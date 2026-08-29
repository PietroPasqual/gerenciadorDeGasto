import { supabase } from '@/lib/supabase'
import type { Income } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export async function listarEntradas(ano: number, mes: number): Promise<Income[]> {
  return (
    unwrap(await supabase.from('incomes').select('*').eq('ano', ano).eq('mes', mes).order('created_at')) ?? []
  )
}

export async function criarEntrada(dados: {
  ano: number
  mes: number
  descricao: string
  valor_centavos: number
}): Promise<Income> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase
      .from('incomes')
      .insert({ ...dados, user_id })
      .select()
      .single(),
    'Não foi possível salvar a entrada.',
  )
}

export async function atualizarEntrada(
  id: string,
  mudancas: Partial<Pick<Income, 'descricao' | 'valor_centavos'>>,
): Promise<Income> {
  return unwrap(await supabase.from('incomes').update(mudancas).eq('id', id).select().single())
}

export async function excluirEntrada(id: string): Promise<void> {
  const { error } = await supabase.from('incomes').delete().eq('id', id)
  if (error) throw error
}
