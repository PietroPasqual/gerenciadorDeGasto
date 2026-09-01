import { formatCentavos } from './money'
import type { Periodo } from './dates'

/**
 * "Esta compra é quatro vezes a sua média nessa categoria."
 *
 * Fato, não conselho — a mesma régua do `observacoes.ts`: a frase mostra um
 * número conferível e não diz o que fazer com ele. Uma compra grande de
 * mercado pode ser o rancho do mês inteiro; só quem vive a vida sabe se
 * aquilo é problema, e o app não sabe.
 *
 * SILENCIOSO QUANDO NÃO HÁ BASE
 *
 * Precisa de MIN_TRANSACOES_BASE compras anteriores na categoria para a média
 * significar algo — com duas compras, "quatro vezes a média" é comparar com
 * uma amostra do tamanho de um dado de seis lados. E precisa de
 * VALOR_MINIMO_CENTAVOS: 4× de uma média de R$ 3,00 são R$ 12,00, e alertar
 * sobre isso é ruído, não informação.
 *
 * NUNCA PARCELAMENTO
 *
 * O valor de uma parcela é uma fração do preço cheio da compra, não o preço
 * dela — comparar isso com compras à vista da mesma categoria mistura duas
 * escalas diferentes. Mesma trava da detecção de assinatura (6.2), e pelo
 * mesmo motivo: parcelamento distorce o que "normal" quer dizer nesta conta.
 */

export interface CandidatoAtipico {
  id: string
  category_id: string | null
  valor_centavos: number
  parcelamento_id: string | null
}

/** O histórico de uma categoria: soma e contagem das compras à vista, fora do mês em avaliação. */
export interface HistoricoCategoria {
  somaCentavos: number
  contagem: number
}

export interface GastoAtipico {
  id: string
  categoriaId: string
  valorCentavos: number
  mediaCentavos: number
  /** Quantas vezes a média — truncado para baixo, para o texto nunca prometer mais do que a compra é. */
  multiplicador: number
}

export const MULTIPLICADOR_ATIPICO = 4
export const MIN_TRANSACOES_BASE = 5
export const VALOR_MINIMO_CENTAVOS = 5000

/**
 * Monta o histórico por categoria a partir da janela de gastos recentes.
 *
 * `periodoAvaliado` existe porque a própria compra em avaliação não pode
 * inflar a média que a compara: uma categoria com uma única compra grande
 * neste mês teria "a média é exatamente este valor", e nada seria atípico
 * nunca. É por isso que a função pede o mês inteiro para excluir, e não só o
 * id da compra — a janela de doze meses tem outras compras do mesmo mês que
 * também não podem entrar.
 */
export function historicoPorCategoria(params: {
  gastos: Array<{
    data: string
    category_id: string | null
    valor_centavos: number
    parcelamento_id: string | null
  }>
  periodoAvaliado: Periodo
}): Map<string, HistoricoCategoria> {
  const historico = new Map<string, HistoricoCategoria>()
  for (const g of params.gastos) {
    if (g.category_id === null || g.parcelamento_id !== null) continue
    const ano = Number(g.data.slice(0, 4))
    const mes = Number(g.data.slice(5, 7))
    if (ano === params.periodoAvaliado.ano && mes === params.periodoAvaliado.mes) continue
    const atual = historico.get(g.category_id) ?? { somaCentavos: 0, contagem: 0 }
    historico.set(g.category_id, {
      somaCentavos: atual.somaCentavos + g.valor_centavos,
      contagem: atual.contagem + 1,
    })
  }
  return historico
}

/**
 * A compra mais atípica do mês, ou `null` quando nenhuma passa nas travas.
 *
 * Só uma: é um fato para caber ao lado dos outros de `observacoesDoMes`, não
 * uma lista — a mais extrema já diz o que precisa ser dito.
 */
export function gastoMaisAtipico(params: {
  candidatos: CandidatoAtipico[]
  historico: Map<string, HistoricoCategoria>
}): GastoAtipico | null {
  let melhor: GastoAtipico | null = null

  for (const c of params.candidatos) {
    if (c.category_id === null || c.parcelamento_id !== null) continue
    if (c.valor_centavos < VALOR_MINIMO_CENTAVOS) continue

    const h = params.historico.get(c.category_id)
    if (!h || h.contagem < MIN_TRANSACOES_BASE) continue

    const media = h.somaCentavos / h.contagem
    const multiplicador = Math.floor(c.valor_centavos / media)
    if (multiplicador < MULTIPLICADOR_ATIPICO) continue

    if (!melhor || multiplicador > melhor.multiplicador) {
      melhor = {
        id: c.id,
        categoriaId: c.category_id,
        valorCentavos: c.valor_centavos,
        mediaCentavos: Math.round(media),
        multiplicador,
      }
    }
  }

  return melhor
}

/** A frase, separada para o teste poder cobrar que ela nunca vire conselho. */
export function textoDoGastoAtipico(g: GastoAtipico, nomeCategoria: string): string {
  return `é ${g.multiplicador}× a sua média em ${nomeCategoria} (normalmente ${formatCentavos(g.mediaCentavos)}).`
}
