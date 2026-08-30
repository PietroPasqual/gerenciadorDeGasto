import { normalizar } from './importar-csv'
import type { Transaction } from './database.types'

/**
 * Filtro da lista de lançamentos.
 *
 * Com um ano de extrato importado, um mês passa de centenas de linhas e o
 * único jeito de achar algo era rolar. Os campos aqui são os que respondem as
 * perguntas que a pessoa faz de fato: "quanto gastei na farmácia", "o que
 * passou de R$ 200", "o que ainda está sem categoria".
 */
export interface Filtro {
  texto: string
  categoriaId: string | null
  formaId: string | null
  /** Em centavos, inclusivo nas duas pontas. null = sem limite daquele lado. */
  valorMin: number | null
  valorMax: number | null
  tipo: 'todos' | 'gasto' | 'entrada'
  /** 'sem-categoria' e 'sem-forma' são pedidos de verdade, não ausência de filtro. */
  semCategoria: boolean
  semForma: boolean
}

export const FILTRO_VAZIO: Filtro = {
  texto: '',
  categoriaId: null,
  formaId: null,
  valorMin: null,
  valorMax: null,
  tipo: 'todos',
  semCategoria: false,
  semForma: false,
}

export function filtroEstaVazio(f: Filtro): boolean {
  return (
    f.texto.trim() === '' &&
    f.categoriaId === null &&
    f.formaId === null &&
    f.valorMin === null &&
    f.valorMax === null &&
    f.tipo === 'todos' &&
    !f.semCategoria &&
    !f.semForma
  )
}

/** Quantos critérios estão ativos — vira o "3" do selo "3 filtros". */
export function quantosFiltros(f: Filtro): number {
  let n = 0
  if (f.texto.trim() !== '') n++
  if (f.categoriaId !== null) n++
  if (f.formaId !== null) n++
  if (f.valorMin !== null || f.valorMax !== null) n++
  if (f.tipo !== 'todos') n++
  if (f.semCategoria) n++
  if (f.semForma) n++
  return n
}

/**
 * Aplica o filtro.
 *
 * O texto casa por trecho e ignora acento e caixa (a mesma `normalizar` que a
 * importação usa): quem digita "farmacia" precisa achar "Drogaria Farmácia
 * São Paulo", senão o campo de busca é decorativo.
 *
 * Os critérios se somam (E, não OU): marcar categoria "Mercado" e valor acima
 * de R$ 100 traz as compras de mercado acima de R$ 100, não a união das duas
 * listas — que é o que alguém esperaria de um filtro.
 */
export function aplicarFiltro(lancamentos: Transaction[], f: Filtro): Transaction[] {
  const alvo = normalizar(f.texto.trim())
  return lancamentos.filter((l) => {
    if (alvo !== '' && !normalizar(l.descricao).includes(alvo)) return false
    if (f.tipo !== 'todos' && l.tipo !== f.tipo) return false
    if (f.categoriaId !== null && l.category_id !== f.categoriaId) return false
    if (f.formaId !== null && l.payment_method_id !== f.formaId) return false
    if (f.semCategoria && l.category_id !== null) return false
    if (f.semForma && l.payment_method_id !== null) return false
    if (f.valorMin !== null && l.valor_centavos < f.valorMin) return false
    if (f.valorMax !== null && l.valor_centavos > f.valorMax) return false
    return true
  })
}

// ------------------------------------------------------------------ URL

/**
 * O filtro mora na URL para o botão voltar desfazer a busca em vez de sair da
 * tela, e para um link levar alguém direto ao mesmo recorte. Chaves curtas
 * porque a URL fica visível.
 */
const CHAVES = {
  texto: 'q',
  categoriaId: 'cat',
  formaId: 'forma',
  valorMin: 'min',
  valorMax: 'max',
  tipo: 'tipo',
  semCategoria: 'sc',
  semForma: 'sf',
} as const

export function filtroParaParams(f: Filtro, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base)
  // Escrever só o que está ativo mantém a URL curta e legível; um filtro
  // limpo não deixa rastro nenhum.
  const definir = (chave: string, valor: string | null) => {
    if (valor === null || valor === '') p.delete(chave)
    else p.set(chave, valor)
  }
  definir(CHAVES.texto, f.texto.trim() || null)
  definir(CHAVES.categoriaId, f.categoriaId)
  definir(CHAVES.formaId, f.formaId)
  definir(CHAVES.valorMin, f.valorMin === null ? null : String(f.valorMin))
  definir(CHAVES.valorMax, f.valorMax === null ? null : String(f.valorMax))
  definir(CHAVES.tipo, f.tipo === 'todos' ? null : f.tipo)
  definir(CHAVES.semCategoria, f.semCategoria ? '1' : null)
  definir(CHAVES.semForma, f.semForma ? '1' : null)
  return p
}

export function filtroDeParams(p: URLSearchParams): Filtro {
  const inteiro = (chave: string) => {
    const bruto = p.get(chave)
    if (bruto === null) return null
    const n = Number(bruto)
    // URL é dado de fora: um "min=abc" colado à mão não pode virar NaN e
    // esconder todos os lançamentos sem explicação.
    return Number.isSafeInteger(n) && n >= 0 ? n : null
  }
  const tipo = p.get(CHAVES.tipo)
  return {
    texto: p.get(CHAVES.texto) ?? '',
    categoriaId: p.get(CHAVES.categoriaId),
    formaId: p.get(CHAVES.formaId),
    valorMin: inteiro(CHAVES.valorMin),
    valorMax: inteiro(CHAVES.valorMax),
    tipo: tipo === 'gasto' || tipo === 'entrada' ? tipo : 'todos',
    semCategoria: p.get(CHAVES.semCategoria) === '1',
    semForma: p.get(CHAVES.semForma) === '1',
  }
}
