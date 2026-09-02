import { formatCentavos } from './money'
import type { Transaction } from './database.types'

/**
 * Seleção de lançamentos para agir em vários de uma vez.
 *
 * O que este arquivo faz não é guardar ids — isso o componente faz sozinho. É
 * responder as três perguntas que uma ação em lote precisa responder ANTES de
 * acontecer: quantos são, quanto somam, e o que exatamente vai ser atingido.
 * Sem a terceira, "excluir 8" é uma frase honesta que esconde que três deles
 * são parcelas de uma compra e que o resto da série vai continuar lá.
 */

export interface ResumoSelecao {
  quantidade: number
  totalCentavos: number
  /** Quantos dos selecionados são parcela de uma compra parcelada. */
  parcelas: number
  /** Quantas séries diferentes esses parcelados tocam. */
  series: number
}

export function resumirSelecao(lancamentos: Transaction[], ids: ReadonlySet<string>): ResumoSelecao {
  const series = new Set<string>()
  let quantidade = 0
  let totalCentavos = 0
  let parcelas = 0

  for (const l of lancamentos) {
    if (!ids.has(l.id)) continue
    quantidade++
    totalCentavos += l.valor_centavos
    if (l.parcelamento_id) {
      parcelas++
      series.add(l.parcelamento_id)
    }
  }

  return { quantidade, totalCentavos, parcelas, series: series.size }
}

/**
 * Tira da seleção o que saiu da tela.
 *
 * Trocar de mês ou digitar no filtro esconde linhas, e uma seleção que
 * sobrevive a isso é uma bomba: a barra continua dizendo "8 selecionados",
 * cinco deles invisíveis, e "excluir" apaga lançamentos que a pessoa não está
 * vendo há dois minutos. Agir só no que está à vista é a única regra que não
 * surpreende.
 *
 * Devolve o MESMO conjunto quando nada mudou — o chamador usa essa identidade
 * para não disparar um render a cada passada.
 */
export function podarSelecao(ids: ReadonlySet<string>, visiveis: Iterable<string>): ReadonlySet<string> {
  const naTela = visiveis instanceof Set ? visiveis : new Set(visiveis)
  let sobrou = true
  for (const id of ids) {
    if (!naTela.has(id)) {
      sobrou = false
      break
    }
  }
  if (sobrou) return ids
  const podado = new Set<string>()
  for (const id of ids) if (naTela.has(id)) podado.add(id)
  return podado
}

/** "1 lançamento" / "12 lançamentos" — o plural aparece em toda frase daqui. */
export function textoDaQuantidade(n: number): string {
  return `${n} ${n === 1 ? 'lançamento' : 'lançamentos'}`
}

/**
 * "1 lançamento alterado" / "3 lançamentos alterados".
 *
 * Existe porque o plural do particípio e o do substantivo têm que andar juntos:
 * `${textoDaQuantidade(n)} alterados` produz "1 lançamento alterados", e uma
 * concordância errada num aviso sobre dinheiro faz o aviso parecer errado.
 */
export function textoDaAcao(n: number, participio: string): string {
  return `${textoDaQuantidade(n)} ${participio}${n === 1 ? '' : 's'}`
}

/**
 * De onde os selecionados saíram.
 *
 * Com filtro ativo a frase precisa dizer as duas coisas: que o recorte existe,
 * e qual é o tamanho do mês inteiro. "3 de 5" sem o "de 40 no mês" faz alguém
 * achar que o mês tem cinco lançamentos.
 */
export function textoDoEscopo(quantidade: number, totalFiltrado: number, totalGeral: number): string {
  if (totalFiltrado < totalGeral) {
    return `${quantidade} de ${totalFiltrado} no filtro atual — o mês tem ${totalGeral}.`
  }
  return `${quantidade} de ${totalGeral} ${totalGeral === 1 ? 'lançamento' : 'lançamentos'} do mês.`
}

/**
 * O texto da confirmação de exclusão.
 *
 * A menção às parcelas não é um detalhe: excluir em lote apaga exatamente as
 * linhas marcadas, e nunca a série inteira. Quem quer a compra toda usa o
 * diálogo de série, que pergunta. Aqui a promessa é a mais estreita possível,
 * e está escrita.
 */
export function textoDaExclusao(resumo: ResumoSelecao): { titulo: string; descricao: string } {
  const titulo = `Excluir ${textoDaQuantidade(resumo.quantidade)}?`
  const partes = [`São ${formatCentavos(resumo.totalCentavos)} no total.`]

  if (resumo.parcelas > 0) {
    const umaParcela = resumo.parcelas === 1
    const umaSerie = resumo.series === 1
    partes.push(
      `${resumo.parcelas} ${umaParcela ? 'é parcela' : 'são parcelas'} de ` +
        `${resumo.series} ${umaSerie ? 'compra parcelada' : 'compras parceladas'}: ` +
        `${umaParcela ? 'só a parcela marcada sai' : 'só as parcelas marcadas saem'}, o resto da série fica.`,
    )
  }

  return { titulo, descricao: partes.join(' ') }
}
