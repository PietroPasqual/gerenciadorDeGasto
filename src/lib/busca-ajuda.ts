import { normalizar } from './importar-csv'

/**
 * Busca dentro da ajuda.
 *
 * A ajuda cresceu para uma dúzia de assuntos, e rolar até achar "por que meu
 * gasto de agosto não descontou do saldo de agosto" não é achar — é ter sorte.
 * Quem chega aqui já está com uma dúvida formada, e a dúvida vem em palavras.
 *
 * Separado da página de propósito: o que decide se um tópico responde a uma
 * pergunta é regra, e regra se testa sem montar tela.
 */

export interface TopicoBuscavel {
  id: string
  titulo: string
  resumo: string
  corpo: string[]
  /**
   * O que a pessoa digitaria e que não está escrito no texto.
   *
   * Ninguém procura por "competência": procura por "por que não desconta",
   * "cartão", "atrasado". Sem isto a busca só acha quem já sabe o nome do que
   * procura — que é justamente quem não precisava da ajuda.
   */
  sinonimos?: string[]
}

/** Onde o termo bateu. Quanto mais alto, mais o tópico é sobre aquilo. */
const PESO = { titulo: 3, resumo: 2, sinonimo: 2, corpo: 1, nenhum: 0 } as const

function pesoDoTermo(topico: TopicoBuscavel, termo: string): number {
  if (normalizar(topico.titulo).includes(termo)) return PESO.titulo
  if (normalizar(topico.resumo).includes(termo)) return PESO.resumo
  if ((topico.sinonimos ?? []).some((s) => normalizar(s).includes(termo))) return PESO.sinonimo
  if (topico.corpo.some((linha) => normalizar(linha).includes(termo))) return PESO.corpo
  return PESO.nenhum
}

/**
 * Os tópicos que respondem à busca, do mais provável para o menos.
 *
 * Os termos se somam (E, não OU): quem digita "fatura cartão" quer o assunto
 * que fala das duas coisas, não a união de duas listas. Busca vazia devolve
 * tudo na ordem original — a ordem do manual é editorial, e embaralhar sem
 * motivo seria perdê-la.
 *
 * O `sort` é estável no JS moderno, então empate mantém a ordem do manual.
 */
export function filtrarTopicos<T extends TopicoBuscavel>(topicos: T[], busca: string): T[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return topicos

  return topicos
    .map((topico) => ({
      topico,
      peso: termos.reduce((soma, termo) => {
        const p = pesoDoTermo(topico, termo)
        return p === PESO.nenhum ? Number.NEGATIVE_INFINITY : soma + p
      }, 0),
    }))
    .filter((r) => r.peso > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.peso - a.peso)
    .map((r) => r.topico)
}

/**
 * Normaliza guardando, para cada caractere do resultado, de onde ele veio.
 *
 * É o que permite realçar "Competência" quando alguém digitou "competencia":
 * a busca acontece no texto sem acento, e o realce precisa voltar para o texto
 * original — no lugar certo.
 *
 * Fazer isso comparando comprimentos não serve. `normalizar` decompõe e tira
 * as marcas de acento, e nada garante que o resultado tenha o mesmo tamanho da
 * entrada (uma ligadura vira duas letras; um texto já decomposto encolhe).
 * Guardar a origem de cada caractere é a única forma que não depende de sorte.
 */
function normalizarComMapa(texto: string): { alvo: string; origem: number[] } {
  let alvo = ''
  const origem: number[] = []
  const letras = [...texto]
  let posicao = 0
  for (const letra of letras) {
    // A limpeza é feita à mão, e não com `normalizar`, porque ela apara as
    // pontas: aplicada caractere a caractere, todo espaço viraria string
    // vazia e "a fatura" viraria "afatura" — o mapa apontaria para o lugar
    // errado a partir da primeira palavra.
    const limpa = letra
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    for (let k = 0; k < limpa.length; k++) origem.push(posicao)
    alvo += limpa
    posicao += letra.length
  }
  // Sentinela: o fim de um acerto na última letra precisa de um índice além dela.
  origem.push(texto.length)
  return { alvo, origem }
}

export interface Pedaco {
  texto: string
  realce: boolean
}

/**
 * Quebra a linha nos trechos que casaram com a busca.
 *
 * O realce é o que responde "por que este resultado apareceu" sem repetir a
 * frase inteira num bloco à parte — repetir seria mostrar a mesma linha duas
 * vezes, já que os assuntos aqui ficam sempre abertos.
 *
 * Acertos que se encostam ou se sobrepõem viram um só: "compra" e "compras"
 * marcados separadamente pintariam a mesma palavra duas vezes e sobrariam
 * elementos vazios no meio.
 */
export function realcarTrechos(texto: string, busca: string): Pedaco[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return [{ texto, realce: false }]

  const { alvo, origem } = normalizarComMapa(texto)
  const faixas: Array<[number, number]> = []
  for (const termo of termos) {
    let de = alvo.indexOf(termo)
    while (de !== -1) {
      faixas.push([origem[de], origem[de + termo.length]])
      de = alvo.indexOf(termo, de + termo.length)
    }
  }
  if (faixas.length === 0) return [{ texto, realce: false }]

  faixas.sort((a, b) => a[0] - b[0])
  const unidas: Array<[number, number]> = []
  for (const faixa of faixas) {
    const ultima = unidas[unidas.length - 1]
    if (ultima && faixa[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], faixa[1])
    else unidas.push([...faixa])
  }

  const pedacos: Pedaco[] = []
  let cursor = 0
  for (const [de, ate] of unidas) {
    if (de > cursor) pedacos.push({ texto: texto.slice(cursor, de), realce: false })
    pedacos.push({ texto: texto.slice(de, ate), realce: true })
    cursor = ate
  }
  if (cursor < texto.length) pedacos.push({ texto: texto.slice(cursor), realce: false })
  return pedacos
}
