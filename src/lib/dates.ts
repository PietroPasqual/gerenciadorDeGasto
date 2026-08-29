/**
 * Datas: o banco guarda em UTC (`date` / `timestamptz`).
 * A exibição usa o fuso do navegador do usuário.
 */

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

/** 1-12 -> "Janeiro" */
export function nomeDoMes(mes: number): string {
  return MESES[mes - 1] ?? ''
}

export function nomeCurtoDoMes(mes: number): string {
  return MESES_CURTOS[mes - 1] ?? ''
}

export interface Periodo {
  ano: number
  mes: number
}

export function periodoAtual(): Periodo {
  const agora = new Date()
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }
}

export function ehFuturo({ ano, mes }: Periodo, referencia = periodoAtual()): boolean {
  return ano > referencia.ano || (ano === referencia.ano && mes > referencia.mes)
}

/** "2026-08-20" (formato aceito pela coluna `date` do Postgres) */
export function paraDataISO(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Primeiro dia do período, em ISO — usado como default ao criar lançamento. */
export function primeiroDiaISO({ ano, mes }: Periodo): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

export function ultimoDiaISO({ ano, mes }: Periodo): string {
  const ultimo = new Date(ano, mes, 0).getDate()
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

/** "2026-08-20" -> "20/08/2026" (sem deslocar o dia por fuso) */
export function formatDataISO(iso: string | null | undefined): string {
  if (!iso) return ''
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

/** timestamptz do banco -> data/hora no fuso do usuário */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Lista de anos para os seletores (5 anos atrás até 2 à frente). */
export function anosDisponiveis(referencia = new Date().getFullYear()): number[] {
  const anos: number[] = []
  for (let a = referencia - 5; a <= referencia + 2; a++) anos.push(a)
  return anos
}
