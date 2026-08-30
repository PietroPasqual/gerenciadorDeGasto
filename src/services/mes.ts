import { supabase } from '@/lib/supabase'
import { unwrap } from './base'
import type {
  Category,
  FixedExpense,
  FixedExpensePayment,
  Goal,
  GoalContribution,
  Income,
  Investment,
  PaymentMethod,
  RecurringIncome,
  Transaction,
} from '@/lib/database.types'
import type { FaturaDoMes } from './invoices'

export interface DadosDoMes {
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  metas: Goal[]
  entradas: Income[]
  entradasRecorrentes: RecurringIncome[]
  gastosFixos: FixedExpense[]
  pagamentos: FixedExpensePayment[]
  lancamentos: Transaction[]
  investimentos: Investment[]
  aportes: GoalContribution[]
  faturas: FaturaDoMes[]
  /** Acumulado de cada meta desde sempre, por id — o teto do resgate. */
  saldosMetas: Record<string, number>
}

/**
 * Tudo o que a tela do mês precisa, numa requisição só (função `carregar_mes`,
 * migration 0011).
 *
 * Antes eram dez chamadas em paralelo. Em wi-fi a diferença não aparece; em 4G
 * ruim, cada uma paga a latência inteira e o navegador ainda limita quantas
 * correm de fato — o mês só aparecia quando a mais lenta das dez chegava.
 *
 * A função é SECURITY INVOKER, então a RLS continua valendo exatamente como
 * valia nas dez consultas separadas.
 */
export async function carregarMes(ano: number, mes: number): Promise<DadosDoMes> {
  const bruto = unwrap(
    await supabase.rpc('carregar_mes', { p_ano: ano, p_mes: mes }),
    'Não foi possível carregar o mês.',
  )
  return bruto as unknown as DadosDoMes
}
