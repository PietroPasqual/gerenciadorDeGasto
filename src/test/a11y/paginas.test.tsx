import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { ProvedorCache, criarClienteCache } from '@/lib/cache'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Varredura automática de acessibilidade nas telas principais, em jsdom.
 *
 * O QUE ESTA SUÍTE PEGA: rótulo ausente, papel ARIA inválido, ordem de
 * cabeçalho, atributo mal formado — tudo que se decide lendo a marcação.
 * Roda em `npm run test`, em segundos, a cada salvamento.
 *
 * O QUE ELA NÃO PEGA, E NÃO É QUESTÃO DE CONFIGURAÇÃO: contraste e tamanho de
 * alvo. Ambos precisam de layout PINTADO — o axe não tem como compor cor de
 * texto com cor de fundo, nem medir um botão, sem um motor de renderização.
 * Em jsdom ele devolve essas regras como `incomplete`, categoria que este
 * arquivo ignora. Prova: um parágrafo #eeeeee sobre #ffffff, praticamente
 * invisível, passava por aqui sem uma violação sequer.
 *
 * Este comentário já afirmou que a suíte cobria contraste. Não cobria, e
 * dentro desse ponto cego morava uma violação real: os meses futuros do
 * comparativo anual usavam `opacity-60`, que derrubava o texto para 2,54:1
 * contra o mínimo de 4,5:1, nos quatro temas.
 *
 * Quem cobre o que falta aqui é `e2e/acessibilidade.spec.ts`, que roda o mesmo
 * axe num Chromium de verdade.
 */
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/mes', () => ({
  carregarMes: vi.fn(async () => ({
    formasPagamento: [],
    categorias: [],
    metas: [],
    entradas: [],
    entradasRecorrentes: [],
    gastosFixos: [],
    pagamentos: [],
    lancamentos: [],
    investimentos: [],
    aportes: [],
    faturas: [],
    saldosMetas: {},
  })),
}))
vi.mock('@/services/reports', () => ({
  obterResumoMensal: vi.fn(async () => ({
    total_entradas: 500_000,
    total_saidas: 200_000,
    saldo: 300_000,
    total_investido: 50_000,
    percentual_investido: 10,
  })),
  obterGastosPorCategoria: vi.fn(async () => []),
  obterSaidasPorFormaPagamento: vi.fn(async () => []),
  obterInvestimentosPorMeta: vi.fn(async () => []),
  obterComparativoAnual: vi.fn(async () => []),
  obterResumoMetas: vi.fn(async () => []),
}))
vi.mock('@/services/goals', () => ({
  listarMetas: vi.fn(async () => []),
  listarAportesDoAno: vi.fn(async () => []),
  listarAportesDoMes: vi.fn(async () => []),
  salvarAporte: vi.fn(),
  criarMeta: vi.fn(),
  atualizarMeta: vi.fn(),
  excluirMeta: vi.fn(),
  resgatarDaMeta: vi.fn(),
  transferirEntreMetas: vi.fn(),
}))
vi.mock('@/services/wishlist', () => ({
  listarWishlist: vi.fn(async () => []),
  criarItemWishlist: vi.fn(),
  atualizarItemWishlist: vi.fn(),
  excluirItemWishlist: vi.fn(),
}))
vi.mock('@/services/categories', () => ({
  listarCategorias: vi.fn(async () => []),
  criarCategoria: vi.fn(),
  atualizarCategoria: vi.fn(),
  excluirCategoria: vi.fn(),
}))
vi.mock('@/services/payment-methods', () => ({
  listarFormasPagamento: vi.fn(async () => []),
  criarFormaPagamento: vi.fn(),
  atualizarFormaPagamento: vi.fn(),
  excluirFormaPagamento: vi.fn(),
}))
vi.mock('@/services/invoices', () => ({ definirFaturaPaga: vi.fn() }))
vi.mock('@/services/profiles', () => ({ atualizarPerfil: vi.fn() }))
vi.mock('@/services/category-rules', () => ({
  listarRegrasAprendidas: vi.fn(async () => []),
  aprenderRegra: vi.fn(),
  esquecerRegra: vi.fn(),
}))
vi.mock('@/services/recurring-incomes', () => ({
  criarEntradaRecorrente: vi.fn(),
  atualizarEntradaRecorrente: vi.fn(),
  excluirEntradaRecorrente: vi.fn(),
}))
vi.mock('@/services/incomes', () => ({
  criarEntrada: vi.fn(),
  atualizarEntrada: vi.fn(),
  excluirEntrada: vi.fn(),
}))
vi.mock('@/services/fixed-expenses', () => ({
  criarGastoFixo: vi.fn(),
  atualizarGastoFixo: vi.fn(),
  excluirGastoFixo: vi.fn(),
  marcarPagamento: vi.fn(),
}))
vi.mock('@/services/transactions', () => ({
  criarLancamento: vi.fn(),
  atualizarLancamento: vi.fn(),
  excluirLancamento: vi.fn(),
  criarParcelamento: vi.fn(),
  excluirSerie: vi.fn(),
  atualizarSerie: vi.fn(),
  criarLancamentosEmLote: vi.fn(),
  listarLancamentosPorIntervalo: vi.fn(async () => []),
  atualizarCategoriaDeVarios: vi.fn(),
}))
vi.mock('@/services/investments', () => ({
  criarInvestimento: vi.fn(),
  atualizarInvestimento: vi.fn(),
  excluirInvestimento: vi.fn(),
}))

import { ControleMensalPage } from '@/features/monthly/controle-mensal-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ComparativoAnualPage } from '@/features/annual/comparativo-anual-page'
import { MetasPage } from '@/features/goals/metas-page'
import { useAuthStore } from '@/store/auth'

useAuthStore.setState({
  profile: { id: 'u', nome: 'Teste', tema: 'rosa', created_at: '', orcamento_centavos: 0 },
} as never)

const telas: Array<[string, React.ComponentType]> = [
  ['painel', DashboardPage],
  ['controle mensal', ControleMensalPage],
  ['comparativo anual', ComparativoAnualPage],
  ['metas', MetasPage],
]

describe('acessibilidade das telas principais', () => {
  it.each(telas)(
    '%s não tem violação detectável pelo axe',
    async (_nome, Tela) => {
      const { container, findAllByRole } = render(
        <ProvedorCache cliente={criarClienteCache()}>
          <MemoryRouter>
            <TooltipProvider>
              <Tela />
            </TooltipProvider>
          </MemoryRouter>
        </ProvedorCache>,
      )
      // Espera a tela sair do skeleton: varrer o esqueleto não diz nada sobre a
      // tela de verdade.
      await findAllByRole('heading', {}, { timeout: 3000 })
      const resultado = await axe(container)
      // A lista de violações vem inteira na mensagem de falha, com o HTML do nó
      // e o link da regra — não vale resumir aqui e perder isso.
      expect(resultado.violations).toEqual([])
    },
    15_000,
  )
})
