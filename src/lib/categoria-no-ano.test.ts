import { describe, expect, it } from 'vitest'
import { chaveDaSerie, seriesPorCategoria } from './categoria-no-ano'
import type { GastoCategoriaMes } from './database.types'

const linha = (
  mes: number,
  category_id: string | null,
  gasto_centavos: number,
  nome = category_id ?? 'Sem categoria',
): GastoCategoriaMes => ({ mes, category_id, nome, cor: '#000', gasto_centavos })

describe('seriesPorCategoria', () => {
  it('monta doze pontos, com zero no mês sem gasto', () => {
    const s = seriesPorCategoria([linha(2, 'a', 1000), linha(5, 'a', 2000)])
    expect(s).toHaveLength(1)
    expect(s[0].valores).toEqual([0, 1000, 0, 0, 2000, 0, 0, 0, 0, 0, 0, 0])
  })

  it('separa as categorias', () => {
    const s = seriesPorCategoria([linha(1, 'a', 1000), linha(1, 'b', 500)])
    expect(s.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('ordena pela que mais pesa — é a que a pessoa veio investigar', () => {
    const s = seriesPorCategoria([linha(1, 'pequena', 100), linha(1, 'grande', 9000)])
    expect(s.map((x) => x.id)).toEqual(['grande', 'pequena'])
  })

  it('empate no total desempata pelo nome', () => {
    const s = seriesPorCategoria([linha(1, 'x', 100, 'Zebra'), linha(1, 'y', 100, 'Abacaxi')])
    expect(s.map((x) => x.nome)).toEqual(['Abacaxi', 'Zebra'])
  })

  it('"Sem categoria" é uma série como as outras — ela some do gráfico se for ignorada', () => {
    const s = seriesPorCategoria([linha(1, null, 5000), linha(1, 'a', 100)])
    expect(s[0].id).toBeNull()
    expect(s[0].nome).toBe('Sem categoria')
    expect(s[0].valores[0]).toBe(5000)
  })

  it('o total conta só até o último mês realizado', () => {
    // Março a dezembro trazem o fixo de R$ 100,00; abril é o último realizado.
    const linhas = Array.from({ length: 10 }, (_, i) => linha(i + 3, 'a', 10000))
    const s = seriesPorCategoria(linhas, 4)
    // Março e abril, e não os dez meses.
    expect(s[0].totalRealizado).toBe(20000)
    // Mas o gráfico continua com os doze pontos.
    expect(s[0].valores.filter((v) => v !== 0)).toHaveLength(10)
  })

  it('a média conta só os meses realizados COM movimento', () => {
    const s = seriesPorCategoria([linha(2, 'a', 1000), linha(4, 'a', 3000)], 6)
    // Dois meses com movimento dentro do recorte: (1000 + 3000) / 2.
    expect(s[0].media).toBe(2000)
  })

  it('sem nenhum mês realizado, a média é zero e não NaN', () => {
    const s = seriesPorCategoria([linha(6, 'a', 1000)], 0)
    expect(s[0].totalRealizado).toBe(0)
    expect(s[0].media).toBe(0)
  })

  it('soma linhas repetidas do mesmo mês em vez de sobrescrever', () => {
    const s = seriesPorCategoria([linha(3, 'a', 100), linha(3, 'a', 250)])
    expect(s[0].valores[2]).toBe(350)
  })

  it('mês fora de 1–12 não corrompe o array', () => {
    const s = seriesPorCategoria([linha(0, 'a', 999), linha(13, 'a', 999), linha(1, 'a', 100)])
    expect(s[0].valores).toEqual([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('lista vazia devolve lista vazia', () => {
    expect(seriesPorCategoria([])).toEqual([])
  })
})

describe('chaveDaSerie', () => {
  it('o id quando existe', () => {
    expect(chaveDaSerie({ id: 'abc' })).toBe('abc')
  })

  it('um nome próprio para a categoria ausente, que não colide com uuid', () => {
    expect(chaveDaSerie({ id: null })).toBe(':sem-categoria')
  })
})
