// Dublê gerado dos exports reais de src/services/wishlist.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarWishlist(...args: unknown[]) {
  return doFixture('wishlist.listarWishlist', args)
}
export async function criarItemWishlist(...args: unknown[]) {
  return doFixture('wishlist.criarItemWishlist', args)
}
export async function atualizarItemWishlist(...args: unknown[]) {
  return doFixture('wishlist.atualizarItemWishlist', args)
}
export async function excluirItemWishlist(...args: unknown[]) {
  return doFixture('wishlist.excluirItemWishlist', args)
}
