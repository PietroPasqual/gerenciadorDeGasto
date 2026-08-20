import { supabase } from '@/lib/supabase'
import type { PaymentMethod, TipoPagamento } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export async function listarFormasPagamento(incluirInativas = false): Promise<PaymentMethod[]> {
  let query = supabase.from('payment_methods').select('*').order('ordem').order('nome')
  if (!incluirInativas) query = query.eq('ativo', true)
  return unwrap(await query) ?? []
}

export async function criarFormaPagamento(dados: {
  nome: string
  tipo: TipoPagamento
  ordem?: number
}): Promise<PaymentMethod> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase.from('payment_methods').insert({ ...dados, user_id }).select().single(),
    'Não foi possível criar a forma de pagamento.',
  )
}

export async function atualizarFormaPagamento(
  id: string,
  mudancas: Partial<Pick<PaymentMethod, 'nome' | 'tipo' | 'ativo' | 'ordem'>>,
): Promise<PaymentMethod> {
  return unwrap(await supabase.from('payment_methods').update(mudancas).eq('id', id).select().single())
}

export async function excluirFormaPagamento(id: string): Promise<void> {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id)
  if (error) throw error
}
