import { lazy } from 'react'

/**
 * As seis páginas de dentro do app entram por import dinâmico: cada uma vira um
 * arquivo .js à parte, que só desce quando a rota abre. Quem sai da primeira
 * carga, junto com elas, é o recharts — 164 kB gzip que só /painel, /mes e
 * /comparativo usam.
 *
 * A landing, o login e o cadastro continuam estáticos DE PROPÓSITO: são a
 * primeira tela de quem chega, e um import dinâmico ali poria uma ida ao
 * servidor na frente do primeiro pixel.
 */
const importar = {
  '/painel': () => import('@/features/dashboard/dashboard-page'),
  '/mes': () => import('@/features/monthly/controle-mensal-page'),
  '/comparativo': () => import('@/features/annual/comparativo-anual-page'),
  '/metas': () => import('@/features/goals/metas-page'),
  '/configuracoes': () => import('@/features/settings/configuracoes-page'),
  '/ajuda': () => import('@/features/help/ajuda-page'),
}

/** Os caminhos que dependem de um pedaço baixado à parte. */
export const ROTAS_PREGUICOSAS = Object.keys(importar)

export const DashboardPage = lazy(() => importar['/painel']().then((m) => ({ default: m.DashboardPage })))
export const ControleMensalPage = lazy(() =>
  importar['/mes']().then((m) => ({ default: m.ControleMensalPage })),
)
export const ComparativoAnualPage = lazy(() =>
  importar['/comparativo']().then((m) => ({ default: m.ComparativoAnualPage })),
)
export const MetasPage = lazy(() => importar['/metas']().then((m) => ({ default: m.MetasPage })))
export const ConfiguracoesPage = lazy(() =>
  importar['/configuracoes']().then((m) => ({ default: m.ConfiguracoesPage })),
)
export const AjudaPage = lazy(() => importar['/ajuda']().then((m) => ({ default: m.AjudaPage })))

let jaAqueceu = false

/**
 * Baixa os seis pedaços de uma vez, quando o navegador estiver ocioso.
 *
 * Sem isto o lazy trocaria um problema por outro. A sessão é conferida no
 * servidor ANTES de a rota protegida montar (`inicializar` espera o perfil),
 * então o download do pedaço só começaria depois dessa ida — duas esperas em
 * fila, onde antes havia uma. Aquecendo desde a montagem, o download corre AO
 * LADO da conferência de sessão e o arquivo quase sempre já está no cache
 * quando a rota enfim monta.
 *
 * O `timeout` existe porque uma aba ocupada pode nunca ficar ociosa; passado
 * um segundo, o navegador roda assim mesmo.
 */
export function aquecerPaginas() {
  if (jaAqueceu) return
  jaAqueceu = true

  const puxar = () => {
    // O erro aqui não é problema: se a rede falhar, o import de novo na hora de
    // abrir a rota tenta outra vez, e aí sim o Suspense mostra o estado certo.
    for (const carregar of Object.values(importar)) carregar().catch(() => {})
  }

  if ('requestIdleCallback' in window) window.requestIdleCallback(puxar, { timeout: 1000 })
  else setTimeout(puxar, 200)
}
