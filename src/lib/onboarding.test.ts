import { describe, expect, it } from 'vitest'
import { ORDEM, deveAparecer, estadoDoGuia, marcarVisto, type DadosDoGuia } from './onboarding'

const zerado: DadosDoGuia = {
  nome: '',
  orcamentoCentavos: 0,
  temEntradaRecorrente: false,
  temLimite: false,
  temLancamento: false,
  vistos: [],
}

const estado = (mudancas: Partial<DadosDoGuia> = {}) => estadoDoGuia({ ...zerado, ...mudancas })
const feitas = (mudancas: Partial<DadosDoGuia> = {}) =>
  estado(mudancas)
    .etapas.filter((e) => e.feita)
    .map((e) => e.id)

describe('estadoDoGuia', () => {
  it('conta vazia não tem nenhum passo feito', () => {
    const e = estado()
    expect(e.feitas).toBe(0)
    expect(e.percentual).toBe(0)
    expect(e.concluido).toBe(false)
    expect(e.proxima).toBe('nome')
  })

  it('as sete etapas saem na ordem da fase 7', () => {
    expect(estado().etapas.map((x) => x.id)).toEqual(ORDEM)
  })

  it('todo passo é pulável — a fase 7 exige isso, e a tela precisa poder dizer', () => {
    expect(estado().etapas.every((x) => x.opcional)).toBe(true)
  })
})

describe('o que é derivado do dado, e não guardado', () => {
  it('nome preenchido no cadastro já chega com o passo pronto', () => {
    expect(feitas({ nome: 'Ana' })).toEqual(['nome'])
  })

  it('nome só de espaços não conta', () => {
    expect(feitas({ nome: '   ' })).toEqual([])
  })

  it('orçamento zero não é orçamento definido', () => {
    expect(feitas({ orcamentoCentavos: 0 })).toEqual([])
    expect(feitas({ orcamentoCentavos: 1 })).toEqual(['orcamento'])
  })

  it('quem configurou pelas Configurações vê o passo pronto, sem o guia saber', () => {
    // O ponto inteiro de derivar: ninguém precisou avisar o guia.
    const e = estado({ orcamentoCentavos: 300000, temEntradaRecorrente: true })
    expect(e.feitas).toBe(2)
    expect(e.proxima).toBe('nome')
  })

  it('entrada recorrente, limite e primeiro gasto também derivam', () => {
    expect(feitas({ temEntradaRecorrente: true })).toEqual(['entrada'])
    expect(feitas({ temLimite: true })).toEqual(['limites'])
    expect(feitas({ temLancamento: true })).toEqual(['primeiro-gasto'])
  })
})

describe('o que não dá para derivar', () => {
  it('categorias e lembretes nascem pendentes — "está bom assim" é uma resposta', () => {
    // As duas já vêm preenchidas (0004 e 0017), então não há nada no dado que
    // distinga "conferi e gostei" de "nunca olhei".
    const e = estado({
      nome: 'Ana',
      orcamentoCentavos: 1,
      temEntradaRecorrente: true,
      temLimite: true,
      temLancamento: true,
    })
    expect(e.etapas.filter((x) => !x.feita).map((x) => x.id)).toEqual(['categorias', 'lembretes'])
  })

  it('marcar como visto resolve o passo', () => {
    expect(feitas({ vistos: ['categorias'] })).toEqual(['categorias'])
  })

  it('visto vale para qualquer passo, inclusive os deriváveis', () => {
    // Quem abriu o passo do orçamento e decidiu não pôr nenhum resolveu o
    // passo. Insistir seria transformar "pular" em "adiar".
    expect(feitas({ vistos: ['orcamento'] })).toEqual(['orcamento'])
  })

  it('visto e dado concordando não conta duas vezes', () => {
    expect(feitas({ nome: 'Ana', vistos: ['nome'] })).toEqual(['nome'])
  })

  it('visto desconhecido não inventa passo nenhum', () => {
    expect(estado({ vistos: ['passo-que-nao-existe'] }).feitas).toBe(0)
  })
})

describe('progresso', () => {
  it('a barra acompanha os sete', () => {
    expect(estado({ nome: 'Ana' }).percentual).toBe(14)
    expect(estado({ nome: 'Ana', orcamentoCentavos: 1 }).percentual).toBe(29)
  })

  it('tudo feito fecha em 100 e sem próxima', () => {
    const e = estado({
      nome: 'Ana',
      orcamentoCentavos: 1,
      temEntradaRecorrente: true,
      temLimite: true,
      temLancamento: true,
      vistos: ['categorias', 'lembretes'],
    })
    expect(e.percentual).toBe(100)
    expect(e.concluido).toBe(true)
    expect(e.proxima).toBeNull()
  })

  it('a próxima é a primeira pendente na ordem, e não a última mexida', () => {
    expect(estado({ nome: 'Ana', temLancamento: true }).proxima).toBe('orcamento')
  })
})

describe('marcarVisto', () => {
  it('acrescenta', () => {
    expect(marcarVisto([], 'nome')).toEqual(['nome'])
    expect(marcarVisto(['nome'], 'orcamento')).toEqual(['nome', 'orcamento'])
  })

  it('devolve a MESMA lista quando já estava lá — é o que evita gravar à toa', () => {
    const original = ['nome']
    expect(marcarVisto(original, 'nome')).toBe(original)
  })
})

describe('deveAparecer', () => {
  it('conta nova vê o guia', () => {
    expect(deveAparecer(null)).toBe(true)
  })

  it('quem já encerrou não vê de novo', () => {
    expect(deveAparecer('2026-01-01T00:00:00Z')).toBe(false)
  })

  it('coluna ausente conta como "ainda não apareceu"', () => {
    // `== null` frouxo: enquanto a 0022 não tiver rodado, a linha volta SEM a
    // coluna, e `undefined` precisa cair no mesmo lado que `null` — a mesma
    // armadilha que a 0005 e a 0019 documentam.
    expect(deveAparecer(undefined)).toBe(true)
  })
})
