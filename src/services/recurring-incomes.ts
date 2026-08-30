import { supabase } from '@/lib/supabase'
import type { RecurringIncome } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

/**
 * Entrada que se repete todo mês — o salário.
 *
 * É a `fixed_expenses` do outro lado do sinal, e de propósito: mesma vigência,
 * mesma função `fixo_vigente` decidindo em que meses conta. Uma segunda regra
 * de vigência daria margem para as duas divergirem num caso de borda.
 *
 * O `fim` encerra sem apagar: quem troca de emprego encerra o salário antigo no
 * último mês em que o recebeu, e os meses anteriores continuam mostrando o
 * valor certo. Excluir a linha reescreveria o passado.
 */
export async function listarEntradasRecorrentes(): Promise<RecurringIncome[]> {
  return (
    unwrap(
      await supabase
        .from('recurring_incomes')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
        .order('descricao'),
    ) ?? []
  )
}

export async function criarEntradaRecorrente(dados: {
  descricao: string
  valor_centavos: number
  dia_recebimento?: number | null
  ordem?: number
  inicio_ano?: number | null
  inicio_mes?: number | null
  fim_ano?: number | null
  fim_mes?: number | null
}): Promise<RecurringIncome> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('recurring_incomes')
      .insert({ ...dados, user_id })
      .select()
      .single(),
    'Não foi possível criar a entrada recorrente.',
  )
}

export async function atualizarEntradaRecorrente(
  id: string,
  mudancas: Partial<
    Pick<
      RecurringIncome,
      | 'descricao'
      | 'valor_centavos'
      | 'dia_recebimento'
      | 'ativo'
      | 'ordem'
      | 'inicio_ano'
      | 'inicio_mes'
      | 'fim_ano'
      | 'fim_mes'
    >
  >,
): Promise<RecurringIncome> {
  return unwrap(await supabase.from('recurring_incomes').update(mudancas).eq('id', id).select().single())
}

export async function excluirEntradaRecorrente(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_incomes').delete().eq('id', id)
  if (error) throw error
}
