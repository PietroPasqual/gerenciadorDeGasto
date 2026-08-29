/**
 * Funções puras de cálculo financeiro.
 *
 * O banco também calcula os agregados (ver supabase/migrations/0003_views.sql) —
 * estas funções servem para: (a) recalcular na hora durante updates otimistas,
 * (b) somar listas já carregadas sem novo round-trip, (c) serem testáveis.
 * Toda entrada e saída é em CENTAVOS (inteiro).
 */

import { faturaVigente } from './fatura'
import { somarCentavos } from './money'

export type NivelLimite = 'ok' | 'atencao' | 'estourado'

export interface ItemValor {
  valor_centavos: number
}

export interface ResumoCalculado {
  totalEntradas: number
  totalSaidas: number
  saldo: number
  totalInvestido: number
  percentualInvestido: number
}

/**
 * Janela em que um gasto fixo vale. `null` de um lado = sem limite ali.
 * ano e mes andam em par (o banco garante isso com um check).
 */
export interface Vigencia {
  inicio_ano: number | null
  inicio_mes: number | null
  fim_ano: number | null
  fim_mes: number | null
}

/**
 * O gasto fixo entra na conta deste mês?
 *
 * Espelho exato de `public.fixo_vigente` (migration 0005) — o painel e o
 * comparativo somam no banco, e o controle mensal soma aqui; as duas contas
 * têm que dar o mesmo número. Comparamos ano*12 + mes para não precisar de
 * duas condições encadeadas (ano maior OU ano igual e mês maior ou igual).
 */
export function estaVigente(v: Vigencia, ano: number, mes: number): boolean {
  const alvo = ano * 12 + mes
  // `== null` (frouxo) de propósito, pegando null E undefined: enquanto a
  // migration 0005 não tiver rodado, o Supabase devolve linhas SEM estes
  // campos. Com uma comparação estrita isso viraria NaN, todo gasto fixo
  // deixaria de ser vigente e as saídas do mês despencariam em silêncio. Sem
  // vigência informada, o certo é o comportamento de antes: vale sempre.
  const inicio = v.inicio_ano == null || v.inicio_mes == null ? null : v.inicio_ano * 12 + v.inicio_mes
  const fim = v.fim_ano == null || v.fim_mes == null ? null : v.fim_ano * 12 + v.fim_mes
  return (inicio === null || alvo >= inicio) && (fim === null || alvo <= fim)
}

/** entradas - saídas (pode ser negativo) */
export function calcularSaldo(totalEntradas: number, totalSaidas: number): number {
  return totalEntradas - totalSaidas
}

/** Percentual do quanto foi investido em relação às entradas do mês. */
export function calcularPercentualInvestido(totalInvestido: number, totalEntradas: number): number {
  if (totalEntradas <= 0) return 0
  return arredondar2((totalInvestido / totalEntradas) * 100)
}

/** Percentual gasto de um limite de categoria. Sem limite (null/0) => 0. */
export function calcularPercentualLimite(gasto: number, limite: number | null | undefined): number {
  if (!limite || limite <= 0) return 0
  return arredondar2((gasto / limite) * 100)
}

/**
 * Semáforo da barra de categoria:
 *   < 80%  -> ok (verde)
 *   80-100% -> atenção (amarelo)
 *   > 100% -> estourado (vermelho)
 * Sem limite definido, é sempre "ok".
 */
export function nivelDoLimite(gasto: number, limite: number | null | undefined): NivelLimite {
  if (!limite || limite <= 0) return 'ok'
  const percentual = (gasto / limite) * 100
  if (percentual > 100) return 'estourado'
  if (percentual >= 80) return 'atencao'
  return 'ok'
}

/** Soma o campo valor_centavos de uma lista. */
export function totalDeItens(itens: ItemValor[]): number {
  return somarCentavos(itens.map((i) => i.valor_centavos))
}

/**
 * Agrupa valores por uma chave (categoria, forma de pagamento, meta...).
 * Itens sem chave caem no bucket `semChave`.
 */
export function agruparPorChave<T extends ItemValor>(
  itens: T[],
  obterChave: (item: T) => string | null | undefined,
  semChave = 'sem-classificacao',
): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (const item of itens) {
    const chave = obterChave(item) ?? semChave
    mapa[chave] = (mapa[chave] ?? 0) + item.valor_centavos
  }
  return mapa
}

/**
 * Resumo completo do mês.
 * saídas = lançamentos do tipo 'gasto' + gastos fixos ativos (que se repetem todo mês).
 * investido = aportes em metas + investimentos avulsos.
 * Espelha exatamente a função SQL `resumo_mensal`.
 */
export function calcularResumoMensal(params: {
  entradasAvulsas: ItemValor[]
  entradasLancamentos: ItemValor[]
  gastos: ItemValor[]
  gastosFixos: ItemValor[]
  investimentos: ItemValor[]
}): ResumoCalculado {
  const totalEntradas = totalDeItens(params.entradasAvulsas) + totalDeItens(params.entradasLancamentos)
  const totalSaidas = totalDeItens(params.gastos) + totalDeItens(params.gastosFixos)
  const totalInvestido = totalDeItens(params.investimentos)

  return {
    totalEntradas,
    totalSaidas,
    saldo: calcularSaldo(totalEntradas, totalSaidas),
    totalInvestido,
    percentualInvestido: calcularPercentualInvestido(totalInvestido, totalEntradas),
  }
}

/** O mínimo de uma forma de pagamento para saber se ela tem fatura. */
export interface FormaComFatura {
  id: string
  dia_fechamento: number | null
  fatura_inicio_ano: number | null
  fatura_inicio_mes: number | null
}

/** O mínimo de um gasto para decidir em que mês ele pesa no bolso. */
export interface GastoComData {
  data: string
  valor_centavos: number
  payment_method_id: string | null
}

/**
 * Este gasto vai para uma fatura, em vez de pesar no mês em que aconteceu?
 *
 * Espelha `mes_de_caixa` no SQL (migration 0009). Só é verdade quando existem
 * as três coisas: forma de pagamento, dia de fechamento e vigência que cobre a
 * data. Faltando qualquer uma, o gasto pesa no próprio mês — que é como o app
 * sempre se comportou.
 */
export function vaiParaFatura(gasto: GastoComData, formas: FormaComFatura[]): boolean {
  if (!gasto.payment_method_id) return false
  const forma = formas.find((f) => f.id === gasto.payment_method_id)
  if (!forma || forma.dia_fechamento === null) return false
  return faturaVigente(gasto.data, forma.fatura_inicio_ano, forma.fatura_inicio_mes)
}

export interface CaixaDoMes {
  /** Gastos sem fatura + fixos + faturas que vencem neste mês. */
  totalSaidasCaixa: number
  /** Gasto FEITO neste mês que só sai numa fatura futura. */
  adiadoParaFatura: number
  /** O total das faturas que vencem neste mês. */
  totalFaturas: number
}

/**
 * Quanto sai da conta neste mês — a pergunta de CAIXA, diferente de "quanto
 * gastei", que é a de competência.
 *
 * A conta tem três partes, e a terceira é a que só existe por causa do cartão:
 * o que foi gasto neste mês sem fatura, mais os fixos, mais as faturas que
 * vencem neste mês (compras de meses anteriores). Os gastos deste mês que
 * foram para uma fatura futura saem da conta e viram `adiadoParaFatura`, que a
 * tela mostra para a diferença entre os dois números não ficar sem explicação.
 *
 * Espelha `resumo_mensal` da 0009 — regra 9.
 */
export function calcularCaixaDoMes(params: {
  gastos: GastoComData[]
  formasPagamento: FormaComFatura[]
  gastosFixos: ItemValor[]
  /** As faturas que vencem neste mês, vindas de `faturas_do_mes`. */
  faturas: Array<{ total_centavos: number }>
}): CaixaDoMes {
  let noMes = 0
  let adiadoParaFatura = 0
  for (const g of params.gastos) {
    if (vaiParaFatura(g, params.formasPagamento)) adiadoParaFatura += g.valor_centavos
    else noMes += g.valor_centavos
  }
  const totalFaturas = params.faturas.reduce((s, f) => s + f.total_centavos, 0)
  return {
    totalSaidasCaixa: noMes + totalDeItens(params.gastosFixos) + totalFaturas,
    adiadoParaFatura,
    totalFaturas,
  }
}

/** Progresso de uma meta (limitado a 100 para a barra, o valor cru fica em `bruto`). */
export function progressoDaMeta(guardado: number, alvo: number): { percentual: number; bruto: number } {
  if (alvo <= 0) return { percentual: 0, bruto: 0 }
  const bruto = arredondar2((guardado / alvo) * 100)
  return { percentual: Math.min(bruto, 100), bruto }
}

/** Progresso da wishlist: quantos itens foram conquistados. */
export function progressoWishlist(itens: Array<{ concluido: boolean }>): {
  cumpridas: number
  pendentes: number
  percentual: number
} {
  const cumpridas = itens.filter((i) => i.concluido).length
  const pendentes = itens.length - cumpridas
  const percentual = itens.length === 0 ? 0 : arredondar2((cumpridas / itens.length) * 100)
  return { cumpridas, pendentes, percentual }
}

/** Média mensal de um ano considerando só os meses com movimento. */
export function mediaMensal(valores: number[]): number {
  const comMovimento = valores.filter((v) => v !== 0)
  if (comMovimento.length === 0) return 0
  return Math.round(somarCentavos(comMovimento) / comMovimento.length)
}

function arredondar2(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.round(valor * 100) / 100
}
