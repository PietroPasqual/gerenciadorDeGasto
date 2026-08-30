import { chaveDoDestinatario } from './agrupar-descricoes'
import { MIN_PALAVRA, PALAVRAS_CURTAS_PERMITIDAS, sugerirCategoria } from './categorizar'

/** Uma regra que o usuário ensinou ao corrigir uma sugestão. */
export interface RegraAprendida {
  termo: string
  category_id: string
}

/**
 * De uma descrição de extrato para a chave da regra.
 *
 * Não é a descrição inteira: "IFD*BRASILIA REST 4471" tem um número que muda a
 * cada compra, e guardar isso como regra daria algo que nunca mais casaria. A
 * chave é o destinatário, pela mesma função que a importação já usa para
 * agrupar — ela tira o verbo do pagamento, os números e as siglas de empresa.
 */
export function termoDaDescricao(descricao: string): string {
  return chaveDoDestinatario(descricao)
}

/**
 * Esta descrição pode virar regra?
 *
 * As três travas do `categorizar.ts` valem AQUI COM MAIS FORÇA, porque uma
 * regra aprendida nasce de um clique e ninguém a revisa depois. Uma chave curta
 * ou genérica ("pix", "loja", "ab") casaria com meio extrato e classificaria
 * tudo errado de uma vez — e o usuário só descobriria olhando o donut.
 *
 * Duas condições, e as duas precisam valer:
 *  1. pelo menos 4 caracteres (o MIN_PALAVRA do arquivo de regras);
 *  2. se for palavra única, ela não pode ser curta demais — as únicas curtas
 *     aceitas são as mesmas que as regras fixas já permitem, uma a uma.
 */
export function podeVirarRegra(descricao: string): boolean {
  const termo = termoDaDescricao(descricao)
  const palavras = termo.split(' ').filter(Boolean)
  if (palavras.length === 0) return false

  // A ordem importa: a lista de exceções precisa ser consultada ANTES do
  // comprimento, senão ela nunca teria efeito — 'hbo' e 'tim' existem nela
  // justamente por serem curtas e ainda assim seguras como palavra inteira.
  if (palavras.length === 1) {
    return palavras[0].length >= MIN_PALAVRA || PALAVRAS_CURTAS_PERMITIDAS.includes(palavras[0])
  }
  return termo.length >= MIN_PALAVRA
}

/**
 * A categoria sugerida para uma descrição, com as regras do usuário na frente.
 *
 * A precedência é o ponto: ele corrigiu de propósito, e o código não tem por
 * que discordar depois. Sem regra dele, cai nas fixas; sem nenhuma das duas,
 * devolve null — deixar sem categoria é visível na tela (existe a fatia "Sem
 * categoria"), classificar errado não é.
 */
export function sugerirCategoriaComAprendizado(
  descricao: string,
  categorias: Array<{ id: string; nome: string }>,
  aprendidas: RegraAprendida[],
): string | null {
  const termo = termoDaDescricao(descricao)
  if (termo !== '') {
    const aprendida = aprendidas.find((r) => r.termo === termo)
    // A categoria pode ter sido excluída depois de a regra nascer; nesse caso
    // a regra é ignorada em silêncio, e as fixas assumem.
    if (aprendida && categorias.some((c) => c.id === aprendida.category_id)) {
      return aprendida.category_id
    }
  }
  return sugerirCategoria(descricao, categorias)
}

/**
 * Quantos lançamentos de uma lista esta regra passaria a classificar.
 *
 * A tela mostra isso na hora de aprender ("isso vale para outros 23 deste
 * mês"): ensinar uma regra sem ver o alcance dela é assinar em branco.
 */
export function alcanceDaRegra(termo: string, descricoes: string[]): number {
  return descricoes.filter((d) => termoDaDescricao(d) === termo).length
}
