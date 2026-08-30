/**
 * Dublê de `virtual:pwa-register`.
 *
 * O E2E roda sem service worker de propósito: um SW cacheando entre specs faria
 * um teste ver o app do teste anterior, e esse é o tipo de flakiness que faz
 * gente parar de confiar na suíte.
 */
export function registerSW(_opcoes?: { onNeedRefresh?: () => void; onOfflineReady?: () => void }) {
  return async (_recarregar?: boolean) => {}
}
