import { diaNoMes } from './fatura'

/** Quantas parcelas o app aceita. 1 não é parcelamento; 60 é o teto do mercado. */
export const MIN_PARCELAS = 2
export const MAX_PARCELAS = 60

/**
 * Divide um total em parcelas inteiras de centavos.
 *
 * R$ 100,00 em 3x NÃO são três parcelas de R$ 33,33 — isso perde um centavo, e
 * um centavo perdido por parcelamento vira dezenas ao longo de um ano de
 * compras. A soma tem que fechar exatamente com o total, sempre.
 *
 * A sobra vai toda na PRIMEIRA parcela (R$ 33,34 + R$ 33,33 + R$ 33,33), que é
 * a convenção dos emissores brasileiros. Não é escolha estética: é o que faz a
 * fatura do app bater com a do banco logo no primeiro mês, que é justamente o
 * mês em que a pessoa confere se lançou certo.
 */
export function dividirEmParcelas(totalCentavos: number, quantidade: number): number[] {
  if (!Number.isInteger(totalCentavos)) {
    throw new Error('Valor em centavos precisa ser inteiro.')
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error('Quantidade de parcelas precisa ser um inteiro maior que zero.')
  }

  // O sinal fica de fora da divisão: dividir número negativo em JS trunca para
  // o lado errado e a sobra sai negativa, quebrando a soma.
  const sinal = totalCentavos < 0 ? -1 : 1
  const total = Math.abs(totalCentavos)
  const base = Math.floor(total / quantidade)
  const sobra = total - base * quantidade

  return Array.from({ length: quantidade }, (_, i) => sinal * (i === 0 ? base + sobra : base))
}

/**
 * As datas de cada parcela: mesmo dia do mês, avançando um mês por parcela.
 *
 * Dia 31 num mês de 30 encosta no último dia em vez de vazar para o mês
 * seguinte — senão a parcela 2 de uma compra em 31/01 cairia em 03/03 e o app
 * mostraria "2/12" fora de ordem.
 */
export function datasDasParcelas(primeiraISO: string, quantidade: number): string[] {
  const [ano, mes, dia] = primeiraISO.slice(0, 10).split('-').map(Number)
  return Array.from({ length: quantidade }, (_, i) => {
    const n = ano * 12 + (mes - 1) + i
    const a = Math.floor(n / 12)
    const m = (n % 12) + 1
    const d = diaNoMes(a, m, dia)
    return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  })
}

/** "3/12" — o rótulo que aparece na linha. */
export function rotuloParcela(parcela: number, total: number): string {
  return `${parcela}/${total}`
}

export interface Parcela {
  parcela: number
  parcelas_total: number
  data: string
  valor_centavos: number
}

/**
 * Monta a série inteira. As parcelas são lançamentos de verdade, um por mês,
 * amarrados por um `parcelamento_id` — e não um lançamento só com um campo
 * "parcelado". Assim cada uma cai na sua fatura sozinha, e o mês que a pessoa
 * abre mostra o que ela realmente vai pagar naquele mês.
 */
export function montarParcelas(
  totalCentavos: number,
  quantidade: number,
  primeiraDataISO: string,
): Parcela[] {
  const valores = dividirEmParcelas(totalCentavos, quantidade)
  const datas = datasDasParcelas(primeiraDataISO, quantidade)
  return valores.map((valor_centavos, i) => ({
    parcela: i + 1,
    parcelas_total: quantidade,
    data: datas[i],
    valor_centavos,
  }))
}
