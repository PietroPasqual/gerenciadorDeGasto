import { supabase } from '@/lib/supabase'
import type { Transaction, TipoLancamento } from '@/lib/database.types'
import { primeiroDiaISO, ultimoDiaISO } from '@/lib/dates'
import { ErroServico, traduzErro, unwrap, userIdAtual } from './base'

export async function listarLancamentos(ano: number, mes: number, tipo?: TipoLancamento): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .gte('data', primeiroDiaISO({ ano, mes }))
    .lte('data', ultimoDiaISO({ ano, mes }))
    .order('data')
    .order('created_at')
  if (tipo) query = query.eq('tipo', tipo)
  return unwrap(await query) ?? []
}

/** Lançamentos de um ano inteiro — usado na exportação CSV anual. */
export async function listarLancamentosDoAno(ano: number): Promise<Transaction[]> {
  return (
    unwrap(
      await supabase
        .from('transactions')
        .select('*')
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data'),
    ) ?? []
  )
}

export async function criarLancamento(dados: {
  data: string
  descricao: string
  payment_method_id?: string | null
  category_id?: string | null
  valor_centavos: number
  tipo: TipoLancamento
}): Promise<Transaction> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase.from('transactions').insert({ ...dados, user_id }).select().single(),
    'Não foi possível salvar o lançamento.',
  )
}

export async function atualizarLancamento(
  id: string,
  mudancas: Partial<
    Pick<Transaction, 'data' | 'descricao' | 'payment_method_id' | 'category_id' | 'valor_centavos' | 'tipo'>
  >,
): Promise<Transaction> {
  return unwrap(await supabase.from('transactions').update(mudancas).eq('id', id).select().single())
}

export async function excluirLancamento(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

/** Lançamentos de um intervalo qualquer — usado para achar duplicata na importação. */
export async function listarLancamentosPorIntervalo(inicioISO: string, fimISO: string): Promise<Transaction[]> {
  return (
    unwrap(
      await supabase.from('transactions').select('*').gte('data', inicioISO).lte('data', fimISO).order('data'),
    ) ?? []
  )
}

/** Quantos entraram de verdade e quantos o banco já tinha. */
export interface ResultadoImportacao {
  novos: number
  jaExistiam: number
}

/**
 * Grava vários lançamentos de uma vez (importação de CSV).
 *
 * Vai em blocos porque um extrato de cartão passa fácil de mil linhas, e um
 * insert único desse tamanho estoura o limite de corpo da requisição.
 *
 * É upsert e não insert porque a importação precisa ser repetível: se um bloco
 * falhar, os anteriores já entraram, e a única saída do usuário é mandar o
 * arquivo de novo. Com `ignoreDuplicates`, a segunda tentativa completa o que
 * faltou em vez de duplicar o que já estava lá — quem decide é o índice único
 * `(user_id, fingerprint)` da 0008, dentro da transação do Postgres, então nem
 * duas abas ao mesmo tempo conseguem furar.
 *
 * Cada bloco volta só com as linhas realmente inseridas, e é daí que sai a
 * contagem: contar `bloco.length` diria "1273 importados" mesmo quando o banco
 * recusou 1200 deles.
 */
export async function criarLancamentosEmLote(
  lista: Array<{
    data: string
    descricao: string
    payment_method_id?: string | null
    category_id?: string | null
    valor_centavos: number
    tipo: TipoLancamento
    fingerprint?: string | null
  }>,
  aoProgredir?: (processados: number, total: number) => void,
): Promise<ResultadoImportacao> {
  if (lista.length === 0) return { novos: 0, jaExistiam: 0 }
  const user_id = await userIdAtual()
  const TAMANHO_BLOCO = 200

  let novos = 0
  let processados = 0
  for (let i = 0; i < lista.length; i += TAMANHO_BLOCO) {
    const bloco = lista.slice(i, i + TAMANHO_BLOCO).map((l) => ({ ...l, user_id }))
    try {
      const inseridos =
        unwrap(
          await supabase
            .from('transactions')
            .upsert(bloco, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true })
            .select('id'),
          'Não foi possível importar os lançamentos.',
        ) ?? []
      novos += inseridos.length
    } catch (erro) {
      if (novos === 0 && processados === 0) throw erro
      throw new ErroServico(
        `Importação interrompida: ${novos} lançamentos entraram antes do erro. ` +
          'Mandar o mesmo arquivo de novo completa o que faltou, sem duplicar. ' +
          (erro instanceof Error ? erro.message : ''),
        erro,
      )
    }
    processados += bloco.length
    aoProgredir?.(processados, lista.length)
  }
  return { novos, jaExistiam: lista.length - novos }
}

/**
 * Põe a mesma categoria em vários lançamentos de uma vez.
 *
 * Existe para a categorização automática: depois de importar um extrato de um
 * ano, são centenas de linhas para classificar. Uma requisição por linha seria
 * centenas de idas ao servidor; agrupando por categoria são poucas, uma por
 * categoria sugerida.
 */
export async function atualizarCategoriaDeVarios(ids: string[], category_id: string): Promise<number> {
  if (ids.length === 0) return 0
  const TAMANHO_BLOCO = 200
  let alterados = 0
  for (let i = 0; i < ids.length; i += TAMANHO_BLOCO) {
    const bloco = ids.slice(i, i + TAMANHO_BLOCO)
    const { error } = await supabase.from('transactions').update({ category_id }).in('id', bloco)
    if (error) throw traduzErro(error, 'Não foi possível salvar as categorias.')
    alterados += bloco.length
  }
  return alterados
}

/**
 * Põe a mesma forma de pagamento em vários lançamentos de uma vez.
 *
 * Gêmea de `atualizarCategoriaDeVarios`, e pelo mesmo motivo: extrato de banco
 * não traz forma de pagamento, então depois de importar são centenas de linhas
 * sem ela.
 */
export async function atualizarFormaDeVarios(ids: string[], payment_method_id: string): Promise<number> {
  if (ids.length === 0) return 0
  const TAMANHO_BLOCO = 200
  let alterados = 0
  for (let i = 0; i < ids.length; i += TAMANHO_BLOCO) {
    const bloco = ids.slice(i, i + TAMANHO_BLOCO)
    const { error } = await supabase.from('transactions').update({ payment_method_id }).in('id', bloco)
    if (error) throw traduzErro(error, 'Não foi possível salvar as formas de pagamento.')
    alterados += bloco.length
  }
  return alterados
}
