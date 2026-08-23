import { describe, expect, it } from 'vitest'
import { observacoesDoMes, type Observacao } from './observacoes'
import { formatCentavos } from './money'

/**
 * Compara usando o mesmo formatador da aplicação. Escrever "R$ 18,94" à mão
 * no teste falha: o separador que o Intl produz é um espaço NÃO-QUEBRÁVEL, e
 * a string parece idêntica mas não é.
 */
const brl = (centavos: number) => formatCentavos(centavos)

const RESUMO_ZERO = { total_entradas: 0, total_saidas: 0, saldo: 0, total_investido: 0 }

function rodar(p: Partial<Parameters<typeof observacoesDoMes>[0]>): Observacao[] {
  return observacoesDoMes({
    resumo: RESUMO_ZERO,
    categorias: [],
    meses: [],
    mes: 8,
    ano: 2026,
    ...p,
  })
}
const ids = (o: Observacao[]) => o.map((x) => x.id)
const texto = (o: Observacao[], id: string) => o.find((x) => x.id === id)?.texto ?? ''

describe('quando NÃO falar', () => {
  it('mês sem nada lançado não gera observação', () => {
    expect(rodar({})).toEqual([])
  })

  it('não compara com a média tendo só um outro mês', () => {
    // Com dois meses, "acima da média" é só "maior que o outro".
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 90000, saldo: 10000, total_investido: 0 },
      meses: [{ mes: 7, entradas: 100000, saidas: 10000 }],
    })
    expect(ids(o)).not.toContain('contra-media')
  })

  it('diferença pequena contra a média não vira notícia', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 105000, saldo: -5000, total_investido: 0 },
      // média dos outros = 100000, diferença de 5% → silêncio
      meses: [
        { mes: 6, entradas: 100000, saidas: 100000 },
        { mes: 7, entradas: 100000, saidas: 100000 },
      ],
    })
    expect(ids(o)).not.toContain('contra-media')
  })

  it('pouco sem categoria não ocupa espaço', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 100000, saldo: 0, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 5000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 95000, limite_centavos: null },
      ],
    })
    expect(ids(o)).not.toContain('sem-categoria')
  })

  it('nunca passa de quatro — é um relance, não um relatório', () => {
    const o = rodar({
      resumo: { total_entradas: 500000, total_saidas: 900000, saldo: -400000, total_investido: 50000 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 500000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 400000, limite_centavos: 100000 },
      ],
      meses: [
        { mes: 5, entradas: 100000, saidas: 300000 },
        { mes: 6, entradas: 100000, saidas: 300000 },
        { mes: 7, entradas: 100000, saidas: 100000 },
      ],
    })
    expect(o.length).toBeLessThanOrEqual(4)
  })
})

describe('os fatos', () => {
  it('saldo negativo diz quanto saiu a mais', () => {
    const o = rodar({
      resumo: { total_entradas: 368074, total_saidas: 369968, saldo: -1894, total_investido: 0 },
    })
    expect(texto(o, 'saldo-negativo')).toContain(brl(1894))
    expect(o.find((x) => x.id === 'saldo-negativo')?.tom).toBe('atencao')
  })

  it('saldo positivo diz quanto sobrou e a fração', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 300000, saldo: 100000, total_investido: 0 },
    })
    expect(texto(o, 'saldo-positivo')).toContain(brl(100000))
    expect(texto(o, 'saldo-positivo')).toContain('25%')
  })

  it('sem categoria alto vira aviso com o valor', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 369968, saldo: 30032, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 369968, limite_centavos: null },
      ],
    })
    expect(texto(o, 'sem-categoria')).toContain('100%')
    expect(texto(o, 'sem-categoria')).toContain(brl(369968))
  })

  it('limite estourado usa o SEU limite, não uma regra de fora', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 150000, saldo: 250000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'Mercado', gasto_centavos: 150000, limite_centavos: 100000 }],
    })
    expect(texto(o, 'limite-estourado')).toContain('Mercado')
    expect(texto(o, 'limite-estourado')).toContain(brl(150000))
    expect(texto(o, 'limite-estourado')).toContain(brl(100000))
  })

  it('a maior categoria não conta o "sem categoria" como campeã', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 90000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 10000, limite_centavos: null },
      ],
    })
    expect(texto(o, 'maior-categoria')).toContain('Mercado')
  })

  it('compara com a média dos OUTROS meses, sem incluir o atual', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 200000, saldo: 200000, total_investido: 0 },
      meses: [
        { mes: 6, entradas: 400000, saidas: 100000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
        { mes: 8, entradas: 400000, saidas: 200000 }, // o mês atual, ignorado
      ],
    })
    // média dos outros dois = 100000; o mês foi 100% acima
    expect(texto(o, 'contra-media')).toContain('100%')
    expect(texto(o, 'contra-media')).toContain('a mais')
    expect(texto(o, 'contra-media')).toContain('2 meses')
  })

  it('gastar abaixo da média é tom bom', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 50000, saldo: 350000, total_investido: 0 },
      meses: [
        { mes: 6, entradas: 400000, saidas: 100000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
      ],
    })
    expect(o.find((x) => x.id === 'contra-media')?.tom).toBe('bom')
    expect(texto(o, 'contra-media')).toContain('a menos')
  })

  it('conta os meses fechados no negativo', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 300000, saldo: 100000, total_investido: 0 },
      meses: [
        { mes: 5, entradas: 100000, saidas: 200000 },
        { mes: 6, entradas: 100000, saidas: 200000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
      ],
    })
    expect(texto(o, 'meses-negativos')).toContain('2 dos 3')
  })

  it('o que foi guardado aparece como fração do que entrou', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 80000 },
    })
    expect(texto(o, 'investido')).toContain(brl(80000))
    expect(texto(o, 'investido')).toContain('20%')
  })
})

describe('ordem e segurança', () => {
  it('o que pede decisão vem antes do que é elogio', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 500000, saldo: -100000, total_investido: 40000 },
    })
    expect(o[0].id).toBe('saldo-negativo')
    expect(ids(o).indexOf('saldo-negativo')).toBeLessThan(ids(o).indexOf('investido'))
  })

  it('não divide por zero em lugar nenhum', () => {
    const o = rodar({
      resumo: { total_entradas: 0, total_saidas: 100000, saldo: -100000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'X', gasto_centavos: 100000, limite_centavos: 0 }],
      meses: [
        { mes: 6, entradas: 0, saidas: 0 },
        { mes: 7, entradas: 0, saidas: 0 },
      ],
    })
    expect(o.every((x) => !x.texto.includes('NaN') && !x.texto.includes('Infinity'))).toBe(true)
  })

  it('limite zero não conta como limite estourado', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'X', gasto_centavos: 100000, limite_centavos: 0 }],
    })
    expect(ids(o)).not.toContain('limite-estourado')
  })
})
