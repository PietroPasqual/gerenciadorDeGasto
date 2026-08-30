import { describe, expect, it } from 'vitest'
import {
  FILTRO_VAZIO,
  aplicarFiltro,
  filtroDeParams,
  filtroEstaVazio,
  filtroParaParams,
  quantosFiltros,
  type Filtro,
} from './filtro-lancamentos'
import type { Transaction } from './database.types'

const t = (p: Partial<Transaction>): Transaction =>
  ({
    id: Math.random().toString(36),
    user_id: 'u',
    data: '2025-08-10',
    descricao: 'Gasto',
    payment_method_id: null,
    category_id: null,
    valor_centavos: 1000,
    tipo: 'gasto',
    created_at: '',
    fingerprint: null,
    parcelamento_id: null,
    parcela: null,
    parcelas_total: null,
    ...p,
  }) as Transaction

const lista = [
  t({ descricao: 'Drogaria Farmácia São Paulo', valor_centavos: 3400, category_id: 'saude' }),
  t({ descricao: 'Mercado Dia', valor_centavos: 25000, category_id: 'mercado', payment_method_id: 'pix' }),
  t({ descricao: 'MERCADO EXTRA', valor_centavos: 8000, category_id: 'mercado' }),
  t({ descricao: 'Salário', valor_centavos: 500000, tipo: 'entrada' }),
  t({ descricao: 'Uber', valor_centavos: 1800, payment_method_id: 'credito' }),
]

describe('aplicarFiltro — texto', () => {
  it('ignora acento e caixa', () => {
    // Quem digita "farmacia" precisa achar "Farmácia", senão o campo é decorativo.
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, texto: 'farmacia' })).toHaveLength(1)
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, texto: 'FARMÁCIA' })).toHaveLength(1)
  })

  it('casa por trecho, não só pelo começo', () => {
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, texto: 'são paulo' })).toHaveLength(1)
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, texto: 'mercado' })).toHaveLength(2)
  })

  it('texto em branco não filtra nada', () => {
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, texto: '   ' })).toHaveLength(lista.length)
  })
})

describe('aplicarFiltro — critérios se somam', () => {
  it('categoria E faixa de valor, não a união das duas', () => {
    const f: Filtro = { ...FILTRO_VAZIO, categoriaId: 'mercado', valorMin: 10000 }
    const r = aplicarFiltro(lista, f)
    expect(r).toHaveLength(1)
    expect(r[0].descricao).toBe('Mercado Dia')
  })

  it('faixa é inclusiva nas duas pontas', () => {
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, valorMin: 1800, valorMax: 3400 })).toHaveLength(2)
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, valorMin: 1801, valorMax: 3399 })).toHaveLength(0)
  })

  it('tipo separa gasto de entrada', () => {
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, tipo: 'entrada' })).toHaveLength(1)
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, tipo: 'gasto' })).toHaveLength(4)
  })

  it('"sem categoria" é um pedido, não ausência de filtro', () => {
    const r = aplicarFiltro(lista, { ...FILTRO_VAZIO, semCategoria: true })
    expect(r.map((x) => x.descricao).sort()).toEqual(['Salário', 'Uber'])
  })

  it('"sem forma de pagamento" idem', () => {
    expect(aplicarFiltro(lista, { ...FILTRO_VAZIO, semForma: true })).toHaveLength(3)
  })

  it('filtro vazio devolve a lista inteira, na mesma ordem', () => {
    expect(aplicarFiltro(lista, FILTRO_VAZIO)).toEqual(lista)
  })
})

describe('filtro na URL', () => {
  it('ida e volta preserva tudo', () => {
    const f: Filtro = {
      texto: 'mercado',
      categoriaId: 'cat-1',
      formaId: 'pm-1',
      valorMin: 1000,
      valorMax: 50000,
      tipo: 'gasto',
      semCategoria: false,
      semForma: true,
    }
    expect(filtroDeParams(filtroParaParams(f))).toEqual(f)
  })

  it('filtro limpo não deixa rastro na URL', () => {
    expect(filtroParaParams(FILTRO_VAZIO).toString()).toBe('')
    expect(filtroDeParams(new URLSearchParams())).toEqual(FILTRO_VAZIO)
  })

  it('preserva parâmetros que não são do filtro (a aba, por exemplo)', () => {
    const base = new URLSearchParams('aba=gastos')
    const p = filtroParaParams({ ...FILTRO_VAZIO, texto: 'uber' }, base)
    expect(p.get('aba')).toBe('gastos')
    expect(p.get('q')).toBe('uber')
  })

  it('limpar um critério remove a chave em vez de deixá-la vazia', () => {
    const comTexto = filtroParaParams({ ...FILTRO_VAZIO, texto: 'uber' })
    const semTexto = filtroParaParams(FILTRO_VAZIO, comTexto)
    expect(semTexto.has('q')).toBe(false)
  })

  it('valor inválido na URL vira "sem limite", não NaN', () => {
    // URL é dado de fora: "min=abc" não pode esconder todos os lançamentos.
    const f = filtroDeParams(new URLSearchParams('min=abc&max=-5'))
    expect(f.valorMin).toBeNull()
    expect(f.valorMax).toBeNull()
    expect(aplicarFiltro(lista, f)).toHaveLength(lista.length)
  })

  it('tipo desconhecido na URL cai em "todos"', () => {
    expect(filtroDeParams(new URLSearchParams('tipo=xpto')).tipo).toBe('todos')
  })
})

describe('contagem de filtros ativos', () => {
  it('filtro vazio conta zero e se reconhece como vazio', () => {
    expect(quantosFiltros(FILTRO_VAZIO)).toBe(0)
    expect(filtroEstaVazio(FILTRO_VAZIO)).toBe(true)
  })

  it('faixa de valor conta como UM critério, mesmo com as duas pontas', () => {
    expect(quantosFiltros({ ...FILTRO_VAZIO, valorMin: 100, valorMax: 900 })).toBe(1)
  })

  it('conta cada critério ativo', () => {
    expect(quantosFiltros({ ...FILTRO_VAZIO, texto: 'uber', categoriaId: 'c', tipo: 'gasto' })).toBe(3)
  })

  it('só espaço em branco no texto não conta como filtro', () => {
    expect(quantosFiltros({ ...FILTRO_VAZIO, texto: '   ' })).toBe(0)
    expect(filtroEstaVazio({ ...FILTRO_VAZIO, texto: '   ' })).toBe(true)
  })
})
