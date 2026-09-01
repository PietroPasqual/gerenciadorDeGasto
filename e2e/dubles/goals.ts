// Dublê gerado dos exports reais de src/services/goals.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export const MAX_METAS = 10
export async function listarMetas(...args: unknown[]) {
  return doFixture('goals.listarMetas', args)
}
export async function criarMeta(...args: unknown[]) {
  return doFixture('goals.criarMeta', args)
}
export async function atualizarMeta(...args: unknown[]) {
  return doFixture('goals.atualizarMeta', args)
}
export async function excluirMeta(...args: unknown[]) {
  return doFixture('goals.excluirMeta', args)
}
export async function listarAportesDoAno(...args: unknown[]) {
  return doFixture('goals.listarAportesDoAno', args)
}
export async function listarAportesDoMes(...args: unknown[]) {
  return doFixture('goals.listarAportesDoMes', args)
}
export async function salvarAporte(...args: unknown[]) {
  return doFixture('goals.salvarAporte', args)
}
export async function resgatarDaMeta(...args: unknown[]) {
  return doFixture('goals.resgatarDaMeta', args)
}
export async function transferirEntreMetas(...args: unknown[]) {
  return doFixture('goals.transferirEntreMetas', args)
}
