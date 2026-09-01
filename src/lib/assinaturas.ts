import { chaveDoDestinatario, rotuloDoDestinatario } from './agrupar-descricoes'
import { periodoAtual } from './dates'

/**
 * Encontra a assinatura escondida no meio dos lançamentos.
 *
 * O `agrupar-descricoes.ts` já junta as linhas do mesmo destinatário. Falta
 * notar que um grupo aparece TODO MÊS com valor parecido — o que descreve uma
 * assinatura e quase nada mais. Metade do valor está em achar a que foi
 * esquecida: algo que sai da conta há oito meses sem nunca ter sido
 * classificado é dinheiro saindo sem ninguém olhar.
 *
 * A REGRA DE OURO AQUI É ERRAR PARA MENOS.
 *
 * Sugestão errada num app de dinheiro custa mais que sugestão ausente: quem
 * recebe "isto parece uma assinatura" sobre o mercado da esquina aprende a
 * ignorar o aviso, e aí a assinatura de verdade passa junto. Por isso cada
 * trava abaixo prefere calar.
 *
 * AS SEIS TRAVAS
 *
 * 1. Só GASTO. Entrada recorrente é salário, e já tem lugar próprio (0012).
 * 2. Nunca PARCELAMENTO. Três meses de valor idêntico é a assinatura da vida
 *    real, mas é também exatamente a cara de um 3x sem juros — o pior falso
 *    positivo possível, porque o gasto fixo criado continuaria cobrando depois
 *    da última parcela. Some o `parcelamento_id` da 0010 e, para o que foi
 *    importado sem essa marca, a pegada "3/10" ou "parcela 3" na descrição.
 * 3. UMA VEZ POR MÊS. Assinatura cobra uma vez. Duas idas ao mercado no mesmo
 *    mês já dizem que aquilo não é assinatura, por mais regular que pareça.
 * 4. MESES SEGUIDOS: três, no mínimo (ver MESES_MINIMOS). Dois meses é
 *    coincidência barata.
 * 5. VALOR PARECIDO: a diferença entre o maior e o menor da sequência cabe em
 *    10% da mediana, com piso de R$ 2,00 (ver TOLERANCIA_*). O piso existe
 *    para a assinatura barata: em R$ 9,90, 10% são 99 centavos, e um centavo
 *    de arredondamento de câmbio não pode derrubar a detecção.
 * 6. AINDA VIVA: a última cobrança é deste mês ou do mês passado. Assinatura
 *    cancelada em janeiro não vira gasto fixo em agosto.
 *
 * O que essas travas deixam passar de propósito: reajuste no meio da janela
 * (Netflix de 39,90 para 44,90 estoura a tolerância e a sequência se parte).
 * A detecção volta sozinha três meses depois do reajuste. Perder a sugestão
 * por um trimestre é o preço certo por não sugerir o supermercado.
 */

export interface GastoDaJanela {
  id: string
  /** ISO, `YYYY-MM-DD`. */
  data: string
  descricao: string
  valor_centavos: number
  tipo: string
  category_id: string | null
  payment_method_id: string | null
  parcelamento_id: string | null
}

/** O que já é gasto fixo não precisa virar gasto fixo de novo. */
export interface FixoExistente {
  nome: string
}

export interface Assinatura {
  chave: string
  /** O destinatário como aparece no extrato — é o nome que o gasto fixo herda. */
  rotulo: string
  /** A descrição inteira de uma das linhas, para inferir a forma de pagamento. */
  exemploCru: string
  ids: string[]
  /** Quantos meses seguidos, contados até a última cobrança. */
  mesesSeguidos: number
  /** O valor da cobrança mais recente — é ele que vai chegar no mês que vem. */
  valorSugerido: number
  /** Dia do mês típico da cobrança (mediana). */
  diaSugerido: number
  categoriaSugerida: string | null
  formaSugerida: string | null
  /** Vigência começa no primeiro mês da sequência, não hoje. */
  inicioAno: number
  inicioMes: number
  /** Nenhuma das cobranças tem categoria: é a assinatura esquecida. */
  nuncaClassificado: boolean
  /** O valor oscilou dentro da tolerância — a tela avisa em vez de esconder. */
  menorValor: number
  maiorValor: number
}

export const MESES_MINIMOS = 3
export const TOLERANCIA_RELATIVA = 0.1
export const TOLERANCIA_MINIMA_CENTAVOS = 200

/**
 * A pegada de parcela que sobrevive à importação: "3/10", "3 de 10",
 * "parcela 3". `chaveDoDestinatario` apaga os números, então sem este teste
 * "NETFLIX 3/10" e "NETFLIX 4/10" cairiam no mesmo grupo parecendo assinatura.
 *
 * Roda no texto CRU, só em minúsculas: `normalizar` troca a barra por espaço,
 * e "3/10" viraria "3 10" — a pegada some justamente no passo que deveria
 * preservá-la.
 *
 * "05/08" numa descrição é data, não parcela, e cai aqui junto. É perda
 * consciente: não dá para distinguir os dois casos sem adivinhar, e a regra da
 * casa é errar para o lado de não sugerir.
 */
const PEGADA_DE_PARCELA = /(\d{1,2}\s*\/\s*\d{1,2})|(\bparcela\b)|(\b\d{1,2}\s+de\s+\d{1,2}\b)/

function ehParcelaDisfarcada(descricao: string): boolean {
  const cru = descricao
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return PEGADA_DE_PARCELA.test(cru)
}

/** Quantos meses desde a "epoch" de meses — para comparar sequência. */
function indiceDoMes(iso: string): number {
  const ano = Number(iso.slice(0, 4))
  const mes = Number(iso.slice(5, 7))
  return ano * 12 + mes
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1 ? ordenados[meio] : ordenados[meio - 1]
}

/** A folga aceita entre a maior e a menor cobrança da sequência. */
export function toleranciaDe(valorTipico: number): number {
  return Math.max(TOLERANCIA_MINIMA_CENTAVOS, Math.round(Math.abs(valorTipico) * TOLERANCIA_RELATIVA))
}

/**
 * As assinaturas que os lançamentos revelam, da mais longa para a mais curta.
 *
 * `hoje` é injetável porque "ainda viva" depende da data, e um teste que
 * dependa do relógio de quem roda apodrece na virada do mês.
 */
export function detectarAssinaturas(params: {
  lancamentos: GastoDaJanela[]
  gastosFixos: FixoExistente[]
  hoje?: Date
}): Assinatura[] {
  const { lancamentos, gastosFixos } = params
  const atual = periodoAtual(params.hoje ?? new Date())
  const mesAtual = atual.ano * 12 + atual.mes

  // Chaves do que já é gasto fixo. Passa pela mesma normalização do
  // agrupamento para "Netflix" casar com "NETFLIX" e com "Netflix.com".
  const jaEhFixo = new Set(gastosFixos.map((f) => chaveDoDestinatario(f.nome)).filter((c) => c !== ''))

  const grupos = new Map<string, GastoDaJanela[]>()
  for (const l of lancamentos) {
    if (l.tipo !== 'gasto') continue // trava 1
    if (l.parcelamento_id !== null) continue // trava 2
    if (ehParcelaDisfarcada(l.descricao)) continue // trava 2
    const chave = chaveDoDestinatario(l.descricao)
    if (chave === '' || jaEhFixo.has(chave)) continue
    const lista = grupos.get(chave) ?? []
    lista.push(l)
    grupos.set(chave, lista)
  }

  const saida: Assinatura[] = []

  for (const [chave, itens] of grupos) {
    // trava 3: um por mês. Dois no mesmo mês descarta o grupo inteiro, e não
    // só o mês repetido — quem cobra duas vezes num mês não é assinatura.
    const porMes = new Map<number, GastoDaJanela>()
    let repetiu = false
    for (const l of itens) {
      const m = indiceDoMes(l.data)
      if (porMes.has(m)) {
        repetiu = true
        break
      }
      porMes.set(m, l)
    }
    if (repetiu) continue

    const meses = [...porMes.keys()].sort((a, b) => a - b)
    const ultimo = meses[meses.length - 1]

    // trava 6: assinatura morta não vira gasto fixo.
    if (ultimo < mesAtual - 1) continue

    // A sequência que interessa é a que TERMINA na última cobrança: um grupo
    // pode ter aparecido em 2023, sumido, e voltado agora.
    let inicio = ultimo
    while (porMes.has(inicio - 1)) inicio -= 1
    const sequencia = []
    for (let m = inicio; m <= ultimo; m += 1) sequencia.push(porMes.get(m) as GastoDaJanela)

    if (sequencia.length < MESES_MINIMOS) continue // trava 4

    const valores = sequencia.map((l) => l.valor_centavos)
    const menor = Math.min(...valores)
    const maior = Math.max(...valores)
    if (maior - menor > toleranciaDe(mediana(valores))) continue // trava 5

    const recente = sequencia[sequencia.length - 1]
    const categorias = sequencia.map((l) => l.category_id).filter((c): c is string => c !== null)
    const formas = sequencia.map((l) => l.payment_method_id).filter((f): f is string => f !== null)

    saida.push({
      chave,
      rotulo: rotuloDoDestinatario(recente.descricao),
      exemploCru: recente.descricao,
      ids: sequencia.map((l) => l.id),
      mesesSeguidos: sequencia.length,
      valorSugerido: recente.valor_centavos,
      diaSugerido: mediana(sequencia.map((l) => Number(l.data.slice(8, 10)))),
      categoriaSugerida: maisComum(categorias),
      formaSugerida: maisComum(formas),
      inicioAno: Math.floor((inicio - 1) / 12),
      inicioMes: ((inicio - 1) % 12) + 1,
      nuncaClassificado: categorias.length === 0,
      menorValor: menor,
      maiorValor: maior,
    })
  }

  // Mais meses primeiro: a sequência mais longa é a mais convincente. Empate
  // decide pelo valor, porque a assinatura cara é a que vale reavaliar.
  return saida.sort((a, b) => b.mesesSeguidos - a.mesesSeguidos || b.valorSugerido - a.valorSugerido)
}

function maisComum(valores: string[]): string | null {
  if (valores.length === 0) return null
  const contagem = new Map<string, number>()
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1)
  let vencedor: string | null = null
  let maior = 0
  for (const [v, n] of contagem) {
    if (n > maior) {
      maior = n
      vencedor = v
    }
  }
  return vencedor
}

/**
 * A frase que a tela mostra. Fica aqui, e não no componente, para o teste poder
 * cobrar que ela nunca diga mais do que os dados sustentam.
 */
export function textoDaAssinatura(a: Assinatura): string {
  const meses = `${a.mesesSeguidos} meses seguidos`
  if (a.nuncaClassificado) return `Sai da conta há ${meses}, sem categoria nenhuma.`
  return `Sai da conta há ${meses}.`
}
