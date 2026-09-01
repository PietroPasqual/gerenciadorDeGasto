// Dublê gerado dos exports reais de src/services/invoices.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarFaturasDoMes(...args: unknown[]) {
  return doFixture('invoices.listarFaturasDoMes', args)
}
export async function definirFaturaPaga(...args: unknown[]) {
  return doFixture('invoices.definirFaturaPaga', args)
}
