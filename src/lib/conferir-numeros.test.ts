import { describe, expect, it } from 'vitest'
import { conferirValores, valoresCitados } from '../../supabase/functions/perguntar/conferir-numeros'

/**
 * Escreve como o Intl escreve. Digitar "R$ 9.999,99" à mão no teste falha: o
 * separador que o Intl produz é um espaço NÃO-QUEBRÁVEL, e a string parece
 * idêntica sem ser. (Mesma pegadinha que já apareceu nas observações.)
 */
const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Os valores que a função manda para o modelo, em centavos. */
const DADOS = [368074, 369968, -1894, 175942, 120000, 74026]

describe('valoresCitados', () => {
  it('acha os reais escritos de várias formas', () => {
    expect(valoresCitados('Você gastou R$ 1.759,42 em Contas.')).toEqual([175942])
    expect(valoresCitados('R$ 18,94 e R$1.200,00')).toEqual([1894, 120000])
    expect(valoresCitados('R$ 50')).toEqual([5000])
  })

  it('ignora número que não é dinheiro', () => {
    // Sem isto, toda resposta daria alarme falso: percentual, contagem de meses
    // e ano são números e não são valores.
    expect(valoresCitados('48% das saídas em 3 dos 8 meses de 2026')).toEqual([])
  })

  it('devolve vazio quando não há valor nenhum', () => {
    expect(valoresCitados('Não consegui responder com esses dados.')).toEqual([])
  })
})

describe('conferirValores', () => {
  it('aceita valor que veio dos dados', () => {
    expect(conferirValores('Contas foi R$ 1.759,42 das saídas.', DADOS)).toEqual([])
  })

  it('aceita conta de dois valores, que o modelo faz com razão', () => {
    // 368074 - 369968 = -1894, e a soma de duas categorias também passa.
    expect(conferirValores('Entraram R$ 3.680,74 e saíram R$ 3.699,68: faltaram R$ 18,94.', DADOS)).toEqual(
      [],
    )
    expect(conferirValores('Contas mais Mercado dão R$ 2.959,42.', DADOS)).toEqual([])
  })

  it('PEGA o valor inventado', () => {
    // O ponto inteiro do módulo: um número que soa certo e não existe.
    expect(conferirValores('Você gastou R$ 9.999,99 com mercado.', DADOS)).toEqual([brl(999999)])
  })

  it('não repete o mesmo suspeito duas vezes', () => {
    const r = conferirValores('R$ 9.999,99 e de novo R$ 9.999,99.', DADOS)
    expect(r).toHaveLength(1)
  })

  it('perdoa um centavo de arredondamento', () => {
    expect(conferirValores('Aproximadamente R$ 1.759,43.', DADOS)).toEqual([])
  })

  it('sem dados, não acusa ninguém', () => {
    // Melhor não conferir do que acusar tudo quando não há base de comparação.
    expect(conferirValores('R$ 1,00', [])).toEqual([])
  })

  it('conta de três termos NÃO passa — a coincidência ficaria fácil demais', () => {
    // Três categorias que não somam nenhum total já enviado. (Na primeira
    // versão deste teste elas somavam exatamente o total de saídas, que ESTÁ
    // nos dados — o teste acusava o código de um erro que era meu.)
    const base = [10000, 20000, 30000]
    expect(conferirValores(`O total é ${brl(60000)}.`, base)).toHaveLength(1)
    // duas ainda passam
    expect(conferirValores(`Duas dão ${brl(50000)}.`, base)).toEqual([])
  })
})
