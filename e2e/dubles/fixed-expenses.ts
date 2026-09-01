// Dublê gerado dos exports reais de src/services/fixed-expenses.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarGastosFixos(...args: unknown[]) {
  return doFixture('fixed-expenses.listarGastosFixos', args)
}
export async function criarGastoFixo(...args: unknown[]) {
  return doFixture('fixed-expenses.criarGastoFixo', args)
}
export async function atualizarGastoFixo(...args: unknown[]) {
  return doFixture('fixed-expenses.atualizarGastoFixo', args)
}
export async function excluirGastoFixo(...args: unknown[]) {
  return doFixture('fixed-expenses.excluirGastoFixo', args)
}
export async function listarPagamentosDoMes(...args: unknown[]) {
  return doFixture('fixed-expenses.listarPagamentosDoMes', args)
}
export async function marcarPagamento(...args: unknown[]) {
  return doFixture('fixed-expenses.marcarPagamento', args)
}
