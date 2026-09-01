import { readFileSync } from 'node:fs'
import {
  test,
  expect,
  appCompleto,
  assinaturasPadrao,
  mesPadrao,
  prepararApp,
  relatoriosPadrao,
} from './fixtures/base'
import type { Page } from '@playwright/test'

/**
 * Acessibilidade medida NO NAVEGADOR, e não em jsdom.
 *
 * Existe porque a varredura de `src/test/a11y/paginas.test.tsx` afirmava
 * cobrir contraste e não cobria: o axe precisa de layout pintado para compor
 * cor de texto com cor de fundo, e em jsdom ele devolve a regra como
 * `incomplete` — categoria que aquele teste ignora. Um parágrafo #eeeeee sobre
 * #ffffff passava limpo por lá.
 *
 * Não substitui a suíte de jsdom: aquela é rápida e roda em `npm run test`,
 * pegando rótulo ausente, papel errado e ordem de cabeçalho a cada salvamento.
 * Esta pega a classe que só existe depois do paint.
 */

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

/**
 * As telas PÚBLICAS — landing, login e cadastro. Ficam à parte porque não têm
 * sessão, e por isso o `prepararApp` delas é diferente. Entraram junto com a
 * fase 2: uma tela recém-reescrita fora da varredura é o mesmo vão que deixou
 * /ajuda com alvos de 23px.
 */
const ROTAS_PUBLICAS = ['/', '/entrar', '/criar-conta']

/** Todas as telas de dentro do app. A ajuda entra: era o vão de cobertura. */
const ROTAS = [
  '/painel',
  '/mes?aba=resumo',
  '/mes?aba=gastos',
  '/mes?aba=fixos',
  '/metas',
  '/comparativo',
  '/configuracoes',
  '/ajuda',
]

const TEMAS = ['rosa', 'azul', 'verde', 'roxo'] as const

interface No {
  html: string
  alvo: string
  resumo: string
}
interface Violacao {
  id: string
  impacto: string
  nos: No[]
}

/**
 * Abre a rota com tema e modo escolhidos, já sem animação em voo.
 *
 * `reducedMotion: 'reduce'` não é só para ir mais rápido: a animação de
 * entrada passa por opacidades intermediárias, e medir contraste no meio dela
 * produz número pior e FALSO. O app já tem a regra global de reduced motion,
 * então aqui o estado final aparece de imediato.
 */
async function abrir(page: Page, rota: string, tema: string, escuro: boolean, logado = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await prepararApp(page, { ...appCompleto(), ...assinaturasPadrao() }, { logado })
  await page.addInitScript(
    ([t, e]) =>
      localStorage.setItem('gdg-tema', JSON.stringify({ state: { tema: t, escuro: e }, version: 0 })),
    [tema, escuro] as const,
  )
  await page.goto(rota)
  await page.getByRole('heading').first().waitFor()
  // Um quadro para o layout assentar depois do heading aparecer.
  await page.waitForTimeout(250)

  /**
   * Onde há gráfico, ESPERAR AS FATIAS.
   *
   * O recharts anima por requestAnimationFrame, que a regra global de reduced
   * motion não alcança: as fatias levam ~500 ms para existir. A primeira
   * versão desta varredura corria o axe aos 250 ms, quando o donut ainda
   * estava vazio — e a regra `svg-img-alt` sumia do relatório sem ter sido
   * corrigida. Um teste que passa por não ter olhado é pior que teste nenhum.
   */
  if (await page.locator('svg.recharts-surface').count()) {
    await page
      .locator('.recharts-sector, .recharts-layer path')
      .first()
      .waitFor({ timeout: 5000 })
      .catch(() => {
        // Gráfico legitimamente vazio (mês sem dado): segue sem fatia.
      })
  }
}

async function rodarAxe(page: Page, regras?: string[]): Promise<Violacao[]> {
  await page.addScriptTag({ content: AXE })
  return page.evaluate(async (somente) => {
    const opcoes = somente ? { runOnly: somente } : { runOnly: ['wcag2a', 'wcag2aa', 'wcag22aa'] as string[] }
    // @ts-expect-error axe é injetado no navegador
    const r = await window.axe.run(document, opcoes)
    return r.violations.map((v: never) => {
      const viol = v as {
        id: string
        impact: string
        nodes: Array<{ html: string; target: string[]; any: Array<{ message: string }> }>
      }
      return {
        id: viol.id,
        impacto: viol.impact,
        nos: viol.nodes.slice(0, 5).map((n) => ({
          html: n.html.slice(0, 120),
          alvo: n.target.join(' '),
          resumo: n.any[0]?.message ?? '',
        })),
      }
    })
  }, regras)
}

function relatar(rota: string, contexto: string, violacoes: Violacao[]): string {
  return violacoes
    .map(
      (v) =>
        `\n[${v.impacto}] ${v.id} — ${rota} (${contexto})\n` +
        v.nos.map((n) => `   ${n.alvo}\n     ${n.html}\n     ${n.resumo}`).join('\n'),
    )
    .join('\n')
}

test.describe('acessibilidade no navegador', () => {
  for (const rota of ROTAS) {
    test(`sem violações de axe em ${rota}`, async ({ page }) => {
      const problemas: string[] = []
      for (const escuro of [false, true]) {
        await abrir(page, rota, 'rosa', escuro)
        const v = await rodarAxe(page)
        if (v.length) problemas.push(relatar(rota, escuro ? 'escuro' : 'claro', v))
      }
      expect(problemas.join('\n'), 'axe encontrou violações').toBe('')
    })
  }

  for (const rota of ROTAS_PUBLICAS) {
    test(`sem violações de axe em ${rota} (pública)`, async ({ page }) => {
      const problemas: string[] = []
      for (const escuro of [false, true]) {
        await abrir(page, rota, 'rosa', escuro, false)
        const v = await rodarAxe(page)
        if (v.length) problemas.push(relatar(rota, escuro ? 'escuro' : 'claro', v))
      }
      expect(problemas.join('\n'), 'axe encontrou violações').toBe('')
    })
  }

  /**
   * As linhas INATIVAS — gasto fixo fora de vigência, entrada recorrente
   * encerrada.
   *
   * Estado próprio porque a fixture padrão não o produz, e foi nesse vão que
   * três `opacity-55`/`opacity-70` sobreviveram: derrubavam o texto para
   * 2,31:1 no claro e 2,95:1 no escuro, contra o mínimo de 4,5:1. Opacidade
   * multiplica o texto junto com o fundo e passa por fora da calibração do
   * themes.css — a mesma armadilha do comparativo anual.
   */
  test('contraste nas linhas inativas', async ({ page }) => {
    const base = mesPadrao()
    const fixture = {
      ...relatoriosPadrao(),
      'mes.carregarMes': {
        ...base,
        gastosFixos: [{ ...base.gastosFixos[0], inicio_ano: 2030, inicio_mes: 1 }],
        entradasRecorrentes: [{ ...base.entradasRecorrentes[0], fim_ano: 2020, fim_mes: 1 }],
      },
    }
    const problemas: string[] = []
    for (const escuro of [false, true]) {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await prepararApp(page, fixture)
      await page.addInitScript(
        (e) =>
          localStorage.setItem(
            'gdg-tema',
            JSON.stringify({ state: { tema: 'rosa', escuro: e }, version: 0 }),
          ),
        escuro,
      )
      await page.goto('/mes?aba=fixos')
      await page.getByRole('heading').first().waitFor()
      await page.waitForTimeout(400)
      const v = await rodarAxe(page, ['color-contrast'])
      if (v.length) problemas.push(relatar('/mes?aba=fixos', escuro ? 'escuro' : 'claro', v))
    }
    expect(problemas.join('\n'), 'contraste abaixo de AA em linha inativa').toBe('')
  })

  /**
   * O contraste dos QUATRO temas, nas telas mais densas.
   *
   * `themes.css` documenta uma calibração por tema; sem medir os quatro, essa
   * documentação é uma promessa que ninguém confere.
   */
  for (const tema of TEMAS) {
    test(`contraste do tema ${tema}, claro e escuro`, async ({ page }) => {
      const problemas: string[] = []
      for (const escuro of [false, true]) {
        for (const rota of ['/painel', '/mes?aba=resumo', '/comparativo']) {
          await abrir(page, rota, tema, escuro)
          const v = await rodarAxe(page, ['color-contrast'])
          if (v.length) problemas.push(relatar(rota, `${tema}/${escuro ? 'escuro' : 'claro'}`, v))
        }
      }
      expect(problemas.join('\n'), 'contraste abaixo de AA').toBe('')
    })
  }
})
