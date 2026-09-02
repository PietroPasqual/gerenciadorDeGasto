import { ehFuturo, nomeCurtoDoMes, periodoAtual } from './dates'

/**
 * As contas do comparativo anual.
 *
 * O que este arquivo protege é uma coisa só: comparar coisas comparáveis.
 * Somar doze meses de um ano contra três do outro dá um número, e o número
 * parece certo — só está errado. Toda função aqui devolve, junto com o
 * resultado, QUAIS meses entraram nele; a tela é obrigada a dizer isso, e é
 * assim que "gastei 40% a mais" para de ser uma frase solta.
 */

export interface MesDoAno {
  mes: number
  entradas: number
  saidas: number
  diferenca: number
}

/** Mês que já aconteceu E teve movimento — os outros não entram em média nenhuma. */
function temMovimento(m: MesDoAno): boolean {
  return m.entradas !== 0 || m.saidas !== 0
}

export interface RealizadoEPrevisto {
  realizados: MesDoAno[]
  previstos: MesDoAno[]
  /** Soma só dos meses que já aconteceram. */
  totalRealizado: { entradas: number; saidas: number }
  /** Soma só do que ainda vai acontecer — hoje, os gastos fixos que se repetem. */
  totalPrevisto: { entradas: number; saidas: number }
}

/**
 * Separa o que já aconteceu do que ainda é estimativa.
 *
 * O total do ano misturava os dois num número só: em março, "Total de gastos"
 * já trazia os fixos de dezembro embutidos, e nada na tela dizia isso. Um
 * número que soma fato com previsão precisa, no mínimo, se apresentar.
 */
export function separarRealizadoPrevisto(
  meses: MesDoAno[],
  ano: number,
  hoje = new Date(),
): RealizadoEPrevisto {
  const referencia = periodoAtual(hoje)
  const realizados: MesDoAno[] = []
  const previstos: MesDoAno[] = []
  for (const m of meses) {
    if (ehFuturo({ ano, mes: m.mes }, referencia)) previstos.push(m)
    else realizados.push(m)
  }
  const somar = (lista: MesDoAno[]) => ({
    entradas: lista.reduce((s, m) => s + m.entradas, 0),
    saidas: lista.reduce((s, m) => s + m.saidas, 0),
  })
  return {
    realizados,
    previstos,
    totalRealizado: somar(realizados),
    totalPrevisto: somar(previstos),
  }
}

export type ImpedimentoComparacao = 'sem-ano-anterior' | 'sem-meses-comuns'

export interface Comparacao {
  /** Os meses (1–12) que entraram nos DOIS lados. Vazio quando há impedimento. */
  mesesComuns: number[]
  entradasAtual: number
  entradasAnterior: number
  saidasAtual: number
  saidasAnterior: number
  /** Variação percentual, ou `null` quando o ano anterior era zero e não há de quê variar. */
  variacaoEntradas: number | null
  variacaoSaidas: number | null
  impedimento?: ImpedimentoComparacao
}

function variacao(atual: number, anterior: number): number | null {
  // Dividir por zero não dá "infinito por cento": dá pergunta errada. Sair de
  // R$ 0 para R$ 300 não é um aumento de X%, é um começo — e a tela mostra a
  // diferença em reais nesse caso.
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / anterior) * 1000) / 10
}

/**
 * Compara o ano aberto com o anterior, sobre a MESMA base.
 *
 * A base é a interseção: só entram os meses que já aconteceram no ano aberto e
 * que tiveram movimento nos dois anos. Três motivos, todos vividos:
 *
 * - comparar março contra um ano fechado compara três meses com doze;
 * - comparar contra um mês em que o app nem era usado divide por zero e
 *   devolve um aumento infinito;
 * - contar o mês de dezembro que ainda não chegou compara fato com previsão.
 *
 * Quando não sobra nenhum mês comum, a função DIZ isso em vez de devolver
 * zeros — zero e "não dá para comparar" são coisas diferentes, e a tela precisa
 * saber qual das duas está mostrando.
 */
export function compararAnos(
  atual: MesDoAno[],
  anterior: MesDoAno[],
  ano: number,
  hoje = new Date(),
): Comparacao {
  const vazio: Comparacao = {
    mesesComuns: [],
    entradasAtual: 0,
    entradasAnterior: 0,
    saidasAtual: 0,
    saidasAnterior: 0,
    variacaoEntradas: null,
    variacaoSaidas: null,
  }

  if (anterior.length === 0) return { ...vazio, impedimento: 'sem-ano-anterior' }

  const { realizados } = separarRealizadoPrevisto(atual, ano, hoje)
  const porMesAnterior = new Map(anterior.map((m) => [m.mes, m]))

  const pares = realizados
    .filter(temMovimento)
    .map((m) => ({ atual: m, anterior: porMesAnterior.get(m.mes) }))
    .filter((p): p is { atual: MesDoAno; anterior: MesDoAno } => !!p.anterior && temMovimento(p.anterior))

  if (pares.length === 0) return { ...vazio, impedimento: 'sem-meses-comuns' }

  const soma = (lista: typeof pares, lado: 'atual' | 'anterior', campo: 'entradas' | 'saidas') =>
    lista.reduce((s, p) => s + p[lado][campo], 0)

  const entradasAtual = soma(pares, 'atual', 'entradas')
  const entradasAnterior = soma(pares, 'anterior', 'entradas')
  const saidasAtual = soma(pares, 'atual', 'saidas')
  const saidasAnterior = soma(pares, 'anterior', 'saidas')

  return {
    mesesComuns: pares.map((p) => p.atual.mes),
    entradasAtual,
    entradasAnterior,
    saidasAtual,
    saidasAnterior,
    variacaoEntradas: variacao(entradasAtual, entradasAnterior),
    variacaoSaidas: variacao(saidasAtual, saidasAnterior),
  }
}

/**
 * "Jan–Mar" ou "Jan, Mar e Mai" — a base da comparação, escrita.
 *
 * Sem isto a tela mostraria "12% a mais" sem dizer a mais do quê, e um número
 * de comparação sem base é um palpite com aparência de fato. Meses seguidos
 * viram intervalo; buracos no meio ficam explícitos, porque um buraco muda o
 * que o número significa.
 */
export function textoDaBase(meses: number[]): string {
  if (meses.length === 0) return ''
  const ordenados = [...meses].sort((a, b) => a - b)
  const seguidos = ordenados.every((m, i) => i === 0 || m === ordenados[i - 1] + 1)

  if (ordenados.length === 1) return nomeCurtoDoMes(ordenados[0])
  if (seguidos) return `${nomeCurtoDoMes(ordenados[0])}–${nomeCurtoDoMes(ordenados[ordenados.length - 1])}`

  const nomes = ordenados.map(nomeCurtoDoMes)
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** Quantos meses de cada lado a tendência olha. */
export const JANELA_TENDENCIA = 3

export interface Tendencia {
  direcao: 'subindo' | 'caindo' | 'estavel'
  /** Percentual de variação entre as duas janelas. */
  variacao: number
  /** A média mensal da janela recente, em centavos. */
  mediaRecente: number
  mediaAnterior: number
  mesesRecentes: number[]
  mesesAnteriores: number[]
}

/**
 * Para onde os gastos estão indo.
 *
 * Média dos três últimos meses com movimento contra a dos três anteriores. Não
 * é regressão nem projeção: é a comparação que a pessoa faria à mão, e por
 * isso ela dá para conferir olhando a tabela ao lado.
 *
 * Devolve `null` sem seis meses de movimento. Com quatro, "subindo 30%" seria
 * uma frase construída sobre um mês atípico — e a tela prefere não dizer nada
 * a dizer algo que ela mesma não sustenta.
 *
 * "Estável" existe porque nem toda diferença é notícia: abaixo de 5% a
 * variação é ruído do mês, não tendência.
 */
export function tendenciaDeGastos(meses: MesDoAno[], ano: number, hoje = new Date()): Tendencia | null {
  const { realizados } = separarRealizadoPrevisto(meses, ano, hoje)
  const comMovimento = realizados.filter(temMovimento).sort((a, b) => a.mes - b.mes)
  if (comMovimento.length < JANELA_TENDENCIA * 2) return null

  const recentes = comMovimento.slice(-JANELA_TENDENCIA)
  const anteriores = comMovimento.slice(-JANELA_TENDENCIA * 2, -JANELA_TENDENCIA)

  const media = (lista: MesDoAno[]) => Math.round(lista.reduce((s, m) => s + m.saidas, 0) / lista.length)
  const mediaRecente = media(recentes)
  const mediaAnterior = media(anteriores)

  const percentual = variacao(mediaRecente, mediaAnterior)
  // Média anterior zerada com seis meses de movimento significa seis meses só
  // de entrada. Não há tendência de gasto para contar.
  if (percentual === null) return null

  return {
    direcao: Math.abs(percentual) < 5 ? 'estavel' : percentual > 0 ? 'subindo' : 'caindo',
    variacao: percentual,
    mediaRecente,
    mediaAnterior,
    mesesRecentes: recentes.map((m) => m.mes),
    mesesAnteriores: anteriores.map((m) => m.mes),
  }
}
