/**
 * Observações sobre o mês — FATOS tirados dos seus próprios números.
 *
 * A régua aqui é deliberada: cada frase é algo que dá para conferir na tela ao
 * lado, e nenhuma diz o que você deveria fazer. "Mercado é 38% das suas
 * saídas" é um fato; "corte no mercado" seria um palpite sobre a sua vida, que
 * um app de planilha não tem como saber (aquele mercado pode ser a compra do
 * mês da família inteira).
 *
 * Toda comparação é contra VOCÊ MESMO — sua média, seu limite, seu mês
 * anterior. Nada de média nacional nem regra de bolso de terceiros.
 *
 * Nenhuma observação aparece sem número que a sustente, e nenhuma aparece
 * quando a base é pequena demais para significar algo (um mês só não tem
 * média).
 */

import { formatCentavos } from './money'

export type Tom = 'neutro' | 'atencao' | 'bom'

export type Observacao = {
  id: string
  texto: string
  tom: Tom
  /** Para onde ir se a pessoa quiser agir sobre isto. */
  para?: string
}

type Resumo = {
  total_entradas: number
  total_saidas: number
  saldo: number
  total_investido: number
}

type Categoria = {
  category_id: string | null
  nome: string
  gasto_centavos: number
  limite_centavos: number | null
}

type MesDoAno = { mes: number; entradas: number; saidas: number }

/**
 * Sempre pelo `formatCentavos` do app, nunca por um toLocaleString próprio: a
 * frase tem de mostrar o valor escrito exatamente igual ao card ao lado dela,
 * senão parecem dois números diferentes. (De quebra, evita divergir num
 * detalhe invisível — o separador do "R$" é um espaço NÃO-QUEBRÁVEL.)
 *
 * O módulo é absoluto porque o sinal já está dito por escrito ("saiu a mais").
 */
function reais(centavos: number): string {
  return formatCentavos(Math.abs(centavos))
}

function porcento(parte: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((parte / total) * 100)
}

export function observacoesDoMes({
  resumo,
  categorias,
  meses,
  mes,
  ano,
}: {
  resumo: Resumo
  categorias: Categoria[]
  /** Os 12 meses do ano, para comparar com a sua própria média. */
  meses: MesDoAno[]
  mes: number
  ano: number
}): Observacao[] {
  const obs: Array<Observacao & { peso: number }> = []
  const { total_entradas, total_saidas, saldo, total_investido } = resumo

  // Mês sem nada lançado não rende observação nenhuma — e dizer "você gastou
  // 0% a mais" num mês vazio seria ruído, não informação.
  if (total_entradas === 0 && total_saidas === 0) return []

  // ------------------------------------------------------------ o saldo
  if (saldo < 0) {
    obs.push({
      peso: 0,
      id: 'saldo-negativo',
      tom: 'atencao',
      texto: `Saiu ${reais(saldo)} a mais do que entrou neste mês.`,
      para: '/mes',
    })
  } else if (saldo > 0 && total_entradas > 0) {
    obs.push({
      peso: 40,
      id: 'saldo-positivo',
      tom: 'bom',
      texto: `Sobrou ${reais(saldo)} — ${porcento(saldo, total_entradas)}% do que entrou.`,
    })
  }

  // ------------------------------------------- sem categoria atrapalhando
  const semCategoria = categorias.find((c) => c.category_id === null)
  if (semCategoria && total_saidas > 0) {
    const pct = porcento(semCategoria.gasto_centavos, total_saidas)
    // Abaixo de 20% não vale ocupar espaço: um resto pequeno sem classificar
    // não impede ninguém de enxergar para onde o dinheiro foi.
    if (pct >= 20) {
      obs.push({
        peso: 10,
        id: 'sem-categoria',
        tom: 'atencao',
        texto: `${pct}% das suas saídas (${reais(semCategoria.gasto_centavos)}) estão sem categoria, então não dá para ver onde foram.`,
        para: '/mes',
      })
    }
  }

  // --------------------------------------------- limite que você definiu
  const estourada = categorias
    .filter((c) => c.limite_centavos && c.limite_centavos > 0 && c.gasto_centavos > c.limite_centavos)
    .sort((a, b) => b.gasto_centavos - a.gasto_centavos)[0]
  if (estourada) {
    obs.push({
      peso: 5,
      id: 'limite-estourado',
      tom: 'atencao',
      texto: `${estourada.nome} passou do limite que você definiu: ${reais(estourada.gasto_centavos)} de ${reais(estourada.limite_centavos!)}.`,
      para: '/mes',
    })
  }

  // -------------------------------------------------- a maior categoria
  const maior = categorias
    .filter((c) => c.category_id !== null && c.gasto_centavos > 0)
    .sort((a, b) => b.gasto_centavos - a.gasto_centavos)[0]
  if (maior && total_saidas > 0) {
    obs.push({
      peso: 30,
      id: 'maior-categoria',
      tom: 'neutro',
      texto: `${maior.nome} foi seu maior gasto: ${reais(maior.gasto_centavos)}, ${porcento(maior.gasto_centavos, total_saidas)}% das saídas.`,
    })
  }

  // ------------------------------------------ comparação com a sua média
  //
  // Só conta mês com movimento, e só a partir de três: com dois meses, "acima
  // da média" quer dizer apenas "maior que o outro", o que não é média nenhuma.
  const lancados = meses.filter((m) => m.mes !== mes && (m.entradas > 0 || m.saidas > 0))
  if (lancados.length >= 2 && total_saidas > 0) {
    const media = Math.round(lancados.reduce((s, m) => s + m.saidas, 0) / lancados.length)
    if (media > 0) {
      const diferenca = porcento(Math.abs(total_saidas - media), media)
      // Menos de 10% de diferença é oscilação normal, não notícia.
      if (diferenca >= 10) {
        const acima = total_saidas > media
        obs.push({
          peso: 20,
          id: 'contra-media',
          tom: acima ? 'atencao' : 'bom',
          texto: `Você gastou ${diferenca}% ${acima ? 'a mais' : 'a menos'} que a sua média dos outros ${lancados.length} meses de ${ano} (${reais(media)}).`,
          para: '/comparativo',
        })
      }
    }
  }

  // --------------------------------------------- meses fechados no negativo
  const comMovimento = meses.filter((m) => m.entradas > 0 || m.saidas > 0)
  const negativos = comMovimento.filter((m) => m.entradas - m.saidas < 0).length
  if (comMovimento.length >= 3 && negativos >= 2) {
    obs.push({
      peso: 25,
      id: 'meses-negativos',
      tom: 'atencao',
      texto: `${negativos} dos ${comMovimento.length} meses lançados de ${ano} fecharam no negativo.`,
      para: '/comparativo',
    })
  }

  // -------------------------------------------------------- o que guardou
  if (total_entradas > 0 && total_investido > 0) {
    obs.push({
      peso: 50,
      id: 'investido',
      tom: 'bom',
      texto: `Você guardou ${reais(total_investido)} — ${porcento(total_investido, total_entradas)}% do que entrou.`,
      para: '/metas',
    })
  }

  // No máximo quatro: isto é um relance no painel, não um relatório. As de
  // atenção vêm primeiro porque são as que pedem alguma decisão.
  return obs
    .sort((a, b) => a.peso - b.peso)
    .slice(0, 4)
    .map(({ peso: _peso, ...o }) => o)
}
