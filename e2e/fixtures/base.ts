import { test as base, type Page } from '@playwright/test'

/** Um mês com um pouco de tudo — a fixture padrão das specs. */
export function mesPadrao() {
  const cat = 'c1'
  const pix = 'p1'
  const credito = 'p2'
  return {
    formasPagamento: [
      {
        id: pix,
        user_id: 'u',
        nome: 'Pix',
        tipo: 'pix',
        ativo: true,
        ordem: 1,
        created_at: '',
        dia_fechamento: null,
        dia_vencimento: null,
        fatura_inicio_ano: null,
        fatura_inicio_mes: null,
      },
      {
        id: credito,
        user_id: 'u',
        nome: 'Crédito',
        tipo: 'credito',
        ativo: true,
        ordem: 2,
        created_at: '',
        dia_fechamento: 20,
        dia_vencimento: 10,
        fatura_inicio_ano: 2025,
        fatura_inicio_mes: 1,
      },
    ],
    categorias: [
      {
        id: cat,
        user_id: 'u',
        nome: 'Mercado',
        limite_centavos: 50000,
        cor: '#a5f6d8',
        ordem: 1,
        created_at: '',
      },
    ],
    metas: [
      { id: 'g1', user_id: 'u', nome: 'Reserva', valor_meta_centavos: 1000000, ordem: 1, created_at: '' },
    ],
    entradas: [
      {
        id: 'i1',
        user_id: 'u',
        ano: 2025,
        mes: 8,
        descricao: 'Freela',
        valor_centavos: 80000,
        created_at: '',
      },
    ],
    entradasRecorrentes: [
      {
        id: 'r1',
        user_id: 'u',
        descricao: 'Salário',
        valor_centavos: 500000,
        dia_recebimento: 5,
        ativo: true,
        ordem: 1,
        created_at: '',
        inicio_ano: 2025,
        inicio_mes: 1,
        fim_ano: null,
        fim_mes: null,
      },
    ],
    gastosFixos: [
      {
        id: 'f1',
        user_id: 'u',
        nome: 'Aluguel',
        payment_method_id: pix,
        category_id: cat,
        valor_centavos: 180000,
        dia_vencimento: 5,
        ativo: true,
        ordem: 1,
        created_at: '',
        inicio_ano: null,
        inicio_mes: null,
        fim_ano: null,
        fim_mes: null,
      },
    ],
    pagamentos: [],
    lancamentos: [
      {
        id: 't1',
        user_id: 'u',
        data: '2025-08-05',
        descricao: 'Mercado Dia',
        payment_method_id: pix,
        category_id: cat,
        valor_centavos: 30000,
        tipo: 'gasto',
        created_at: '',
        fingerprint: null,
        parcelamento_id: null,
        parcela: null,
        parcelas_total: null,
      },
      {
        id: 't2',
        user_id: 'u',
        data: '2025-08-10',
        descricao: 'Notebook',
        payment_method_id: credito,
        category_id: null,
        valor_centavos: 33333,
        tipo: 'gasto',
        created_at: '',
        fingerprint: null,
        parcelamento_id: 'pa1',
        parcela: 2,
        parcelas_total: 3,
      },
    ],
    investimentos: [],
    aportes: [
      { id: 'a1', user_id: 'u', goal_id: 'g1', ano: 2025, mes: 8, valor_centavos: 50000, created_at: '' },
    ],
    faturas: [
      {
        payment_method_id: credito,
        nome: 'Crédito',
        dia_fechamento: 20,
        dia_vencimento: 10,
        total_centavos: 46334,
        paga: false,
        pago_em: null,
        primeira_compra: '2025-07-10',
        ultima_compra: '2025-07-15',
      },
    ],
    saldosMetas: { g1: 50000 },
  }
}

/**
 * Planta a fixture e a sessão ANTES do app carregar.
 *
 * `addInitScript` roda em cada documento novo, o que também cobre navegação
 * dentro do app — sem ele, a segunda página encontraria a fixture vazia.
 */
export async function prepararApp(
  page: Page,
  fixture: Record<string, unknown> = {},
  opcoes: { logado?: boolean } = {},
) {
  const logado = opcoes.logado ?? true
  await page.addInitScript(
    ([f, entrou]) => {
      window.__FIXTURE__ = f as Record<string, unknown>
      window.__ESCRITAS__ = []
      window.__SESSAO__ = entrou ? { user: { id: 'u', email: 'teste@finz.local' } } : null
      // O período é persistido pelo Zustand; fixar agosto/2025 mantém as specs
      // estáveis quando o mês real virar.
      localStorage.setItem('gdg-periodo', JSON.stringify({ state: { ano: 2025, mes: 8 }, version: 0 }))
    },
    [fixture, logado] as const,
  )
}

/** O que o app tentou gravar — usado para afirmar sem precisar de servidor. */
export async function escritas(page: Page) {
  return page.evaluate(() => window.__ESCRITAS__ ?? [])
}

/** As leituras que o painel e o comparativo fazem, além do mês. */
export function relatoriosPadrao() {
  return {
    'reports.obterResumoMensal': {
      total_entradas: 580000,
      total_saidas: 256334,
      saldo: 323666,
      total_investido: 50000,
      percentual_investido: 8.62,
    },
    'reports.obterGastosPorCategoria': [
      {
        category_id: 'c1',
        nome: 'Mercado',
        cor: '#a5f6d8',
        limite_centavos: 50000,
        gasto_centavos: 210000,
        percentual_limite: 420,
      },
      {
        category_id: null,
        nome: 'Sem categoria',
        cor: '#94a3b8',
        limite_centavos: null,
        gasto_centavos: 33333,
        percentual_limite: 0,
      },
    ],
    'reports.obterSaidasPorFormaPagamento': [
      { payment_method_id: 'p1', nome: 'Pix', tipo: 'pix', gasto_centavos: 210000 },
    ],
    'reports.obterInvestimentosPorMeta': [
      { goal_id: 'g1', nome: 'Reserva', valor_meta_centavos: 1000000, valor_centavos: 50000 },
    ],
    'reports.obterComparativoAnual': Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      entradas: 580000,
      saidas: 250000 + i * 1000,
      diferenca: 330000 - i * 1000,
    })),
    /**
     * Gasto por categoria, mês a mês (0020). Mercado cresce ao longo do ano e
     * Sem categoria aparece uma vez só — é o que sobra de um extrato.
     */
    'reports.obterGastosPorCategoriaAno': [
      ...[1, 2, 3, 4].map((mes) => ({
        mes,
        category_id: 'c1',
        nome: 'Mercado',
        cor: '#a5f6d8',
        gasto_centavos: 100000 + mes * 10000,
      })),
      { mes: 2, category_id: null, nome: 'Sem categoria', cor: '#94a3b8', gasto_centavos: 33333 },
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
    ],
    'goals.listarMetas': [
      { id: 'g1', user_id: 'u', nome: 'Reserva', valor_meta_centavos: 1000000, ordem: 1, created_at: '' },
    ],
    'goals.listarAportesDoAno': [],
    /**
     * Um desejo em cada estado: sem meta (quero), ligado a g1 (juntando) e
     * conquistado. É a fixture que faz a varredura de acessibilidade e a de
     * alvos de toque VEREM os três — com a lista vazia elas passavam por eles
     * sem olhar.
     */
    'wishlist.listarWishlist': [
      {
        id: 'w1',
        user_id: 'u',
        nome: 'Notebook',
        valor_centavos: 400000,
        prioridade: 5,
        concluido: false,
        concluido_em: null,
        created_at: '',
        goal_id: null,
      },
      {
        id: 'w2',
        user_id: 'u',
        nome: 'Cadeira',
        valor_centavos: 200000,
        prioridade: 3,
        concluido: false,
        concluido_em: null,
        created_at: '',
        goal_id: 'g1',
      },
      {
        id: 'w3',
        user_id: 'u',
        nome: 'Fone',
        valor_centavos: 50000,
        prioridade: 2,
        concluido: true,
        concluido_em: '2025-08-01T00:00:00Z',
        created_at: '',
        goal_id: null,
      },
    ],
    'categories.listarCategorias': [
      {
        id: 'c1',
        user_id: 'u',
        nome: 'Mercado',
        limite_centavos: 50000,
        cor: '#a5f6d8',
        ordem: 1,
        created_at: '',
      },
    ],
    'payment-methods.listarFormasPagamento': [
      {
        id: 'p1',
        user_id: 'u',
        nome: 'Pix',
        tipo: 'pix',
        ativo: true,
        ordem: 1,
        created_at: '',
        dia_fechamento: null,
        dia_vencimento: null,
        fatura_inicio_ano: null,
        fatura_inicio_mes: null,
      },
    ],
    'category-rules.listarRegrasAprendidas': [],
    'profiles.obterPerfil': {
      id: 'u',
      nome: 'Teste',
      tema: 'rosa',
      orcamento_centavos: 0,
      preferencias_lembrete: {
        fatura_fechando: true,
        fatura_vencendo: true,
        fixo_vencendo: true,
        dias_antes: 3,
      },
      created_at: '',
    },
    'transactions.listarLancamentosPorIntervalo': [],
    // Vazio por padrão: a sugestão de assinatura é acréscimo, e nenhuma outra
    // spec deve ganhar um cartão extra na tela por causa dela.
    'transactions.listarGastosRecentes': [],
  }
}

/** Mês + relatórios: o que basta para qualquer tela abrir. */
export function appCompleto() {
  return { 'mes.carregarMes': mesPadrao(), ...relatoriosPadrao() }
}

export const test = base
export { expect } from '@playwright/test'

/**
 * Doze cobranças mensais iguais — o mínimo que a detecção de assinatura aceita,
 * com folga. As datas são de 2025 porque as specs fixam o relógio em agosto de
 * 2025 com `page.clock.setFixedTime`.
 */
export function assinaturasPadrao() {
  return {
    'transactions.listarGastosRecentes': [6, 7, 8].map((mes) => ({
      id: `n${mes}`,
      data: `2025-0${mes}-12`,
      descricao: 'NETFLIX.COM',
      valor_centavos: 3990,
      tipo: 'gasto',
      category_id: null,
      payment_method_id: null,
      parcelamento_id: null,
    })),
  }
}
