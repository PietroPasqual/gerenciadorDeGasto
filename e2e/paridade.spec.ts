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

/**
 * Abre a folha de lançamento — o mesmo formulário nos dois tamanhos.
 *
 * No celular quem abre é o FAB; no PC, o botão do cabeçalho da tabela. Daí
 * para dentro é a MESMA superfície, e é justamente por isso que os testes de
 * consequência abaixo não ramificam: o que eles verificam existe igual nos
 * dois lugares, e ramificar esconderia o dia em que deixar de existir.
 */
async function abrirFolhaDeLancamento(page: import('@playwright/test').Page, isMobile: boolean) {
  const abrir = isMobile
    ? page.getByRole('button', { name: /novo gasto/i })
    : page.getByRole('button', { name: 'Lançar gasto' })
  await abrir.click()
  await expect(page.getByLabel('Valor', { exact: true })).toBeVisible()
}

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
  test('exatamente uma navegação principal, no DOM e na tela', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()

    const { noDom, visiveis } = await page.evaluate(() => {
      const todas = [...document.querySelectorAll('nav[aria-label="Navegação principal"]')]
      return { noDom: todas.length, visiveis: todas.filter((n) => n.checkVisibility()).length }
    })

    // Antes da fase 3 eram TRÊS no DOM — barra lateral, abas do header e barra
    // inferior —, cada uma escondida nas larguras das outras, e este teste só
    // conseguia cobrar que uma estivesse visível. Com o dock, o DOM também
    // passa a ter uma só: se alguém ressuscitar uma segunda navegação para
    // alguma largura, isto quebra antes de a divergência entre as duas
    // aparecer numa tela.
    expect(noDom, isMobile ? 'celular' : 'pc').toBe(1)
    expect(visiveis, isMobile ? 'celular' : 'pc').toBe(1)
  })

  test('o dock flutua sobre o conteúdo sem cobrir o fim da página', async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes?aba=gastos')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()

    const dock = page.locator('nav[aria-label="Navegação principal"]')
    const caixa = await dock.boundingBox()
    expect(caixa, 'o dock precisa estar na tela').not.toBeNull()

    // A moldura que posiciona o dock cobre a largura TODA da tela. Se ela
    // recebesse cliques, uma faixa invisível engoliria o toque na última
    // linha de qualquer lista — daí o `pointer-events-none` nela e o
    // `pointer-events-auto` só na barra.
    //
    // `elementFromPoint` já pula quem tem pointer-events: none, então
    // perguntar a cor do que ele devolve não prova nada: a prova é QUEM ele
    // devolve. Na borda esquerda, longe da barra, não pode ser a moldura; no
    // centro do dock, tem que ser a barra.
    const alvos = await page.evaluate(
      ({ borda, centro }) => {
        const nav = document.querySelector('nav[aria-label="Navegação principal"]')
        const moldura = nav?.parentElement ?? null
        const naBorda = document.elementFromPoint(borda.x, borda.y)
        const noCentro = document.elementFromPoint(centro.x, centro.y)
        return {
          molduraNaBorda: !!moldura && (naBorda === moldura || moldura.contains(naBorda)),
          dockNoCentro: !!nav && (noCentro === nav || nav.contains(noCentro)),
        }
      },
      {
        borda: { x: 4, y: (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2 },
        centro: {
          x: (caixa?.x ?? 0) + (caixa?.width ?? 0) / 2,
          y: (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2,
        },
      },
    )
    expect(alvos.molduraNaBorda, 'a moldura do dock não pode interceptar cliques').toBe(false)
    expect(alvos.dockNoCentro, 'o dock em si precisa continuar clicável').toBe(true)

    // E o conteúdo reserva espaço: rolado até o fim, o último bloco da página
    // termina ACIMA do topo do dock, e não por baixo dele. É o que o
    // --dock-reserva garante, e é o que um `pb` cravado à mão deixava de
    // garantir toda vez que a altura da navegação mudava.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const fimDoConteudo = await page.evaluate(() => {
      const ultimo = document.querySelector('main')?.lastElementChild
      return ultimo ? ultimo.getBoundingClientRect().bottom : 0
    })
    expect(fimDoConteudo).toBeLessThanOrEqual((caixa?.y ?? 0) + 1)
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

/**
 * O painel personalizável (fase 4).
 *
 * A aritmética de ordem e visibilidade tem teste próprio em
 * `src/lib/painel.test.ts`, e a tela tem um de componente em
 * `dashboard-page.test.tsx`. O que só aqui se vê é o que jsdom não pinta: que
 * a capa REALMENTE desenha um gradiente, e que os alvos de personalizar
 * respeitam os 44px no celular — as duas coisas que o axe só mede em
 * navegador de verdade.
 */
test.describe('painel personalizável', () => {
  test.beforeEach(async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: /olá/i })).toBeVisible()
  })

  test('a capa desenha um gradiente de verdade, e sem texto por cima', async ({ page }) => {
    // A capa é decoração: `aria-hidden`, e nenhum texto sobre ela. O gradiente
    // varia de luminosidade ao longo da faixa, e texto ali teria contraste
    // diferente em cada ponto — que é a armadilha que derrubou o comparativo
    // anual para 2,54:1 e está anotada no themes.css.
    const gradiente = await page.evaluate(() => {
      const capa = [...document.querySelectorAll('main [aria-hidden="true"] > div')].find((d) =>
        getComputedStyle(d).backgroundImage.includes('gradient'),
      )
      if (!capa) return null
      return {
        imagem: getComputedStyle(capa).backgroundImage,
        texto: (capa.parentElement?.textContent ?? '').trim(),
      }
    })
    expect(gradiente, 'a capa precisa desenhar um gradiente').not.toBeNull()
    expect(gradiente?.imagem).toContain('gradient')
    expect(gradiente?.texto, 'nada de texto sobre a capa').toBe('')
  })

  test('personalizar, mover e esconder — tudo na própria tela', async ({ page }) => {
    await page.getByRole('button', { name: 'Personalizar' }).click()

    // Mover é uma operação sobre um card que está À VISTA: a pessoa vê o
    // bloco trocar de lugar embaixo do dedo que o moveu. Foi por isso que a
    // personalização ficou no painel e não numa página de configurações.
    await page.getByRole('button', { name: 'Mover Gastos por categoria para baixo' }).click()

    const ordem = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('main section[aria-label]')].map((s) => s.getAttribute('aria-label')),
      )
    await expect
      .poll(ordem)
      .toEqual([
        'Personalizar o painel',
        'Observações do mês',
        'Gastos por categoria',
        'Resumo do mês',
        'Atalhos',
        'Orçamento do mês',
      ])

    await page.getByRole('button', { name: 'Esconder Atalhos' }).click()
    await expect.poll(ordem).not.toContain('Atalhos')

    // E o que sai da tela é oferecido de volta, senão esconder seria caminho
    // só de ida.
    const bandeja = page.getByRole('region', { name: 'Personalizar o painel' })
    await expect(bandeja.getByRole('button', { name: 'Atalhos' })).toBeVisible()

    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    expect(gravadas.some((e) => e.chave.includes('atualizarPerfil'))).toBe(true)
  })

  test('a moldura do painel não come metade do primeiro quadro no celular', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a medida é sobre o primeiro quadro do celular')

    // Medido a 390x844 antes deste teste existir: header 57px + capa 144px +
    // saudação + uma linha inteira só para o botão "Personalizar" punham o
    // primeiro dado a 361px — 43% da tela era moldura, e num telefone com a
    // barra do navegador o primeiro card não aparecia sem rolar.
    //
    // A capa encolheu para 6rem no celular e o botão foi para a linha do
    // título. O teto de 300px trava o resultado: é folgado o bastante para
    // caber ajuste de tipografia, e apertado o bastante para quebrar se
    // alguém devolver a capa de 9rem ao celular ou empilhar o botão de novo.
    const m = await page.evaluate(() => {
      const primeiro = document.querySelector('main > div > *:not([aria-hidden]):not(header)')
      return {
        viewport: window.innerHeight,
        primeiroDadoEm: primeiro ? Math.round(primeiro.getBoundingClientRect().top) : null,
      }
    })
    expect(m.primeiroDadoEm, 'o primeiro dado do painel desceu demais').toBeLessThanOrEqual(300)
  })

  test('nenhum alvo da personalização fica abaixo de 44px no celular', async ({ page, isMobile }) => {
    // O modo de edição cria oito setas e um seletor de seis capas de uma vez
    // — a maior safra de alvos novos que o app ganhou numa fase só, e
    // exatamente o tipo de tela que caiu no vão que deixou /ajuda com 23px.
    await page.getByRole('button', { name: 'Personalizar' }).click()
    await expect(page.getByRole('group', { name: 'Capa do painel' })).toBeVisible()

    const r = await medirAlvos(page)
    if (isMobile) expect(r.pequenos, 'alvos pequenos ao personalizar o painel').toEqual([])
    expect(r.estouro, 'personalizar o painel faz a página rolar de lado').toBe(0)
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

  test('a linha diz em que fatura o gasto sai, nos dois tamanhos', async ({ page }) => {
    // "Notebook" é no crédito, que fecha dia 20: compra de 10/08 vence em
    // setembro. "Mercado Dia" é no Pix e não tem fatura nenhuma.
    const etiqueta = page.locator('[title="Sai na fatura de Setembro de 2025"]:visible')
    await expect(etiqueta).toHaveCount(1)
    await expect(etiqueta).toHaveText('fat. set')
    // Só o do crédito ganha etiqueta — o do Pix pesa no próprio mês.
    await expect(page.locator('[title^="Sai na fatura"]:visible')).toHaveCount(1)
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
    await abrirFolhaDeLancamento(page, isMobile)
    // Parcelar é a exceção — o campo fica recolhido até alguém pedir.
    await page.getByRole('button', { name: 'Parcelar compra' }).click()
    await expect(page.getByLabel('Número de parcelas')).toHaveValue('2')
    await page.getByRole('button', { name: 'Mais uma parcela' }).click()
    await expect(page.getByLabel('Número de parcelas')).toHaveValue('3')
    // A divisão é dita antes de salvar, junto com as outras consequências.
    await expect(page.getByText(/3x de|preencha o valor total/i).first()).toBeVisible()
    await expect(page.getByText(/entram nos meses seguintes/i)).toBeVisible()
  })

  test('a folha diz em que fatura a compra vai cair, antes de salvar', async ({ page, isMobile }) => {
    await abrirFolhaDeLancamento(page, isMobile)
    // Sem forma escolhida não há fatura, e o formulário fica calado: um aviso
    // que aparece sempre deixa de ser lido.
    await expect(page.getByText(/entra na fatura de/i)).toHaveCount(0)

    await page.getByRole('button', { name: 'Crédito' }).click()
    // Agosto/2025 é o mês aberto, o cartão fecha dia 20 e vence dia 10.
    await expect(page.getByText('Entra na fatura de Setembro')).toBeVisible()
    await expect(page.getByText(/vence em 10\/09\/2025/)).toBeVisible()
    await expect(page.getByText('Gasto de Agosto, sai da conta em Setembro')).toBeVisible()
  })

  test('a folha avisa quando o lançamento é de outro mês', async ({ page, isMobile }) => {
    await abrirFolhaDeLancamento(page, isMobile)
    await expect(page.getByText(/este lançamento é de/i)).toHaveCount(0)
    await page.getByLabel('Data', { exact: true }).fill('2025-10-03')
    await expect(page.getByText('Este lançamento é de Outubro de 2025')).toBeVisible()
    await expect(page.getByText(/não vai aparecer nesta lista/i)).toBeVisible()
  })

  test('o mesmo formulário lança entrada, e diz onde ela foi parar', async ({ page, isMobile }) => {
    await abrirFolhaDeLancamento(page, isMobile)
    await page.getByRole('button', { name: 'Entrada', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Nova entrada' })).toBeVisible()
    // Escopo na folha: "Forma de pagamento" também é cabeçalho de coluna e
    // campo do filtro, e procurar na página inteira acharia esses.
    const folha = page.getByRole('dialog')
    // Entrada com data é descrição, valor e dia — é o que a tabela mostra dela.
    await expect(folha.getByText('Forma de pagamento')).toHaveCount(0)
    await expect(folha.getByText('Parcelar compra')).toHaveCount(0)

    await page.getByLabel('Valor', { exact: true }).fill('12345')
    await page.getByLabel('Descrição', { exact: true }).fill('Freela')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    expect(gravadas.some((e) => e.chave.includes('criarLancamento'))).toBe(true)
    await expect(page.getByText('Ela fica na aba Entradas.')).toBeVisible()
  })

  /**
   * Ações em lote.
   *
   * A fixture tem dois gastos, e um deles é a parcela 2/3 de uma compra — que é
   * exatamente o caso que a confirmação precisa saber explicar. Nenhum destes
   * ramifica por tamanho: marcar, a barra e a confirmação são a MESMA
   * superfície nos dois, e ramificar aqui esconderia o dia em que deixarem de
   * ser.
   */
  test.describe('ações em lote', () => {
    async function marcar(page: import('@playwright/test').Page, ...nomes: string[]) {
      await page.getByRole('button', { name: 'Marcar', exact: true }).click()
      for (const nome of nomes) {
        await page
          .getByRole('checkbox', { name: `Marcar ${nome}` })
          .locator('visible=true')
          .click()
      }
    }

    test('a barra diz quantos, quanto e de onde eles saíram', async ({ page }) => {
      await marcar(page, 'Mercado Dia', 'Notebook')
      const barra = page.getByRole('group', { name: 'Ações para os lançamentos marcados' })
      // R$ 300,00 + R$ 333,33. O separador do Intl é NBSP, então a comparação
      // é por regex e não por texto literal.
      await expect(barra.getByText(/2 lançamentos ·\s*R\$\s*633,33/)).toBeVisible()
      await expect(barra.getByText('2 de 2 lançamentos do mês.')).toBeVisible()
    })

    test('o filtro tira da seleção o que saiu da tela', async ({ page }) => {
      await marcar(page, 'Mercado Dia', 'Notebook')
      const barra = page.getByRole('group', { name: 'Ações para os lançamentos marcados' })
      await page.getByLabel('Buscar lançamento por descrição').fill('Notebook')
      // Um marcado sumiu da lista: a barra tem que encolher junto, senão
      // "excluir" apagaria um lançamento que ninguém está vendo.
      await expect(barra.getByText(/1 lançamento ·\s*R\$\s*333,33/)).toBeVisible()
      await expect(barra.getByText('1 de 1 no filtro atual — o mês tem 2.')).toBeVisible()

      // E a AÇÃO tem que ir junto: a barra dizer "1" e o banco receber dois ids
      // seria pior do que não podar nada, porque aí ninguém desconfia.
      await page.getByRole('button', { name: 'Categoria' }).click()
      await page.getByRole('button', { name: /Mercado/ }).click()
      const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
      expect(gravadas.find((e) => e.chave === 'transactions.atualizarVarios')?.args[0]).toEqual(['t2'])
    })

    test('excluir em lote confirma, e promete por escrito que a série fica', async ({ page }) => {
      await marcar(page, 'Mercado Dia', 'Notebook')
      await page.getByRole('button', { name: 'Excluir', exact: true }).click()
      await expect(page.getByText('Excluir 2 lançamentos?')).toBeVisible()
      await expect(page.getByText(/1 é parcela de 1 compra parcelada/)).toBeVisible()
      await expect(page.getByText(/só a parcela marcada sai, o resto da série fica/)).toBeVisible()

      await page.getByRole('button', { name: 'Excluir', exact: true }).last().click()
      const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
      const exclusao = gravadas.find((e) => e.chave === 'transactions.excluirVarios')
      expect(exclusao?.args[0]).toEqual(['t1', 't2'])
      // Nada de excluirSerie: em lote a promessa é a mais estreita possível.
      expect(gravadas.some((e) => e.chave === 'transactions.excluirSerie')).toBe(false)
      await expect(page.getByText('2 lançamentos excluídos')).toBeVisible()
    })

    test('categorizar em lote diz em quantos vale antes de aplicar', async ({ page }) => {
      await marcar(page, 'Notebook')
      await page.getByRole('button', { name: 'Categoria' }).click()
      await expect(page.getByText('Vale para 1 lançamento marcado.')).toBeVisible()
      await page.getByRole('button', { name: /Mercado/ }).click()

      const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
      const edicao = gravadas.find((e) => e.chave === 'transactions.atualizarVarios')
      expect(edicao?.args[0]).toEqual(['t2'])
      await expect(page.getByText('1 lançamento alterado')).toBeVisible()
    })

    test('duplicar avisa que a cópia de parcela sai solta, e dá desfazer', async ({ page }) => {
      await prepararApp(page, {
        ...fixtureMes(),
        ...assinaturasPadrao(),
        // O servidor devolve as cópias com id próprio: é delas que o desfazer
        // precisa, e é por isso que o dublê precisa dizer o que voltou.
        'transactions.criarVarios': [
          {
            id: 'copia1',
            user_id: 'u',
            data: '2025-08-10',
            descricao: 'Notebook',
            payment_method_id: null,
            category_id: null,
            valor_centavos: 33333,
            tipo: 'gasto',
            created_at: '',
            fingerprint: null,
            parcelamento_id: null,
            parcela: null,
            parcelas_total: null,
          },
        ],
      })
      await page.goto('/mes?aba=gastos')
      await marcar(page, 'Notebook')
      await page.getByRole('button', { name: 'Duplicar' }).click()

      await expect(page.getByText('1 lançamento duplicado')).toBeVisible()
      await expect(page.getByText(/cópias de parcela saem soltas/)).toBeVisible()

      await page.getByRole('button', { name: 'Desfazer' }).click()
      const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
      const desfazer = gravadas.find((e) => e.chave === 'transactions.excluirVarios')
      expect(desfazer?.args[0]).toEqual(['copia1'])
    })
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

/**
 * Mede todo alvo visível da tela e o quanto ela rola de lado.
 *
 * A altura sai do `<label>` que envolve o controle quando existe: uma caixa de
 * seleção de 16px dentro de um card de 68px é um alvo de 68px, e medir a caixa
 * sozinha reprovaria um layout correto.
 */
async function medirAlvos(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
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
}

/** Um ano de doze meses com os valores dados a partir de janeiro. */
function anoDe(pares: Array<[number, number]>) {
  return Array.from({ length: 12 }, (_, i) => {
    const [entradas, saidas] = pares[i] ?? [0, 0]
    return { mes: i + 1, entradas, saidas, diferenca: entradas - saidas }
  })
}

test.describe('comparativo anual', () => {
  /**
   * Abril de 2026: Jan–Abr já aconteceram, Mai–Dez são previsão.
   *
   * 2026 gasta mais que 2025 nos mesmos meses, e 2025 só passa a ter movimento
   * em fevereiro — é isso que prova que a comparação usa a interseção, e não os
   * doze meses de um contra os quatro do outro.
   */
  async function abrirAno(page: import('@playwright/test').Page) {
    await fixarHoje(page, '2026-04-15T10:00:00')
    await prepararApp(page, {
      ...relatoriosPadrao(),
      'reports.obterComparativoAnual#[2026]': anoDe([
        [100000, 60000],
        [100000, 60000],
        [100000, 60000],
        [100000, 60000],
        // De maio em diante só os fixos, que é o que o agregado devolve para
        // mês futuro.
        [0, 20000],
        [0, 20000],
        [0, 20000],
        [0, 20000],
        [0, 20000],
        [0, 20000],
        [0, 20000],
        [0, 20000],
      ]),
      'reports.obterComparativoAnual#[2025]': anoDe([
        // Janeiro de 2025 sem movimento: o app ainda não era usado.
        [0, 0],
        [100000, 50000],
        [100000, 50000],
        [100000, 50000],
        [100000, 50000],
      ]),
    })
    await page.addInitScript(() =>
      localStorage.setItem(
        'gdg-periodo',
        JSON.stringify({ state: { ano: 2026, mes: 4, anoComparativo: 2026 }, version: 0 }),
      ),
    )
    await page.goto('/comparativo')
    await expect(page.getByRole('heading', { name: 'Comparativo anual' })).toBeVisible()
  }

  test('o total destacado é o REALIZADO, com o previsto dito à parte', async ({ page }) => {
    await abrirAno(page)
    // Jan–Abr: 4 x R$ 600,00 = R$ 2.400,00. Os R$ 200,00/mês de maio a dezembro
    // NÃO entram no número grande — eles aparecem escritos como previsão.
    await expect(page.getByText('Gastos realizados')).toBeVisible()
    await expect(page.locator('text=/R\\$\\s*2\\.400,00/').locator('visible=true').first()).toBeVisible()
    await expect(page.getByText(/R\$\s*1\.600,00 previstos até dezembro/)).toBeVisible()
  })

  test('a comparação com o ano anterior usa só os meses comuns, e diz quais', async ({ page }) => {
    await abrirAno(page)
    // Janeiro de 2025 não teve movimento, então a base é Fev–Abr: R$ 1.800,00
    // contra R$ 1.500,00, ou seja +20%.
    await expect(page.getByText('+20%')).toBeVisible()
    // Entradas iguais nos dois anos: a variação delas é 0%.
    await expect(page.getByText('0%', { exact: true })).toBeVisible()
    await expect(page.getByText('vs 2025 (Fev–Abr)').first()).toBeVisible()
    await expect(page.getByText(/usa .*Fev–Abr.* dos dois anos/)).toBeVisible()
  })

  test('gastar mais que no ano passado não é comemorado em verde', async ({ page }) => {
    await abrirAno(page)
    // A cor segue o SIGNIFICADO: subir gasto é ruim, subir entrada é bom.
    const deltaGastos = page.locator('p', { hasText: 'vs 2025 (Fev–Abr)' }).nth(1)
    await expect(deltaGastos).toHaveClass(/text-destructive/)
  })

  test('a faixa de previsto aparece no gráfico', async ({ page, isMobile }) => {
    await abrirAno(page)
    if (isMobile) {
      await page.getByRole('heading', { name: 'Entrada x gastos' }).scrollIntoViewIfNeeded()
    }
    const grafico = page.locator('svg.recharts-surface').first()
    await expect(grafico).toBeVisible()
    // O rótulo DENTRO do gráfico, e não a etiqueta "previsto" das linhas do
    // mês: são duas marcas diferentes da mesma ideia, e conferir a errada
    // deixaria a faixa do gráfico sem teste nenhum.
    await expect(grafico.locator('text', { hasText: 'previsto' })).toBeVisible()
  })

  test('a categoria mais pesada abre escolhida, e trocar de chip troca a série', async ({ page }) => {
    await abrirAno(page)
    await expect(page.getByRole('heading', { name: 'Uma categoria ao longo do ano' })).toBeVisible()

    // Mercado soma R$ 5.000,00 em Jan–Abr (110 + 120 + 130 + 140); Sem
    // categoria, R$ 333,33 num mês só.
    await expect(page.getByText(/Total em Jan–Abr:/)).toBeVisible()
    await expect(page.locator('text=/R\\$\\s*5\\.000,00/').locator('visible=true').first()).toBeVisible()

    await page.getByRole('button', { name: 'Sem categoria' }).click()
    await expect(page.locator('text=/R\\$\\s*333,33/').locator('visible=true').first()).toBeVisible()
  })

  test('o bloco de categoria diz que a medida é outra', async ({ page }) => {
    await abrirAno(page)
    // Os números do topo são de caixa; este bloco é de competência. Duas
    // medidas na mesma tela só é honesto se as duas se apresentarem.
    await expect(page.getByText(/Pela data da compra, e não pelo vencimento da fatura/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'O que muda entre uma medida e a outra' })).toBeVisible()
  })

  test('sem seis meses realizados, não há frase de tendência', async ({ page }) => {
    await abrirAno(page)
    // Só quatro meses aconteceram: o app prefere não dizer nada a dizer algo
    // que ele mesmo não sustenta.
    await expect(page.getByText(/Os gastos est/)).toHaveCount(0)
  })

  test('com o ano fechado, a tendência aparece com as duas janelas escritas', async ({ page }) => {
    await fixarHoje(page, '2026-12-20T10:00:00')
    await prepararApp(page, {
      ...relatoriosPadrao(),
      'reports.obterComparativoAnual#[2026]': anoDe([
        [100000, 100000],
        [100000, 100000],
        [100000, 100000],
        [100000, 150000],
        [100000, 150000],
        [100000, 150000],
      ]),
      'reports.obterComparativoAnual#[2025]': [],
    })
    await page.addInitScript(() =>
      localStorage.setItem(
        'gdg-periodo',
        JSON.stringify({ state: { ano: 2026, mes: 12, anoComparativo: 2026 }, version: 0 }),
      ),
    )
    await page.goto('/comparativo')
    await expect(page.getByText(/Os gastos estão subindo/)).toBeVisible()
    await expect(page.getByText(/em Abr–Jun/)).toBeVisible()
    await expect(page.getByText(/em Jan–Mar/)).toBeVisible()
  })
})

test.describe('guardar, resgatar e transferir na tela de metas', () => {
  /** Agosto de 2025, com o seletor de ano na mesma casa do relógio. */
  async function abrirMetas(page: import('@playwright/test').Page) {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, {
      ...appCompleto(),
      'goals.listarMetas': [
        { id: 'g1', user_id: 'u', nome: 'Reserva', valor_meta_centavos: 1000000, ordem: 1, created_at: '' },
        { id: 'g2', user_id: 'u', nome: 'Viagem', valor_meta_centavos: 500000, ordem: 2, created_at: '' },
      ],
      'goals.listarAportesDoAno': [
        { id: 'a1', user_id: 'u', goal_id: 'g1', ano: 2025, mes: 8, valor_centavos: 50000, created_at: '' },
      ],
      'reports.obterResumoMetas': [
        {
          goal_id: 'g1',
          nome: 'Reserva',
          valor_meta_centavos: 1000000,
          guardado_ano: 50000,
          guardado_total: 50000,
          percentual: 5,
        },
        {
          goal_id: 'g2',
          nome: 'Viagem',
          valor_meta_centavos: 500000,
          guardado_ano: 0,
          guardado_total: 0,
          percentual: 0,
        },
      ],
    })
    await page.addInitScript(() =>
      localStorage.setItem(
        'gdg-periodo',
        JSON.stringify({ state: { ano: 2025, mes: 8, anoComparativo: 2025 }, version: 0 }),
      ),
    )
    await page.goto('/metas')
    await expect(page.getByRole('heading', { name: /Quanto guardei/ })).toBeVisible()
  }

  test('"Guardar" abre no mês de hoje, já com o que está lá', async ({ page }) => {
    await abrirMetas(page)
    await page.getByRole('button', { name: 'Guardar em Reserva' }).click()

    await expect(page.getByRole('heading', { name: 'Guardar em Reserva' })).toBeVisible()
    // Agosto já tem R$ 500,00, e o campo abre com eles: `salvarAporte`
    // SUBSTITUI o mês, e um campo vazio apagaria o valor sem avisar.
    const campo = page.getByLabel('Valor guardado em Agosto')
    await expect(campo).toHaveValue(/500,00/)
    await expect(page.getByText(/substitui o que estiver guardado/)).toBeVisible()
  })

  test('trocar o mês troca o valor que está em jogo', async ({ page }) => {
    await abrirMetas(page)
    await page.getByRole('button', { name: 'Guardar em Reserva' }).click()
    // Setembro não tem nada guardado.
    await page.getByRole('button', { name: /^Setembro/ }).click()
    await expect(page.getByLabel('Valor guardado em Setembro')).toHaveValue(/0,00/)
  })

  test('salvar grava o aporte no mês escolhido', async ({ page }) => {
    await abrirMetas(page)
    await page.getByRole('button', { name: 'Guardar em Reserva' }).click()
    await page.getByRole('button', { name: /^Setembro/ }).click()

    // ESPERA o campo trocar de mês antes de digitar.
    //
    // Sem isto o teste reprovava uma vez a cada cinco, e não por lentidão: a
    // folha abre em Agosto, que tem R$ 500,00 guardados, e trocar para
    // Setembro zera o campo num render seguinte. Quando o `fill` chegava
    // antes desse render, os dígitos entravam no MoneyInput ainda carregado e
    // o aporte gravado saía 5000030000 em vez de 30000 — número errado, não
    // ausência de gravação. É o mesmo `toHaveValue` que o teste logo acima já
    // faz, e que aqui faltava.
    await expect(page.getByLabel('Valor guardado em Setembro')).toHaveValue(/0,00/)
    await page.getByLabel('Valor guardado em Setembro').fill('30000')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    // ESPERA a escrita aparecer, em vez de ler o array uma vez só.
    //
    // O salvamento é assíncrono; ler `__ESCRITAS__` logo depois do clique
    // dependia de a ida e volta do `page.evaluate` demorar mais que o handler.
    // Na maioria das vezes demorava, e o teste reprovava uma vez a cada quatro
    // ou cinco execuções — inclusive antes da fase 3, o que descarta o dock
    // como causa. `expect.poll` troca a corrida por uma condição.
    await expect
      .poll(async () => {
        const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
        return gravadas.find((e) => e.chave === 'goals.salvarAporte')?.args[0] ?? null
      })
      .toMatchObject({ goal_id: 'g1', ano: 2025, mes: 9, valor_centavos: 30000 })
  })

  test('resgatar e transferir existem AQUI, com o saldo à vista', async ({ page }) => {
    await abrirMetas(page)
    await page.getByRole('button', { name: 'Resgatar ou transferir' }).click()
    // O saldo é o teto do resgate, e ele precisa aparecer antes de digitar.
    await expect(page.locator('text=/R\\$\\s*500,00/').locator('visible=true').first()).toBeVisible()

    // Rótulo exato: "Valor" sozinho também casa com os campos da wishlist,
    // que continuam no DOM atrás da folha.
    await page.getByLabel('Valor do movimento').fill('20000')
    await page.getByRole('button', { name: /^Resgatar R\$/ }).click()

    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    expect(gravadas.some((e) => e.chave === 'goals.resgatarDaMeta')).toBe(true)
  })
})

test.describe('wishlist', () => {
  test.beforeEach(async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/metas')
    await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible()
  })

  test('os três estados aparecem, cada um com o seu rótulo', async ({ page }) => {
    // Notebook não tem meta; Cadeira está ligada a "Reserva"; Fone foi conquistado.
    await expect(page.getByRole('button', { name: /Estado de Notebook.*Quero comprar/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Estado de Cadeira.*Estou juntando/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Estado de Fone.*Conquistado/ })).toBeVisible()
  })

  test('quem está juntando mostra a meta e o quanto ela cobre', async ({ page }) => {
    // Reserva tem R$ 500,00; a cadeira custa R$ 2.000,00 -> 25%.
    const botao = page.getByRole('button', { name: /Estado de Cadeira/ })
    await expect(botao).toContainText('Reserva')
    await expect(botao).toContainText('25%')
  })

  test('a lista não se apresenta como dinheiro comprometido', async ({ page }) => {
    // "Falta juntar" somava tudo o que estava pendente e lia vontade como
    // compromisso. A frase não pode voltar.
    await expect(page.getByText('Falta juntar')).toHaveCount(0)
    await expect(page.getByText(/A lista não reserva dinheiro/)).toBeVisible()
    // O que sobrou é o preço somado dos desejos SEM meta — R$ 4.000,00 do
    // notebook, e não os R$ 6.000,00 de tudo que está pendente.
    await expect(page.getByText(/R\$\s*4\.000,00 em desejos/)).toBeVisible()
  })

  test('ligar um desejo a uma meta grava a ligação', async ({ page }) => {
    await page.getByRole('button', { name: /Estado de Notebook/ }).click()
    await expect(page.getByText(/Ligar a uma meta é o que faz o dinheiro guardado aparecer/)).toBeVisible()

    await page.getByRole('button', { name: /Reserva/ }).click()
    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    const escrita = gravadas.find((e) => e.chave === 'wishlist.atualizarItemWishlist')
    expect(escrita?.args[0]).toBe('w1')
    expect(escrita?.args[1]).toMatchObject({ goal_id: 'g1', concluido: false })
  })

  test('a meta que banca dois desejos avisa que o dinheiro é o mesmo', async ({ page }) => {
    const base = relatoriosPadrao()
    await prepararApp(page, {
      ...fixtureMes(),
      'wishlist.listarWishlist': (base['wishlist.listarWishlist'] as Array<Record<string, unknown>>).map(
        (item) => (item.id === 'w1' ? { ...item, goal_id: 'g1' } : item),
      ),
    })
    await page.goto('/metas')
    await page.getByRole('button', { name: /Estado de Notebook/ }).click()
    await expect(page.getByText(/o mesmo dinheiro para os dois/)).toBeVisible()
  })
})

test.describe('primeiro acesso guiado', () => {
  /** Conta nova: nada configurado, e o guia nunca encerrado. */
  function contaNova(mudancas: Record<string, unknown> = {}) {
    const base = relatoriosPadrao()
    return {
      ...appCompleto(),
      'profiles.obterPerfil': {
        ...(base['profiles.obterPerfil'] as Record<string, unknown>),
        nome: '',
        orcamento_centavos: 0,
        onboarding_em: null,
        onboarding_vistos: [],
      },
      'recurring-incomes.listarEntradasRecorrentes': [],
      'transactions.existeLancamento': false,
      // Categorias semeadas pela 0004, sem limite nenhum — a fixture comum tem
      // um limite em Mercado, e ele deixaria o passo "limites" pronto antes de
      // a pessoa fazer qualquer coisa.
      'categories.listarCategorias': [
        {
          id: 'c1',
          user_id: 'u',
          nome: 'Mercado',
          limite_centavos: null,
          cor: '#a5f6d8',
          ordem: 1,
          created_at: '',
        },
        {
          id: 'c2',
          user_id: 'u',
          nome: 'Transporte',
          limite_centavos: null,
          cor: '#9ecbff',
          ordem: 2,
          created_at: '',
        },
      ],
      ...mudancas,
    }
  }

  test('abre sozinho na conta nova, e nunca em quem já usa o app', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: 'Deixe o app com a sua cara' })).toBeVisible()

    // A fixture padrão tem `onboarding_em` preenchido — como toda conta que já
    // existia ficou depois da 0022.
    await prepararApp(page, fixtureMes())
    await page.goto('/painel')
    await expect(page.getByRole('heading', { name: 'Deixe o app com a sua cara' })).toHaveCount(0)
  })

  test('mostra progresso e abre na primeira pendente', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await expect(page.getByText('0 de 7')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Como te chamar' })).toBeVisible()
  })

  /**
   * O ponto inteiro de derivar o estado do dado: ninguém precisou avisar o
   * guia de que o orçamento foi configurado por outro caminho.
   */
  test('o que já foi configurado por fora chega marcado como feito', async ({ page }) => {
    const base = relatoriosPadrao()
    await prepararApp(
      page,
      contaNova({
        'profiles.obterPerfil': {
          ...(base['profiles.obterPerfil'] as Record<string, unknown>),
          nome: 'Ana',
          orcamento_centavos: 300000,
          onboarding_em: null,
          onboarding_vistos: [],
        },
        'transactions.existeLancamento': true,
      }),
    )
    await page.goto('/painel')
    await expect(page.getByText('3 de 7')).toBeVisible()
    // Nome, orçamento e primeiro gasto prontos: a primeira pendente é a entrada.
    await expect(page.getByRole('heading', { name: 'Sua entrada que se repete' })).toBeVisible()
  })

  test('salvar o nome escreve pelo mesmo serviço das configurações', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByLabel('Seu nome').fill('Ana')
    await page.getByRole('button', { name: 'Salvar nome' }).click()

    const gravadas = await escritas(page)
    const salva = gravadas.find((e) => e.chave === 'profiles.atualizarPerfil')
    expect(salva?.args[0]).toEqual({ nome: 'Ana' })
  })

  test('"pular" não grava dado de exemplo nenhum', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByRole('button', { name: 'Pular este passo' }).click()
    await expect(page.getByRole('heading', { name: /Quanto você quer gastar/ })).toBeVisible()

    // Nem nome vazio, nem orçamento zero: pular é não escrever.
    const gravadas = await escritas(page)
    expect(gravadas.some((e) => e.chave === 'profiles.atualizarPerfil')).toBe(false)
  })

  test('"fazer isto depois" encerra o guia de vez', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByRole('button', { name: 'Fazer isto depois' }).click()
    await expect(page.getByRole('heading', { name: 'Deixe o app com a sua cara' })).toHaveCount(0)

    const gravadas = await escritas(page)
    const salva = gravadas.find(
      (e) => e.chave === 'profiles.atualizarPerfil' && 'onboarding_em' in (e.args[0] as object),
    )
    expect(typeof (salva?.args[0] as { onboarding_em: string }).onboarding_em).toBe('string')
  })

  test('dá para andar pelos passos em qualquer ordem', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByRole('button', { name: /Passo 6: Avisos de vencimento/ }).click()
    await expect(page.getByRole('heading', { name: 'Avisos de vencimento' })).toBeVisible()
    await page.getByRole('button', { name: /Passo 1: Como te chamar/ }).click()
    await expect(page.getByRole('heading', { name: 'Como te chamar' })).toBeVisible()
  })

  test('o último passo leva à folha de lançamento de verdade', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByRole('button', { name: /Passo 7: Seu primeiro gasto/ }).click()
    await page.getByRole('link', { name: 'Lançar meu primeiro gasto' }).click()
    // O guia não tem formulário próprio: usa `?novo=1`, o mesmo atalho do
    // manifest. Confirmo a FOLHA aberta, e não o endereço — a tela consome o
    // parâmetro na hora, para o botão voltar não reabrir a folha.
    await expect(page.getByRole('heading', { name: 'Novo gasto' })).toBeVisible()
  })

  test('"está bom assim" resolve o passo que não dá para derivar', async ({ page }) => {
    await prepararApp(page, contaNova())
    await page.goto('/painel')
    await page.getByRole('button', { name: /Passo 4: As categorias/ }).click()
    await page.getByRole('button', { name: 'Está bom assim' }).click()

    const gravadas = await escritas(page)
    const salva = gravadas.find(
      (e) => e.chave === 'profiles.atualizarPerfil' && 'onboarding_vistos' in (e.args[0] as object),
    )
    expect((salva?.args[0] as { onboarding_vistos: string[] }).onboarding_vistos).toEqual(['categorias'])
  })
})

test.describe('configurações', () => {
  test.beforeEach(async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/configuracoes')
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
  })

  /** Abre a seção — índice lateral no PC, aba rolável no celular. */
  async function abrirSecao(page: import('@playwright/test').Page, rotulo: string | RegExp) {
    const alvo = page.getByRole('tab', { name: rotulo })
    if (await alvo.count()) await alvo.click()
    else await page.getByRole('link', { name: rotulo }).click()
  }

  test('as oito seções da fase 6 existem, nos dois tamanhos', async ({ page, isMobile }) => {
    const rotulos = [
      'Perfil',
      'Aparência',
      'Lembretes',
      /Categorias/,
      /pagamento|Pagamento/,
      'Metas',
      /dados|Dados/,
      /Segurança/,
    ]
    for (const rotulo of rotulos) {
      const papel = isMobile ? 'tab' : 'link'
      await expect(page.getByRole(papel, { name: rotulo }).first()).toBeVisible()
    }
  })

  test('o perfil saiu de dentro de "Aparência" e tem seção própria', async ({ page }) => {
    await abrirSecao(page, 'Perfil')
    // `exact`: no PC as oito seções renderizam juntas, e "Nome da categoria",
    // "Nome do item" e "Nome da forma de pagamento" também casariam.
    await expect(page.getByLabel('Nome', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seu perfil' })).toBeVisible()
  })

  test('a seção de dados aponta para onde a importação realmente mora', async ({ page }) => {
    await abrirSecao(page, /dados|Dados/)
    await expect(page.getByRole('heading', { name: 'Importar extrato' })).toBeVisible()
    await page.getByRole('link', { name: 'Ir para o controle mensal' }).click()
    await expect(page).toHaveURL(/\/mes\?aba=gastos/)
  })
})

test.describe('segurança e sessão', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/configuracoes')
    if (isMobile) await page.getByRole('tab', { name: /Segurança/ }).click()
    await expect(page.getByRole('heading', { name: 'Trocar a senha' })).toBeVisible()
  })

  test('mostra o e-mail da conta e a saída, sem prometer o que não faz', async ({ page }) => {
    await expect(page.getByText('teste@finz.local')).toBeVisible()
    // Dentro do `main`: a moldura do app tem o próprio "Sair da conta", e é o
    // desta seção que precisa existir.
    await expect(page.getByRole('main').getByRole('button', { name: 'Sair da conta' })).toBeVisible()
    // A seção só existe "caso existam opções reais": o que não dá para fazer
    // com a chave pública está escrito como não dá.
    await expect(page.getByText(/encerrar a conta não são feitos pelo app/)).toBeVisible()
  })

  test('senha curta e senha que não confere são recusadas antes de sair do app', async ({ page }) => {
    await page.getByLabel('Nova senha', { exact: true }).fill('123')
    await page.getByLabel('Confirmar nova senha').fill('123')
    await page.getByRole('button', { name: 'Trocar senha' }).click()
    await expect(page.getByText('A senha precisa ter pelo menos 6 caracteres')).toBeVisible()

    await page.getByLabel('Nova senha', { exact: true }).fill('senhanova')
    await page.getByLabel('Confirmar nova senha').fill('senhaoutra')
    await page.getByRole('button', { name: 'Trocar senha' }).click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    expect(gravadas.some((e) => e.chave === 'supabase.auth.updateUser')).toBe(false)
  })

  test('senha válida chega ao Supabase', async ({ page }) => {
    await page.getByLabel('Nova senha', { exact: true }).fill('senhanova')
    await page.getByLabel('Confirmar nova senha').fill('senhanova')
    await page.getByRole('button', { name: 'Trocar senha' }).click()

    await expect(page.getByText('Senha trocada')).toBeVisible()
    const gravadas = await page.evaluate(() => window.__ESCRITAS__ ?? [])
    const troca = gravadas.find((e) => e.chave === 'supabase.auth.updateUser')
    expect(troca?.args[0]).toEqual({ password: 'senhanova' })
  })
})

test.describe('ajuda', () => {
  test.beforeEach(async ({ page }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/ajuda')
    await expect(page.getByRole('heading', { name: 'Ajuda', exact: true })).toBeVisible()
  })

  test('a busca acha o assunto e diz por que ele apareceu', async ({ page }) => {
    await page.getByLabel('Buscar na ajuda').fill('não desconta')
    await expect(page.getByText('1 assunto encontrado')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Competência e caixa' })).toBeVisible()
    // O realce responde "por que este apareceu" — e ele acha o texto COM acento
    // a partir da busca sem acento.
    await expect(page.locator('mark', { hasText: 'não' }).first()).toBeVisible()
    // E o resto do manual sai da tela.
    await expect(page.getByRole('heading', { name: 'Atalhos de teclado' })).toHaveCount(0)
  })

  test('a busca ignora acento e maiúscula', async ({ page }) => {
    await page.getByLabel('Buscar na ajuda').fill('COMPETENCIA')
    await expect(page.getByRole('heading', { name: 'Competência e caixa' })).toBeVisible()
    // O realce cai em cima da palavra acentuada, e não uma letra ao lado.
    await expect(page.locator('mark').first()).toHaveText('Competência')
  })

  test('busca sem resposta mostra o vazio, e não o manual inteiro', async ({ page }) => {
    await page.getByLabel('Buscar na ajuda').fill('criptomoeda')
    await expect(page.getByText('Nada na ajuda sobre isso')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Atalhos de teclado' })).toHaveCount(0)
  })

  test('os seis assuntos que a fase 6 exige estão escritos', async ({ page }) => {
    for (const titulo of [
      'Competência e caixa',
      'Como a fatura do cartão é calculada',
      'Compras parceladas',
      'Backup e restauração',
      'O app sem internet',
      'Importar extrato em CSV',
    ]) {
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
    }
  })

  test('o link do painel de faturas leva ao assunto certo, nos dois tamanhos', async ({ page }) => {
    await page.goto('/mes?aba=resumo')
    await page
      .getByRole('link', { name: 'Como a fatura é calculada' })
      .locator('visible=true')
      .first()
      .click()
    await expect(page).toHaveURL(/\/ajuda#fatura$/)
    // O bloco apontado fica destacado: quem foi MANDADO para cá não escolheu o
    // destino, e sem a marca teria doze blocos para adivinhar qual é.
    await expect(page.locator('#fatura')).toHaveClass(/ring-2/)
  })
})

test.describe('alvos de toque e layout', () => {
  test('nenhum alvo abaixo de 44px no celular, e nada rola de lado', async ({ page, isMobile }) => {
    // 03/08 põe o painel de lembretes na tela: o alvo que só aparece perto de
    // um vencimento é justamente o que passaria despercebido nesta varredura.
    await fixarHoje(page, '2025-08-03T10:00:00')
    await prepararApp(page, fixtureMes())
    for (const rota of [
      '/painel',
      '/mes?aba=resumo',
      '/mes?aba=gastos',
      '/metas',
      '/configuracoes',
      '/ajuda',
      '/comparativo',
    ]) {
      await page.goto(rota)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await page.waitForTimeout(300)

      const r = await medirAlvos(page)
      expect(r.estouro, `${rota} rola de lado`).toBe(0)
      if (isMobile) expect(r.pequenos, `${rota}`).toEqual([])
    }
  })

  /**
   * A MESMA medição, com a seleção ligada.
   *
   * O modo de marcação troca cada card por um <label> com caixa dentro e põe
   * uma barra de cinco botões presa ao rodapé — nada disso existe no DOM com a
   * seleção desligada, então a varredura acima passa por ele sem olhar. É o
   * mesmo vão que deixou /ajuda com alvos de 23px durante meses.
   */
  test('nenhum alvo abaixo de 44px com a seleção ligada', async ({ page, isMobile }) => {
    await prepararApp(page, fixtureMes())
    await page.goto('/mes?aba=gastos')
    await expect(page.getByRole('heading', { name: 'Controle mensal' })).toBeVisible()

    await page.getByRole('button', { name: 'Marcar', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Marcar Mercado Dia' }).locator('visible=true').click()
    await expect(page.getByRole('group', { name: 'Ações para os lançamentos marcados' })).toBeVisible()

    const r = await medirAlvos(page)
    expect(r.estouro, 'a barra de seleção faz a página rolar de lado').toBe(0)
    if (isMobile) expect(r.pequenos, 'alvos pequenos no modo de marcação').toEqual([])
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

  /**
   * A 0019 deixou a meta sem prazo intocada, e este teste guardava isso. A
   * fase 6 pede projeção de conclusão "quando houver base suficiente", e a
   * base é a mesma do ritmo — então a meta sem prazo passou a responder
   * "quando eu chego lá?". O que ela NÃO pode fazer é falar de prazo, que ela
   * não tem; é essa metade que continua guardada aqui.
   */
  test('meta sem prazo prevê a conclusão, mas nunca fala em prazo', async ({ page }) => {
    await fixarHoje(page, '2025-08-15T10:00:00')
    await prepararApp(page, metaComPrazo({ prazo_ano: null, prazo_mes: null }))
    await page.goto('/metas')

    await expect(page.getByText('Reserva').first()).toBeVisible()
    await expect(page.getByText(/em \d+ meses/)).toHaveCount(0)
    await expect(page.getByText(/O prazo era/)).toHaveCount(0)

    // R$ 6.000,00 de R$ 10.000,00, guardando R$ 800,00 por mês.
    await expect(page.getByText(/Faltam .* para a meta/)).toBeVisible()
    await expect(page.getByText(/No ritmo deste ano/)).toBeVisible()
  })

  test('meta sem prazo e sem base diz o que falta, e não chuta a data', async ({ page }) => {
    // Fevereiro: menos meses decorridos do que o mínimo de ritmo. "No seu
    // ritmo você chega em 2041" seria extrapolação de um mês.
    await fixarHoje(page, '2025-02-10T10:00:00')
    await prepararApp(page, {
      ...metaComPrazo({ prazo_ano: null, prazo_mes: null }),
      'goals.listarAportesDoAno': [
        { id: 'a1', user_id: 'u', goal_id: 'g1', ano: 2025, mes: 1, valor_centavos: 80000, created_at: '' },
      ],
    })
    await page.goto('/metas')

    await expect(page.getByText(/Faltam .* para a meta/)).toBeVisible()
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

test.describe('backup e restauração', () => {
  /** Um plano pronto, como o serviço devolveria depois de ler o arquivo. */
  function planoDeExemplo(entram: number) {
    return {
      itens: [
        {
          tabela: 'categories',
          rotulo: 'Categorias',
          noArquivo: 3,
          entram,
          jaExistem: 3 - entram,
          linhas: [],
        },
      ],
      totalEntram: entram,
      totalJaExistem: 3 - entram,
      descartadas: 0,
    }
  }

  const arquivo = { name: 'finz-backup-2026-08-31.json', mimeType: 'application/json' }

  async function abrirDados(page: import('@playwright/test').Page, isMobile: boolean) {
    await page.goto('/configuracoes')
    if (isMobile) await page.getByRole('tab', { name: 'Dados' }).click()
  }

  test('baixar backup pede o arquivo completo ao serviço', async ({ page, isMobile }) => {
    await prepararApp(page, {
      ...appCompleto(),
      'backup.obterBackupCompleto': {
        formato: 'finz-backup',
        versao: 1,
        geradoEm: '2026-08-31T12:00:00.000Z',
        dados: { categories: [{ id: 'c1' }] },
      },
    })
    await abrirDados(page, isMobile)

    const botao = page.getByRole('button', { name: /baixar backup/i })
    await expect(botao).toBeVisible()
    expect((await botao.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

    await botao.click()
    await expect(page.getByText(/Backup gerado com 1 linhas/)).toBeVisible()
  })

  test('a prévia diz o que entra antes de gravar, e só então libera o botão', async ({ page, isMobile }) => {
    await prepararApp(page, {
      ...appCompleto(),
      'backup.obterPlanoDeRestauracao': planoDeExemplo(2),
    })
    await abrirDados(page, isMobile)

    await page.getByLabel('Arquivo de backup').setInputFiles({
      ...arquivo,
      buffer: Buffer.from(JSON.stringify({ formato: 'finz-backup', versao: 1, dados: {} })),
    })

    // Escopo no diálogo: "Categorias" também é o nome de uma seção da própria
    // tela de configurações, e sem isto o seletor casa quatro elementos.
    const previa = page.getByRole('dialog')
    await expect(previa.getByText('O que vai entrar')).toBeVisible()
    await expect(previa.getByText(/Nada do que já está aqui será apagado ou alterado/)).toBeVisible()
    await expect(previa.getByText('Categorias')).toBeVisible()
    // O número, não só o rótulo: 2 entram e 1 já está aqui.
    await expect(previa.getByText('+2')).toBeVisible()
    await expect(previa.getByText(/1 já estão aqui/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Restaurar 2 linhas' })).toBeVisible()
  })

  test('arquivo que não é backup do finZ é recusado antes de qualquer escrita', async ({
    page,
    isMobile,
  }) => {
    await prepararApp(page, appCompleto())
    await abrirDados(page, isMobile)

    await page
      .getByLabel('Arquivo de backup')
      .setInputFiles({ ...arquivo, buffer: Buffer.from('{"qualquer":"coisa"}') })

    await expect(page.getByRole('alert')).toContainText(/não é um backup do finZ/)
    await expect(page.getByText('O que vai entrar')).toHaveCount(0)
    const gravadas = await escritas(page)
    expect(gravadas.find((e) => e.chave === 'backup.restaurar')).toBeUndefined()
  })

  test('nada novo no arquivo: o botão diz isso e não grava', async ({ page, isMobile }) => {
    await prepararApp(page, {
      ...appCompleto(),
      'backup.obterPlanoDeRestauracao': planoDeExemplo(0),
    })
    await abrirDados(page, isMobile)

    await page.getByLabel('Arquivo de backup').setInputFiles({
      ...arquivo,
      buffer: Buffer.from(JSON.stringify({ formato: 'finz-backup', versao: 1, dados: {} })),
    })

    const botao = page.getByRole('button', { name: /nada para restaurar/i })
    await expect(botao).toBeVisible()
    await expect(botao).toBeDisabled()
  })

  test('trocar as configurações é escolha à parte, e vem desmarcada', async ({ page, isMobile }) => {
    await prepararApp(page, {
      ...appCompleto(),
      'backup.obterPlanoDeRestauracao': planoDeExemplo(2),
      'backup.restaurar': { gravadas: 2, renomeadas: 0, perfilRestaurado: false },
    })
    await abrirDados(page, isMobile)

    await page.getByLabel('Arquivo de backup').setInputFiles({
      ...arquivo,
      buffer: Buffer.from(
        JSON.stringify({ formato: 'finz-backup', versao: 1, dados: {}, perfil: { nome: 'Pietro' } }),
      ),
    })

    const caixa = page.getByRole('checkbox', { name: /trocar também minhas configurações/i })
    await expect(caixa).toBeVisible()
    await expect(caixa).not.toBeChecked()

    // Sem marcar, o perfil não viaja para o serviço.
    await page.getByRole('button', { name: 'Restaurar 2 linhas' }).click()
    await expect(page.getByText(/linhas restauradas|Nada novo para restaurar/)).toBeVisible()
    const chamada = (await escritas(page)).find((e) => e.chave === 'backup.restaurar')
    expect((chamada?.args[1] as { perfil: unknown }).perfil).toBeNull()
  })
})

test.describe('compra fora do padrão', () => {
  /**
   * Cinco compras de R$ 100 em julho — o histórico — e uma de R$ 500 em
   * agosto — a candidata, 5× a média e acima do piso de R$ 50.
   */
  function comCompraAtipica() {
    const historico = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      data: '2026-07-10',
      descricao: 'Mercado',
      valor_centavos: 10000,
      tipo: 'gasto',
      category_id: 'c1',
      payment_method_id: 'p1',
      parcelamento_id: null,
    }))
    return {
      ...appCompleto(),
      'transactions.listarGastosRecentes': historico,
      'mes.carregarMes': {
        ...mesPadrao(),
        lancamentos: [
          {
            id: 'atipico',
            user_id: 'u',
            data: '2026-08-12',
            descricao: 'Compra grande',
            payment_method_id: 'p1',
            category_id: 'c1',
            valor_centavos: 50000,
            tipo: 'gasto',
            created_at: '',
            fingerprint: null,
            parcelamento_id: null,
            parcela: null,
            parcelas_total: null,
          },
        ],
        gastosFixos: [],
        faturas: [],
      },
    }
  }

  test('a compra que é 4x ou mais a média da categoria aparece com o número', async ({ page }) => {
    await fixarHoje(page, '2026-08-18T10:00:00')
    await prepararApp(page, comCompraAtipica())
    await page.goto('/painel')

    const linha = page.getByRole('link', { name: /a sua média em Mercado/ })
    await expect(linha).toBeVisible()
    await expect(linha).toContainText('5× a sua média em Mercado')
    await expect(linha).toContainText('normalmente')
    await expect(linha).toContainText('100,00')
    await expect(linha).toContainText('500,00')
  })

  test('sem histórico suficiente, o painel não fala nada sobre a compra', async ({ page }) => {
    await fixarHoje(page, '2026-08-18T10:00:00')
    const fixture = comCompraAtipica()
    // Só duas no histórico: abaixo do mínimo de cinco.
    fixture['transactions.listarGastosRecentes'] = fixture['transactions.listarGastosRecentes'].slice(0, 2)
    await prepararApp(page, fixture)
    await page.goto('/painel')

    await expect(page.getByText(/Gastos por categoria/i)).toBeVisible()
    await expect(page.getByText(/a sua média em/)).toHaveCount(0)
  })
})
