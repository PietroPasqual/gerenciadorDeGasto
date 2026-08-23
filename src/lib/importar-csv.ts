/**
 * Leitura de CSV para importar lançamentos.
 *
 * Tudo aqui é puro: entra texto, sai dado. A tela só monta o que estas funções
 * devolvem. É de propósito — importar extrato é a operação que mais pode
 * estragar número no app, e número errado tem de morrer no teste, não na tela.
 */

import { parseParaCentavos } from './money'
import type { TipoLancamento } from './database.types'

/** Tira acento e caixa, para comparar nome de categoria com o do arquivo. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de acento
    .toLowerCase()
    .trim()
}

// -------------------------------------------------------------- codificação

/**
 * Decodifica o arquivo escolhido.
 *
 * Nem todo extrato vem em UTF-8: banco e Excel brasileiros ainda gravam em
 * windows-1252, e ler esse arquivo como UTF-8 transforma "Alimentação" em
 * "Alimenta\ufffdão" — a categoria deixa de casar pelo nome e o lançamento entra
 * sem categoria, calado. Por isso a primeira tentativa é UTF-8 em modo
 * `fatal`: byte inválido lança, e aí sim caímos no windows-1252.
 */
export function decodificarTexto(dados: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dados)
  } catch {
    return new TextDecoder('windows-1252').decode(dados)
  }
}

// ---------------------------------------------------------------- leitura

const SEPARADORES = [';', ',', '\t'] as const

/**
 * Descobre o separador contando ocorrências FORA de aspas na primeira linha.
 * Contar sem olhar as aspas erraria em "Mercado, feira";12,50 — ali a vírgula
 * do meio da descrição venceria o ponto e vírgula de verdade.
 */
function acharSeparador(texto: string): string {
  const contagem = new Map<string, number>(SEPARADORES.map((s) => [s, 0]))
  let dentroDeAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (c === '"') dentroDeAspas = !dentroDeAspas
    else if (!dentroDeAspas && (c === '\n' || c === '\r')) break
    else if (!dentroDeAspas && contagem.has(c)) contagem.set(c, contagem.get(c)! + 1)
  }
  let melhor = ';'
  for (const [sep, n] of contagem) if (n > contagem.get(melhor)!) melhor = sep
  return melhor
}

export type ArquivoCSV = { cabecalho: string[]; linhas: string[][]; separador: string }

/**
 * Divide o CSV respeitando aspas: campo entre aspas pode conter o separador,
 * quebra de linha e aspas dobradas ("" vira ").
 */
export function lerCSV(bruto: string): ArquivoCSV {
  // \ufeff = BOM, que o Excel escreve no começo do arquivo.
  const texto = bruto.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n')
  const separador = acharSeparador(texto)

  const tabela: string[][] = []
  let linha: string[] = []
  let campo = ''
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else dentroDeAspas = false
      } else campo += c
    } else if (c === '"') dentroDeAspas = true
    else if (c === separador) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n') {
      linha.push(campo)
      tabela.push(linha)
      linha = []
      campo = ''
    } else campo += c
  }
  linha.push(campo)
  tabela.push(linha)

  // Linhas totalmente vazias não são dado: extrato costuma terminar com \n.
  const util = tabela.filter((l) => l.some((c) => c.trim() !== '')).map((l) => l.map((c) => c.trim()))
  if (util.length === 0) return { cabecalho: [], linhas: [], separador }
  return { cabecalho: util[0], linhas: util.slice(1), separador }
}

// ------------------------------------------------------------------ datas

/** Um dia só existe se sobreviver à ida e volta pelo Date. */
function montarISO(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export type OrdemData = 'dia-mes' | 'mes-dia'

/**
 * Olha a coluna inteira antes de decidir se 03/04 é 3 de abril ou 4 de março.
 *
 * Um valor acima de 12 na primeira posição só cabe em dia; na segunda, só em
 * mês trocado. Se o arquivo inteiro for ambíguo (todo mundo <= 12), fica
 * dia-mes, que é o padrão brasileiro — e a tela DIZ qual foi usada, porque
 * data trocada em silêncio é o tipo de erro que só aparece meses depois.
 */
export function detectarOrdemData(valores: string[]): OrdemData {
  for (const v of valores) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v.trim())
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12 && b <= 12) return 'dia-mes'
    if (b > 12 && a <= 12) return 'mes-dia'
  }
  return 'dia-mes'
}

export function interpretarData(valor: string, ordem: OrdemData = 'dia-mes'): string | null {
  const texto = valor.trim()
  if (texto === '') return null

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto)
  if (iso) return montarISO(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(texto)
  if (br) {
    const dia = ordem === 'dia-mes' ? Number(br[1]) : Number(br[2])
    const mes = ordem === 'dia-mes' ? Number(br[2]) : Number(br[1])
    let ano = Number(br[3])
    // "15/08/26": dois dígitos viram 20xx. Extrato não tem data do século XX.
    if (br[3].length === 2) ano += 2000
    return montarISO(ano, mes, dia)
  }

  return null
}

// -------------------------------------------------------------- mapeamento

export type Campo = 'data' | 'descricao' | 'valor' | 'valorSaida' | 'valorEntrada' | 'categoria' | 'forma'

/** Índice da coluna do arquivo para cada campo; -1 = não usar. */
export type Mapa = Record<Campo, number>

const PISTAS: Record<Campo, string[]> = {
  data: ['data', 'date', 'dia', 'data da compra', 'data lancamento', 'data do lancamento'],
  descricao: [
    'descricao',
    'description',
    'historico',
    'lancamento',
    'titulo',
    'estabelecimento',
    'memo',
    'detalhe',
  ],
  valor: ['valor', 'amount', 'value', 'quantia', 'valor (r$)', 'preco', 'montante'],
  // Extrato de Bradesco, Santander e Caixa não usa sinal: usa DUAS colunas.
  valorSaida: ['debito', 'saida', 'saidas', 'debit', 'valor debito', 'pagamento/debito'],
  valorEntrada: ['credito', 'entrada', 'entradas', 'credit', 'valor credito', 'deposito/credito'],
  categoria: ['categoria', 'category', 'tipo de gasto', 'classificacao'],
  forma: ['forma de pagamento', 'forma', 'pagamento', 'payment', 'meio de pagamento', 'cartao', 'conta'],
}

/** Chuta a coluna de cada campo pelo nome do cabeçalho. Exato ganha de parcial. */
export function adivinharColunas(cabecalho: string[]): Mapa {
  const nomes = cabecalho.map(normalizar)
  const mapa: Mapa = {
    data: -1,
    descricao: -1,
    valor: -1,
    valorSaida: -1,
    valorEntrada: -1,
    categoria: -1,
    forma: -1,
  }
  const usadas = new Set<number>()

  // Débito/crédito são tentados ANTES de 'valor': num extrato de duas colunas,
  // deixar 'valor' pegar a de débito primeiro faria toda compra virar entrada.
  const ordem: Campo[] = ['data', 'descricao', 'valorSaida', 'valorEntrada', 'valor', 'categoria', 'forma']
  for (const campo of ordem) {
    let achou = nomes.findIndex((n, i) => !usadas.has(i) && PISTAS[campo].includes(n))
    if (achou === -1) {
      achou = nomes.findIndex(
        (n, i) => !usadas.has(i) && n !== '' && PISTAS[campo].some((p) => n.includes(p)),
      )
    }
    if (achou !== -1) {
      mapa[campo] = achou
      usadas.add(achou)
    }
  }

  // Achou as duas colunas separadas? Então 'valor' não tem papel — e uma coluna
  // de "Saldo" pega por semelhança só atrapalharia.
  if (mapa.valorSaida !== -1 || mapa.valorEntrada !== -1) mapa.valor = -1
  return mapa
}

// -------------------------------------------------------------- preparação

/** Como transformar o sinal do valor em tipo de lançamento. */
export type RegraSinal = 'pelo-sinal' | 'tudo-gasto' | 'tudo-entrada'

export type LancamentoImportado = {
  linha: number
  data: string
  descricao: string
  valor_centavos: number
  tipo: TipoLancamento
  category_id: string | null
  payment_method_id: string | null
  /** Já existe um lançamento igual no banco: fica de fora por padrão. */
  duplicado: boolean
}

export type Problema = { linha: number; motivo: string; conteudo: string }

export type Resultado = {
  prontos: LancamentoImportado[]
  problemas: Problema[]
  ordemData: OrdemData
}

type Nomeado = { id: string; nome: string }
/** O mínimo de um lançamento já gravado para saber se o do arquivo repete. */
export type Existente = { data: string; descricao: string; valor_centavos: number; tipo: string }

/** Chave de duplicata: mesmo dia, mesma descrição e mesmo valor. */
function chaveDuplicata(data: string, descricao: string, centavos: number, tipo: string): string {
  return `${data}|${normalizar(descricao)}|${centavos}|${tipo}`
}

export function prepararImportacao({
  arquivo,
  mapa,
  regraSinal,
  categorias,
  formas,
  existentes,
  ordemData,
}: {
  arquivo: ArquivoCSV
  mapa: Mapa
  regraSinal: RegraSinal
  categorias: Nomeado[]
  formas: Nomeado[]
  existentes: Existente[]
  /** Ausente = detectar pela própria coluna. */
  ordemData?: OrdemData
}): Resultado {
  const colunaData = mapa.data
  const ordem =
    ordemData ?? detectarOrdemData(colunaData >= 0 ? arquivo.linhas.map((l) => l[colunaData] ?? '') : [])

  const porNome = (lista: Nomeado[]) => new Map(lista.map((x) => [normalizar(x.nome), x.id]))
  const mapaCategorias = porNome(categorias)
  const mapaFormas = porNome(formas)

  const jaExiste = new Set(
    existentes.map((e) => chaveDuplicata(e.data, e.descricao, Math.abs(e.valor_centavos), e.tipo)),
  )
  // Duplicata dentro do próprio arquivo conta igual: extrato repete parcela.
  const vistasNoArquivo = new Set<string>()

  // Duas colunas de valor mapeadas? Então a direção vem delas e a regra de
  // sinal não se aplica.
  const duasColunas = mapa.valorSaida >= 0 || mapa.valorEntrada >= 0

  const prontos: LancamentoImportado[] = []
  const problemas: Problema[] = []

  arquivo.linhas.forEach((linha, i) => {
    const numero = i + 2 // +1 pelo cabeçalho, +1 porque planilha conta do 1
    const bruta = linha.join(arquivo.separador)
    const pegar = (c: number) => (c >= 0 ? (linha[c] ?? '').trim() : '')

    const data = interpretarData(pegar(colunaData), ordem)
    if (!data) {
      problemas.push({ linha: numero, motivo: 'data não reconhecida', conteudo: bruta })
      return
    }

    const descricao = pegar(mapa.descricao) || 'Sem descrição'

    let valor_centavos: number
    let tipo: TipoLancamento

    if (duasColunas) {
      // Extrato de duas colunas: quem diz a direção é a coluna preenchida, não
      // o sinal. A coluna não usada costuma vir vazia OU como 0,00 — por isso
      // "preenchida" aqui quer dizer diferente de zero, e não "não vazia".
      const saida = parseParaCentavos(pegar(mapa.valorSaida)) ?? 0
      const entrada = parseParaCentavos(pegar(mapa.valorEntrada)) ?? 0
      if (saida === 0 && entrada === 0) {
        problemas.push({ linha: numero, motivo: 'sem valor em débito nem em crédito', conteudo: bruta })
        return
      }
      tipo = saida !== 0 ? 'gasto' : 'entrada'
      valor_centavos = Math.abs(saida !== 0 ? saida : entrada)
    } else {
      const centavos = parseParaCentavos(pegar(mapa.valor))
      if (centavos === null) {
        problemas.push({ linha: numero, motivo: 'valor não reconhecido', conteudo: bruta })
        return
      }
      if (centavos === 0) {
        problemas.push({ linha: numero, motivo: 'valor zerado', conteudo: bruta })
        return
      }
      tipo =
        regraSinal === 'tudo-gasto'
          ? 'gasto'
          : regraSinal === 'tudo-entrada'
            ? 'entrada'
            : centavos < 0
              ? 'gasto'
              : 'entrada'
      // O banco guarda o valor sempre positivo; quem diz a direção é o tipo.
      valor_centavos = Math.abs(centavos)
    }

    const chave = chaveDuplicata(data, descricao, valor_centavos, tipo)
    const duplicado = jaExiste.has(chave) || vistasNoArquivo.has(chave)
    vistasNoArquivo.add(chave)

    prontos.push({
      linha: numero,
      data,
      descricao,
      valor_centavos,
      tipo,
      category_id: mapaCategorias.get(normalizar(pegar(mapa.categoria))) ?? null,
      payment_method_id: mapaFormas.get(normalizar(pegar(mapa.forma))) ?? null,
      duplicado,
    })
  })

  return { prontos, problemas, ordemData: ordem }
}
