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
import { periodoAtual } from './dates'
import { ultimoDiaDoMes } from './fatura'
import { textoDoGastoAtipico, type GastoAtipico } from './gasto-atipico'

export type Tom = 'neutro' | 'atencao' | 'bom'

export type Observacao = {
  id: string
  /**
   * O número, separado da frase.
   *
   * Fica à parte para a tela poder mostrá-lo grande. Enfiado no meio do texto
   * ("Saiu R$ 18,94 a mais do que entrou"), o dado que importa tem o mesmo
   * peso visual das preposições ao redor e o olho não para nele.
   */
  destaque: string
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

/**
 * A ÚNICA observação deste arquivo que fala do futuro.
 *
 * No dia 18 a pergunta deixa de ser "quanto gastei" e vira "no meu ritmo,
 * fecho no azul?". A conta existe, mas ela tem uma armadilha que precisa estar
 * escrita: NEM TUDO SE PROJETA.
 *
 * Gasto fixo e fatura que vence no mês são valores CHEIOS, já conhecidos no
 * dia 1. Multiplicá-los pela média diária seria transformar um aluguel de
 * R$ 1.800 lançado no dia 5 em R$ 11.160 de projeção — um número
 * confiantemente errado, que é pior do que número nenhum. Só o gasto do dia a
 * dia (o que não vai para fatura futura) entra na régua de três; o resto entra
 * pelo valor que já tem.
 *
 * Parcela já lançada para um dia futuro deste mês entra inteira também: ela é
 * fato agendado, não previsão.
 *
 * Entrada não se projeta em hipótese nenhuma. Salário não pinga por dia, e
 * extrapolar receita é a forma mais rápida de prometer um mês que não existe.
 */
export interface EntradaDaProjecao {
  ano: number
  mes: number
  totalEntradas: number
  /** Soma dos gastos fixos vigentes no mês. Valor cheio, não se projeta. */
  fixosCentavos: number
  /** Soma das faturas que vencem no mês. Valor cheio, não se projeta. */
  faturasCentavos: number
  /**
   * Só os gastos que pesam NESTE mês pela data em que aconteceram — o que
   * `calcularCaixaDoMes` chama de `noMes`. Compra que foi para fatura futura
   * não entra aqui: ela vai sair noutro mês, e contá-la duas vezes (aqui e na
   * fatura daquele mês) é o defeito da família competência × caixa.
   */
  gastosDoDia: Array<{ data: string; valor_centavos: number }>
  hoje?: Date
}

export interface Projecao {
  diasDecorridos: number
  diasRestantes: number
  mediaDiaria: number
  saidasProjetadas: number
  saldoProjetado: number
}

/** Menos de um terço do mês não faz média — "dia 3 não tem média". */
export const MIN_DIAS_DECORRIDOS = 10

/** Nos últimos dias a "projeção" já é quase o fato, e não acrescenta nada. */
export const MIN_DIAS_RESTANTES = 3

/**
 * A projeção de fechamento, ou `null` quando não há base para ela.
 *
 * Cala em quatro casos, e cada um por um motivo: mês que não é o corrente
 * (projetar o passado é absurdo, projetar o futuro é chute), poucos dias
 * decorridos, poucos dias restantes, e nenhum gasto do dia a dia — sem
 * variável não há ritmo, só os valores cheios que já se conhecem.
 */
export function projecaoFimDoMes(p: EntradaDaProjecao): Projecao | null {
  const hoje = p.hoje ?? new Date()
  const atual = periodoAtual(hoje)
  if (p.ano !== atual.ano || p.mes !== atual.mes) return null

  const diasDoMes = ultimoDiaDoMes(p.ano, p.mes)
  const diasDecorridos = hoje.getDate()
  const diasRestantes = diasDoMes - diasDecorridos
  if (diasDecorridos < MIN_DIAS_DECORRIDOS) return null
  if (diasRestantes < MIN_DIAS_RESTANTES) return null

  let ateHoje = 0
  let agendadoNoMes = 0
  for (const g of p.gastosDoDia) {
    const dia = Number(g.data.slice(8, 10))
    if (dia <= diasDecorridos) ateHoje += g.valor_centavos
    else agendadoNoMes += g.valor_centavos
  }
  if (ateHoje <= 0) return null

  const mediaDiaria = Math.round(ateHoje / diasDecorridos)
  const saidasProjetadas =
    ateHoje + mediaDiaria * diasRestantes + agendadoNoMes + p.fixosCentavos + p.faturasCentavos

  return {
    diasDecorridos,
    diasRestantes,
    mediaDiaria,
    saidasProjetadas,
    saldoProjetado: p.totalEntradas - saidasProjetadas,
  }
}

export function observacoesDoMes({
  resumo,
  categorias,
  meses,
  mes,
  ano,
  projecao = null,
  gastoAtipico = null,
}: {
  resumo: Resumo
  categorias: Categoria[]
  /** Os 12 meses do ano, para comparar com a sua própria média. */
  meses: MesDoAno[]
  mes: number
  ano: number
  /** Já calculada pela tela, ou `null` quando não há base (ver projecaoFimDoMes). */
  projecao?: Projecao | null
  /** A compra mais atípica do mês, ou `null` (ver gastoMaisAtipico em gasto-atipico.ts). */
  gastoAtipico?: GastoAtipico | null
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
      destaque: reais(saldo),
      texto: 'saiu a mais do que entrou neste mês.',
      para: '/mes',
    })
  } else if (saldo > 0 && total_entradas > 0) {
    obs.push({
      peso: 40,
      id: 'saldo-positivo',
      tom: 'bom',
      destaque: reais(saldo),
      texto: `sobraram este mês — ${porcento(saldo, total_entradas)}% do que entrou.`,
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
        destaque: `${pct}%`,
        texto: `das suas saídas (${reais(semCategoria.gasto_centavos)}) estão sem categoria, então não dá para ver onde foram.`,
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
      destaque: estourada.nome,
      texto: `passou do limite que você definiu: ${reais(estourada.gasto_centavos)} de ${reais(estourada.limite_centavos!)}.`,
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
      destaque: maior.nome,
      texto: `foi seu maior gasto: ${reais(maior.gasto_centavos)}, ${porcento(maior.gasto_centavos, total_saidas)}% das saídas.`,
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
          destaque: `${diferenca}% ${acima ? 'a mais' : 'a menos'}`,
          texto: `que a sua média dos outros ${lancados.length} meses de ${ano} (${reais(media)}).`,
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
      destaque: `${negativos} de ${comMovimento.length}`,
      texto: `meses lançados de ${ano} fecharam no negativo.`,
      para: '/comparativo',
    })
  }

  // ------------------------------------------------ como o mês deve fechar
  //
  // Peso 2 quando fecha no vermelho: fica logo abaixo do saldo já negativo,
  // porque é a única frase da tela sobre algo que ainda dá para mudar.
  if (projecao) {
    const { saldoProjetado, diasDecorridos, diasRestantes } = projecao
    const restam = diasRestantes === 1 ? 'falta 1 dia' : `faltam ${diasRestantes} dias`
    obs.push(
      saldoProjetado < 0
        ? {
            peso: 2,
            id: 'projecao-fechamento',
            tom: 'atencao',
            destaque: reais(saldoProjetado),
            texto: `a mais do que entrou é o que o mês deve fechar, mantido o ritmo destes ${diasDecorridos} dias. É projeção, não fato — ${restam}.`,
            para: '/mes',
          }
        : {
            peso: 45,
            id: 'projecao-fechamento',
            tom: 'bom',
            destaque: reais(saldoProjetado),
            texto: `é o que deve sobrar no fim do mês, mantido o ritmo destes ${diasDecorridos} dias. É projeção, não fato — ${restam}.`,
            para: '/mes',
          },
    )
  }

  // ------------------------------------------------- compra fora do padrão
  //
  // Peso 15: mais chamativo que "sem categoria" (10 é engano de cadastro,
  // rotina), menos urgente que estar no vermelho ou ter estourado um limite
  // que a própria pessoa definiu.
  if (gastoAtipico) {
    const nomeCategoria = categorias.find((c) => c.category_id === gastoAtipico.categoriaId)?.nome
    // Categoria some da lista (excluída) entre a compra e a tela: sem nome
    // para mostrar, a frase não tem como ficar honesta.
    if (nomeCategoria) {
      obs.push({
        peso: 15,
        id: 'gasto-atipico',
        tom: 'atencao',
        destaque: reais(gastoAtipico.valorCentavos),
        texto: textoDoGastoAtipico(gastoAtipico, nomeCategoria),
        para: '/mes',
      })
    }
  }

  // -------------------------------------------------------- o que guardou
  if (total_entradas > 0 && total_investido > 0) {
    obs.push({
      peso: 50,
      id: 'investido',
      tom: 'bom',
      destaque: reais(total_investido),
      texto: `guardados — ${porcento(total_investido, total_entradas)}% do que entrou.`,
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
