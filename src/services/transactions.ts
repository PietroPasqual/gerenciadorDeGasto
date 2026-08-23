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

/**
 * Grava vários lançamentos de uma vez (importação de CSV).
 *
 * Vai em blocos porque um extrato de cartão passa fácil de mil linhas, e um
 * insert único desse tamanho estoura o limite de corpo da requisição. Cada
 * bloco é uma transação do lado do Postgres: se um bloco falhar, os anteriores
 * já entraram — por isso a função devolve quantos entraram, para a tela poder
 * dizer a verdade em vez de "não importou nada".
 */
export async function criarLancamentosEmLote(
  lista: Array<{
    data: string
    descricao: string
    payment_method_id?: string | null
    category_id?: string | null
    valor_centavos: number
    tipo: TipoLancamento
  }>,
  aoProgredir?: (gravados: number, total: number) => void,
): Promise<number> {
  if (lista.length === 0) return 0
  const user_id = await userIdAtual()
  const TAMANHO_BLOCO = 200

  let gravados = 0
  for (let i = 0; i < lista.length; i += TAMANHO_BLOCO) {
    const bloco = lista.slice(i, i + TAMANHO_BLOCO).map((l) => ({ ...l, user_id }))
    try {
      unwrap(await supabase.from('transactions').insert(bloco), 'Não foi possível importar os lançamentos.')
    } catch (erro) {
      if (gravados === 0) throw erro
      throw new ErroServico(
        `Importação interrompida: ${gravados} lançamentos entraram antes do erro. ${
          erro instanceof Error ? erro.message : ''
        }`.trim(),
        erro,
      )
    }
    gravados += bloco.length
    aoProgredir?.(gravados, lista.length)
  }
  return gravados
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
