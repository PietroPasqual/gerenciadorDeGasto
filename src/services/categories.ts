import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export async function listarCategorias(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select('*').order('ordem').order('nome')) ?? []
}

export async function criarCategoria(dados: {
  nome: string
  limite_centavos?: number | null
  cor?: string
  ordem?: number
}): Promise<Category> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase.from('categories').insert({ ...dados, user_id }).select().single(),
    'Não foi possível criar a categoria.',
  )
}

export async function atualizarCategoria(
  id: string,
  mudancas: Partial<Pick<Category, 'nome' | 'limite_centavos' | 'cor' | 'ordem'>>,
): Promise<Category> {
  return unwrap(await supabase.from('categories').update(mudancas).eq('id', id).select().single())
}

export async function excluirCategoria(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
