import type { WishlistItem } from './database.types'

/**
 * Os três estados de um desejo.
 *
 * A wishlist tinha dois — pendente e conquistado — e o card somava tudo o que
 * estava pendente sob o rótulo "Falta juntar". Isso é ler uma lista de vontades
 * como dinheiro comprometido: querer um notebook não reserva um centavo.
 *
 * O estado do meio é o único em que existe dinheiro de verdade, e ele é
 * DERIVADO da ligação com uma meta (0021), não de um campo que alguém marca.
 * Uma coluna de status daria para marcar "juntando" sem meta nenhuma atrás, e
 * a tela mostraria progresso de um dinheiro que não existe.
 */

export type EstadoDesejo = 'quero' | 'juntando' | 'conquistado'

/** O mínimo de uma meta para a wishlist falar dela. */
export interface MetaLigada {
  goal_id: string
  nome: string
  guardado_total: number
}

export interface DesejoNaTela {
  item: WishlistItem
  estado: EstadoDesejo
  /** Nome da meta ligada, ou `null`. */
  metaNome: string | null
  /** Quanto a meta ligada tem guardado. `null` sem meta. */
  guardadoNaMeta: number | null
  /** Quanto do valor do desejo isso cobre, 0–100. `null` quando não dá para dizer. */
  percentual: number | null
  /**
   * A mesma meta banca mais de um desejo?
   *
   * Sem este aviso, dois desejos ligados a "Reserva" mostrariam o MESMO
   * dinheiro como se fosse de cada um — a armadilha de tratar vontade como
   * compromisso, de novo, só que por dentro.
   */
  metaCompartilhada: boolean
}

export function estadoDoDesejo(item: Pick<WishlistItem, 'concluido' | 'goal_id'>): EstadoDesejo {
  if (item.concluido) return 'conquistado'
  return item.goal_id ? 'juntando' : 'quero'
}

/**
 * Junta cada desejo com a meta dele.
 *
 * Um desejo pode apontar para uma meta que não veio na lista (apagada em outra
 * aba, ou ainda carregando). Nesse caso ele continua "juntando" — o vínculo
 * existe no banco —, mas sem número: inventar zero diria "você não guardou
 * nada", que é diferente de "não sei".
 */
export function montarDesejos(itens: WishlistItem[], metas: MetaLigada[]): DesejoNaTela[] {
  const porMeta = new Map(metas.map((m) => [m.goal_id, m]))

  const quantosPorMeta = new Map<string, number>()
  for (const item of itens) {
    if (!item.goal_id || item.concluido) continue
    quantosPorMeta.set(item.goal_id, (quantosPorMeta.get(item.goal_id) ?? 0) + 1)
  }

  return itens.map((item) => {
    const estado = estadoDoDesejo(item)
    const meta = item.goal_id ? porMeta.get(item.goal_id) : undefined
    const guardadoNaMeta = meta ? meta.guardado_total : null

    return {
      item,
      estado,
      metaNome: meta?.nome ?? null,
      guardadoNaMeta,
      percentual:
        guardadoNaMeta === null || item.valor_centavos <= 0
          ? null
          : Math.min(100, Math.round((guardadoNaMeta / item.valor_centavos) * 100)),
      metaCompartilhada: item.goal_id ? (quantosPorMeta.get(item.goal_id) ?? 0) > 1 : false,
    }
  })
}

export interface ResumoWishlist {
  quero: number
  juntando: number
  conquistados: number
  /** A soma dos "quero comprar" — vontade, e a tela precisa chamá-la assim. */
  totalDesejado: number
  /**
   * O guardado nas metas ligadas, contando CADA META UMA VEZ.
   *
   * Somar por desejo contaria a mesma meta duas vezes quando ela banca dois
   * desejos, e o número apareceria maior do que o dinheiro que existe. É o
   * mesmo erro do "Falta juntar", com outra roupa.
   */
  guardadoNasMetas: number
}

export function resumirWishlist(desejos: DesejoNaTela[]): ResumoWishlist {
  const metasContadas = new Set<string>()
  let guardadoNasMetas = 0
  const resumo: ResumoWishlist = {
    quero: 0,
    juntando: 0,
    conquistados: 0,
    totalDesejado: 0,
    guardadoNasMetas: 0,
  }

  for (const d of desejos) {
    if (d.estado === 'conquistado') {
      resumo.conquistados++
      continue
    }
    if (d.estado === 'quero') {
      resumo.quero++
      resumo.totalDesejado += d.item.valor_centavos
      continue
    }
    resumo.juntando++
    const id = d.item.goal_id
    if (id && !metasContadas.has(id) && d.guardadoNaMeta !== null) {
      metasContadas.add(id)
      guardadoNasMetas += d.guardadoNaMeta
    }
  }

  resumo.guardadoNasMetas = guardadoNasMetas
  return resumo
}
