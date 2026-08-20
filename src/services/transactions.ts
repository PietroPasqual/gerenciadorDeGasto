import { supabase } from '@/lib/supabase'
import type { Transaction, TipoLancamento } from '@/lib/database.types'
import { primeiroDiaISO, ultimoDiaISO } from '@/lib/dates'
import { unwrap, userIdAtual } from './base'

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
