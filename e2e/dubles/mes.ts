// Dublê de src/services/mes.ts.
import { doFixture } from './fixture'

export async function carregarMes(...args: unknown[]) {
  return doFixture('mes.carregarMes', args)
}
