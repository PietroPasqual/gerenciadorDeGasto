import { describe, expect, it } from 'vitest'
import { CAPA_PADRAO, capaValida, mover, ordemParaSalvar, widgetsVisiveis } from './painel'

const CONHECIDOS = ['saldo', 'categorias', 'observacoes', 'atalhos'] as const

describe('widgetsVisiveis', () => {
  it('sem nada salvo, devolve os widgets do app na ordem que o app declara', () => {
    // É o caso de toda conta que existia antes da 0023: os defaults são
    // listas vazias, e ninguém pode abrir o app com o painel remontado.
    expect(widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: [], ocultos: [] })).toEqual([
      'saldo',
      'categorias',
      'observacoes',
      'atalhos',
    ])
  })

  it('respeita a ordem que a pessoa salvou', () => {
    expect(
      widgetsVisiveis({
        conhecidos: CONHECIDOS,
        ordem: ['atalhos', 'saldo', 'observacoes', 'categorias'],
        ocultos: [],
      }),
    ).toEqual(['atalhos', 'saldo', 'observacoes', 'categorias'])
  })

  it('um widget NOVO aparece no fim, e não some', () => {
    // A pessoa mexeu no painel quando só existiam três widgets. 'atalhos'
    // entrou depois. Se "não está na ordem" significasse "não aparece", todo
    // widget lançado a partir de agora nasceria invisível para quem já
    // personalizou — que é o defeito que a 0023 evita com duas listas.
    expect(
      widgetsVisiveis({
        conhecidos: CONHECIDOS,
        ordem: ['observacoes', 'saldo', 'categorias'],
        ocultos: [],
      }),
    ).toEqual(['observacoes', 'saldo', 'categorias', 'atalhos'])
  })

  it('o que a pessoa escondeu não aparece', () => {
    expect(
      widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: [], ocultos: ['categorias', 'atalhos'] }),
    ).toEqual(['saldo', 'observacoes'])
  })

  it('esconder é mais forte que ser novo', () => {
    // Widget que nunca entrou na ordem MAS está na lista de escondidos
    // continua escondido: é o caso de quem escondeu, o app renomeou o
    // widget de lugar na lista declarada, e ele voltou a ser "novo".
    expect(widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: ['saldo'], ocultos: ['atalhos'] })).toEqual([
      'saldo',
      'categorias',
      'observacoes',
    ])
  })

  it('ignora id que o app não conhece mais', () => {
    // Widget aposentado, ou gravado por uma versão mais nova em outro
    // aparelho. Renderizar por id desconhecido é tela branca.
    expect(
      widgetsVisiveis({
        conhecidos: CONHECIDOS,
        ordem: ['saldo', 'widget-que-nao-existe-mais', 'categorias'],
        ocultos: [],
      }),
    ).toEqual(['saldo', 'categorias', 'observacoes', 'atalhos'])
  })

  it('id repetido na ordem salva não duplica o widget na tela', () => {
    expect(
      widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: ['saldo', 'saldo', 'categorias'], ocultos: [] }),
    ).toEqual(['saldo', 'categorias', 'observacoes', 'atalhos'])
  })

  it('esconder tudo devolve lista vazia, e não os padrões de volta', () => {
    // Painel vazio é uma escolha legítima. Se o "vazio" fosse tratado como
    // "nunca mexi", esconder o último widget traria os quatro de volta.
    expect(widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: [], ocultos: [...CONHECIDOS] })).toEqual([])
  })
})

describe('mover', () => {
  const lista = ['saldo', 'categorias', 'observacoes']

  it('sobe uma casa', () => {
    expect(mover(lista, 'observacoes', -1)).toEqual(['saldo', 'observacoes', 'categorias'])
  })

  it('desce uma casa', () => {
    expect(mover(lista, 'saldo', 1)).toEqual(['categorias', 'saldo', 'observacoes'])
  })

  it('no topo, subir devolve a MESMA lista', () => {
    // Identidade e não igualdade: o componente compara por referência para
    // não gravar no perfil um clique que não mudou nada.
    expect(mover(lista, 'saldo', -1)).toBe(lista)
  })

  it('no fim, descer devolve a MESMA lista', () => {
    expect(mover(lista, 'observacoes', 1)).toBe(lista)
  })

  it('id que não está na lista devolve a MESMA lista', () => {
    expect(mover(lista, 'atalhos', -1)).toBe(lista)
  })
})

describe('ordemParaSalvar', () => {
  it('sem escondidos, é a própria lista visível', () => {
    expect(
      ordemParaSalvar({ visiveis: ['atalhos', 'saldo'], ordemAntiga: ['saldo', 'atalhos'], ocultos: [] }),
    ).toEqual(['atalhos', 'saldo'])
  })

  it('o escondido volta para o lugar de onde saiu, e não para o fim', () => {
    // É o que faz "esconder e mostrar de novo" se desfazer. Sem a âncora,
    // 'categorias' — que era o segundo card do painel — reapareceria depois
    // de 'atalhos' quando a pessoa o trouxesse de volta.
    const salvo = ordemParaSalvar({
      visiveis: ['saldo', 'observacoes', 'atalhos'],
      ordemAntiga: ['saldo', 'categorias', 'observacoes', 'atalhos'],
      ocultos: ['categorias'],
    })
    expect(salvo).toEqual(['saldo', 'categorias', 'observacoes', 'atalhos'])

    // E de volta na tela, ele reaparece na segunda posição.
    expect(widgetsVisiveis({ conhecidos: CONHECIDOS, ordem: salvo, ocultos: [] })).toEqual([
      'saldo',
      'categorias',
      'observacoes',
      'atalhos',
    ])
  })

  it('reordenar leva o escondido junto com a âncora dele', () => {
    const salvo = ordemParaSalvar({
      visiveis: ['atalhos', 'saldo', 'observacoes'],
      ordemAntiga: ['saldo', 'categorias', 'observacoes', 'atalhos'],
      ocultos: ['categorias'],
    })
    // 'categorias' vinha depois de 'saldo'; 'saldo' foi para o meio e levou
    // o escondido consigo.
    expect(salvo).toEqual(['atalhos', 'saldo', 'categorias', 'observacoes'])
  })

  it('escondido que era o primeiro de todos continua na frente', () => {
    expect(
      ordemParaSalvar({
        visiveis: ['categorias', 'observacoes'],
        ordemAntiga: ['saldo', 'categorias', 'observacoes'],
        ocultos: ['saldo'],
      }),
    ).toEqual(['saldo', 'categorias', 'observacoes'])
  })

  it('nenhum escondido evapora da ordem, nem quando a âncora dele também sumiu', () => {
    // 'categorias' vinha depois de 'saldo', e 'saldo' também foi escondido.
    // A âncora não está entre os visíveis; a rede de segurança do fim é o
    // que garante que os dois continuem gravados em vez de sumirem para
    // sempre da personalização.
    const salvo = ordemParaSalvar({
      visiveis: ['observacoes', 'atalhos'],
      ordemAntiga: ['saldo', 'categorias', 'observacoes', 'atalhos'],
      ocultos: ['saldo', 'categorias'],
    })
    expect([...salvo].sort()).toEqual(['atalhos', 'categorias', 'observacoes', 'saldo'])
    expect(salvo).toHaveLength(4)
  })
})

describe('capaValida', () => {
  it('aceita as capas que o app desenha', () => {
    expect(capaValida('mata')).toBe('mata')
    expect(capaValida('nenhuma')).toBe('nenhuma')
  })

  it('nome desconhecido, nulo ou vazio cai no padrão', () => {
    // Capa aposentada, ou gravada por uma versão mais nova. Nada disso pode
    // deixar o painel com `background-image: var(--capa-sei-la)`.
    expect(capaValida('capa-que-foi-aposentada')).toBe(CAPA_PADRAO)
    expect(capaValida(null)).toBe(CAPA_PADRAO)
    expect(capaValida(undefined)).toBe(CAPA_PADRAO)
    expect(capaValida('')).toBe(CAPA_PADRAO)
  })
})
