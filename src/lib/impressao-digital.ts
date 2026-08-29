import { normalizar } from './importar-csv'

/**
 * FNV-1a de 64 bits. Não é criptografia — é só um jeito determinístico de
 * espremer a chave do lançamento num texto curto e do mesmo tamanho sempre.
 * Precisa ser estável entre navegadores e entre versões do app: se o hash
 * mudar, todo extrato já importado deixa de casar e volta a duplicar.
 */
function fnv1a64(texto: string): string {
  const PRIMO = 1099511628211n
  const MASCARA = 0xffffffffffffffffn
  let hash = 14695981039346656037n
  for (let i = 0; i < texto.length; i++) {
    hash ^= BigInt(texto.charCodeAt(i))
    hash = (hash * PRIMO) & MASCARA
  }
  return hash.toString(16).padStart(16, '0')
}

export interface ChaveLancamento {
  data: string
  descricao: string
  valor_centavos: number
  tipo: string
  /**
   * Qual repetição esta linha é, dentro do próprio arquivo, contando a partir
   * de 1. É o que separa dois cafés de verdade de uma reimportação: dois cafés
   * no mesmo dia pelo mesmo valor recebem 1 e 2 e entram os dois, e reimportar
   * o mesmo arquivo recalcula 1 e 2 na mesma ordem, então os dois colidem.
   */
  ocorrencia: number
}

/**
 * Impressão digital de um lançamento importado.
 *
 * O `user_id` não entra no hash porque ele já é a primeira coluna do índice
 * único — botá-lo aqui dentro só deixaria o índice pior sem separar nada.
 */
export function impressaoDigital({
  data,
  descricao,
  valor_centavos,
  tipo,
  ocorrencia,
}: ChaveLancamento): string {
  return fnv1a64(`${data}|${normalizar(descricao)}|${valor_centavos}|${tipo}|${ocorrencia}`)
}

/**
 * Numera as repetições de uma lista na ordem em que aparecem e devolve a
 * impressão digital de cada uma. A ordem do arquivo é parte da chave, então
 * esta função tem que ver a lista inteira, e na mesma ordem, toda vez.
 */
export function impressoesDigitais(lista: Array<Omit<ChaveLancamento, 'ocorrencia'>>): string[] {
  const contagem = new Map<string, number>()
  return lista.map((item) => {
    const base = `${item.data}|${normalizar(item.descricao)}|${item.valor_centavos}|${item.tipo}`
    const ocorrencia = (contagem.get(base) ?? 0) + 1
    contagem.set(base, ocorrencia)
    return impressaoDigital({ ...item, ocorrencia })
  })
}
