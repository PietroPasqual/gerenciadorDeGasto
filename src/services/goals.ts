import { supabase } from '@/lib/supabase'
import type { Goal, GoalContribution } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export const MAX_METAS = 10

export async function listarMetas(): Promise<Goal[]> {
  return unwrap(await supabase.from('goals').select('*').order('ordem').order('created_at')) ?? []
}

export async function criarMeta(dados: {
  nome: string
  valor_meta_centavos: number
  ordem?: number
}): Promise<Goal> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('goals')
      .insert({ ...dados, user_id })
      .select()
      .single(),
    'Não foi possível criar a meta.',
  )
}

export async function atualizarMeta(
  id: string,
  mudancas: Partial<Pick<Goal, 'nome' | 'valor_meta_centavos' | 'ordem'>>,
): Promise<Goal> {
  return unwrap(await supabase.from('goals').update(mudancas).eq('id', id).select().single())
}

export async function excluirMeta(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

/** Aportes de um ano inteiro (grid da tela de Metas). */
export async function listarAportesDoAno(ano: number): Promise<GoalContribution[]> {
  return unwrap(await supabase.from('goal_contributions').select('*').eq('ano', ano)) ?? []
}

/** Aportes de um mês (tela de controle mensal). */
export async function listarAportesDoMes(ano: number, mes: number): Promise<GoalContribution[]> {
  return unwrap(await supabase.from('goal_contributions').select('*').eq('ano', ano).eq('mes', mes)) ?? []
}

/**
 * Grava o aporte de uma meta em um mês.
 * Upsert pela chave única (goal_id, ano, mes) — a mesma célula é editada
 * tanto pelo controle mensal quanto pelo grid da tela de Metas.
 */
export async function salvarAporte(dados: {
  goal_id: string
  ano: number
  mes: number
  valor_centavos: number
}): Promise<GoalContribution> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('goal_contributions')
      .upsert({ ...dados, user_id }, { onConflict: 'goal_id,ano,mes' })
      .select()
      .single(),
    'Não foi possível salvar o aporte.',
  )
}

/**
 * Tira dinheiro de uma meta.
 *
 * O valor entra como movimento NEGATIVO na célula do mês, somado ao que já
 * estiver lá — guardar R$ 500 e resgatar R$ 200 no mesmo mês termina em
 * R$ 300, não em -R$ 200. Por isso é uma função no banco e não um update
 * daqui: ler o valor atual, subtrair e gravar deixaria duas abas abertas
 * sobrescrevendo uma à outra.
 *
 * O banco recusa resgate maior do que a meta tem guardado (trigger da 0013).
 */
export async function resgatarDaMeta(
  goal_id: string,
  ano: number,
  mes: number,
  centavos: number,
): Promise<void> {
  unwrap(
    await supabase.rpc('resgatar_de_meta', {
      p_goal_id: goal_id,
      p_ano: ano,
      p_mes: mes,
      p_centavos: centavos,
    }),
    'Não foi possível resgatar da meta.',
  )
}

/**
 * Move dinheiro de uma meta para outra, no mesmo mês.
 *
 * Uma chamada só porque os dois lados precisam ser uma transação: feito em
 * duas, uma falha no meio tira da origem e não põe no destino — dinheiro que
 * some sem nada na tela dizendo o que houve.
 *
 * O total investido do mês não muda: sai de uma e entra na outra.
 */
export async function transferirEntreMetas(
  origem: string,
  destino: string,
  ano: number,
  mes: number,
  centavos: number,
): Promise<void> {
  unwrap(
    await supabase.rpc('transferir_entre_metas', {
      p_origem: origem,
      p_destino: destino,
      p_ano: ano,
      p_mes: mes,
      p_centavos: centavos,
    }),
    'Não foi possível transferir entre as metas.',
  )
}
