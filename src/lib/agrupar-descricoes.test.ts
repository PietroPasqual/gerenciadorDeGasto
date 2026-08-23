import { describe, expect, it } from 'vitest'
import {
  agruparPorDestinatario,
  chaveDoDestinatario,
  coberturaDosMaiores,
  rotuloDoDestinatario,
} from './agrupar-descricoes'

describe('chaveDoDestinatario', () => {
  it('tira o verbo da transferência e deixa o nome', () => {
    expect(chaveDoDestinatario('Pix enviado para Verli Friedrich')).toBe('verli friedrich')
    expect(chaveDoDestinatario('Pix automático enviado para Ebanx')).toBe('ebanx')
    expect(chaveDoDestinatario('Pix recebido c6 de EDSON RIBEIRO DA SILVA')).toBe('edson ribeiro da silva')
    expect(chaveDoDestinatario('Compra com Cartão UBER TRIP')).toBe('uber trip')
  })

  it('junta a mesma empresa escrita de formas diferentes', () => {
    // O ponto do agrupamento: estas três têm de cair na MESMA chave.
    const a = chaveDoDestinatario('Pix enviado para GOOGLE BRASIL PAGAMENTOS LTDA.')
    const b = chaveDoDestinatario('Pix enviado para Google Brasil Pagamentos Ltda')
    const c = chaveDoDestinatario('Pix automático enviado para GOOGLE BRASIL PAGAMENTOS')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('ignora códigos numéricos, que quebrariam o grupo em pedaços de um', () => {
    expect(chaveDoDestinatario('Pix enviado para EBANX 0231')).toBe(
      chaveDoDestinatario('Pix enviado para EBANX 9987'),
    )
  })

  it('pega o prefixo mais longo primeiro, sem deixar "para" sobrando', () => {
    expect(chaveDoDestinatario('Pix enviado para Maria')).toBe('maria')
    expect(chaveDoDestinatario('Pix enviado Maria')).toBe('maria')
  })

  it('descrição sem nome vira chave vazia', () => {
    expect(chaveDoDestinatario('TRANSF ENVIADA PIX')).toBe('')
    expect(chaveDoDestinatario('123456')).toBe('')
  })
})

describe('agruparPorDestinatario', () => {
  const item = (id: string, descricao: string, valor: number) => ({ id, descricao, valor_centavos: valor })

  it('junta as linhas do mesmo destinatário e soma', () => {
    const g = agruparPorDestinatario([
      item('1', 'Pix enviado para Verli Friedrich', 1120),
      item('2', 'Pix enviado para Verli Friedrich', 2219),
      item('3', 'Pix enviado para EBANX', 1604),
    ])
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ chave: 'verli friedrich', total: 3339 })
    expect(g[0].ids).toEqual(['1', '2'])
  })

  it('ordena pelos que mais se repetem — mais decisão por toque', () => {
    const g = agruparPorDestinatario([
      item('1', 'Pix enviado para Ana', 100),
      item('2', 'Pix enviado para Bruno', 100),
      item('3', 'Pix enviado para Bruno', 100),
      item('4', 'Pix enviado para Bruno', 100),
    ])
    expect(g[0].chave).toBe('bruno')
    expect(g[0].ids).toHaveLength(3)
  })

  it('não cria grupo sem nome', () => {
    expect(agruparPorDestinatario([item('1', 'TRANSF ENVIADA PIX', 500)])).toEqual([])
  })

  it('o rótulo é o destinatário, sem o verbo da transferência', () => {
    // Com a frase inteira, o celular mostrava "Pix enviado para D…" e
    // "Pix enviado para M…": duas linhas indistinguíveis.
    const g = agruparPorDestinatario([item('1', 'Pix enviado para GOOGLE BRASIL PAGAMENTOS LTDA.', 1850)])
    expect(g[0].rotulo).toBe('GOOGLE BRASIL PAGAMENTOS LTDA.')
  })
})

describe('coberturaDosMaiores', () => {
  it('diz quantos lançamentos os maiores grupos resolvem', () => {
    const g = agruparPorDestinatario([
      { id: '1', descricao: 'Pix enviado para Ana', valor_centavos: 100 },
      { id: '2', descricao: 'Pix enviado para Ana', valor_centavos: 100 },
      { id: '3', descricao: 'Pix enviado para Bruno', valor_centavos: 100 },
    ])
    expect(coberturaDosMaiores(g, 1)).toBe(2)
    expect(coberturaDosMaiores(g, 2)).toBe(3)
  })
})

describe('rotuloDoDestinatario', () => {
  it('preserva maiúscula e acento do nome', () => {
    expect(rotuloDoDestinatario('Pix enviado para Alessandra Alves Ribeiro Tsukada')).toBe(
      'Alessandra Alves Ribeiro Tsukada',
    )
    expect(rotuloDoDestinatario('Pix automático enviado para Ebanx')).toBe('Ebanx')
    expect(rotuloDoDestinatario('Compra com Cartão UBER TRIP')).toBe('UBER TRIP')
  })

  it('sem prefixo conhecido, devolve a descrição inteira', () => {
    expect(rotuloDoDestinatario('DEBITO DE CARTAO')).toBe('DEBITO DE CARTAO')
  })

  it('não devolve vazio quando só existe o prefixo', () => {
    expect(rotuloDoDestinatario('TRANSF ENVIADA PIX')).toBe('TRANSF ENVIADA PIX')
  })
})
