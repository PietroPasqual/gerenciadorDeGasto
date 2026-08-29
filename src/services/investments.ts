import { supabase } from '@/lib/supabase'
import type { Investment } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

/**
 * `investments` guarda os aportes SEM meta (avulsos).
 * Aportes ligados a uma meta ficam em `goal_contributions` (ver services/goals.ts),
 * assim nada é contado duas vezes no total investido do mês.
 */
export async function listarInvestimentos(ano: number, mes: number): Promise<Investment[]> {
  return (
    unwrap(
      await supabase.from('investments').select('*').eq('ano', ano).eq('mes', mes).order('created_at'),
    ) ?? []
  )
}

export async function criarInvestimento(dados: {
  ano: number
  mes: number
  descricao: string
  valor_centavos: number
  goal_id?: string | null
}): Promise<Investment> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('investments')
      .insert({ ...dados, user_id })
      .select()
      .single(),
    'Não foi possível salvar o investimento.',
  )
}

export async function atualizarInvestimento(
  id: string,
  mudancas: Partial<Pick<Investment, 'descricao' | 'valor_centavos' | 'goal_id'>>,
): Promise<Investment> {
  return unwrap(await supabase.from('investments').update(mudancas).eq('id', id).select().single())
}

export async function excluirInvestimento(id: string): Promise<void> {
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) throw error
}
