import { supabase } from '@/lib/supabase'
import type { FixedExpense, FixedExpensePayment } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

/**
 * A definição do gasto fixo é única, mas vale só dentro da VIGÊNCIA dele:
 * de (inicio_ano, inicio_mes) até (fim_ano, fim_mes), qualquer um dos lados
 * podendo ser nulo para "sem limite". Antes da migration 0005 não havia
 * vigência nenhuma e um aluguel cadastrado em agosto era somado também em
 * janeiro. Quem filtra por mês é o chamador (as funções SQL fazem isso no
 * banco; no cliente é `estaVigente`, em src/lib/calculations.ts).
 *
 * O que muda mês a mês é apenas o "pago?" (tabela fixed_expense_payments).
 */
export async function listarGastosFixos(): Promise<FixedExpense[]> {
  return unwrap(await supabase.from('fixed_expenses').select('*').eq('ativo', true).order('ordem').order('nome')) ?? []
}

export async function criarGastoFixo(dados: {
  nome: string
  payment_method_id?: string | null
  category_id?: string | null
  valor_centavos: number
  dia_vencimento?: number | null
  ordem?: number
  inicio_ano?: number | null
  inicio_mes?: number | null
  fim_ano?: number | null
  fim_mes?: number | null
}): Promise<FixedExpense> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase.from('fixed_expenses').insert({ ...dados, user_id }).select().single(),
    'Não foi possível criar o gasto fixo.',
  )
}

export async function atualizarGastoFixo(
  id: string,
  mudancas: Partial<
    Pick<
      FixedExpense,
      | 'nome'
      | 'payment_method_id'
      | 'category_id'
      | 'valor_centavos'
      | 'dia_vencimento'
      | 'ativo'
      | 'ordem'
      | 'inicio_ano'
      | 'inicio_mes'
      | 'fim_ano'
      | 'fim_mes'
    >
  >,
): Promise<FixedExpense> {
  return unwrap(await supabase.from('fixed_expenses').update(mudancas).eq('id', id).select().single())
}

export async function excluirGastoFixo(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
  if (error) throw error
}

export async function listarPagamentosDoMes(ano: number, mes: number): Promise<FixedExpensePayment[]> {
  return unwrap(await supabase.from('fixed_expense_payments').select('*').eq('ano', ano).eq('mes', mes)) ?? []
}

/** Marca/desmarca o "pago?" de um gasto fixo em um mês (upsert na chave única). */
export async function marcarPagamento(dados: {
  fixed_expense_id: string
  ano: number
  mes: number
  pago: boolean
}): Promise<FixedExpensePayment> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('fixed_expense_payments')
      .upsert(
        {
          ...dados,
          user_id,
          pago_em: dados.pago ? new Date().toISOString() : null,
        },
        { onConflict: 'fixed_expense_id,ano,mes' },
      )
      .select()
      .single(),
    'Não foi possível atualizar o pagamento.',
  )
}
