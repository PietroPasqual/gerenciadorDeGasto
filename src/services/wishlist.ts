import { supabase } from '@/lib/supabase'
import type { TablesUpdate, WishlistItem } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export async function listarWishlist(): Promise<WishlistItem[]> {
  return (
    unwrap(
      await supabase
        .from('wishlist_items')
        .select('*')
        .order('concluido')
        .order('prioridade', { ascending: false })
        .order('created_at'),
    ) ?? []
  )
}

export async function criarItemWishlist(dados: {
  nome: string
  valor_centavos: number
  prioridade: number
}): Promise<WishlistItem> {
  const user_id = await userIdAtual()
  return unwrap(
    await supabase.from('wishlist_items').insert({ ...dados, user_id }).select().single(),
    'Não foi possível criar o item.',
  )
}

export async function atualizarItemWishlist(
  id: string,
  mudancas: Partial<Pick<WishlistItem, 'nome' | 'valor_centavos' | 'prioridade' | 'concluido'>>,
): Promise<WishlistItem> {
  const payload: TablesUpdate<'wishlist_items'> = { ...mudancas }
  if (mudancas.concluido !== undefined) {
    payload.concluido_em = mudancas.concluido ? new Date().toISOString() : null
  }
  return unwrap(await supabase.from('wishlist_items').update(payload).eq('id', id).select().single())
}

export async function excluirItemWishlist(id: string): Promise<void> {
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id)
  if (error) throw error
}
