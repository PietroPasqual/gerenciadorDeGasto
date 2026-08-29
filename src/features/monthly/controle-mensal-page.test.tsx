import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Teste de fumaça da tela mais importante: com os serviços mockados,
 * a página precisa montar, somar os totais e mostrar o resumo do mês.
 * Os mocks substituem os módulos de serviço, então o cliente Supabase
 * (que exige variáveis de ambiente) nunca é carregado.
 */
vi.mock('@/services/payment-methods', () => ({
  listarFormasPagamento: vi.fn(async () => [
    { id: 'pm1', user_id: 'u', nome: 'Pix', tipo: 'pix', ativo: true, ordem: 1, created_at: '' },
  ]),
}))

vi.mock('@/services/categories', () => ({
  listarCategorias: vi.fn(async () => [
    {
      id: 'cat1',
      user_id: 'u',
      nome: 'Mercado',
      limite_centavos: 50_000,
      cor: '#a5f6d8',
      ordem: 1,
      created_at: '',
    },
  ]),
}))

vi.mock('@/services/goals', () => ({
  MAX_METAS: 10,
  listarMetas: vi.fn(async () => [
    { id: 'g1', user_id: 'u', nome: 'Reserva', valor_meta_centavos: 1_000_000, ordem: 1, created_at: '' },
  ]),
  listarAportesDoMes: vi.fn(async () => [
    { id: 'a1', user_id: 'u', goal_id: 'g1', ano: 2026, mes: 8, valor_centavos: 20_000, created_at: '' },
  ]),
  salvarAporte: vi.fn(),
}))

vi.mock('@/services/incomes', () => ({
  listarEntradas: vi.fn(async () => [
    {
      id: 'i1',
      user_id: 'u',
      ano: 2026,
      mes: 8,
      descricao: 'Salário',
      valor_centavos: 300_000,
      created_at: '',
    },
  ]),
  criarEntrada: vi.fn(),
  atualizarEntrada: vi.fn(),
  excluirEntrada: vi.fn(),
}))

vi.mock('@/services/fixed-expenses', () => ({
  listarGastosFixos: vi.fn(async () => [
    {
      id: 'f1',
      user_id: 'u',
      nome: 'Aluguel',
      payment_method_id: 'pm1',
      category_id: 'cat1',
      valor_centavos: 120_000,
      dia_vencimento: 5,
      ativo: true,
      ordem: 1,
      created_at: '',
    },
  ]),
  listarPagamentosDoMes: vi.fn(async () => []),
  criarGastoFixo: vi.fn(),
  atualizarGastoFixo: vi.fn(),
  excluirGastoFixo: vi.fn(),
  marcarPagamento: vi.fn(),
}))

vi.mock('@/services/transactions', () => ({
  listarLancamentos: vi.fn(async () => [
    {
      id: 't1',
      user_id: 'u',
      data: '2026-08-10',
      descricao: 'Feira',
      payment_method_id: 'pm1',
      category_id: 'cat1',
      valor_centavos: 25_000,
      tipo: 'gasto',
      created_at: '',
    },
  ]),
  criarLancamento: vi.fn(),
  atualizarLancamento: vi.fn(),
  excluirLancamento: vi.fn(),
}))

vi.mock('@/services/investments', () => ({
  listarInvestimentos: vi.fn(async () => []),
  criarInvestimento: vi.fn(),
  atualizarInvestimento: vi.fn(),
  excluirInvestimento: vi.fn(),
}))

import { ControleMensalPage } from './controle-mensal-page'
import { usePeriodoStore } from '@/store/periodo'

describe('ControleMensalPage', () => {
  beforeEach(() => {
    usePeriodoStore.setState({ ano: 2026, mes: 8 })
    // Recharts precisa de dimensões; jsdom devolve 0 sem isso.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 })
  })

  it('mostra o mês selecionado e os lançamentos carregados', async () => {
    render(
      <MemoryRouter>
        <ControleMensalPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Agosto')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByDisplayValue('Salário')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Aluguel')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Feira')).toBeInTheDocument()
  })

  it('soma entradas, saídas e saldo do mês no resumo', async () => {
    render(
      <MemoryRouter>
        <ControleMensalPage />
      </MemoryRouter>,
    )

    // Entradas 3.000,00 | Saídas 120.000 + 25.000 centavos = 1.450,00 | Saldo 1.550,00
    const entradas = await screen.findByLabelText(/^R\$\s?3\.000,00$/)
    expect(entradas).toBeInTheDocument()
    expect(screen.getByLabelText(/^R\$\s?1\.450,00$/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^R\$\s?1\.550,00$/)).toBeInTheDocument()
  })
})
