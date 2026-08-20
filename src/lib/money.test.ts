import { describe, expect, it } from 'vitest'
import { centavosParaTexto, formatCentavos, parseParaCentavos, somarCentavos } from './money'

// O espaço do formato BRL do Intl é NBSP ( ), por isso o normalize.
const normalizar = (texto: string) => texto.replace(/ /g, ' ')

describe('formatCentavos', () => {
  it('formata centavos como moeda brasileira', () => {
    expect(normalizar(formatCentavos(123_456))).toBe('R$ 1.234,56')
  })

  it('formata zero e nulo', () => {
    expect(normalizar(formatCentavos(0))).toBe('R$ 0,00')
    expect(normalizar(formatCentavos(null))).toBe('R$ 0,00')
  })

  it('formata negativo', () => {
    expect(normalizar(formatCentavos(-50_000))).toBe('-R$ 500,00')
  })
})

describe('parseParaCentavos', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1234,56', 123_456],
    ['1234.56', 123_456],
    ['R$ 1.234,56', 123_456],
    ['1234', 123_400],
    ['0,05', 5],
    ['1.234', 123_400], // ponto como separador de milhar
    ['1.5', 150], // ponto como decimal
    ['-25,50', -2_550],
  ])('interpreta %s como %i centavos', (entrada, esperado) => {
    expect(parseParaCentavos(entrada)).toBe(esperado)
  })

  it('devolve null para texto vazio ou inválido', () => {
    expect(parseParaCentavos('')).toBeNull()
    expect(parseParaCentavos('   ')).toBeNull()
    expect(parseParaCentavos('abc')).toBeNull()
    expect(parseParaCentavos(null)).toBeNull()
  })

  it('aceita número direto', () => {
    expect(parseParaCentavos(12.34)).toBe(1_234)
  })

  it('arredonda em vez de truncar', () => {
    expect(parseParaCentavos('0,005')).toBe(1)
  })
})

describe('centavosParaTexto', () => {
  it('devolve o valor sem símbolo, pronto para input', () => {
    expect(centavosParaTexto(123_456)).toBe('1.234,56')
    expect(centavosParaTexto(0)).toBe('0,00')
  })
})

describe('somarCentavos', () => {
  it('soma ignorando nulos', () => {
    expect(somarCentavos([1_000, null, 2_500, undefined])).toBe(3_500)
  })
})
