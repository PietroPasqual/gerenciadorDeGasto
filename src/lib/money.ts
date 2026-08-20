/**
 * Dinheiro no app é SEMPRE inteiro em centavos.
 * Nunca use float para somar/armazenar: 0.1 + 0.2 !== 0.3.
 */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const brlCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** 123456 -> "R$ 1.234,56" */
export function formatCentavos(centavos: number | null | undefined): string {
  return brl.format((centavos ?? 0) / 100)
}

/** 123456 -> "R$ 1,2 mil" (usado em eixos de gráfico) */
export function formatCentavosCompacto(centavos: number | null | undefined): string {
  return brlCompacto.format((centavos ?? 0) / 100)
}

/** 123456 -> "1.234,56" (para inputs, sem o símbolo) */
export function centavosParaTexto(centavos: number | null | undefined): string {
  return ((centavos ?? 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Converte o que o usuário digita em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "1234" e negativos.
 * Retorna null quando não dá para interpretar.
 */
export function parseParaCentavos(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null
  }

  let texto = input.trim()
  if (texto === '') return null

  const negativo = texto.startsWith('-') || /^\(.*\)$/.test(texto)
  texto = texto.replace(/[^\d,.]/g, '')
  if (texto === '') return null

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')

  if (temVirgula && temPonto) {
    // "1.234,56" (pt-BR) ou "1,234.56" (en-US): o último separador manda
    if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.')
    } else {
      texto = texto.replace(/,/g, '')
    }
  } else if (temVirgula) {
    texto = texto.replace(',', '.')
  } else if (temPonto) {
    // "1.234" é milhar em pt-BR; "1.5" é decimal
    const partes = texto.split('.')
    const ultima = partes[partes.length - 1]
    if (partes.length > 2 || ultima.length === 3) {
      texto = partes.join('')
    }
  }

  const valor = Number(texto)
  if (!Number.isFinite(valor)) return null

  const centavos = Math.round(valor * 100)
  return negativo ? -centavos : centavos
}

/** Soma segura de uma lista de centavos. */
export function somarCentavos(valores: Array<number | null | undefined>): number {
  return valores.reduce<number>((total, v) => total + (v ?? 0), 0)
}
