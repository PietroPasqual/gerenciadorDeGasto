/**
 * Sugere a categoria de um lançamento a partir da descrição.
 *
 * Existe por causa da importação: extrato de banco não traz categoria, então
 * um extrato de um ano entra com centenas de lançamentos sem classificar, e
 * classificar um a um não é trabalho que alguém faça.
 *
 * TRÊS TRAVAS, tiradas de erros medidos num classificador parecido:
 *
 * 1. Termo casa como PALAVRA INTEIRA. Substring solta produz falso positivo
 *    silencioso — "SUPER" acha "SUPERINTENDENCIA", "ETF" acha "NETFLIX".
 * 2. Prefixo existe, mas só a partir de 5 letras e só no COMEÇO de uma
 *    palavra (`supermerc` acha `SUPERMERCADO`, nunca no meio de outra). Há um
 *    teste que falha se alguém adicionar um prefixo curto demais.
 * 3. Nunca inventa categoria: só sugere uma que o usuário JÁ TEM, casando pelo
 *    nome. Quem apagou "iFood" não recebe "iFood" de volta pela importação.
 *
 * A ORDEM DAS REGRAS É A DESAMBIGUAÇÃO. "Posto de saúde" bate em saúde antes
 * de bater em posto de combustível; "Uber Eats" bate em delivery antes de
 * bater em transporte. Por isso a lista é uma sequência, e não um mapa.
 */

export type Regra = {
  /** Só para leitura humana e mensagem de teste. */
  nome: string
  /** Casam como palavra inteira; podem ter espaço ("amazon prime"). */
  palavras?: string[]
  /** Casam no começo de uma palavra. Mínimo de 5 letras (ver trava 2). */
  prefixos?: string[]
  /** Nomes de categoria aceitáveis, do mais para o menos específico. */
  categorias: string[]
}

export const MIN_PREFIXO = 5
export const MIN_PALAVRA = 4

/**
 * As únicas palavras de 3 letras permitidas, uma a uma e com motivo.
 * Qualquer outra é curta demais para não dar falso positivo: "dia", "ale",
 * "big" e "extra" estavam aqui e foram removidas — "Pix enviado dia 5" caía em
 * Mercado por causa de "dia", e "hora extra" também.
 */
export const PALAVRAS_CURTAS_PERMITIDAS = [
  'hbo', // canal; não é palavra de português
  'tim', // operadora; como palavra inteira não colide com nome próprio comum
]

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const REGRAS: Regra[] = [
  // Saúde vem antes de transporte de propósito: "posto de saúde" não é posto
  // de combustível.
  {
    nome: 'saúde',
    palavras: ['saude', 'unimed', 'hapvida', 'amil', 'sulamerica', 'posto de saude'],
    prefixos: [
      'drogar',
      'farmac',
      'drogasil',
      'drogaria',
      'panvel',
      'pacheco',
      'laborat',
      'clinic',
      'hospit',
      'odonto',
      'dentis',
      'psicol',
      'oftalm',
    ],
    categorias: ['Saúde'],
  },
  // Delivery antes de transporte: "Uber Eats" é comida, não corrida.
  {
    nome: 'delivery',
    palavras: ['ifood', 'rappi', 'uber eats', 'ubereats', 'aiqfome', 'zedelivery', 'ze delivery'],
    prefixos: ['deliver'],
    categorias: ['iFood', 'Alimentação', 'Lazer'],
  },
  {
    nome: 'transporte',
    palavras: [
      'uber',
      'cabify',
      '99app',
      '99 pop',
      'taxi',
      'blablacar',
      'metro',
      'onibus',
      'shell',
      'ipiranga',
      'petrobras',
      'posto',
    ],
    prefixos: [
      'combust',
      'estacion',
      'pedagio',
      'gasolin',
      'localiza',
      'movida',
      'unidas',
      'buser',
      'clickbus',
    ],
    categorias: ['Transporte'],
  },
  {
    nome: 'mercado',
    palavras: ['carrefour', 'assai', 'atacadao', 'tenda', 'sam s club', 'makro'],
    prefixos: [
      'supermerc',
      'hipermerc',
      'mercadinho',
      'mercearia',
      'atacad',
      'sacolao',
      'hortifr',
      'quitand',
      'padari',
      'panific',
      'acougue',
      'muffato',
      'angeloni',
      'zaffari',
      'condor',
      'nagumo',
    ],
    categorias: ['Mercado', 'Alimentação'],
  },
  {
    nome: 'assinaturas',
    palavras: [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'globoplay',
      'deezer',
      'icloud',
      'apple com',
      'amazon prime',
      'prime video',
      'youtube premium',
      'google one',
      'canva',
      'chatgpt',
      'openai',
      'anthropic',
      'claude ai',
      'adobe',
      'paramount',
      'crunchyroll',
    ],
    prefixos: ['assinat', 'playstation plus', 'xbox game pass', 'microsoft'],
    categorias: ['Assinaturas'],
  },
  {
    nome: 'academia',
    palavras: [
      'academia',
      'smart fit',
      'smartfit',
      'bluefit',
      'gympass',
      'totalpass',
      'crossfit',
      'bodytech',
    ],
    prefixos: ['pilates'],
    categorias: ['Academia', 'Saúde'],
  },
  {
    nome: 'contas de casa',
    palavras: [
      'copel',
      'cemig',
      'cpfl',
      'enel',
      'light',
      'celesc',
      'coelba',
      'sabesp',
      'sanepar',
      'cagece',
      'casan',
      'comgas',
      'vivo',
      'claro',
      'tim',
      'iptu',
      'ipva',
      'aluguel',
      'condominio',
    ],
    prefixos: ['energia', 'eletric', 'telefon', 'internet', 'saneam'],
    categorias: ['Contas', 'Moradia'],
  },
  {
    nome: 'vestuário',
    palavras: [
      'renner',
      'riachuelo',
      'zara',
      'hering',
      'nike',
      'adidas',
      'centauro',
      'shein',
      'marisa',
      'pernambucanas',
    ],
    prefixos: ['vestuar', 'calcado'],
    categorias: ['Vestuário'],
  },
  {
    nome: 'lazer',
    palavras: ['cinemark', 'cinepolis', 'ingresso com', 'steam', 'nintendo', 'teatro', 'sympla', 'eventim'],
    prefixos: ['cinema', 'restaur', 'lanchon', 'hamburg', 'pizzar', 'cervej', 'sorvet', 'cafeter'],
    categorias: ['Lazer'],
  },
  {
    nome: 'desenvolvimento',
    palavras: ['udemy', 'alura', 'coursera', 'rocketseat', 'github', 'kindle', 'domestika'],
    prefixos: ['faculd', 'univers', 'livrar', 'escola'],
    categorias: ['Desenvolvimento', 'Educação'],
  },
  {
    nome: 'cartão',
    palavras: ['pagto cartao credito', 'pagamento de fatura', 'fatura cartao', 'pagto cartao'],
    categorias: ['Cartões'],
  },
]

/** Palavra inteira; funciona também para termos com espaço. */
function temPalavra(acolchoado: string, termo: string): boolean {
  return acolchoado.includes(` ${termo} `)
}

/** Começo de palavra — nunca no meio de outra. */
function temPrefixo(acolchoado: string, prefixo: string): boolean {
  return acolchoado.includes(` ${prefixo}`)
}

/**
 * Qual regra a descrição dispara, ou null. Exportada para o teste conseguir
 * apontar QUAL regra causou uma classificação, e não só o resultado.
 */
export function regraDe(descricao: string): Regra | null {
  const acolchoado = ` ${normalizar(descricao)} `
  if (acolchoado.trim() === '') return null

  for (const regra of REGRAS) {
    if (regra.palavras?.some((p) => temPalavra(acolchoado, p))) return regra
    if (regra.prefixos?.some((p) => temPrefixo(acolchoado, p))) return regra
  }
  return null
}

type Categoria = { id: string; nome: string }

/**
 * O id da categoria do usuário que combina com a descrição, ou null.
 *
 * Devolve null com folga: sem regra, ou com regra cujo nome de categoria o
 * usuário não tem, ninguém é classificado. Deixar sem categoria é visível na
 * tela (existe a fatia "Sem categoria"); classificar errado, não.
 */
export function sugerirCategoria(descricao: string, categorias: Categoria[]): string | null {
  const regra = regraDe(descricao)
  if (!regra) return null

  const porNome = new Map(categorias.map((c) => [normalizar(c.nome), c.id]))
  for (const nome of regra.categorias) {
    const id = porNome.get(normalizar(nome))
    if (id) return id
  }
  return null
}

// ------------------------------------------------------ forma de pagamento

/**
 * A forma de pagamento, ao contrário da categoria, MUITAS VEZES está escrita
 * na descrição: "Pix enviado para X" é Pix, "DEBITO DE CARTAO" é débito.
 *
 * Não é palpite sobre o que a pessoa quis dizer — é o próprio banco dizendo
 * como o dinheiro saiu. Por isso as regras aqui são coladas no verbo da
 * operação, e nada que dependa do nome do destinatário entra.
 */
const REGRAS_FORMA: Array<{ termos: string[]; nomes: string[] }> = [
  { termos: ['pix'], nomes: ['Pix'] },
  { termos: ['boleto'], nomes: ['Boleto'] },
  { termos: ['saque', 'dinheiro', 'especie'], nomes: ['Dinheiro'] },
  // "DEBITO DE CARTAO", "compra no debito", "debito automatico"
  { termos: ['debito'], nomes: ['Débito', 'Cartão de débito'] },
  { termos: ['credito'], nomes: ['Crédito', 'Cartão de crédito'] },
  { termos: ['ted', 'doc', 'transferencia'], nomes: ['Transferência', 'TED'] },
]

/**
 * O id da forma de pagamento que combina com a descrição, ou null.
 *
 * "Compra com Cartão" sozinho NÃO decide nada de propósito: pode ser débito ou
 * crédito, e escolher um dos dois no chute erraria metade das vezes em
 * silêncio. Só cai numa forma quando a palavra está lá.
 */
export function sugerirFormaPagamento(descricao: string, formas: Categoria[]): string | null {
  const acolchoado = ` ${normalizar(descricao)} `
  if (acolchoado.trim() === '') return null

  const porNome = new Map(formas.map((f) => [normalizar(f.nome), f.id]))
  for (const regra of REGRAS_FORMA) {
    if (!regra.termos.some((t) => temPalavra(acolchoado, t))) continue
    for (const nome of regra.nomes) {
      const id = porNome.get(normalizar(nome))
      if (id) return id
    }
    // Achou a operação mas o usuário não tem essa forma cadastrada: para aqui
    // em vez de tentar a próxima regra, que casaria por acaso.
    return null
  }
  return null
}
