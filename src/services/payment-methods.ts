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
    await supabase
      .from('payment_methods')
      .insert({ ...dados, user_id })
      .select()
      .single(),
    'Não foi possível criar a forma de pagamento.',
  )
}

/**
 * Atualiza a forma de pagamento, incluindo a configuração de fatura.
 *
 * `fatura_inicio_ano/mes` é a vigência da 0009: enquanto for nulo, o cartão não
 * tem fatura nenhuma e todo gasto dele conta no mês da compra, como sempre
 * contou. Preencher é uma decisão explícita do usuário — é isso que impede a
 * 0009 de reescrever sozinha o histórico (regra 8).
 */
export async function atualizarFormaPagamento(
  id: string,
  mudancas: Partial<
    Pick<
      PaymentMethod,
      | 'nome'
      | 'tipo'
      | 'ativo'
      | 'ordem'
      | 'dia_fechamento'
      | 'dia_vencimento'
      | 'fatura_inicio_ano'
      | 'fatura_inicio_mes'
    >
  >,
): Promise<PaymentMethod> {
  return unwrap(await supabase.from('payment_methods').update(mudancas).eq('id', id).select().single())
}

export async function excluirFormaPagamento(id: string): Promise<void> {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id)
  if (error) throw error
}
