// Dublê gerado dos exports reais de src/services/investments.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarInvestimentos(...args: unknown[]) {
  return doFixture('investments.listarInvestimentos', args)
}
export async function criarInvestimento(...args: unknown[]) {
  return doFixture('investments.criarInvestimento', args)
}
export async function atualizarInvestimento(...args: unknown[]) {
  return doFixture('investments.atualizarInvestimento', args)
}
export async function excluirInvestimento(...args: unknown[]) {
  return doFixture('investments.excluirInvestimento', args)
}
