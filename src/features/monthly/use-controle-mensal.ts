import { toast } from 'sonner'
import { useCallback } from 'react'
import type {
  Category,
  FixedExpense,
  FixedExpensePayment,
  GoalContribution,
  Goal,
  Income,
  Investment,
  PaymentMethod,
  RecurringIncome,
  Transaction,
} from '@/lib/database.types'
import { useConsulta } from '@/lib/cache'
import { executarOtimista } from '@/lib/otimista'
import { tempId } from '@/lib/utils'
import { calcularCaixaDoMes, calcularResumoMensal, estaVigente } from '@/lib/calculations'
import { definirFaturaPaga, type FaturaDoMes } from '@/services/invoices'
import { carregarMes } from '@/services/mes'
import * as metasSvc from '@/services/goals'
import * as entradasSvc from '@/services/incomes'
import * as fixosSvc from '@/services/fixed-expenses'
import * as lancamentosSvc from '@/services/transactions'
import * as investimentosSvc from '@/services/investments'
import * as recorrentesSvc from '@/services/recurring-incomes'

export interface DadosMes {
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  metas: Goal[]
  entradas: Income[]
  gastosFixos: FixedExpense[]
  pagamentos: FixedExpensePayment[]
  lancamentos: Transaction[]
  investimentos: Investment[]
  aportes: GoalContribution[]
  /** As faturas de cartão que vencem neste mês (compras de meses anteriores). */
  faturas: FaturaDoMes[]
  /** Entradas que se repetem todo mês; a vigência decide se contam neste. */
  entradasRecorrentes: RecurringIncome[]
}

/**
 * Carrega e edita tudo o que a tela de controle mensal precisa.
 *
 * Por que os totais são calculados aqui e não pela função SQL `resumo_mensal`:
 * a tela já tem todas as linhas em memória e faz updates otimistas — recalcular
 * localmente (src/lib/calculations.ts) mantém o resumo em sincronia instantânea,
 * sem um round-trip por tecla digitada. As funções SQL são usadas nas telas que
 * NÃO carregam as linhas (painel, comparativo anual, metas).
 */
export function useControleMensal(ano: number, mes: number) {
  const recurso = useConsulta<DadosMes>(['mes', ano, mes], () => carregarMes(ano, mes))

  const dados = recurso.dados
  const { definirDados } = recurso

  /** Aplica uma mudança na lista X do estado, devolvendo o snapshot anterior. */
  const mutar = useCallback(
    (transformar: (atual: DadosMes) => DadosMes) => {
      definirDados((atual) => (atual ? transformar(atual) : atual))
    },
    [definirDados],
  )

  const snapshot = () => dados as DadosMes

  // ------------------------------------------------------------------
  // Entradas
  // ------------------------------------------------------------------
  const adicionarEntrada = async (descricao: string, valor_centavos: number) => {
    const provisorio: Income = {
      id: tempId(),
      user_id: '',
      ano,
      mes,
      descricao,
      valor_centavos,
      created_at: new Date().toISOString(),
    }
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, entradas: [...d.entradas, provisorio] })),
      restaurar: (s) => definirDados(s),
      acao: () => entradasSvc.criarEntrada({ ano, mes, descricao, valor_centavos }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, entradas: d.entradas.map((e) => (e.id === provisorio.id ? salvo : e)) })),
      mensagemErro: 'Não foi possível adicionar a entrada',
    })
  }

  const editarEntrada = async (
    id: string,
    mudancas: Partial<Pick<Income, 'descricao' | 'valor_centavos'>>,
  ) => {
    await executarOtimista({
      chave: `entrada:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({ ...d, entradas: d.entradas.map((e) => (e.id === id ? { ...e, ...mudancas } : e)) })),
      restaurar: (s) => definirDados(s),
      acao: () => entradasSvc.atualizarEntrada(id, mudancas),
      mensagemErro: 'Não foi possível salvar a entrada',
    })
  }

  const removerEntrada = async (id: string) => {
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, entradas: d.entradas.filter((e) => e.id !== id) })),
      restaurar: (s) => definirDados(s),
      acao: () => entradasSvc.excluirEntrada(id),
      mensagemErro: 'Não foi possível excluir a entrada',
    })
  }

  // ------------------------------------------------------------------
  // Gastos fixos (definição + "pago?" do mês)
  // ------------------------------------------------------------------
  const adicionarGastoFixo = async (dadosNovos: {
    nome: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    dia_vencimento: number | null
  }) => {
    const provisorio: FixedExpense = {
      id: tempId(),
      user_id: '',
      ativo: true,
      ordem: (dados?.gastosFixos.length ?? 0) + 1,
      created_at: new Date().toISOString(),
      // Nasce valendo a partir do mês que está aberto na tela: quem cadastra
      // um gasto fixo em agosto está dizendo "começo a pagar isto agora", não
      // "sempre paguei isto". O contrário inventaria saída em janeiro.
      inicio_ano: ano,
      inicio_mes: mes,
      fim_ano: null,
      fim_mes: null,
      ...dadosNovos,
    }
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, gastosFixos: [...d.gastosFixos, provisorio] })),
      restaurar: (s) => definirDados(s),
      acao: () =>
        fixosSvc.criarGastoFixo({
          ...dadosNovos,
          ordem: provisorio.ordem,
          inicio_ano: provisorio.inicio_ano,
          inicio_mes: provisorio.inicio_mes,
        }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, gastosFixos: d.gastosFixos.map((g) => (g.id === provisorio.id ? salvo : g)) })),
      mensagemErro: 'Não foi possível adicionar o gasto fixo',
    })
  }

  const editarGastoFixo = async (id: string, mudancas: Partial<FixedExpense>) => {
    await executarOtimista({
      chave: `gasto-fixo:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          gastosFixos: d.gastosFixos.map((g) => (g.id === id ? { ...g, ...mudancas } : g)),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => fixosSvc.atualizarGastoFixo(id, mudancas),
      mensagemErro: 'Não foi possível salvar o gasto fixo',
    })
  }

  const removerGastoFixo = async (id: string) => {
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          gastosFixos: d.gastosFixos.filter((g) => g.id !== id),
          pagamentos: d.pagamentos.filter((p) => p.fixed_expense_id !== id),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => fixosSvc.excluirGastoFixo(id),
      mensagemErro: 'Não foi possível excluir o gasto fixo',
    })
  }

  const alternarPago = async (fixed_expense_id: string, pago: boolean) => {
    const existente = dados?.pagamentos.find((p) => p.fixed_expense_id === fixed_expense_id)
    const provisorio: FixedExpensePayment = existente
      ? { ...existente, pago, pago_em: pago ? new Date().toISOString() : null }
      : {
          id: tempId(),
          user_id: '',
          fixed_expense_id,
          ano,
          mes,
          pago,
          pago_em: pago ? new Date().toISOString() : null,
        }

    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          pagamentos: existente
            ? d.pagamentos.map((p) => (p.id === existente.id ? provisorio : p))
            : [...d.pagamentos, provisorio],
        })),
      restaurar: (s) => definirDados(s),
      acao: () => fixosSvc.marcarPagamento({ fixed_expense_id, ano, mes, pago }),
      confirmar: (salvo) =>
        mutar((d) => ({
          ...d,
          pagamentos: d.pagamentos.map((p) => (p.fixed_expense_id === fixed_expense_id ? salvo : p)),
        })),
      mensagemErro: 'Não foi possível atualizar o pagamento',
    })
  }

  // ------------------------------------------------------------------
  // Lançamentos do mês (gastos e entradas avulsas)
  // ------------------------------------------------------------------
  /**
   * Lança uma compra parcelada: N lançamentos de uma vez, um por mês.
   *
   * Sem escrita otimista, ao contrário do lançamento avulso: as parcelas dos
   * outros meses nem aparecem nesta tela, e simular só a primeira mostraria um
   * total errado até a resposta chegar. Recarregar é mais honesto.
   */
  const adicionarParcelamento = async (dadosNovos: {
    data: string
    descricao: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    parcelas: number
  }) => {
    try {
      await lancamentosSvc.criarParcelamento({
        totalCentavos: dadosNovos.valor_centavos,
        quantidade: dadosNovos.parcelas,
        primeiraDataISO: dadosNovos.data,
        descricao: dadosNovos.descricao,
        payment_method_id: dadosNovos.payment_method_id,
        category_id: dadosNovos.category_id,
      })
      await recurso.recarregar()
    } catch (erro) {
      toast.error('Não foi possível salvar a compra parcelada', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    }
  }

  /** Exclui a série inteira de um parcelamento. */
  const removerSerie = async (parcelamento_id: string) => {
    try {
      await lancamentosSvc.excluirSerie(parcelamento_id)
      await recurso.recarregar()
    } catch (erro) {
      toast.error('Não foi possível excluir o parcelamento', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    }
  }

  /** Edita todas as parcelas de uma série (descrição, forma e categoria). */
  const editarSerie = async (
    parcelamento_id: string,
    mudancas: { descricao?: string; payment_method_id?: string | null; category_id?: string | null },
  ) => {
    try {
      await lancamentosSvc.atualizarSerie(parcelamento_id, mudancas)
      await recurso.recarregar()
    } catch (erro) {
      toast.error('Não foi possível editar o parcelamento', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    }
  }

  const adicionarLancamento = async (dadosNovos: {
    data: string
    descricao: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    tipo: 'gasto' | 'entrada'
  }) => {
    const provisorio: Transaction = {
      id: tempId(),
      user_id: '',
      created_at: new Date().toISOString(),
      // Lançamento à mão não tem impressão digital: ela só serve para o banco
      // recusar a segunda cópia de uma importação (ver 0008).
      fingerprint: null,
      // Parcelamento tem caminho próprio (criarParcelamento); por aqui passa
      // sempre lançamento avulso.
      parcelamento_id: null,
      parcela: null,
      parcelas_total: null,
      ...dadosNovos,
    }
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, lancamentos: [...d.lancamentos, provisorio] })),
      restaurar: (s) => definirDados(s),
      acao: () => lancamentosSvc.criarLancamento(dadosNovos),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === provisorio.id ? salvo : l)) })),
      mensagemErro: 'Não foi possível adicionar o lançamento',
    })
  }

  const editarLancamento = async (id: string, mudancas: Partial<Transaction>) => {
    await executarOtimista({
      chave: `lancamento:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          lancamentos: d.lancamentos.map((l) => (l.id === id ? { ...l, ...mudancas } : l)),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => lancamentosSvc.atualizarLancamento(id, mudancas),
      mensagemErro: 'Não foi possível salvar o lançamento',
    })
  }

  const removerLancamento = async (id: string) => {
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, lancamentos: d.lancamentos.filter((l) => l.id !== id) })),
      restaurar: (s) => definirDados(s),
      acao: () => lancamentosSvc.excluirLancamento(id),
      mensagemErro: 'Não foi possível excluir o lançamento',
    })
  }

  // ------------------------------------------------------------------
  // Investimentos (aporte por meta + avulsos)
  // ------------------------------------------------------------------
  const salvarAporteMeta = async (goal_id: string, valor_centavos: number) => {
    const existente = dados?.aportes.find((a) => a.goal_id === goal_id)
    const provisorio: GoalContribution = existente
      ? { ...existente, valor_centavos }
      : {
          id: tempId(),
          user_id: '',
          goal_id,
          ano,
          mes,
          valor_centavos,
          created_at: new Date().toISOString(),
        }

    await executarOtimista({
      chave: `aporte:${goal_id}:${mes}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          aportes: existente
            ? d.aportes.map((a) => (a.id === existente.id ? provisorio : a))
            : [...d.aportes, provisorio],
        })),
      restaurar: (s) => definirDados(s),
      acao: () => metasSvc.salvarAporte({ goal_id, ano, mes, valor_centavos }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, aportes: d.aportes.map((a) => (a.goal_id === goal_id ? salvo : a)) })),
      mensagemErro: 'Não foi possível salvar o aporte',
    })
  }

  const adicionarInvestimentoAvulso = async (descricao: string, valor_centavos: number) => {
    const provisorio: Investment = {
      id: tempId(),
      user_id: '',
      ano,
      mes,
      goal_id: null,
      descricao,
      valor_centavos,
      created_at: new Date().toISOString(),
    }
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, investimentos: [...d.investimentos, provisorio] })),
      restaurar: (s) => definirDados(s),
      acao: () => investimentosSvc.criarInvestimento({ ano, mes, descricao, valor_centavos, goal_id: null }),
      confirmar: (salvo) =>
        mutar((d) => ({
          ...d,
          investimentos: d.investimentos.map((i) => (i.id === provisorio.id ? salvo : i)),
        })),
      mensagemErro: 'Não foi possível adicionar o investimento',
    })
  }

  const editarInvestimentoAvulso = async (id: string, mudancas: Partial<Investment>) => {
    await executarOtimista({
      chave: `investimento:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          investimentos: d.investimentos.map((i) => (i.id === id ? { ...i, ...mudancas } : i)),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => investimentosSvc.atualizarInvestimento(id, mudancas),
      mensagemErro: 'Não foi possível salvar o investimento',
    })
  }

  const removerInvestimentoAvulso = async (id: string) => {
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, investimentos: d.investimentos.filter((i) => i.id !== id) })),
      restaurar: (s) => definirDados(s),
      acao: () => investimentosSvc.excluirInvestimento(id),
      mensagemErro: 'Não foi possível excluir o investimento',
    })
  }

  // ------------------------------------------------------------------
  // Entradas recorrentes
  // ------------------------------------------------------------------
  const adicionarEntradaRecorrente = async (dadosNovos: {
    descricao: string
    valor_centavos: number
    inicio_ano: number | null
    inicio_mes: number | null
  }) => {
    const provisorio: RecurringIncome = {
      id: tempId(),
      user_id: '',
      created_at: new Date().toISOString(),
      descricao: dadosNovos.descricao,
      valor_centavos: dadosNovos.valor_centavos,
      dia_recebimento: null,
      ativo: true,
      ordem: (dados?.entradasRecorrentes.length ?? 0) + 1,
      inicio_ano: dadosNovos.inicio_ano,
      inicio_mes: dadosNovos.inicio_mes,
      fim_ano: null,
      fim_mes: null,
    }
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, entradasRecorrentes: [...d.entradasRecorrentes, provisorio] })),
      restaurar: (s) => definirDados(s),
      acao: () =>
        recorrentesSvc.criarEntradaRecorrente({
          descricao: provisorio.descricao,
          valor_centavos: provisorio.valor_centavos,
          ordem: provisorio.ordem,
          inicio_ano: provisorio.inicio_ano,
          inicio_mes: provisorio.inicio_mes,
        }),
      confirmar: (salvo) =>
        mutar((d) => ({
          ...d,
          entradasRecorrentes: d.entradasRecorrentes.map((r) => (r.id === provisorio.id ? salvo : r)),
        })),
      mensagemErro: 'Não foi possível adicionar a entrada recorrente',
    })
  }

  const editarEntradaRecorrente = async (id: string, mudancas: Partial<RecurringIncome>) =>
    executarOtimista({
      chave: `recorrente:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          entradasRecorrentes: d.entradasRecorrentes.map((r) => (r.id === id ? { ...r, ...mudancas } : r)),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => recorrentesSvc.atualizarEntradaRecorrente(id, mudancas),
      mensagemErro: 'Não foi possível salvar a entrada recorrente',
    })

  const removerEntradaRecorrente = async (id: string) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          entradasRecorrentes: d.entradasRecorrentes.filter((r) => r.id !== id),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => recorrentesSvc.excluirEntradaRecorrente(id),
      mensagemErro: 'Não foi possível excluir a entrada recorrente',
    })

  // ------------------------------------------------------------------
  // Fatura de cartão
  // ------------------------------------------------------------------
  const alternarFaturaPaga = async (payment_method_id: string, paga: boolean) => {
    await executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          faturas: d.faturas.map((f) =>
            f.payment_method_id === payment_method_id
              ? { ...f, paga, pago_em: paga ? new Date().toISOString() : null }
              : f,
          ),
        })),
      restaurar: (s) => definirDados(s),
      acao: () => definirFaturaPaga(payment_method_id, ano, mes, paga),
      mensagemErro: 'Não foi possível salvar o pagamento da fatura',
    })
  }

  // ------------------------------------------------------------------
  // Derivados
  // ------------------------------------------------------------------
  const gastos = dados?.lancamentos.filter((l) => l.tipo === 'gasto') ?? []
  const entradasAvulsas = dados?.lancamentos.filter((l) => l.tipo === 'entrada') ?? []

  /**
   * A definição do gasto fixo é única, mas só conta nos meses da vigência
   * dele. `dados.gastosFixos` continua com a lista inteira (a tabela mostra
   * todos, marcando os que não valem no mês) — quem soma usa só estes.
   * Mesma regra da função SQL, para o painel e esta tela não divergirem.
   */
  const fixosDoMes = (dados?.gastosFixos ?? []).filter((f) => estaVigente(f, ano, mes))

  /** Mesma regra dos fixos, do outro lado do sinal (ver migration 0012). */
  const recorrentesDoMes = (dados?.entradasRecorrentes ?? []).filter((r) => estaVigente(r, ano, mes))

  /**
   * O que sai da conta neste mês. Difere de `resumo.totalSaidas` só quando
   * existe cartão com fatura ligada — sem isso os dois números são iguais e a
   * tela mostra um só, como sempre mostrou.
   */
  const caixa = calcularCaixaDoMes({
    gastos,
    formasPagamento: dados?.formasPagamento ?? [],
    gastosFixos: fixosDoMes,
    faturas: dados?.faturas ?? [],
  })

  const resumo = calcularResumoMensal({
    entradasAvulsas: dados?.entradas ?? [],
    entradasLancamentos: entradasAvulsas,
    entradasRecorrentes: recorrentesDoMes,
    gastos,
    gastosFixos: fixosDoMes,
    investimentos: [...(dados?.aportes ?? []), ...(dados?.investimentos ?? [])],
  })

  return {
    ...recurso,
    dados,
    gastos,
    entradasAvulsas,
    fixosDoMes,
    recorrentesDoMes,
    resumo,
    caixa,
    faturas: dados?.faturas ?? [],
    acoes: {
      adicionarEntrada,
      editarEntrada,
      removerEntrada,
      adicionarGastoFixo,
      editarGastoFixo,
      removerGastoFixo,
      alternarPago,
      adicionarLancamento,
      editarLancamento,
      removerLancamento,
      salvarAporteMeta,
      adicionarInvestimentoAvulso,
      editarInvestimentoAvulso,
      removerInvestimentoAvulso,
      adicionarEntradaRecorrente,
      editarEntradaRecorrente,
      removerEntradaRecorrente,
      alternarFaturaPaga,
      adicionarParcelamento,
      removerSerie,
      editarSerie,
    },
  }
}
