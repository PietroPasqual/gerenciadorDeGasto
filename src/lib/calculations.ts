/**
 * Funções puras de cálculo financeiro.
 *
 * O banco também calcula os agregados (ver supabase/migrations/0003_views.sql) —
 * estas funções servem para: (a) recalcular na hora durante updates otimistas,
 * (b) somar listas já carregadas sem novo round-trip, (c) serem testáveis.
 * Toda entrada e saída é em CENTAVOS (inteiro).
 */

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
