import type { GastoCategoriaMes } from './database.types'

/**
 * Uma categoria ao longo do ano.
 *
 * O comparativo respondia "quanto entrou e quanto saiu por mês" e parava aí. A
 * pergunta que leva alguém a abrir a tela é outra: "o mercado está subindo?".
 * Isto transforma as linhas soltas da 0020 — uma por (mês, categoria) — na
 * série de doze pontos que o gráfico desenha.
 *
 * O id da categoria pode ser `null`: é a linha sintética "Sem categoria", que
 * existe desde a 0006 e costuma ser a MAIOR de todas logo depois de importar
 * um extrato. Escondê-la aqui faria o gráfico afirmar que o dinheiro não foi
 * para lugar nenhum.
 */

export interface SerieCategoria {
  id: string | null
  nome: string
  cor: string
  /** Doze posições, janeiro a dezembro, em centavos. Mês sem gasto é 0. */
  valores: number[]
  /** Soma só dos meses já realizados — o previsto fica de fora. */
  totalRealizado: number
  /** Média dos meses realizados COM movimento. Zero quando não houve nenhum. */
  media: number
}

/**
 * Agrupa as linhas em séries, da maior para a menor.
 *
 * `ateMes` é o último mês já realizado. Ele existe porque a 0020 devolve os
 * gastos fixos dos meses futuros (eles são vigentes lá), e somá-los no total
 * daria um número que mistura fato com previsão — o mesmo defeito que os
 * indicadores do topo tinham. Os doze pontos continuam no gráfico, com a faixa
 * de previsto marcada; o que muda é o que entra na conta.
 *
 * A ordem é por total realizado, decrescente: a categoria que a pessoa quer
 * investigar quase sempre é a que mais pesa, e deixá-la em primeiro poupa a
 * busca.
 */
export function seriesPorCategoria(linhas: GastoCategoriaMes[], ateMes = 12): SerieCategoria[] {
  const porChave = new Map<string, SerieCategoria>()

  for (const linha of linhas) {
    // `null` e a string "null" não podem colidir com um id de verdade; um uuid
    // nunca começa com dois-pontos.
    const chave = linha.category_id ?? ':sem-categoria'
    let serie = porChave.get(chave)
    if (!serie) {
      serie = {
        id: linha.category_id,
        nome: linha.nome,
        cor: linha.cor,
        valores: Array.from({ length: 12 }, () => 0),
        totalRealizado: 0,
        media: 0,
      }
      porChave.set(chave, serie)
    }
    // Mês fora de 1–12 não existe, mas o dado vem do banco e o índice negativo
    // corromperia o array em silêncio.
    if (linha.mes >= 1 && linha.mes <= 12) serie.valores[linha.mes - 1] += linha.gasto_centavos
  }

  const series = [...porChave.values()]
  for (const serie of series) {
    const realizados = serie.valores.slice(0, Math.max(0, Math.min(12, ateMes)))
    serie.totalRealizado = realizados.reduce((s, v) => s + v, 0)
    const comMovimento = realizados.filter((v) => v !== 0)
    serie.media = comMovimento.length === 0 ? 0 : Math.round(serie.totalRealizado / comMovimento.length)
  }

  return series.sort((a, b) => b.totalRealizado - a.totalRealizado || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** A chave estável de uma série, para o seletor — `null` precisa de um nome. */
export function chaveDaSerie(serie: Pick<SerieCategoria, 'id'>): string {
  return serie.id ?? ':sem-categoria'
}
