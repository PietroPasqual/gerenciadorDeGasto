import { normalizar } from './categorizar'

/**
 * Agrupa lançamentos por "quem", para categorizar em bloco.
 *
 * A categorização automática por palavra-chave só funciona quando a descrição
 * traz o nome de um comércio conhecido — o que é a cara de uma fatura de
 * cartão ("SUPERMERCADO SAO JOAO", "UBER TRIP"). Extrato de conta no Brasil
 * hoje é outra coisa: é Pix para gente e para empresa, com o nome do
 * destinatário. Nenhuma lista de palavras sabe quem é "Verli Friedrich", e
 * fingir que sabe seria pior do que não classificar.
 *
 * A saída é agrupar. "Pix enviado para Verli Friedrich" aparece doze vezes no
 * ano; o usuário decide UMA vez e as doze vão junto. Trezentas decisões viram
 * algumas dezenas.
 */

/**
 * O que vem antes do nome e não ajuda a distinguir um destinatário do outro.
 * Ordem importa: o mais longo primeiro, senão "pix enviado" comeria o
 * "pix enviado para" e sobraria um "para" solto no começo do nome.
 */
const PREFIXOS = [
  'pix automatico enviado para',
  'pix automatico recebido de',
  'pix enviado para',
  'pix recebido c6 de',
  'pix recebido de',
  'pix enviado',
  'pix recebido',
  'transferencia enviada para',
  'transferencia recebida de',
  'transferencia enviada',
  'transferencia recebida',
  'transf enviada pix',
  'transf recebida pix',
  'compra com cartao',
  'compra no debito',
  'pagamento de',
  'pagto',
  'ted credito em conta',
  'ted debito em conta',
]

/**
 * Reduz a descrição a "quem": tira o verbo da transferência, os códigos
 * numéricos e a pontuação. É esta chave que junta as linhas do mesmo
 * destinatário.
 */
export function chaveDoDestinatario(descricao: string): string {
  let texto = normalizar(descricao)
  for (const prefixo of PREFIXOS) {
    if (texto.startsWith(prefixo)) {
      texto = texto.slice(prefixo.length).trim()
      break
    }
  }
  // Códigos e números soltos ("LTDA 0231", "PARCELA 2 3") não distinguem
  // destinatário e quebrariam o grupo em pedaços de um.
  texto = texto
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(ltda|me|epp|sa|s a|eireli)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto
}

/**
 * O nome do destinatário como ele aparece no extrato, com maiúsculas e acentos
 * preservados — a chave serve para agrupar, este texto serve para ler.
 *
 * Mostrar a descrição inteira não funciona: "Pix enviado para " ocupa a largura
 * toda no celular e sobra "Pix enviado para D…", "Pix enviado para M…" — duas
 * linhas que parecem iguais e não dá para saber qual é qual.
 */
export function rotuloDoDestinatario(descricao: string): string {
  const texto = descricao.trim()
  const semAcento = normalizar(texto)
  for (const prefixo of PREFIXOS) {
    if (semAcento.startsWith(prefixo)) {
      // Corta no ORIGINAL pelo mesmo número de palavras do prefixo, para não
      // perder maiúscula nem acento do nome.
      const palavras = prefixo.split(' ').length
      const resto = texto.split(/\s+/).slice(palavras).join(' ').trim()
      return resto === '' ? texto : resto
    }
  }
  return texto
}

export type ItemAgrupavel = { id: string; descricao: string; valor_centavos: number }

export type GrupoDescricao = {
  chave: string
  /** O destinatário, sem o verbo da transferência, para mostrar na tela. */
  rotulo: string
  /**
   * A descrição inteira da primeira linha, como veio.
   *
   * Necessária porque o `rotulo` corta exatamente a parte que diz a FORMA DE
   * PAGAMENTO: em "Pix enviado para Verli Friedrich", o rótulo é o nome e o
   * "Pix" fica no prefixo descartado.
   */
  exemploCru: string
  ids: string[]
  total: number
}

/**
 * Agrupa e ordena por quantidade — quem mais se repete rende mais decisão por
 * toque, então vem primeiro.
 */
export function agruparPorDestinatario(itens: ItemAgrupavel[]): GrupoDescricao[] {
  const mapa = new Map<string, GrupoDescricao>()
  for (const item of itens) {
    const chave = chaveDoDestinatario(item.descricao)
    // Descrição que virou vazia (só números, por exemplo) não forma grupo:
    // juntaria coisas sem nada em comum sob um rótulo em branco.
    if (chave === '') continue
    const grupo: GrupoDescricao = mapa.get(chave) ?? {
      chave,
      rotulo: rotuloDoDestinatario(item.descricao),
      exemploCru: item.descricao,
      ids: [],
      total: 0,
    }
    grupo.ids.push(item.id)
    grupo.total += item.valor_centavos
    mapa.set(chave, grupo)
  }
  return [...mapa.values()].sort((a, b) => b.ids.length - a.ids.length || b.total - a.total)
}

/** Quantos lançamentos os N maiores grupos cobrem — para a tela ser honesta. */
export function coberturaDosMaiores(grupos: GrupoDescricao[], n: number): number {
  return grupos.slice(0, n).reduce((s, g) => s + g.ids.length, 0)
}
