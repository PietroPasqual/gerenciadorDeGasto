import { describe, expect, it } from 'vitest'
import {
  MIN_PALAVRA,
  MIN_PREFIXO,
  PALAVRAS_CURTAS_PERMITIDAS,
  REGRAS,
  regraDe,
  sugerirCategoria,
  sugerirFormaPagamento,
} from './categorizar'

/** As categorias que o app cria para todo usuário novo. */
const CATEGORIAS = [
  { id: 'c-contas', nome: 'Contas' },
  { id: 'c-saude', nome: 'Saúde' },
  { id: 'c-lazer', nome: 'Lazer' },
  { id: 'c-transporte', nome: 'Transporte' },
  { id: 'c-vestuario', nome: 'Vestuário' },
  { id: 'c-eventuais', nome: 'Despesas eventuais' },
  { id: 'c-ifood', nome: 'iFood' },
  { id: 'c-mercado', nome: 'Mercado' },
  { id: 'c-assinaturas', nome: 'Assinaturas' },
  { id: 'c-academia', nome: 'Academia' },
  { id: 'c-presentes', nome: 'Presentes' },
  { id: 'c-desenvolvimento', nome: 'Desenvolvimento' },
  { id: 'c-cartoes', nome: 'Cartões' },
]

describe('as travas contra falso positivo', () => {
  it('nenhum prefixo é curto demais', () => {
    const curtos = REGRAS.flatMap((r) => (r.prefixos ?? []).filter((p) => p.length < MIN_PREFIXO))
    // Prefixo curto casa no começo de qualquer palavra: 'super' pegaria
    // SUPERINTENDENCIA. Este teste falha na hora se alguém adicionar um.
    expect(curtos).toEqual([])
  })

  it('nenhuma palavra é curta demais, fora da lista explícita', () => {
    const curtas = REGRAS.flatMap((r) =>
      (r.palavras ?? []).filter((p) => p.length < MIN_PALAVRA && !PALAVRAS_CURTAS_PERMITIDAS.includes(p)),
    )
    expect(curtas).toEqual([])
  })

  it('prefixo casa no COMEÇO de palavra, nunca no meio', () => {
    // 'farmac' existe como prefixo de Saúde.
    expect(regraDe('FARMACIA SAO JOAO')?.nome).toBe('saúde')
    // ...e não deve casar dentro de outra palavra.
    expect(regraDe('MINHAFARMACIA')).toBeNull()
  })

  it('os falsos positivos que eu media em outro classificador não acontecem', () => {
    // 'SUPER' como substring pegava SUPERINTENDENCIA. Aqui o prefixo é
    // 'supermerc', então não pega.
    expect(regraDe('SUPERINTENDENCIA DE SEGUROS')).toBeNull()
    // 'ETF' dentro de NETFLIX: netflix casa como assinatura, não como
    // investimento — e não existe termo de 3 letras solto.
    expect(regraDe('NETFLIX COM')?.nome).toBe('assinaturas')
    // 'dia' e 'extra' foram removidos justamente por causa destes:
    expect(regraDe('Pix enviado dia 5')).toBeNull()
    expect(regraDe('HORA EXTRA')).toBeNull()
  })
})

describe('a ordem das regras desambigua', () => {
  it('posto de saúde não é posto de combustível', () => {
    expect(regraDe('POSTO DE SAUDE CENTRAL')?.nome).toBe('saúde')
    expect(regraDe('POSTO IPIRANGA')?.nome).toBe('transporte')
  })

  it('Uber Eats é comida, Uber é corrida', () => {
    expect(regraDe('UBER EATS')?.nome).toBe('delivery')
    expect(regraDe('UBER TRIP')?.nome).toBe('transporte')
  })
})

describe('sugerirCategoria', () => {
  const sugerir = (d: string) => {
    const id = sugerirCategoria(d, CATEGORIAS)
    return id ? CATEGORIAS.find((c) => c.id === id)!.nome : null
  }

  it('classifica o que aparece de verdade num extrato', () => {
    expect(sugerir('Compra com Cartão IFOOD SP')).toBe('iFood')
    expect(sugerir('Compra com Cartão UBER TRIP')).toBe('Transporte')
    expect(sugerir('SUPERMERCADO SAO JOAO')).toBe('Mercado')
    expect(sugerir('NETFLIX COM')).toBe('Assinaturas')
    expect(sugerir('DROGARIA PACHECO')).toBe('Saúde')
    expect(sugerir('COPEL DISTRIBUICAO')).toBe('Contas')
    expect(sugerir('SMART FIT')).toBe('Academia')
    expect(sugerir('Pix enviado para POSTO SHELL')).toBe('Transporte')
    expect(sugerir('CINEMARK')).toBe('Lazer')
    expect(sugerir('UDEMY')).toBe('Desenvolvimento')
  })

  it('não classifica Pix para pessoa — é ambíguo de verdade', () => {
    // Pode ser aluguel, divisão de conta, empréstimo. O extrato não diz, e
    // deixar sem categoria é visível na tela; errar não é.
    expect(sugerir('Pix enviado para Alessandra Alves Ribeiro')).toBeNull()
    expect(sugerir('Pix recebido de EDSON RIBEIRO DA SILVA')).toBeNull()
    expect(sugerir('TRANSF ENVIADA PIX')).toBeNull()
  })

  it('nunca sugere categoria que o usuário não tem', () => {
    // Quem apagou "iFood" não recebe iFood de volta pela importação. Aqui a
    // regra de delivery aceita iFood, Alimentação ou Lazer — sem as três, nada.
    const semDelivery = CATEGORIAS.filter((c) => !['iFood', 'Lazer'].includes(c.nome))
    expect(sugerirCategoria('IFOOD SP', semDelivery)).toBeNull()
    expect(sugerirCategoria('IFOOD SP', [])).toBeNull()
  })

  it('cai na segunda opção da regra quando a primeira não existe', () => {
    const semIfood = CATEGORIAS.filter((c) => c.nome !== 'iFood')
    // A regra de delivery lista iFood, Alimentação e Lazer nessa ordem.
    expect(sugerirCategoria('IFOOD SP', semIfood)).toBe('c-lazer')
  })

  it('ignora acento e caixa no nome da categoria do usuário', () => {
    expect(sugerirCategoria('DROGASIL', [{ id: 'x', nome: 'SAUDE' }])).toBe('x')
    expect(sugerirCategoria('DROGASIL', [{ id: 'x', nome: 'saúde' }])).toBe('x')
  })

  it('descrição vazia não vira categoria', () => {
    expect(sugerirCategoria('', CATEGORIAS)).toBeNull()
    expect(sugerirCategoria('   ', CATEGORIAS)).toBeNull()
    expect(sugerirCategoria('123456', CATEGORIAS)).toBeNull()
  })
})

describe('sugerirFormaPagamento', () => {
  const FORMAS = [
    { id: 'f-dinheiro', nome: 'Dinheiro' },
    { id: 'f-pix', nome: 'Pix' },
    { id: 'f-debito', nome: 'Débito' },
    { id: 'f-boleto', nome: 'Boleto' },
    { id: 'f-credito', nome: 'Crédito' },
  ]
  const sugerir = (d: string, formas = FORMAS) => sugerirFormaPagamento(d, formas)

  it('lê a forma no verbo da operação, que o banco escreve', () => {
    expect(sugerir('Pix enviado para Verli Friedrich')).toBe('f-pix')
    expect(sugerir('Pix automático enviado para Ebanx')).toBe('f-pix')
    expect(sugerir('TRANSF ENVIADA PIX')).toBe('f-pix')
    expect(sugerir('DEBITO DE CARTAO')).toBe('f-debito')
    expect(sugerir('Pagamento de boleto')).toBe('f-boleto')
    expect(sugerir('SAQUE CAIXA ELETRONICO')).toBe('f-dinheiro')
  })

  it('"Compra com Cartão" sozinho não decide entre débito e crédito', () => {
    // Chutar um dos dois erraria metade das vezes, em silêncio.
    expect(sugerir('Compra com Cartão PADARIA')).toBeNull()
  })

  it('não sugere forma que o usuário não tem cadastrada', () => {
    expect(sugerir('Pix enviado para X', [{ id: 'f-dinheiro', nome: 'Dinheiro' }])).toBeNull()
    expect(sugerir('Pix enviado para X', [])).toBeNull()
  })

  it('para na regra que casou, sem tentar a seguinte por acaso', () => {
    // "Pix" casou mas não existe Pix cadastrado: o resultado é null, e não
    // "Transferência" só porque a palavra "enviado" lembra transferência.
    const semPix = [{ id: 'f-transf', nome: 'Transferência' }]
    expect(sugerir('Pix enviado para X', semPix)).toBeNull()
  })

  it('descrição vazia não vira forma', () => {
    expect(sugerir('')).toBeNull()
    expect(sugerir('   ')).toBeNull()
  })
})
