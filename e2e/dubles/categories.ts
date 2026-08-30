// Dublê gerado dos exports reais de src/services/categories.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarCategorias(...args: unknown[]) {
  return doFixture('categories.listarCategorias', args)
}
export async function criarCategoria(...args: unknown[]) {
  return doFixture('categories.criarCategoria', args)
}
export async function atualizarCategoria(...args: unknown[]) {
  return doFixture('categories.atualizarCategoria', args)
}
export async function excluirCategoria(...args: unknown[]) {
  return doFixture('categories.excluirCategoria', args)
}
