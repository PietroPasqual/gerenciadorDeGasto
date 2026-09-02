/**
 * As regras do painel personalizável (fase 4).
 *
 * Tudo aqui é função pura sobre listas de identificadores: nenhuma delas
 * conhece React, o Supabase ou como um widget se desenha. É de propósito —
 * a parte que erra silenciosamente num painel montado pela pessoa é a
 * ARITMÉTICA de ordem e visibilidade, e ela precisa caber num teste sem
 * montar tela nenhuma.
 */

/** Os nomes de capa que o app desenha. O primeiro é o padrão. */
export const CAPAS = ['aurora', 'sereno', 'mata', 'brasa', 'noite', 'nenhuma'] as const
export type Capa = (typeof CAPAS)[number]

export const CAPA_PADRAO: Capa = 'aurora'

/**
 * Rótulos das capas. Ficam aqui e não no componente porque a lista de capas e
 * os nomes que a pessoa lê são a mesma decisão: acrescentar uma capa sem
 * nomeá-la deixaria um botão em branco no seletor.
 */
export const NOME_DA_CAPA: Record<Capa, string> = {
  aurora: 'Aurora',
  sereno: 'Sereno',
  mata: 'Mata',
  brasa: 'Brasa',
  noite: 'Noite',
  nenhuma: 'Sem capa',
}

/**
 * Um nome vindo do banco vira capa conhecida, ou o padrão.
 *
 * A 0023 guarda o NOME e não o gradiente, justamente para que aposentar uma
 * capa não deixe ninguém com um painel quebrado: o nome órfão cai aqui.
 */
export function capaValida(nome: string | null | undefined): Capa {
  return CAPAS.includes(nome as Capa) ? (nome as Capa) : CAPA_PADRAO
}

/**
 * Quais widgets o painel desenha, e em que ordem.
 *
 * A regra que a 0023 documenta, num lugar só:
 *
 *   (ordem ∩ conhecidos) ++ (conhecidos \ ordem)   menos   ocultos
 *
 * Em português: primeiro o que a pessoa ordenou, na ordem dela; atrás, o que
 * o app conhece e a ordem dela não menciona — que é exatamente o caso de um
 * widget lançado depois da última vez que ela mexeu no painel, e é por isso
 * que ele APARECE em vez de sumir. No fim, tira-se o que ela escondeu.
 *
 * As duas interseções com `conhecidos` não são zelo à toa: `painel_ordem`
 * pode conter o id de um widget que a versão atual do app não tem mais
 * (aposentado, ou gravado por uma versão mais nova noutro aparelho), e
 * renderizar por id desconhecido é tela branca.
 *
 * `ocultos` é aplicado por último, e não filtrando as entradas antes de
 * juntar: um widget novo pode nascer já escondido se a pessoa escondeu algo
 * com o mesmo id no passado, e respeitar isso é o comportamento certo.
 */
export function widgetsVisiveis({
  conhecidos,
  ordem,
  ocultos,
}: {
  conhecidos: readonly string[]
  ordem: readonly string[]
  ocultos: readonly string[]
}): string[] {
  const existe = new Set(conhecidos)
  const jaOrdenados = new Set<string>()

  const daPessoa: string[] = []
  for (const id of ordem) {
    if (!existe.has(id) || jaOrdenados.has(id)) continue
    jaOrdenados.add(id)
    daPessoa.push(id)
  }

  const novos = conhecidos.filter((id) => !jaOrdenados.has(id))
  const escondido = new Set(ocultos)
  return [...daPessoa, ...novos].filter((id) => !escondido.has(id))
}

/**
 * Move um widget uma casa para cima ou para baixo.
 *
 * Recebe a lista JÁ VISÍVEL e devolve outra lista visível — mover é uma
 * operação sobre o que a pessoa vê, não sobre a lista guardada. Quem
 * transforma isso na `painel_ordem` completa é `ordemParaSalvar`, logo
 * abaixo, e a separação existe porque os widgets escondidos não podem perder
 * o lugar deles só porque alguém arrastou um vizinho.
 *
 * Nos extremos devolve a MESMA referência: o componente compara por
 * identidade para não gravar no perfil um clique que não mudou nada.
 */
export function mover(visiveis: readonly string[], id: string, direcao: -1 | 1): readonly string[] {
  const de = visiveis.indexOf(id)
  if (de < 0) return visiveis
  const para = de + direcao
  if (para < 0 || para >= visiveis.length) return visiveis

  const copia = [...visiveis]
  ;[copia[de], copia[para]] = [copia[para], copia[de]]
  return copia
}

/**
 * A `painel_ordem` que vai para o banco depois de a pessoa reordenar.
 *
 * O detalhe que não é óbvio: a lista visível não contém os escondidos, e
 * salvar só ela apagaria a posição deles. Quem for trazido de volta apareceria
 * no fim, mesmo tendo sido o primeiro card do painel antes de ser escondido.
 *
 * Então os escondidos são reinseridos ANCORADOS: cada um volta logo depois do
 * vizinho que tinha antes na ordem antiga. É o que faz "esconder e mostrar de
 * novo" ser uma operação que se desfaz, em vez de um caminho só de ida.
 */
export function ordemParaSalvar({
  visiveis,
  ordemAntiga,
  ocultos,
}: {
  visiveis: readonly string[]
  ordemAntiga: readonly string[]
  ocultos: readonly string[]
}): string[] {
  const escondido = new Set(ocultos)
  const naVisivel = new Set(visiveis)

  // Para cada escondido, de quem ele vinha logo depois na ordem antiga.
  const ancora = new Map<string, string | null>()
  let anterior: string | null = null
  for (const id of ordemAntiga) {
    if (escondido.has(id)) ancora.set(id, anterior)
    else anterior = id
  }

  const resultado: string[] = []
  const soltos = [...escondido].filter((id) => ancora.get(id) === null || !ancora.has(id))

  // Escondidos cuja âncora sumiu (ou que nunca tiveram uma) entram na frente,
  // que é onde estavam: `anterior` só é nulo antes do primeiro visível.
  for (const id of soltos) if (!naVisivel.has(id)) resultado.push(id)

  for (const id of visiveis) {
    resultado.push(id)
    for (const [oculto, depoisDe] of ancora) {
      if (depoisDe === id && !resultado.includes(oculto)) resultado.push(oculto)
    }
  }

  // Rede de segurança: escondido cuja âncora não está mais entre os visíveis
  // (ela própria foi escondida) não pode simplesmente evaporar da ordem.
  for (const id of escondido) if (!resultado.includes(id)) resultado.push(id)

  return resultado
}
