import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { traduzErro, unwrap, userIdAtual } from './base'
import {
  TABELAS_BACKUP,
  aplicarRemapa,
  montarBackup,
  perfilParaRestaurar,
  prepararRestauracao,
  type Backup,
  type Linha,
  type Plano,
  type Remapa,
  type TabelaBackup,
} from '@/lib/backup'

/**
 * Blocos de 500 na gravação.
 *
 * O mesmo motivo da importação de CSV (0008): um extrato de um ano passa de
 * mil linhas com folga, e um insert único desse tamanho estoura o limite de
 * corpo da requisição do PostgREST.
 */
const TAMANHO_DO_BLOCO = 500

/**
 * O `from()` do supabase-js é tipado por tabela, e aqui a tabela só se conhece
 * em tempo de execução — não existe tipo estático que cubra as treze formas na
 * mesma chamada. O afrouxamento fica preso a esta função, e quem valida de
 * verdade continua sendo o banco: coluna que não existe derruba o insert, e a
 * RLS recusa linha de outro dono.
 */
interface EscritaSemTipo {
  upsert: (
    linhas: Linha[],
    opcoes: { onConflict: string; ignoreDuplicates: boolean },
  ) => {
    select: (
      colunas: string,
    ) => PromiseLike<{ data: Array<{ id: string }> | null; error: PostgrestError | null }>
  }
}

function escreverEm(tabela: TabelaBackup): EscritaSemTipo {
  return supabase.from(tabela) as unknown as EscritaSemTipo
}

async function lerTabela(tabela: TabelaBackup, userId: string): Promise<Linha[]> {
  // O filtro por user_id é redundante com a RLS, e fica de propósito: é a
  // mesma dobra de segurança dos agregados. Um `select *` sem filtro num
  // arquivo que a pessoa vai levar embora é a leitura mais perigosa do app.
  const { data, error } = await supabase.from(tabela).select('*').eq('user_id', userId)
  if (error) throw traduzErro(error, `Não foi possível ler ${tabela}.`)
  return (data ?? []) as Linha[]
}

/**
 * Tudo o que é seu, num objeto só.
 *
 * O prefixo `obter` não é enfeite: o dublê do E2E decide pelo NOME se a função
 * é leitura, e leitura sem fixture tem de estourar em vez de devolver `{}`.
 * Uma leitura batizada de `exportarTudo` passava por escrita e devolvia objeto
 * vazio — a tela quebrava longe da causa, que é exatamente o que o dublê
 * existe para impedir.
 */
export async function obterBackupCompleto(): Promise<Backup> {
  const userId = await userIdAtual()

  const listas = await Promise.all(TABELAS_BACKUP.map((t) => lerTabela(t, userId)))
  const dados: Backup['dados'] = {}
  TABELAS_BACKUP.forEach((tabela, i) => {
    dados[tabela] = listas[i]
  })

  const { data: perfil } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  return montarBackup(dados, {
    origem: { userId, nome: (perfil as Linha | null)?.nome as string | undefined },
    perfil: (perfil as Linha | null) ?? undefined,
  })
}

export interface ResultadoRestauracao {
  gravadas: number
  /** Quantas precisaram de id novo por colisão com outra conta do mesmo banco. */
  renomeadas: number
  perfilRestaurado: boolean
}

/**
 * Grava o plano.
 *
 * `ignoreDuplicates` na chave primária é a última linha de defesa: o plano já
 * tirou o que existe, mas entre montar o plano e gravar cabe outra aba
 * gravando a mesma coisa. Quem decide de verdade é o índice, dentro da
 * transação do Postgres.
 *
 * A ordem das tabelas vem do plano, que a herda de TABELAS_BACKUP — quem é
 * apontado entra antes de quem aponta.
 */
export async function restaurar(
  plano: Plano,
  opcoes: { perfil?: Linha | null } = {},
): Promise<ResultadoRestauracao> {
  const userId = await userIdAtual()
  const mapa: Remapa = new Map()
  let gravadas = 0
  let renomeadas = 0

  for (const item of plano.itens) {
    // As referências primeiro: os pais desta tabela já foram processados, e se
    // algum deles trocou de id o filho precisa apontar para o id novo.
    const linhas = item.linhas.map((l) => aplicarRemapa(l, item.tabela, mapa))

    for (let i = 0; i < linhas.length; i += TAMANHO_DO_BLOCO) {
      const bloco = linhas.slice(i, i + TAMANHO_DO_BLOCO)
      const entraram = await inserir(item, bloco)
      gravadas += entraram.size

      /**
       * O que não entrou tem o id ocupado por uma linha que a RLS esconde —
       * ou seja, de OUTRA conta neste mesmo banco. Sem esta segunda passada a
       * restauração numa segunda conta grava zero e não diz nada.
       *
       * O id novo é sorteado e anotado no mapa, para os filhos desta linha
       * (processados depois) apontarem para o lugar certo.
       */
      const perdidas = bloco.filter((l) => !entraram.has(String(l.id)))
      if (perdidas.length === 0) continue

      const comIdNovo = perdidas.map((l) => {
        const novo = crypto.randomUUID()
        mapa.set(String(l.id), novo)
        return { ...l, id: novo }
      })
      const segunda = await inserir(item, comIdNovo)
      gravadas += segunda.size
      renomeadas += segunda.size
    }
  }

  const perfil = perfilParaRestaurar(opcoes.perfil ?? undefined)
  if (perfil) {
    unwrap(
      await supabase
        .from('profiles')
        .update(perfil as never)
        .eq('id', userId)
        .select()
        .single(),
      'Não foi possível restaurar as configurações do perfil.',
    )
  }

  return { gravadas, renomeadas, perfilRestaurado: perfil !== null }
}

/** Insere um bloco e devolve os ids que realmente entraram. */
async function inserir(item: Plano['itens'][number], bloco: Linha[]): Promise<Set<string>> {
  if (bloco.length === 0) return new Set()
  const { data, error } = await escreverEm(item.tabela)
    .upsert(bloco, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
  if (error) throw traduzErro(error, `Não foi possível restaurar ${item.rotulo}.`)
  return new Set((data ?? []).map((l) => String(l.id)))
}

/**
 * O que vai entrar, decidido contra o que o app tem AGORA.
 *
 * A leitura do estado atual acontece aqui, e não quando a tela abriu: entre
 * abrir as Configurações e escolher o arquivo cabe uma importação de CSV
 * noutra aba, e um plano montado sobre dado velho prometeria linhas que já
 * existem.
 *
 * Fica no serviço, e não no componente, porque só ele precisa saber quem está
 * logado — a decisão em si é a função pura `prepararRestauracao`.
 */
export async function obterPlanoDeRestauracao(backup: Backup): Promise<Plano> {
  const userId = await userIdAtual()
  const listas = await Promise.all(TABELAS_BACKUP.map((t) => lerTabela(t, userId)))
  const existentes: Partial<Record<TabelaBackup, Linha[]>> = {}
  TABELAS_BACKUP.forEach((tabela, i) => {
    existentes[tabela] = listas[i]
  })
  return prepararRestauracao({ backup, existentes, userId })
}
