import { formatCentavos } from './money'
import { nomeCurtoDoMes, periodoAtual, type Periodo } from './dates'

/**
 * A meta com prazo responde "quanto por mês para chegar lá?".
 *
 * A RÉGUA É A DO observacoes.ts, e vale repetir por que: cada frase daqui é
 * aritmética sobre os números da própria pessoa, conferível na tela ao lado.
 * Nenhuma diz o que ela deveria fazer. "Faltam R$ 4.200 em 7 meses — R$ 600
 * por mês" é uma divisão; "guarde R$ 600 por mês" seria um conselho sobre uma
 * vida que o app não conhece, e "você está atrasado" seria cobrança.
 *
 * A diferença entre as duas frases é uma palavra, e é toda a diferença.
 *
 * SILÊNCIO QUANDO A BASE É PEQUENA
 *
 * O ritmo só aparece com pelo menos três meses decorridos E algum valor
 * guardado. Em fevereiro, "no seu ritmo você chega em 2041" é uma extrapolação
 * de um mês — um número com cara de fato que não é fato nenhum.
 *
 * MÊS, NÃO DIA
 *
 * Aporte é mensal no modelo inteiro (goal_contributions tem ano e mes), então
 * toda conta aqui é em meses inteiros. Prometer precisão de dia seria inventar
 * uma exatidão que os dados não têm.
 */

/** Mínimo de meses decorridos para o ritmo significar alguma coisa. */
export const MESES_MINIMOS_DE_RITMO = 3

export interface PrazoDaMeta {
  prazo_ano: number | null
  prazo_mes: number | null
}

export interface ProjecaoMeta {
  /** Meses do mês corrente até o prazo, inclusive. Negativo quando já passou. */
  mesesRestantes: number
  faltaCentavos: number
  /** Quanto por mês para chegar no prazo. `null` quando o prazo já passou. */
  porMes: number | null
  /** Média mensal guardada no ano corrente. `null` quando a base é pequena. */
  ritmoMensal: number | null
  /** No ritmo atual, chega até o prazo? `null` quando não há ritmo para dizer. */
  chegaNoPrazo: boolean | null
  /** No ritmo atual, o mês em que a meta fecha. `null` sem ritmo, ou já fechada. */
  chegaEm: Periodo | null
  concluida: boolean
  prazoVencido: boolean
}

/**
 * O prazo existe? Os dois campos andam juntos (ver 0019).
 *
 * `== null` FROUXO, pegando null E undefined — a mesma decisão, pelo mesmo
 * motivo, do `estaVigente` da 0005: enquanto a 0019 não tiver rodado no
 * Supabase, as linhas de `goals` voltam SEM estas colunas. Com `=== null`,
 * `undefined` passa pelo teste como se fosse prazo, e a tela mostra
 * "Até /defined" em toda meta. Foi exatamente o que aconteceu, e o E2E pegou.
 */
export function temPrazo(meta: PrazoDaMeta): boolean {
  return meta.prazo_ano != null && meta.prazo_mes != null
}

function paraIndice({ ano, mes }: Periodo): number {
  return ano * 12 + mes
}

function paraPeriodo(indice: number): Periodo {
  return { ano: Math.floor((indice - 1) / 12), mes: ((indice - 1) % 12) + 1 }
}

/**
 * A média mensal guardada no ano, contando os meses SEM aporte.
 *
 * Contar só os meses em que houve aporte inflaria o ritmo: quem guardou uma vez
 * em março veria "seu ritmo é R$ 500/mês" depois de oito meses sem guardar
 * nada. O mês vazio é parte do ritmo, e é justamente o que o número precisa
 * dizer.
 */
export function ritmoMensal(aportesDoAno: number[], mesAtual: number): number | null {
  const decorridos = Math.min(Math.max(mesAtual, 0), 12)
  if (decorridos < MESES_MINIMOS_DE_RITMO) return null
  const soma = aportesDoAno.slice(0, decorridos).reduce((s, v) => s + v, 0)
  if (soma <= 0) return null
  return Math.round(soma / decorridos)
}

/**
 * A projeção da meta. `null` quando ela não tem prazo — e meta sem prazo é o
 * comportamento de antes da 0019, intocado (regra 8).
 */
export function projecaoDaMeta(params: {
  meta: PrazoDaMeta & { valor_meta_centavos: number }
  guardadoTotal: number
  /** Valores guardados no ano `anoDosAportes`, do índice 0 (jan) ao 11 (dez). */
  aportesDoAno: number[]
  /**
   * De que ano são esses aportes.
   *
   * A tela de metas tem seletor de ano, então ela pode estar mostrando 2024
   * enquanto o relógio diz 2026. Sem este campo, os aportes de um ano antigo
   * virariam "o seu ritmo atual" — um número errado com cara de fato.
   */
  anoDosAportes: number
  hoje?: Date
}): ProjecaoMeta | null {
  const { meta, guardadoTotal, aportesDoAno, anoDosAportes } = params
  if (!temPrazo(meta)) return null

  const atual = periodoAtual(params.hoje ?? new Date())
  const prazo = { ano: meta.prazo_ano as number, mes: meta.prazo_mes as number }
  const mesesRestantes = paraIndice(prazo) - paraIndice(atual) + 1
  const falta = Math.max(0, meta.valor_meta_centavos - guardadoTotal)
  const concluida = falta === 0

  // Só o ano corrente descreve o ritmo atual (ver anoDosAportes).
  const ritmo = anoDosAportes === atual.ano ? ritmoMensal(aportesDoAno, atual.mes) : null

  let chegaEm: Periodo | null = null
  if (!concluida && ritmo !== null && ritmo > 0) {
    chegaEm = paraPeriodo(paraIndice(atual) + Math.ceil(falta / ritmo) - 1)
  }

  return {
    mesesRestantes,
    faltaCentavos: falta,
    porMes: mesesRestantes > 0 && !concluida ? Math.ceil(falta / mesesRestantes) : null,
    ritmoMensal: ritmo,
    chegaNoPrazo: concluida
      ? true
      : ritmo === null
        ? null
        : chegaEm !== null && paraIndice(chegaEm) <= paraIndice(prazo),
    chegaEm,
    concluida,
    prazoVencido: mesesRestantes <= 0,
  }
}

export interface PrevisaoDeConclusao {
  faltaCentavos: number
  /** Média mensal do ano corrente. `null` quando a base é pequena demais. */
  ritmoMensal: number | null
  /** No ritmo atual, o mês em que a meta fecha. `null` sem ritmo. */
  chegaEm: Periodo | null
}

/**
 * A previsão de uma meta SEM prazo.
 *
 * A 0019 deixou a meta sem prazo intocada de propósito: nada de projeção,
 * exatamente como antes dela. Mas a fase 6 pede projeção de conclusão "apenas
 * quando houver base suficiente", e a base é a mesma que o ritmo já usa. Uma
 * meta sem prazo com seis meses de aporte tem uma resposta honesta para "e
 * quando eu chego lá?", e calar era desperdiçar um número que já existia.
 *
 * O que NÃO muda: sem base, continua o silêncio. E isto não é `projecaoDaMeta`
 * com um `if` a mais — aquela responde "dá para chegar no prazo?", que é outra
 * pergunta e só existe com prazo.
 *
 * `null` quando a meta tem prazo (o outro caminho responde), quando ela já foi
 * alcançada, ou quando não há alvo para alcançar.
 */
export function previsaoDeConclusao(params: {
  meta: PrazoDaMeta & { valor_meta_centavos: number }
  guardadoTotal: number
  aportesDoAno: number[]
  anoDosAportes: number
  hoje?: Date
}): PrevisaoDeConclusao | null {
  const { meta, guardadoTotal, aportesDoAno, anoDosAportes } = params
  if (temPrazo(meta)) return null
  if (meta.valor_meta_centavos <= 0) return null

  const falta = meta.valor_meta_centavos - guardadoTotal
  if (falta <= 0) return null

  const atual = periodoAtual(params.hoje ?? new Date())
  // Só o ano corrente descreve o ritmo atual — mesmo motivo do `anoDosAportes`
  // em `projecaoDaMeta`: a tela tem seletor de ano.
  const ritmo = anoDosAportes === atual.ano ? ritmoMensal(aportesDoAno, atual.mes) : null

  return {
    faltaCentavos: falta,
    ritmoMensal: ritmo,
    chegaEm:
      ritmo !== null && ritmo > 0 ? paraPeriodo(paraIndice(atual) + Math.ceil(falta / ritmo) - 1) : null,
  }
}

function mesAno({ ano, mes }: Periodo): string {
  return `${nomeCurtoDoMes(mes).toLowerCase()}/${String(ano).slice(2)}`
}

/**
 * As duas frases da tela, separadas porque só a primeira é aritmética pura.
 *
 * A segunda é extrapolação e precisa dizer isso na própria frase ("no ritmo
 * deste ano") — quem lê tem de conseguir distinguir a divisão do palpite sem
 * saber como o app foi feito.
 */
export function textoDoPrazo(p: ProjecaoMeta, prazo: Periodo): string {
  if (p.concluida) return `Meta alcançada. O prazo era ${mesAno(prazo)}.`
  if (p.prazoVencido) return `O prazo era ${mesAno(prazo)}. Faltam ${formatCentavos(p.faltaCentavos)}.`
  const meses = p.mesesRestantes === 1 ? 'neste mês' : `em ${p.mesesRestantes} meses`
  return `Faltam ${formatCentavos(p.faltaCentavos)} ${meses} — ${formatCentavos(p.porMes as number)} por mês.`
}

/** A frase do ritmo, escrita num lugar só para as duas telas não divergirem. */
function fraseDoRitmo(ritmo: number, chegaEm: Periodo): string {
  return `No ritmo deste ano (${formatCentavos(ritmo)} por mês), chega em ${mesAno(chegaEm)}.`
}

/** `null` quando não há base: silêncio é melhor que um número inventado. */
export function textoDoRitmo(p: ProjecaoMeta): string | null {
  if (p.concluida || p.ritmoMensal === null || p.chegaEm === null) return null
  return fraseDoRitmo(p.ritmoMensal, p.chegaEm)
}

/**
 * A frase da meta sem prazo: quanto falta, e — só com base — quando chega.
 *
 * "Faltam R$ 3.000,00" é subtração e aparece sempre. A segunda metade é
 * extrapolação, diz isso na própria frase, e some quando não há de onde
 * extrapolar.
 */
export function textoDaPrevisao(p: PrevisaoDeConclusao): string {
  const falta = `Faltam ${formatCentavos(p.faltaCentavos)} para a meta.`
  if (p.ritmoMensal === null || p.chegaEm === null) return falta
  return `${falta} ${fraseDoRitmo(p.ritmoMensal, p.chegaEm)}`
}
