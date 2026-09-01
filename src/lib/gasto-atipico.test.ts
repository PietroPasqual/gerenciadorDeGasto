import { describe, expect, it } from 'vitest'
import { formatCentavos } from './money'
import {
  MIN_TRANSACOES_BASE,
  MULTIPLICADOR_ATIPICO,
  VALOR_MINIMO_CENTAVOS,
  gastoMaisAtipico,
  historicoPorCategoria,
  textoDoGastoAtipico,
  type CandidatoAtipico,
} from './gasto-atipico'

const CAT_MERCADO = 'cat-mercado'
const CAT_LAZER = 'cat-lazer'

const MES_AVALIADO = { ano: 2026, mes: 8 }
const FORA_DO_MES = '2026-05-10' // qualquer data que não seja agosto de 2026

/** Cinco compras de R$ 100 na categoria — a base mínima, no valor mínimo. */
function historicoPadrao(categoria = CAT_MERCADO, valor = 10000, n = MIN_TRANSACOES_BASE) {
  const gastos = Array.from({ length: n }, () => ({
    data: FORA_DO_MES,
    category_id: categoria,
    valor_centavos: valor,
    parcelamento_id: null,
  }))
  return historicoPorCategoria({ gastos, periodoAvaliado: MES_AVALIADO })
}

function candidato(valor: number, categoria = CAT_MERCADO, extra: Partial<CandidatoAtipico> = {}) {
  return {
    id: 't1',
    category_id: categoria,
    valor_centavos: valor,
    parcelamento_id: null,
    ...extra,
  }
}

describe('historicoPorCategoria', () => {
  it('soma e conta por categoria', () => {
    const h = historicoPorCategoria({
      gastos: [
        { data: FORA_DO_MES, category_id: CAT_MERCADO, valor_centavos: 10000, parcelamento_id: null },
        { data: FORA_DO_MES, category_id: CAT_MERCADO, valor_centavos: 20000, parcelamento_id: null },
        { data: FORA_DO_MES, category_id: CAT_LAZER, valor_centavos: 5000, parcelamento_id: null },
      ],
      periodoAvaliado: MES_AVALIADO,
    })
    expect(h.get(CAT_MERCADO)).toEqual({ somaCentavos: 30000, contagem: 2 })
    expect(h.get(CAT_LAZER)).toEqual({ somaCentavos: 5000, contagem: 1 })
  })

  it('ignora sem categoria', () => {
    const h = historicoPorCategoria({
      gastos: [{ data: FORA_DO_MES, category_id: null, valor_centavos: 10000, parcelamento_id: null }],
      periodoAvaliado: MES_AVALIADO,
    })
    expect(h.size).toBe(0)
  })

  it('ignora parcelamento — a trava mais importante do arquivo', () => {
    // O valor da parcela é uma fração do preço cheio, não o preço; entrar no
    // histórico inflaria ou desinflaria a média com números de outra escala.
    const h = historicoPorCategoria({
      gastos: [{ data: FORA_DO_MES, category_id: CAT_MERCADO, valor_centavos: 10000, parcelamento_id: 'p1' }],
      periodoAvaliado: MES_AVALIADO,
    })
    expect(h.size).toBe(0)
  })

  it('exclui o mês avaliado — a própria compra não pode inflar a média que a compara', () => {
    const h = historicoPorCategoria({
      gastos: [
        { data: FORA_DO_MES, category_id: CAT_MERCADO, valor_centavos: 10000, parcelamento_id: null },
        { data: '2026-08-20', category_id: CAT_MERCADO, valor_centavos: 999999, parcelamento_id: null },
      ],
      periodoAvaliado: MES_AVALIADO,
    })
    expect(h.get(CAT_MERCADO)).toEqual({ somaCentavos: 10000, contagem: 1 })
  })
})

describe('gastoMaisAtipico', () => {
  it('acha a compra que é 4x ou mais a média da categoria', () => {
    const historico = historicoPadrao()
    const g = gastoMaisAtipico({ candidatos: [candidato(40000)], historico })
    expect(g).toEqual({
      id: 't1',
      categoriaId: CAT_MERCADO,
      valorCentavos: 40000,
      mediaCentavos: 10000,
      multiplicador: 4,
    })
  })

  it('trunca o multiplicador para baixo: não promete mais do que a compra é', () => {
    // 39999 / 10000 = 3.9999 — três vezes e quase quatro, mas não quatro.
    const historico = historicoPadrao()
    expect(gastoMaisAtipico({ candidatos: [candidato(39999)], historico })).toBeNull()
    expect(MULTIPLICADOR_ATIPICO).toBe(4)
  })

  it('cala com menos de cinco compras na categoria — sem base não há média', () => {
    expect(MIN_TRANSACOES_BASE).toBe(5)
    const historico = historicoPadrao(CAT_MERCADO, 10000, MIN_TRANSACOES_BASE - 1)
    expect(gastoMaisAtipico({ candidatos: [candidato(40000)], historico })).toBeNull()
  })

  it('cala abaixo do valor mínimo — 4x de uma média pequena não vale o alerta', () => {
    expect(VALOR_MINIMO_CENTAVOS).toBe(5000)
    const historico = historicoPadrao(CAT_MERCADO, 100) // média de R$1,00
    // R$ 40,00 seria 40x a média, mas é menor que o piso de R$ 50,00.
    expect(gastoMaisAtipico({ candidatos: [candidato(4000)], historico })).toBeNull()
  })

  it('cala sem categoria', () => {
    const historico = historicoPadrao()
    expect(
      gastoMaisAtipico({ candidatos: [candidato(40000, null as unknown as string)], historico }),
    ).toBeNull()
  })

  it('cala em parcelamento, mesmo acima do multiplicador', () => {
    const historico = historicoPadrao()
    expect(
      gastoMaisAtipico({
        candidatos: [candidato(40000, CAT_MERCADO, { parcelamento_id: 'p1' })],
        historico,
      }),
    ).toBeNull()
  })

  it('cala categoria sem histórico', () => {
    const historico = historicoPadrao(CAT_MERCADO)
    expect(gastoMaisAtipico({ candidatos: [candidato(40000, CAT_LAZER)], historico })).toBeNull()
  })

  it('entre vários candidatos, escolhe o de maior multiplicador', () => {
    const historico = historicoPadrao()
    const g = gastoMaisAtipico({
      candidatos: [
        candidato(40000, CAT_MERCADO, { id: 't-quatro' }),
        candidato(90000, CAT_MERCADO, { id: 't-nove' }),
        candidato(50000, CAT_MERCADO, { id: 't-cinco' }),
      ],
      historico,
    })
    expect(g?.id).toBe('t-nove')
    expect(g?.multiplicador).toBe(9)
  })

  it('lista vazia não inventa nada', () => {
    expect(gastoMaisAtipico({ candidatos: [], historico: historicoPadrao() })).toBeNull()
  })
})

describe('textoDoGastoAtipico', () => {
  it('é fato, com número e categoria, nunca conselho', () => {
    const historico = historicoPadrao()
    const g = gastoMaisAtipico({ candidatos: [candidato(40000)], historico })!
    const texto = textoDoGastoAtipico(g, 'Mercado')
    expect(texto).toBe(`é 4× a sua média em Mercado (normalmente ${formatCentavos(10000)}).`)
    expect(texto).not.toMatch(/deveria|precisa|corte|evite|cuidado|gaste menos/i)
  })
})
