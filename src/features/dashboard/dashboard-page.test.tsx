import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * O painel personalizável (fase 4), pela porta da frente.
 *
 * `src/lib/painel.test.ts` já cobre a aritmética de ordem e visibilidade. O
 * que se testa AQUI é o que aquele não alcança: que os botões da tela chamam
 * a aritmética certa, que o resultado vira ordem na marcação, e que o painel
 * grava no perfil o que a pessoa acabou de fazer.
 *
 * Os serviços são dublês para o cliente Supabase — que exige variáveis de
 * ambiente — nunca ser carregado.
 */
/** O store de auth importa o cliente real, que exige variáveis de ambiente. */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const atualizarPerfil = vi.fn(async (mudancas: Record<string, unknown>) => ({
  ...perfilBase(),
  ...mudancas,
}))

vi.mock('@/services/profiles', () => ({
  atualizarPerfil: (m: Record<string, unknown>) => atualizarPerfil(m),
  obterPerfil: vi.fn(async () => perfilBase()),
}))

/**
 * Os relatórios ficam em consts para cada teste poder trocar a resposta.
 *
 * O painel decide o que desenhar a partir DELES — o mês em branco é
 * "resumo zerado e nenhuma categoria" —, então testar essa decisão exige
 * mandar números diferentes, e não um dublê fixo.
 */
const obterResumoMensal = vi.fn()
const obterGastosPorCategoria = vi.fn()

const RESUMO_COM_MOVIMENTO = {
  total_entradas: 300_000,
  total_saidas: 120_000,
  saldo: 180_000,
  total_investido: 50_000,
  percentual_investido: 16,
}
const RESUMO_ZERADO = {
  total_entradas: 0,
  total_saidas: 0,
  saldo: 0,
  total_investido: 0,
  percentual_investido: 0,
}

vi.mock('@/services/reports', () => ({
  obterResumoMensal: () => obterResumoMensal(),
  obterGastosPorCategoria: () => obterGastosPorCategoria(),
  obterComparativoAnual: vi.fn(async () => []),
}))

vi.mock('@/services/mes', () => ({
  carregarMes: vi.fn(async () => ({
    formasPagamento: [],
    categorias: [],
    metas: [],
    entradas: [],
    gastosFixos: [],
    pagamentosFixos: [],
    lancamentos: [],
    investimentos: [],
    faturas: [],
    entradasRecorrentes: [],
  })),
}))

vi.mock('@/services/transactions', () => ({
  listarGastosRecentes: vi.fn(async () => []),
}))

function perfilBase() {
  return {
    id: 'u',
    nome: 'Pietro Teste',
    tema: 'rosa' as const,
    created_at: '',
    orcamento_centavos: 0,
    preferencias_lembrete: {},
    assinaturas_ignoradas: {},
    onboarding_em: '2025-01-01T00:00:00Z',
    onboarding_vistos: [],
    painel_ordem: [] as string[],
    painel_ocultos: [] as string[],
    painel_capa: 'aurora',
  }
}

import { DashboardPage } from './dashboard-page'
import { ProvedorCache, criarClienteCache } from '@/lib/cache'
import { useAuthStore } from '@/store/auth'

/** Os blocos do painel, na ordem em que aparecem na tela. */
async function ordemNaTela() {
  // Em modo de edição cada bloco é uma <section> com o nome dele; é a única
  // marcação que expõe a ordem sem depender do conteúdo de cada card.
  return (await screen.findAllByRole('region')).map((s) => s.getAttribute('aria-label'))
}

/**
 * Clicar e deixar o React aplicar o que veio depois.
 *
 * O projeto usa `fireEvent` e não o `user-event`, que não é dependência daqui.
 * O `act` em volta existe porque cada clique do painel dispara uma gravação
 * otimista: o estado muda na hora e a promessa do serviço resolve num
 * microtask depois. Sem isto o React avisa de atualização fora de `act` e a
 * asserção seguinte lê a tela de antes.
 */
async function clicar(alvo: HTMLElement) {
  await act(async () => {
    fireEvent.click(alvo)
  })
}

function montar() {
  // Cliente novo a cada teste: um compartilhado carregaria para o próximo o
  // resumo já resolvido do anterior, e o estado de carregamento — que decide
  // se o bloco vira Skeleton ou card — deixaria de ser o mesmo em todos.
  return render(
    <ProvedorCache cliente={criarClienteCache()}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ProvedorCache>,
  )
}

describe('painel personalizável', () => {
  beforeEach(() => {
    atualizarPerfil.mockClear()
    obterResumoMensal.mockResolvedValue(RESUMO_COM_MOVIMENTO)
    obterGastosPorCategoria.mockResolvedValue([
      { category_id: 'c1', nome: 'Mercado', cor: '#a5f6d8', gasto_centavos: 120_000 },
    ])
    useAuthStore.setState({ profile: perfilBase() as never })
  })

  it('abre com os quatro blocos de fábrica, e sem controle de edição à mostra', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)

    // Fora do modo de edição a moldura não desenha nada: nem título de bloco,
    // nem setas. É o painel de antes da fase 4.
    expect(screen.queryByRole('button', { name: /mover/i })).toBeNull()
    expect(screen.getByRole('button', { name: /personalizar/i })).toBeInTheDocument()
  })

  it('"Personalizar" revela os blocos na ordem de fábrica', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    expect(await ordemNaTela()).toEqual([
      'Personalizar o painel',
      'Gastos por categoria',
      'Observações do mês',
      'Resumo do mês',
      'Atalhos',
      'Orçamento do mês',
    ])
  })

  it('descer um bloco muda a tela E grava a ordem no perfil', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    await clicar(screen.getByRole('button', { name: 'Mover Gastos por categoria para baixo' }))

    await waitFor(async () =>
      expect(await ordemNaTela()).toEqual([
        'Personalizar o painel',
        'Observações do mês',
        'Gastos por categoria',
        'Resumo do mês',
        'Atalhos',
        'Orçamento do mês',
      ]),
    )

    expect(atualizarPerfil).toHaveBeenCalledWith({
      painel_ordem: ['observacoes', 'categorias', 'saldo', 'atalhos', 'orcamento'],
    })
  })

  it('no topo, subir não grava nada', async () => {
    // A seta fica desabilitada, então não há clique para gravar. O teste
    // existe porque a alternativa — deixar clicar e gravar a mesma ordem —
    // manda uma escrita ao Supabase por um toque que não mudou nada.
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    const subirPrimeiro = screen.getByRole('button', { name: 'Mover Gastos por categoria para cima' })
    expect(subirPrimeiro).toBeDisabled()
    await clicar(subirPrimeiro)
    expect(atualizarPerfil).not.toHaveBeenCalled()
  })

  it('esconder tira o bloco da tela e o oferece de volta na bandeja', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))
    await clicar(screen.getByRole('button', { name: 'Esconder Atalhos' }))

    await waitFor(async () => expect(await ordemNaTela()).not.toContain('Atalhos'))

    // Esconder guarda a ordem JUNTO, para o bloco saber de onde saiu.
    expect(atualizarPerfil).toHaveBeenCalledWith({
      painel_ocultos: ['atalhos'],
      painel_ordem: ['categorias', 'observacoes', 'saldo', 'atalhos', 'orcamento'],
    })

    const bandeja = screen.getByRole('region', { name: 'Personalizar o painel' })
    expect(within(bandeja).getByRole('button', { name: /atalhos/i })).toBeInTheDocument()
  })

  it('esconder e mostrar de novo devolve o bloco ao MESMO lugar', async () => {
    // É a razão de `ordemParaSalvar` ancorar os escondidos. Sem isso o bloco
    // voltaria no fim do painel, e "esconder" viraria caminho só de ida.
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))
    await clicar(screen.getByRole('button', { name: 'Esconder Observações do mês' }))

    await waitFor(async () => expect(await ordemNaTela()).not.toContain('Observações do mês'))

    const bandeja = screen.getByRole('region', { name: 'Personalizar o painel' })
    await clicar(within(bandeja).getByRole('button', { name: /observações do mês/i }))

    await waitFor(async () =>
      expect(await ordemNaTela()).toEqual([
        'Personalizar o painel',
        'Gastos por categoria',
        'Observações do mês',
        'Resumo do mês',
        'Atalhos',
        'Orçamento do mês',
      ]),
    )
  })

  it('esconder tudo deixa uma saída na tela, e não um painel em branco', async () => {
    useAuthStore.setState({
      profile: {
        ...perfilBase(),
        painel_ocultos: ['categorias', 'observacoes', 'saldo', 'atalhos', 'orcamento'],
      } as never,
    })
    montar()
    await screen.findByText(/olá, pietro/i)

    expect(screen.getByText(/escondeu todos os blocos/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /personalizar o painel/i })).toBeInTheDocument()
  })

  it('trocar a capa grava só o NOME dela', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    const capas = screen.getByRole('group', { name: 'Capa do painel' })
    await clicar(within(capas).getByRole('button', { name: 'Mata' }))

    // O nome, e não o gradiente: é o que faz a capa acompanhar o tema e
    // sobreviver a uma mudança no desenho dela.
    expect(atualizarPerfil).toHaveBeenCalledWith({ painel_capa: 'mata' })
  })

  it('uma capa aposentada no perfil não quebra o painel', async () => {
    useAuthStore.setState({ profile: { ...perfilBase(), painel_capa: 'capa-que-nao-existe' } as never })
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    const capas = screen.getByRole('group', { name: 'Capa do painel' })
    expect(within(capas).getByRole('button', { name: 'Aurora' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('um widget que o app não conhece mais não vira bloco fantasma', async () => {
    useAuthStore.setState({
      profile: { ...perfilBase(), painel_ordem: ['saldo', 'widget-aposentado', 'categorias'] } as never,
    })
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    // 'saldo' e 'categorias' vieram da ordem salva; os três que ela não
    // menciona entram atrás, na ordem que o app declara — inclusive o
    // 'orcamento', que nasceu depois de esta conta já ter sido personalizada.
    expect(await ordemNaTela()).toEqual([
      'Personalizar o painel',
      'Resumo do mês',
      'Gastos por categoria',
      'Observações do mês',
      'Atalhos',
      'Orçamento do mês',
    ])
  })

  it('"Voltar ao padrão" limpa as três colunas de uma vez', async () => {
    useAuthStore.setState({
      profile: {
        ...perfilBase(),
        painel_ordem: ['atalhos', 'saldo'],
        painel_ocultos: ['categorias'],
        painel_capa: 'noite',
      } as never,
    })
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))
    await clicar(screen.getByRole('button', { name: /voltar ao padrão/i }))

    expect(atualizarPerfil).toHaveBeenCalledWith({
      painel_ordem: [],
      painel_ocultos: [],
      painel_capa: 'aurora',
    })
  })

  it('mês em branco mostra um caminho, e não quatro blocos vazios', async () => {
    // Antes, um mês recém-começado abria com um donut "Sem dados", cards
    // zerados e nenhuma saída. Informava que não havia informação, e só.
    obterResumoMensal.mockResolvedValue(RESUMO_ZERADO)
    obterGastosPorCategoria.mockResolvedValue([])
    montar()
    await screen.findByText(/ainda está em branco/i)

    expect(screen.getByRole('link', { name: /lançar o primeiro gasto/i })).toHaveAttribute(
      'href',
      '/mes?aba=gastos&novo=1',
    )
    // E os blocos vazios saem de cena: eram a segunda mensagem de vazio
    // seguida, repetindo a primeira com menos ajuda.
    expect(screen.queryByText('Gastos por categoria')).toBeNull()
  })

  it('um mês com qualquer movimento NÃO mostra o convite', async () => {
    montar()
    await screen.findByText(/olá, pietro/i)
    expect(screen.queryByText(/ainda está em branco/i)).toBeNull()
  })

  it('fatura de outro mês vencendo aqui já conta como movimento', async () => {
    // `total_saidas` é CAIXA: uma compra do mês passado que vence agora faz o
    // mês ter movimento sem nenhum gasto novo lançado. Chamar isso de "em
    // branco" mandaria a pessoa lançar um gasto num mês que tem dinheiro
    // saindo.
    obterResumoMensal.mockResolvedValue({ ...RESUMO_ZERADO, total_saidas: 45_000, saldo: -45_000 })
    obterGastosPorCategoria.mockResolvedValue([])
    montar()
    await screen.findByText(/olá, pietro/i)
    expect(screen.queryByText(/ainda está em branco/i)).toBeNull()
  })

  it('no modo de edição os blocos voltam, mesmo com o mês em branco', async () => {
    // Sem isto, quem tem um mês vazio não consegue arranjar o painel: os
    // blocos precisam estar à vista justamente para receberem as setas.
    obterResumoMensal.mockResolvedValue(RESUMO_ZERADO)
    obterGastosPorCategoria.mockResolvedValue([])
    montar()
    await screen.findByText(/ainda está em branco/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))

    expect(await ordemNaTela()).toEqual([
      'Personalizar o painel',
      'Gastos por categoria',
      'Observações do mês',
      'Resumo do mês',
      'Atalhos',
      'Orçamento do mês',
    ])
    expect(screen.queryByText(/ainda está em branco/i)).toBeNull()
  })

  it('se a gravação falhar, o painel volta ao que era e avisa', async () => {
    atualizarPerfil.mockRejectedValueOnce(new Error('sem rede'))
    montar()
    await screen.findByText(/olá, pietro/i)
    await clicar(screen.getByRole('button', { name: /personalizar/i }))
    await clicar(screen.getByRole('button', { name: 'Esconder Atalhos' }))

    // O update é otimista: some na hora e volta quando o servidor recusa. Sem
    // esse retorno, a pessoa fecharia o app achando que gravou.
    await waitFor(async () => expect(await ordemNaTela()).toContain('Atalhos'))
  })
})
