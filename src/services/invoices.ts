import { supabase } from '@/lib/supabase'
import { unwrap, userIdAtual } from './base'

/** Uma fatura que pesa num mês. Espelha o retorno de `faturas_do_mes` (0009). */
export interface FaturaDoMes {
  payment_method_id: string
  nome: string
  dia_fechamento: number
  dia_vencimento: number | null
  total_centavos: number
  paga: boolean
  pago_em: string | null
  /** As bordas reais das compras que entraram — úteis para explicar o período. */
  primeira_compra: string
  ultima_compra: string
}

export async function listarFaturasDoMes(ano: number, mes: number): Promise<FaturaDoMes[]> {
  return unwrap(await supabase.rpc('faturas_do_mes', { p_ano: ano, p_mes: mes })) ?? []
}

/**
 * Marca (ou desmarca) a fatura como paga.
 *
 * `upsert` porque a linha de pagamento só nasce quando alguém marca: guardar
 * uma linha "não paga" para cada cartão e cada mês desde sempre encheria a
 * tabela de nada. Mesmo formato de `fixed_expense_payments`.
 */
export async function definirFaturaPaga(
  payment_method_id: string,
  ano: number,
  mes: number,
  pago: boolean,
): Promise<void> {
  const user_id = await userIdAtual()
  unwrap(
    await supabase.from('invoice_payments').upsert(
      {
        user_id,
        payment_method_id,
        ano,
        mes,
        pago,
        pago_em: pago ? new Date().toISOString() : null,
      },
      { onConflict: 'payment_method_id,ano,mes' },
    ),
    'Não foi possível salvar o pagamento da fatura.',
  )
}
