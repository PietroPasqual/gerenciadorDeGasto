import { supabase } from '@/lib/supabase'
import type { Transaction, TipoLancamento } from '@/lib/database.types'
import { primeiroDiaISO, ultimoDiaISO } from '@/lib/dates'
import { montarParcelas } from '@/lib/parcelamento'
import type { GastoDaJanela } from '@/lib/assinaturas'
import { ErroServico, traduzErro, unwrap, userIdAtual } from './base'

export async function listarLancamentos(
  ano: number,
  mes: number,
  tipo?: TipoLancamento,
): Promise<Transaction[]> {
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
    await supabase
      .from('transactions')
      .insert({ ...dados, user_id })
      .select()
      .single(),
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
export async function listarLancamentosPorIntervalo(
  inicioISO: string,
  fimISO: string,
): Promise<Transaction[]> {
  return (
    unwrap(
      await supabase
        .from('transactions')
        .select('*')
        .gte('data', inicioISO)
        .lte('data', fimISO)
        .order('data'),
    ) ?? []
  )
}

/**
 * Só os gastos de uma janela larga (tipicamente doze meses) — usada pela
 * detecção de assinatura (6.2) E pelo alerta de gasto atípico (6.6). As duas
 * perguntam a mesma coisa ao banco: "o que foi gasto, em que categoria, nos
 * últimos N meses" — então é a mesma consulta, não duas.
 *
 * Uma consulta própria em vez de reaproveitar `listarLancamentosPorIntervalo`
 * porque a janela é larga: com `select('*')` isso desce a descrição, o
 * fingerprint e o created_at de milhares de linhas para responder uma pergunta
 * que só olha oito campos. O `eq('tipo', 'gasto')` corta o resto no servidor,
 * onde é barato.
 */
export async function listarGastosRecentes(inicioISO: string, fimISO: string): Promise<GastoDaJanela[]> {
  return (
    unwrap(
      await supabase
        .from('transactions')
        .select('id, data, descricao, valor_centavos, tipo, category_id, payment_method_id, parcelamento_id')
        .eq('tipo', 'gasto')
        .gte('data', inicioISO)
        .lte('data', fimISO)
        .order('data'),
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
 * Cria uma compra parcelada: uma linha por parcela, todas amarradas pelo mesmo
 * `parcelamento_id`.
 *
 * São lançamentos de verdade, e não um lançamento só marcado como "parcelado",
 * porque cada parcela precisa cair na fatura do seu mês. O mês que a pessoa
 * abre tem que mostrar o que ela vai pagar naquele mês — não a compra inteira
 * no mês da primeira parcela.
 *
 * A divisão vem de `montarParcelas`, que garante que a soma fecha exatamente
 * com o total (a sobra de centavos vai na primeira parcela).
 */
export async function criarParcelamento(dados: {
  totalCentavos: number
  quantidade: number
  primeiraDataISO: string
  descricao: string
  payment_method_id?: string | null
  category_id?: string | null
}): Promise<Transaction[]> {
  const user_id = await userIdAtual()
  const parcelamento_id = crypto.randomUUID()
  const parcelas = montarParcelas(dados.totalCentavos, dados.quantidade, dados.primeiraDataISO)

  return unwrap(
    await supabase
      .from('transactions')
      .insert(
        parcelas.map((p) => ({
          user_id,
          data: p.data,
          descricao: dados.descricao,
          payment_method_id: dados.payment_method_id ?? null,
          category_id: dados.category_id ?? null,
          valor_centavos: p.valor_centavos,
          tipo: 'gasto' as const,
          parcelamento_id,
          parcela: p.parcela,
          parcelas_total: p.parcelas_total,
        })),
      )
      .select(),
    'Não foi possível salvar a compra parcelada.',
  )
}

/** Todas as parcelas de uma série, em ordem. */
export async function listarParcelas(parcelamento_id: string): Promise<Transaction[]> {
  return (
    unwrap(
      await supabase.from('transactions').select('*').eq('parcelamento_id', parcelamento_id).order('parcela'),
    ) ?? []
  )
}

/**
 * Exclui uma parcela só, ou a série inteira — mesma escolha de um evento
 * recorrente de calendário.
 *
 * Excluir a série toda é uma operação e não N: um delete por parcela deixaria
 * a série pela metade se a rede caísse no meio, e "meia compra parcelada" é um
 * estado que ninguém sabe consertar depois.
 */
export async function excluirSerie(parcelamento_id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('parcelamento_id', parcelamento_id)
  if (error) throw error
}

/**
 * Edita a série inteira. O valor NÃO entra aqui de propósito: mudar o total de
 * uma compra parcelada exige redividir tudo (e a sobra de centavos muda de
 * lugar), então isso é apagar e recriar, não um update.
 */
export async function atualizarSerie(
  parcelamento_id: string,
  mudancas: Partial<Pick<Transaction, 'descricao' | 'payment_method_id' | 'category_id'>>,
): Promise<Transaction[]> {
  return (
    unwrap(
      await supabase
        .from('transactions')
        .update(mudancas)
        .eq('parcelamento_id', parcelamento_id)
        .select()
        .order('parcela'),
    ) ?? []
  )
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
