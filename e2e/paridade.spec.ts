import { test, expect, appCompleto, mesPadrao, prepararApp, relatoriosPadrao } from './fixtures/base'

/**
 * Cada bloco aqui é uma linha de docs/paridade.md.
 *
 * O projeto do Playwright decide a largura (390px e 1280px), então o MESMO
 * teste roda nos dois tamanhos: é isso que prova paridade em vez de afirmar.
 * Quando o caminho é legitimamente diferente — tabela no PC, card no celular —
 * o teste ramifica por `isMobile` e cobre os dois, nunca só um.
 *
 * `checkVisibility()` em vez de contar nós ou ler `textContent`: o próprio
 * docs/paridade.md registra que os dois dão falso negativo aqui, porque a
 * navegação existe três vezes no DOM e só uma está visível.
 */
const fixtureMes = () => appCompleto()

test.describe('entrar', () => {
  test('sem sessão, qualquer rota protegida manda para o login', async ({ page }) => {
    await prepararApp(page, {}, { logado: false })
    await page.goto('/mes')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('o formulário de login existe e valida', async ({ page }) => {
    await prepararApp(page, {}, { logado: false })
    await page.goto('/entrar')
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible()
    await expect(page.getByLabel(/senha/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /criar conta/i })).toBeVisible()
  })

  test('com sessão, a rota protegida abre', async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()
  })
})

test.describe('navegação', () => {
  test('exatamente uma navegação principal visível', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()

    const visiveis = await page.evaluate(
      () =>
        [...document.querySelectorAll('nav[aria-label="Navegação principal"]')].filter((n) =>
          n.checkVisibility(),
        ).length,
    )
    // Existem três no DOM (barra lateral, abas do header, barra inferior) e o
    // documento avisa que contar o DOM engana. Visível tem que ser uma só.
    expect(visiveis, isMobile ? 'celular' : 'pc').toBe(1)
  })

  test('as seis telas são alcançáveis nos dois tamanhos', async ({ page }) => {
    await prepararApp(page, fixtureMes())
    for (const [rota, titulo] of [
      ['/painel', /olá|painel/i],
      ['/mes', /controle mensal/i],
      ['/comparativo', /comparativo anual/i],
      ['/metas', /metas/i],
      ['/configuracoes', /configurações/i],
      ['/ajuda', /ajuda/i],
    ] as const) {
      await page.goto(rota)
      await expect(page.getByRole('heading', { name: titulo }).first()).toBeVisible()
    }
  })
})

test.describe('controle mensal', () => {
  test.beforeEach(async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes?aba=gastos')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()
  })

  test('o gasto lançado aparece — card no celular, célula editável no PC', async ({ page, isMobile }) => {
    // É a linha "Editar gasto — células da linha | Tocar no card → sheet" da
    // tabela de paridade. No PC a descrição vive no `value` de um input, então
    // getByText não acha: não é bug, é a diferença que o documento descreve.
    if (isMobile) {
      await expect(page.getByText('Mercado Dia').first()).toBeVisible()
    } else {
      await expect(page.getByLabel('Descrição do gasto').first()).toHaveValue('Mercado Dia')
    }
  })

  test('a etiqueta de parcela aparece nos dois tamanhos', async ({ page }) => {
    // A etiqueta existe duas vezes no DOM (card do celular e linha do PC) e só
    // uma está visível — o mesmo falso negativo que docs/paridade.md registra
    // para a navegação. `:visible` é o que resolve, não `.first()`.
    const etiqueta = page.locator('[title="Parcela 2 de 3"]:visible')
    await expect(etiqueta).toHaveCount(1)
    await expect(etiqueta).toHaveText('2/3')
  })

  test('lançar gasto: FAB no celular, linha de adição no PC', async ({ page, isMobile }) => {
    if (isMobile) {
      const fab = page.getByRole('button', { name: /novo gasto/i })
      await expect(fab).toBeVisible()
      await fab.click()
      await expect(page.getByRole('heading', { name: /novo gasto/i })).toBeVisible()
      // O campo de valor recebe foco: é o único que a pessoa sempre sabe.
      await expect(page.getByLabel('Valor', { exact: true }).first()).toBeVisible()
    } else {
      await expect(page.getByPlaceholder(/descrição|novo gasto/i).first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Lançar gasto' })).toBeVisible()
    }
  })

  test('a compra parcelada pede o número de parcelas', async ({ page, isMobile }) => {
    // No PC não existe FAB: a folha abre pelo botão do cabeçalho da tabela.
    const abrir = isMobile
      ? page.getByRole('button', { name: /novo gasto/i })
      : page.getByRole('button', { name: 'Lançar gasto' })
    await abrir.click()
    await expect(page.getByLabel('Parcelas')).toBeVisible()
    await page.getByRole('button', { name: 'Mais uma parcela' }).click()
    await expect(page.getByText(/2x de|preencha o valor total/i)).toBeVisible()
  })

  test('a fatura do mês aparece com valor e vencimento', async ({ page }) => {
    await page.goto('/mes?aba=resumo')
    await expect(page.getByText('Faturas que vencem neste mês')).toBeVisible()
    // O separador do `Intl` em pt-BR é NBSP (U+00A0), não espaço comum. Comparar
    // com espaço normal falha e a mensagem não diz por quê — já mordeu antes.
    await expect(page.locator('text=/R\\$\\s*463,34/').locator('visible=true').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /marcar fatura como paga/i })).toBeVisible()
  })

  test('marcar gasto fixo como pago', async ({ page }) => {
    await page.goto('/mes?aba=fixos')
    const alvo = page.getByRole('checkbox', { name: 'Marcar Aluguel como pago' })
    await expect(alvo).toBeVisible()
    await alvo.click()
    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    expect(gravadas.some((e) => e.chave.includes('marcarPagamento'))).toBe(true)
  })

  test('busca filtra a lista e diz quantos sobraram', async ({ page }) => {
    await page.getByLabel('Buscar lançamento por descrição').fill('mercado')
    await expect(page.getByText(/mostrando 1 de 2/i)).toBeVisible()
    await expect(page.getByText('Notebook')).toHaveCount(0)
  })

  test('trocar de mês leva ao mês certo — faixa no celular, setas no PC', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('button', { name: 'Set', exact: true }).first().click()
    } else {
      await page.getByRole('button', { name: 'Próximo mês' }).first().click()
    }
    await expect(page.getByText(/setembro de 2025/i).first()).toBeVisible()
  })
})

test.describe('alvos de toque e layout', () => {
  test('nenhum alvo abaixo de 44px no celular, e nada rola de lado', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    for (const rota of ['/painel', '/mes?aba=resumo', '/mes?aba=gastos', '/metas']) {
      await page.goto(rota)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await page.waitForTimeout(300)

      const r = await page.evaluate(() => {
        const alvos = [
          ...document.querySelectorAll('button, a, input, [role="switch"], [role="checkbox"]'),
        ].filter((e) => e.checkVisibility())
        return {
          pequenos: alvos
            .map((e) => ({
              t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24),
              h: Math.round(((e.closest('label') as HTMLElement) ?? e).getBoundingClientRect().height),
            }))
            // O X de fechar de sheet/diálogo é do shadcn e some junto com o
            // overlay; não é alvo de navegação.
            .filter((x) => x.h > 0 && x.h < 44 && !/fechar/i.test(x.t)),
          estouro: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      expect(r.estouro, `${rota} rola de lado`).toBe(0)
      if (isMobile) expect(r.pequenos, `${rota}`).toEqual([])
    }
  })
})

test.describe('estados obrigatórios', () => {
  test('erro de carga mostra "tentar novamente"', async ({ page }) => {
    await prepararApp(page, { ...relatoriosPadrao(), 'mes.carregarMes': { erro: 'Falha de rede simulada' } })
    await page.goto('/mes')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible()
  })

  test('mês sem nada mostra o vazio com CTA, não uma tela em branco', async ({ page }) => {
    const vazio = { ...mesPadrao(), lancamentos: [], entradas: [], gastosFixos: [], faturas: [] }
    await prepararApp(page, { ...relatoriosPadrao(), 'mes.carregarMes': vazio })
    await page.goto('/mes?aba=gastos')
    await expect(page.getByText(/nenhum gasto lançado/i)).toBeVisible()
  })
})
