import { describe, expect, it } from 'vitest'
import { filtrarTopicos, realcarTrechos, type TopicoBuscavel } from './busca-ajuda'

const TOPICOS: TopicoBuscavel[] = [
  {
    id: 'fatura',
    titulo: 'Como a fatura do cartão é calculada',
    resumo: 'O dia do fechamento decide em qual fatura a compra entra.',
    corpo: ['Compra feita até o dia do fechamento entra na fatura do mês seguinte.'],
    sinonimos: ['crédito', 'vencimento'],
  },
  {
    id: 'competencia',
    titulo: 'Competência e caixa',
    resumo: 'O mês em que você gastou nem sempre é o mês em que o dinheiro sai.',
    corpo: ['Por que o gasto de agosto não descontou do saldo de agosto.'],
    sinonimos: ['não desconta'],
  },
  {
    id: 'offline',
    titulo: 'O app sem internet',
    resumo: 'Dá para consultar o que já foi aberto.',
    corpo: ['A leitura funciona; a escrita ainda precisa de conexão.'],
  },
]

const ids = (lista: TopicoBuscavel[]) => lista.map((t) => t.id)

describe('filtrarTopicos', () => {
  it('busca vazia devolve tudo, na ordem do manual', () => {
    expect(ids(filtrarTopicos(TOPICOS, ''))).toEqual(['fatura', 'competencia', 'offline'])
    expect(ids(filtrarTopicos(TOPICOS, '   '))).toEqual(['fatura', 'competencia', 'offline'])
  })

  it('ignora acento e caixa', () => {
    expect(ids(filtrarTopicos(TOPICOS, 'COMPETENCIA'))).toEqual(['competencia'])
    expect(ids(filtrarTopicos(TOPICOS, 'crédito'))).toEqual(['fatura'])
    expect(ids(filtrarTopicos(TOPICOS, 'credito'))).toEqual(['fatura'])
  })

  it('acerto no título vem antes de acerto no corpo', () => {
    // "fatura" está no título do primeiro e no corpo do segundo? Não — está no
    // título do primeiro e em lugar nenhum do segundo. Uso "agosto", que só
    // existe no corpo, para provar que corpo também acha.
    expect(ids(filtrarTopicos(TOPICOS, 'agosto'))).toEqual(['competencia'])
  })

  it('quem tem o termo no título ganha de quem tem só no corpo', () => {
    const lista: TopicoBuscavel[] = [
      { id: 'so-no-corpo', titulo: 'Outro assunto', resumo: 'x', corpo: ['fala de fatura de passagem'] },
      { id: 'no-titulo', titulo: 'Fatura do cartão', resumo: 'y', corpo: ['z'] },
    ]
    expect(ids(filtrarTopicos(lista, 'fatura'))).toEqual(['no-titulo', 'so-no-corpo'])
  })

  it('os termos se somam: quem não tem TODOS fica de fora', () => {
    expect(ids(filtrarTopicos(TOPICOS, 'fatura cartao'))).toEqual(['fatura'])
    // "offline" não fala de fatura nenhuma.
    expect(ids(filtrarTopicos(TOPICOS, 'fatura internet'))).toEqual([])
  })

  it('acha pelo sinônimo, que é como a pessoa pergunta de verdade', () => {
    expect(ids(filtrarTopicos(TOPICOS, 'não desconta'))).toEqual(['competencia'])
  })

  it('busca sem resposta devolve lista vazia, não a lista inteira', () => {
    expect(filtrarTopicos(TOPICOS, 'criptomoeda')).toEqual([])
  })
})

describe('realcarTrechos', () => {
  const marcado = (texto: string, busca: string) =>
    realcarTrechos(texto, busca)
      .filter((p) => p.realce)
      .map((p) => p.texto)

  const remontar = (texto: string, busca: string) =>
    realcarTrechos(texto, busca)
      .map((p) => p.texto)
      .join('')

  it('busca vazia devolve o texto inteiro, sem realce', () => {
    expect(realcarTrechos('Fatura do cartão', '')).toEqual([{ texto: 'Fatura do cartão', realce: false }])
  })

  it('realça no texto ORIGINAL, com acento e caixa preservados', () => {
    expect(marcado('A competência é o mês da compra', 'competencia')).toEqual(['competência'])
    expect(marcado('Fatura do cartão', 'FATURA')).toEqual(['Fatura'])
  })

  it('o texto remontado é sempre idêntico ao original', () => {
    // A prova que importa: realçar não pode comer nem duplicar caractere. Um
    // deslize de um índice aqui apagaria letras da ajuda em silêncio.
    for (const busca of ['competencia', 'mes', 'a', 'compra competencia', 'nada']) {
      expect(remontar('A competência é o mês da compra', busca)).toBe('A competência é o mês da compra')
    }
  })

  it('acha todas as ocorrências, não só a primeira', () => {
    expect(marcado('mês a mês, todo mês', 'mes')).toEqual(['mês', 'mês', 'mês'])
  })

  it('junta acertos que se sobrepõem em um só', () => {
    // "compra" e "compras" pintariam a mesma palavra duas vezes.
    const pedacos = realcarTrechos('as compras do mês', 'compra compras')
    expect(pedacos.filter((p) => p.realce).map((p) => p.texto)).toEqual(['compras'])
    expect(pedacos.every((p) => p.texto.length > 0)).toBe(true)
  })

  it('termo ausente não realça nada', () => {
    expect(marcado('Fatura do cartão', 'criptomoeda')).toEqual([])
  })

  it('funciona com o texto já decomposto, em que o tamanho muda', () => {
    // "cafe" + acento combinante: 5 caracteres que viram 4 ao normalizar.
    const decomposto = 'cafe\u0301 da manhã'
    expect(remontar(decomposto, 'cafe')).toBe(decomposto)
    expect(marcado(decomposto, 'cafe')).toEqual(['cafe\u0301'])
  })
})
