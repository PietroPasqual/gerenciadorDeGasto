// Dublê gerado dos exports reais de src/services/incomes.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarEntradas(...args: unknown[]) {
  return doFixture('incomes.listarEntradas', args)
}
export async function criarEntrada(...args: unknown[]) {
  return doFixture('incomes.criarEntrada', args)
}
export async function atualizarEntrada(...args: unknown[]) {
  return doFixture('incomes.atualizarEntrada', args)
}
export async function excluirEntrada(...args: unknown[]) {
  return doFixture('incomes.excluirEntrada', args)
}
