import { describe, expect, it } from 'vitest'
import {
  alcanceDaRegra,
  podeVirarRegra,
  sugerirCategoriaComAprendizado,
  termoDaDescricao,
} from './regras-aprendidas'

const categorias = [
  { id: 'c-alim', nome: 'Alimentação' },
  { id: 'c-casa', nome: 'Casa' },
  { id: 'c-transp', nome: 'Transporte' },
]

describe('termoDaDescricao', () => {
  it('tira os números que mudam a cada compra', () => {
    // Sem isso a regra nasceria presa a uma compra só e nunca mais casaria.
    expect(termoDaDescricao('IFD*BRASILIA REST 4471')).toBe(termoDaDescricao('IFD*BRASILIA REST 9982'))
  })

  it('ignora o verbo do pagamento e a caixa', () => {
    expect(termoDaDescricao('PAG*JoaoDaSilva')).toBe(termoDaDescricao('pag*joaodasilva'))
  })

  it('destinatários diferentes dão termos diferentes', () => {
    expect(termoDaDescricao('PAG*JOAODASILVA')).not.toBe(termoDaDescricao('PAG*MARIASOUZA'))
  })
})

describe('podeVirarRegra — as três travas', () => {
  it('recusa termo curto demais', () => {
    expect(podeVirarRegra('ab')).toBe(false)
    expect(podeVirarRegra('PIX')).toBe(false)
    expect(podeVirarRegra('123 456')).toBe(false)
  })

  it('recusa descrição que vira termo vazio', () => {
    expect(podeVirarRegra('')).toBe(false)
    expect(podeVirarRegra('   ')).toBe(false)
    expect(podeVirarRegra('9999')).toBe(false)
  })

  it('aceita nome de destinatário de verdade', () => {
    expect(podeVirarRegra('PAG*JOAODASILVA 991')).toBe(true)
    expect(podeVirarRegra('MERCADO SAO JORGE LTDA')).toBe(true)
  })

  it('só deixa passar palavra curta que as regras fixas já permitem', () => {
    // 'hbo' e 'tim' estão na lista explícita; qualquer outra de 3 letras não.
    expect(podeVirarRegra('HBO')).toBe(true)
    expect(podeVirarRegra('TIM')).toBe(true)
    expect(podeVirarRegra('XYZ')).toBe(false)
    expect(podeVirarRegra('DIA')).toBe(false)
  })
})

describe('sugerirCategoriaComAprendizado — precedência', () => {
  it('a regra do usuário ganha da fixa', () => {
    // 'uber' cai em Transporte pelas regras fixas; o usuário disse que é Casa.
    const semAprendizado = sugerirCategoriaComAprendizado('UBER *TRIP', categorias, [])
    expect(semAprendizado).toBe('c-transp')

    const comAprendizado = sugerirCategoriaComAprendizado('UBER *TRIP', categorias, [
      { termo: termoDaDescricao('UBER *TRIP'), category_id: 'c-casa' },
    ])
    expect(comAprendizado).toBe('c-casa')
  })

  it('sem regra do usuário, cai nas fixas', () => {
    expect(sugerirCategoriaComAprendizado('DROGARIA SAO PAULO', categorias, [])).toBeNull()
    expect(
      sugerirCategoriaComAprendizado('IFOOD PEDIDO', categorias, [{ termo: 'outra', category_id: 'c-casa' }]),
    ).toBe('c-alim')
  })

  it('regra apontando para categoria excluída é ignorada, e as fixas assumem', () => {
    const r = sugerirCategoriaComAprendizado('UBER *TRIP', categorias, [
      { termo: termoDaDescricao('UBER *TRIP'), category_id: 'c-apagada' },
    ])
    expect(r).toBe('c-transp')
  })

  it('a regra vale para a mesma loja com número diferente', () => {
    const aprendidas = [{ termo: termoDaDescricao('IFD*BRASILIA REST 4471'), category_id: 'c-casa' }]
    expect(sugerirCategoriaComAprendizado('IFD*BRASILIA REST 9982', categorias, aprendidas)).toBe('c-casa')
  })

  it('descrição vazia não casa com regra nenhuma', () => {
    expect(
      sugerirCategoriaComAprendizado('   ', categorias, [{ termo: '', category_id: 'c-casa' }]),
    ).toBeNull()
  })
})

describe('alcanceDaRegra', () => {
  it('conta quantos lançamentos a regra passaria a classificar', () => {
    const descricoes = ['PAG*JOAODASILVA 991', 'PAG*JOAODASILVA 4471', 'PAG*MARIASOUZA 12', 'MERCADO DIA']
    expect(alcanceDaRegra(termoDaDescricao('PAG*JOAODASILVA 1'), descricoes)).toBe(2)
    expect(alcanceDaRegra(termoDaDescricao('PAG*MARIASOUZA 1'), descricoes)).toBe(1)
    expect(alcanceDaRegra('naoexiste', descricoes)).toBe(0)
  })
})
