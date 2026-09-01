// Dublê gerado dos exports reais de src/services/backup.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function obterBackupCompleto(...args: unknown[]) {
  return doFixture('backup.obterBackupCompleto', args)
}
export async function restaurar(...args: unknown[]) {
  return doFixture('backup.restaurar', args)
}
export async function obterPlanoDeRestauracao(...args: unknown[]) {
  return doFixture('backup.obterPlanoDeRestauracao', args)
}
