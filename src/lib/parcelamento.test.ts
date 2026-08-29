import { describe, expect, it } from 'vitest'
import { datasDasParcelas, dividirEmParcelas, montarParcelas, rotuloParcela } from './parcelamento'

describe('dividirEmParcelas', () => {
  it('o caso do enunciado: R$ 100,00 em 3x', () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3334, 3333, 3333])
  })

  it('a soma fecha EXATAMENTE com o total, sempre', () => {
    // Varre valores e quantidades de verdade: é a única propriedade que não
    // pode falhar nunca, porque a diferença vira dinheiro que some.
    for (let total = 1; total <= 2000; total++) {
      for (const n of [2, 3, 4, 5, 6, 7, 10, 12, 18, 24, 60]) {
        const parcelas = dividirEmParcelas(total, n)
        expect(parcelas).toHaveLength(n)
        expect(
          parcelas.reduce((s, v) => s + v, 0),
          `${total} em ${n}x`,
        ).toBe(total)
      }
    }
  })

  it('toda parcela é inteiro de centavos — nenhum float no caminho', () => {
    for (const [total, n] of [
      [10000, 3],
      [999, 7],
      [1, 2],
      [123456789, 13],
    ] as const) {
      for (const v of dividirEmParcelas(total, n)) expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('a sobra vai na primeira parcela, e só nela', () => {
    expect(dividirEmParcelas(10000, 3)).toEqual([3334, 3333, 3333])
    // Sobra de 4 centavos em 5x: os quatro vão juntos na primeira, não um em
    // cada — é o que diferencia esta regra da de espalhar.
    expect(dividirEmParcelas(10004, 5)).toEqual([2004, 2000, 2000, 2000, 2000])
    expect(dividirEmParcelas(10002, 5)).toEqual([2002, 2000, 2000, 2000, 2000])

    // Da segunda em diante todas são iguais, seja qual for a sobra.
    for (let total = 1000; total < 1060; total++) {
      const [, ...resto] = dividirEmParcelas(total, 7)
      expect(new Set(resto).size).toBe(1)
    }
  })

  it('divide redondo sem sobra quando não há sobra', () => {
    expect(dividirEmParcelas(9000, 3)).toEqual([3000, 3000, 3000])
    expect(dividirEmParcelas(1200, 12)).toEqual(Array(12).fill(100))
  })

  it('total menor que a quantidade de parcelas não perde o centavo', () => {
    // R$ 0,02 em 5x: quatro parcelas de zero e a sobra na primeira.
    expect(dividirEmParcelas(2, 5)).toEqual([2, 0, 0, 0, 0])
  })

  it('recusa float e quantidade inválida em vez de arredondar calado', () => {
    expect(() => dividirEmParcelas(100.5, 3)).toThrow(/inteiro/)
    expect(() => dividirEmParcelas(1000, 0)).toThrow(/maior que zero/)
    expect(() => dividirEmParcelas(1000, 2.5)).toThrow(/inteiro/)
  })

  it('valor negativo continua somando exato', () => {
    const p = dividirEmParcelas(-10000, 3)
    expect(p.reduce((s, v) => s + v, 0)).toBe(-10000)
    expect(p).toEqual([-3334, -3333, -3333])
  })
})

describe('datasDasParcelas', () => {
  it('avança um mês por parcela', () => {
    expect(datasDasParcelas('2025-08-15', 4)).toEqual([
      '2025-08-15',
      '2025-09-15',
      '2025-10-15',
      '2025-11-15',
    ])
  })

  it('vira o ano', () => {
    expect(datasDasParcelas('2025-11-10', 3)).toEqual(['2025-11-10', '2025-12-10', '2026-01-10'])
  })

  it('dia 31 encosta no último dia do mês em vez de vazar', () => {
    expect(datasDasParcelas('2025-01-31', 4)).toEqual([
      '2025-01-31',
      '2025-02-28',
      '2025-03-31',
      '2025-04-30',
    ])
  })

  it('fevereiro de ano bissexto ganha o dia 29', () => {
    expect(datasDasParcelas('2024-01-31', 2)).toEqual(['2024-01-31', '2024-02-29'])
  })

  it('as datas saem em ordem crescente, sempre', () => {
    for (const inicio of ['2025-01-31', '2025-08-15', '2024-02-29', '2025-12-31']) {
      const datas = datasDasParcelas(inicio, 24)
      for (let i = 1; i < datas.length; i++) expect(datas[i] > datas[i - 1]).toBe(true)
    }
  })
})

describe('montarParcelas', () => {
  it('12x de uma compra de R$ 2.400,05 fecha exato e numera certo', () => {
    const parcelas = montarParcelas(240005, 12, '2025-08-20')
    expect(parcelas).toHaveLength(12)
    expect(parcelas.reduce((s, p) => s + p.valor_centavos, 0)).toBe(240005)
    expect(parcelas[0]).toEqual({
      parcela: 1,
      parcelas_total: 12,
      data: '2025-08-20',
      valor_centavos: 20005,
    })
    expect(parcelas[11].parcela).toBe(12)
    expect(parcelas[11].data).toBe('2026-07-20')
    expect(rotuloParcela(parcelas[2].parcela, 12)).toBe('3/12')
  })
})
