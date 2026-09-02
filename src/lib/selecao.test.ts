import { describe, expect, it } from 'vitest'
import { formatCentavos } from './money'
import {
  podarSelecao,
  resumirSelecao,
  textoDaAcao,
  textoDaExclusao,
  textoDaQuantidade,
  textoDoEscopo,
} from './selecao'
import type { Transaction } from './database.types'

function lancamento(id: string, mudancas: Partial<Transaction> = {}): Transaction {
  return {
    id,
    user_id: 'u',
    created_at: '',
    data: '2026-09-10',
    descricao: id,
    payment_method_id: null,
    category_id: null,
    valor_centavos: 1000,
    tipo: 'gasto',
    fingerprint: null,
    parcelamento_id: null,
    parcela: null,
    parcelas_total: null,
    ...mudancas,
  } as Transaction
}

const LISTA = [
  lancamento('a', { valor_centavos: 2500 }),
  lancamento('b', { valor_centavos: 1000, parcelamento_id: 's1', parcela: 1, parcelas_total: 3 }),
  lancamento('c', { valor_centavos: 1000, parcelamento_id: 's1', parcela: 2, parcelas_total: 3 }),
  lancamento('d', { valor_centavos: 700, parcelamento_id: 's2', parcela: 1, parcelas_total: 2 }),
  lancamento('e', { valor_centavos: 300 }),
]

describe('resumirSelecao', () => {
  it('soma só o que está marcado', () => {
    expect(resumirSelecao(LISTA, new Set(['a', 'e']))).toEqual({
      quantidade: 2,
      totalCentavos: 2800,
      parcelas: 0,
      series: 0,
    })
  })

  it('conta parcelas e quantas séries elas tocam', () => {
    expect(resumirSelecao(LISTA, new Set(['b', 'c', 'd']))).toEqual({
      quantidade: 3,
      totalCentavos: 2700,
      parcelas: 3,
      series: 2,
    })
  })

  it('duas parcelas da MESMA compra são uma série só', () => {
    expect(resumirSelecao(LISTA, new Set(['b', 'c'])).series).toBe(1)
  })

  it('id marcado que não está na lista não conta — ele não existe mais', () => {
    expect(resumirSelecao(LISTA, new Set(['a', 'fantasma'])).quantidade).toBe(1)
  })

  it('seleção vazia é zero em tudo', () => {
    expect(resumirSelecao(LISTA, new Set())).toEqual({
      quantidade: 0,
      totalCentavos: 0,
      parcelas: 0,
      series: 0,
    })
  })
})

describe('podarSelecao', () => {
  it('tira o que saiu da tela', () => {
    const podado = podarSelecao(new Set(['a', 'b', 'c']), ['a', 'c'])
    expect([...podado].sort()).toEqual(['a', 'c'])
  })

  it('devolve o MESMO conjunto quando nada saiu — é o que evita o render à toa', () => {
    const original = new Set(['a', 'b'])
    expect(podarSelecao(original, ['a', 'b', 'z'])).toBe(original)
  })

  it('lista vazia zera a seleção', () => {
    expect(podarSelecao(new Set(['a']), []).size).toBe(0)
  })

  it('seleção vazia continua a mesma', () => {
    const vazio = new Set<string>()
    expect(podarSelecao(vazio, ['a'])).toBe(vazio)
  })
})

describe('textoDaQuantidade', () => {
  it('singular e plural', () => {
    expect(textoDaQuantidade(1)).toBe('1 lançamento')
    expect(textoDaQuantidade(4)).toBe('4 lançamentos')
    expect(textoDaQuantidade(0)).toBe('0 lançamentos')
  })
})

describe('textoDaAcao', () => {
  it('concorda o particípio com o número', () => {
    expect(textoDaAcao(1, 'alterado')).toBe('1 lançamento alterado')
    expect(textoDaAcao(3, 'alterado')).toBe('3 lançamentos alterados')
  })

  it('vale para os acentuados também', () => {
    expect(textoDaAcao(1, 'excluído')).toBe('1 lançamento excluído')
    expect(textoDaAcao(2, 'excluído')).toBe('2 lançamentos excluídos')
  })
})

describe('textoDoEscopo', () => {
  it('com filtro, diz o recorte E o tamanho do mês', () => {
    const texto = textoDoEscopo(3, 5, 40)
    expect(texto).toContain('3 de 5 no filtro atual')
    expect(texto).toContain('o mês tem 40')
  })

  it('sem filtro, fala só do mês', () => {
    expect(textoDoEscopo(3, 40, 40)).toBe('3 de 40 lançamentos do mês.')
  })

  it('mês de um lançamento só fala no singular', () => {
    expect(textoDoEscopo(1, 1, 1)).toBe('1 de 1 lançamento do mês.')
  })
})

describe('textoDaExclusao', () => {
  it('sem parcela, diz quantos e quanto', () => {
    const { titulo, descricao } = textoDaExclusao(resumirSelecao(LISTA, new Set(['a', 'e'])))
    expect(titulo).toBe('Excluir 2 lançamentos?')
    expect(descricao).toBe(`São ${formatCentavos(2800)} no total.`)
  })

  it('com parcela, promete o escopo estreito por escrito', () => {
    const { descricao } = textoDaExclusao(resumirSelecao(LISTA, new Set(['b', 'c', 'd'])))
    expect(descricao).toContain('3 são parcelas de 2 compras parceladas')
    expect(descricao).toContain('só as parcelas marcadas saem, o resto da série fica')
  })

  it('uma parcela só fala no singular dos dois lados', () => {
    const { titulo, descricao } = textoDaExclusao(resumirSelecao(LISTA, new Set(['d'])))
    expect(titulo).toBe('Excluir 1 lançamento?')
    expect(descricao).toContain('1 é parcela de 1 compra parcelada')
    expect(descricao).toContain('só a parcela marcada sai')
  })
})
