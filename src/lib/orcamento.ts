import { ultimoDiaDoMes } from './fatura'
import { periodoAtual } from './dates'

/**
 * Orçamento do mês inteiro.
 *
 * Existe limite por categoria desde a 0001, mas não um teto geral — e a
 * pergunta que alguém faz de fato no dia 18 não é "quanto sobrou de mercado",
 * é "quanto ainda posso gastar por dia até o fim do mês".
 */
export interface Orcamento {
  /** Teto do mês, em centavos. 0 = sem orçamento definido. */
  tetoCentavos: number
}

export interface SituacaoOrcamento {
  tetoCentavos: number
  gastoCentavos: number
  /** Pode ser negativo: estourar o teto é informação, não erro de conta. */
  restanteCentavos: number
  /** 0–100 para a barra; o valor cru fica em `percentualBruto`. */
  percentual: number
  percentualBruto: number
  /** Dias que ainda contam, incluindo hoje. Nunca menor que 1. */
  diasRestantes: number
  /**
   * O mês já acabou? Aí não existe "por dia" para mostrar — a validação pegou
   * um mês passado exibindo "R$ 436,66 por dia · para 1 dia", que é uma frase
   * sem sentido para quem só quer conferir quanto gastou em agosto.
   */
  mesEncerrado: boolean
  /**
   * Quanto dá para gastar por dia daqui até o fim. `null` quando o teto já
   * estourou — dizer "R$ -12,00 por dia" seria pior do que não dizer nada.
   */
  porDiaCentavos: number | null
  estourou: boolean
}

/**
 * Quantos dias ainda contam no mês, incluindo hoje.
 *
 * Incluir hoje é o ponto: no dia 18 de um mês de 31, sobram 14 dias, não 13.
 * Quem pergunta "quanto posso gastar por dia" está perguntando a partir de
 * agora, e hoje ainda não acabou.
 *
 * Mês passado devolve 0 (nada mais a distribuir) e mês futuro devolve o mês
 * inteiro, porque ele ainda não começou.
 */
export function diasRestantesDoMes(ano: number, mes: number, hoje = new Date()): number {
  const total = ultimoDiaDoMes(ano, mes)
  const atual = periodoAtual()
  if (ano > atual.ano || (ano === atual.ano && mes > atual.mes)) return total
  if (ano < atual.ano || (ano === atual.ano && mes < atual.mes)) return 0
  return total - hoje.getDate() + 1
}

/**
 * A situação do orçamento no mês aberto.
 *
 * O gasto usado aqui é o de CAIXA (o que sai da conta), e não o de competência:
 * a pergunta é sobre quanto ainda dá para gastar, e o que já foi para uma
 * fatura futura não pesa neste mês. Ver migration 0009.
 */
export function situacaoDoOrcamento(params: {
  tetoCentavos: number
  gastoCentavos: number
  ano: number
  mes: number
  hoje?: Date
}): SituacaoOrcamento {
  const { tetoCentavos, gastoCentavos, ano, mes } = params
  const restanteCentavos = tetoCentavos - gastoCentavos
  const percentualBruto = tetoCentavos > 0 ? (gastoCentavos / tetoCentavos) * 100 : 0
  // Máximo de 1: distribuir o que sobra por "zero dias" seria divisão por zero,
  // e num mês já encerrado o número certo a mostrar é o total, não o diário.
  const diasBrutos = diasRestantesDoMes(ano, mes, params.hoje)
  const mesEncerrado = diasBrutos === 0
  const diasRestantes = Math.max(1, diasBrutos)
  const estourou = restanteCentavos < 0

  return {
    tetoCentavos,
    gastoCentavos,
    restanteCentavos,
    percentual: Math.min(Math.max(percentualBruto, 0), 100),
    percentualBruto: Math.round(percentualBruto * 100) / 100,
    diasRestantes,
    mesEncerrado,
    // Trunca para baixo: arredondar para cima daria um teto diário que, seguido
    // à risca, estoura o mês por alguns centavos. E some de vez num mês que já
    // acabou — ali a pergunta não é mais "quanto por dia".
    porDiaCentavos: estourou || mesEncerrado ? null : Math.floor(restanteCentavos / diasRestantes),
    estourou,
  }
}
