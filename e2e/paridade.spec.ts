import {
  test,
  expect,
  appCompleto,
  assinaturasPadrao,
  escritas,
  mesPadrao,
  prepararApp,
  relatoriosPadrao,
} from './fixtures/base'

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
    // 03/08 põe o painel de lembretes na tela: o alvo que só aparece perto de
    // um vencimento é justamente o que passaria despercebido nesta varredura.
    await fixarHoje(page, '2025-08-03T10:00:00')
    await prepararApp(page, fixtureMes())
    for (const rota of ['/painel', '/mes?aba=resumo', '/mes?aba=gastos', '/metas', '/configuracoes']) {
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

/**
 * Os lembretes dependem de "hoje", que num teste não pode ser o relógio real.
 *
 * `setFixedTime` em vez de `clock.install`: congelar os timers junto quebraria
 * as animações do Radix e as sheets nunca terminariam de abrir. Aqui basta que
 * `new Date()` responda agosto de 2025, o mesmo mês que a fixture fixa.
 */
async function fixarHoje(page: import('@playwright/test').Page, iso: string) {
  await page.clock.setFixedTime(new Date(iso))
}

test.describe('lembretes de vencimento', () => {
  test('o painel aparece no topo do resumo e leva à tela do vencimento', async ({ page }) => {
    // Aluguel vence dia 5; em 03/08 faltam 2 dias, dentro da antecedência de 3.
    await fixarHoje(page, '2025-08-03T10:00:00')
    await prepararApp(page, fixtureMes())
    await page.goto('/mes?aba=resumo')

    const painel = page.getByRole('button', { name: /aluguel vence/i })
    await expect(painel).toBeVisible()
    await expect(page.getByText(/vence por aqui/i)).toBeVisible()

    await painel.click()
    await expect(page).toHaveURL(/aba=fixos/)
  })

  test('sem nada por perto o painel some inteiro', async ({ page }) => {
    // 22/08: o aluguel (dia 5) já passou o mês inteiro? não — venceu há 17
    // dias, e vencido não caduca. Marcar como pago é o que faz sumir.
    await fixarHoje(page, '2025-08-22T10:00:00')
    const mes = mesPadrao()
    await prepararApp(page, {
      ...relatoriosPadrao(),
      'mes.carregarMes': {
        ...mes,
        pagamentos: [
          { id: 'pg1', user_id: 'u', fixed_expense_id: 'f1', ano: 2025, mes: 8, pago: true, created_at: '' },
        ],
        faturas: [{ ...mes.faturas[0], paga: true }],
      },
    })
    await page.goto('/mes?aba=resumo')

    await expect(page.getByText(/vence por aqui|tem coisa vencida/i)).toHaveCount(0)
  })

  test('o que venceu se anuncia como vencido', async ({ page }) => {
    await fixarHoje(page, '2025-08-22T10:00:00')
    await prepararApp(page, fixtureMes())
    await page.goto('/mes?aba=resumo')

    await expect(page.getByText(/tem coisa vencida/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /aluguel venceu/i })).toBeVisible()
  })

  test('cada tipo de lembrete pode ser desligado nas configurações', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/configuracoes')

    if (isMobile) await page.getByRole('tab', { name: 'Lembretes' }).click()

    const interruptor = page.getByRole('switch', { name: /gasto fixo vencendo/i })
    await expect(interruptor).toBeVisible()
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')

    // A varredura de alvos de toque abre /configuracoes na aba Aparência e
    // nunca chega aqui, então a altura desta linha se mede no lugar.
    expect((await interruptor.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

    await interruptor.click()
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')

    const gravadas = await escritas(page)
    const salva = gravadas.find((e) => e.chave === 'profiles.atualizarPerfil')
    expect(salva).toBeTruthy()
    expect(
      (salva?.args[0] as { preferencias_lembrete: { fixo_vencendo: boolean } }).preferencias_lembrete
        .fixo_vencendo,
    ).toBe(false)
  })

  test('a antecedência aceita de 0 a 15 e recusa o resto', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/configuracoes')
    if (isMobile) await page.getByRole('tab', { name: 'Lembretes' }).click()

    const campo = page.getByLabel(/antecedência/i)
    await expect(campo).toBeVisible()
    // 44px no celular: é um campo numérico, e teclado no telefone erra alvo
    // pequeno com facilidade.
    const caixa = await campo.boundingBox()
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(isMobile ? 44 : 36)

    await campo.fill('90')
    await campo.blur()
    // Volta ao valor anterior, não a zero: zero desligaria o aviso calado.
    await expect(campo).toHaveValue('3')
  })
})

test.describe('sugestão de assinatura', () => {
  const comAssinatura = () => ({ ...appCompleto(), ...assinaturasPadrao() })

  test('o que sai todo mês é oferecido como gasto fixo, com a vigência certa', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, comAssinatura())
    await page.goto('/mes?aba=fixos')

    await expect(page.getByText(/isto parece uma assinatura/i)).toBeVisible()
    await expect(page.getByText('NETFLIX.COM')).toBeVisible()
    await expect(page.getByText(/3 meses seguidos, sem categoria nenhuma/i)).toBeVisible()

    await page.getByRole('button', { name: /virar gasto fixo/i }).click()

    const gravadas = await escritas(page)
    const criado = gravadas.find((e) => e.chave === 'fixed-expenses.criarGastoFixo')
    expect(criado).toBeTruthy()
    const dados = criado?.args[0] as {
      nome: string
      valor_centavos: number
      dia_vencimento: number
      inicio_ano: number
      inicio_mes: number
    }
    expect(dados.nome).toBe('NETFLIX.COM')
    expect(dados.valor_centavos).toBe(3990)
    expect(dados.dia_vencimento).toBe(12)
    // Junho, o primeiro mês em que apareceu — não agosto, o mês na tela.
    expect(dados.inicio_ano).toBe(2025)
    expect(dados.inicio_mes).toBe(6)
  })

  test('"agora não" some com a sugestão e grava a dispensa no perfil', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, {
      ...comAssinatura(),
      // O perfil que o servidor devolve depois de gravar. Sem isto a tela
      // adotaria um perfil sem a dispensa e o cartão voltaria — que é
      // exatamente o que a tela faria se o servidor mentisse.
      'profiles.atualizarPerfil': {
        id: 'u',
        nome: 'Teste',
        tema: 'rosa',
        orcamento_centavos: 0,
        preferencias_lembrete: {},
        assinaturas_ignoradas: ['netflix com'],
        created_at: '',
      },
    })
    await page.goto('/mes?aba=fixos')

    await page.getByRole('button', { name: /não sugerir NETFLIX/i }).click()
    await expect(page.getByText(/isto parece uma assinatura/i)).toHaveCount(0)

    const gravadas = await escritas(page)
    const salva = gravadas.find((e) => e.chave === 'profiles.atualizarPerfil')
    expect((salva?.args[0] as { assinaturas_ignoradas: string[] }).assinaturas_ignoradas).toEqual([
      'netflix com',
    ])
  })

  test('sem repetição não há sugestão nenhuma', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, appCompleto())
    await page.goto('/mes?aba=fixos')

    await expect(page.getByRole('heading', { name: /gastos fixos/i }).first()).toBeVisible()
    await expect(page.getByText(/parece uma assinatura/i)).toHaveCount(0)
  })
})

test.describe('meta com prazo', () => {
  /**
   * A meta "Reserva": R$ 10.000 de alvo, R$ 6.000 guardados, R$ 800 por mês de
   * janeiro a agosto. Faltam R$ 4.000; o prazo é jun/26, dez meses à frente.
   */
  function metaComPrazo(prazo: { prazo_ano: number | null; prazo_mes: number | null }) {
    const meta = {
      id: 'g1',
      user_id: 'u',
      nome: 'Reserva',
      valor_meta_centavos: 1000000,
      ordem: 1,
      created_at: '',
      ...prazo,
    }
    return {
      ...appCompleto(),
      'goals.listarMetas': [meta],
      'goals.listarAportesDoAno': Array.from({ length: 8 }, (_, i) => ({
        id: `a${i}`,
        user_id: 'u',
        goal_id: 'g1',
        ano: 2025,
        mes: i + 1,
        valor_centavos: 80000,
        created_at: '',
      })),
      'reports.obterResumoMetas': [
        {
          goal_id: 'g1',
          nome: 'Reserva',
          valor_meta_centavos: 1000000,
          guardado_ano: 640000,
          guardado_total: 600000,
          percentual: 60,
        },
      ],
    }
  }

  test('com prazo, o card diz quanto falta por mês e em que ritmo está', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, metaComPrazo({ prazo_ano: 2026, prazo_mes: 6 }))
    await page.goto('/metas')

    await expect(page.getByText(/Faltam .* em 11 meses/)).toBeVisible()
    await expect(page.getByText(/No ritmo deste ano .*, chega em/)).toBeVisible()
  })

  test('meta sem prazo continua sem projeção nenhuma', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, metaComPrazo({ prazo_ano: null, prazo_mes: null }))
    await page.goto('/metas')

    await expect(page.getByText('Reserva').first()).toBeVisible()
    await expect(page.getByText(/Faltam .* meses/)).toHaveCount(0)
    await expect(page.getByText(/No ritmo deste ano/)).toHaveCount(0)
  })

  test('nenhuma frase da projeção diz o que a pessoa deveria fazer', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    // Prazo já vencido: é o caso em que uma cobrança escaparia, se fosse
    // escapar em algum.
    await prepararApp(page, metaComPrazo({ prazo_ano: 2025, prazo_mes: 3 }))
    await page.goto('/metas')

    await expect(page.getByText(/O prazo era mar\/25/)).toBeVisible()
    const texto = (await page.locator('main').innerText()).toLowerCase()
    expect(texto).not.toMatch(/você deveria|precisa guardar|está atrasado|tente guardar/)
  })

  test('o prazo se põe pelo mesmo chip nos dois tamanhos', async ({ page, isMobile }) => {
    // appCompleto() já traz a meta "Reserva", e ela nasce sem prazo.
    await prepararApp(page, appCompleto())
    await page.goto('/configuracoes')
    if (isMobile) await page.getByRole('tab', { name: 'Metas' }).click()

    const chip = page.getByRole('button', { name: /sem prazo/i }).first()
    await expect(chip).toBeVisible()
    expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(isMobile ? 44 : 20)

    await chip.click()
    await expect(page.getByText(/quando você quer ter juntado/i)).toBeVisible()

    await page.getByRole('switch', { name: /quero ter juntado até/i }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()

    const gravadas = await escritas(page)
    const salva = gravadas.find((e) => e.chave === 'goals.atualizarMeta')
    const prazo = salva?.args[1] as { prazo_ano: number; prazo_mes: number }
    expect(prazo.prazo_ano).toBeGreaterThan(2000)
    expect(prazo.prazo_mes).toBeGreaterThanOrEqual(1)
  })
})

test.describe('projeção de fim de mês', () => {
  /**
   * O painel sempre mostra o mês corrente, então a fixture do mês precisa ser
   * do mês em que o relógio está — por isso as datas aqui são geradas, e não
   * fixas em agosto de 2025 como no resto do arquivo.
   */
  function mesDoRelogio(ano: number, mes: number, ateODia: number) {
    const base = mesPadrao()
    const mm = String(mes).padStart(2, '0')
    return {
      ...appCompleto(),
      'mes.carregarMes': {
        ...base,
        // Um gasto por dia, sem cartão: é o que faz o ritmo.
        lancamentos: Array.from({ length: ateODia }, (_, i) => ({
          id: `d${i}`,
          user_id: 'u',
          data: `${ano}-${mm}-${String(i + 1).padStart(2, '0')}`,
          descricao: 'Almoço',
          payment_method_id: 'p1',
          category_id: 'c1',
          valor_centavos: 5000,
          tipo: 'gasto',
          created_at: '',
          fingerprint: null,
          parcelamento_id: null,
          parcela: null,
          parcelas_total: null,
        })),
        gastosFixos: [],
        faturas: [],
      },
    }
  }

  test('no dia 18 o painel diz como o mês deve fechar, e que é projeção', async ({ page }) => {
    await fixarHoje(page, '2026-08-18T10:00:00')
    await prepararApp(page, mesDoRelogio(2026, 8, 18))
    await page.goto('/painel')

    await expect(page.getByText(/É projeção, não fato/)).toBeVisible()
    await expect(page.getByText(/faltam 13 dias/)).toBeVisible()

    // O número, e não só a frase: R$ 5.800 de entradas menos (18 dias × R$ 50
    // já gastos + 13 dias × R$ 50 de média) = R$ 4.250. Uma asserção só na
    // frase passaria mesmo com a conta errada.
    await expect(page.getByText(/4\.250,00/)).toBeVisible()
  })

  test('no dia 3 não há média, e a frase não aparece', async ({ page }) => {
    await fixarHoje(page, '2026-08-03T10:00:00')
    await prepararApp(page, mesDoRelogio(2026, 8, 3))
    await page.goto('/painel')

    await expect(page.getByText(/Gastos por categoria/i)).toBeVisible()
    await expect(page.getByText(/É projeção, não fato/)).toHaveCount(0)
  })
})
