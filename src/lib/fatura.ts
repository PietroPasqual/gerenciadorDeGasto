import type { Periodo } from './dates'

/**
 * Fatura de cartão de crédito.
 *
 * O ponto inteiro deste arquivo: um gasto no crédito acontece num mês e sai do
 * bolso em outro. Quem separa os dois é o dia de fechamento do cartão — e essa
 * separação é DERIVADA da data do gasto, nunca guardada à mão. Guardar seria
 * criar uma segunda verdade que envelhece: mudar o fechamento do cartão
 * deixaria o histórico inteiro mentindo.
 *
 * Duas palavras que aparecem o tempo todo aqui:
 * - competência: o mês em que a compra aconteceu. É o que a análise por
 *   categoria usa, porque a pergunta ali é "onde meu dinheiro foi".
 * - caixa: o mês em que a fatura vence. É o que o saldo usa, porque a pergunta
 *   ali é "quanto sai da minha conta".
 */

/** Último dia do mês — fevereiro é o motivo de isto existir. */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/**
 * Encaixa um dia configurado (1–31) num mês que pode não tê-lo.
 *
 * Fechamento no dia 31 em fevereiro vira dia 28 — e não dia 3 de março, que é o
 * que aconteceria deixando o Date rolar sozinho. Emissor faz assim: o ciclo
 * fecha no último dia, não invade o mês seguinte.
 */
export function diaNoMes(ano: number, mes: number, dia: number): number {
  return Math.min(dia, ultimoDiaDoMes(ano, mes))
}

function proximoMes({ ano, mes }: Periodo): Periodo {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }
}

/**
 * Em qual fatura cai uma compra.
 *
 * A regra do emissor: compra feita ATÉ o dia do fechamento entra na fatura que
 * vence no mês seguinte; compra feita DEPOIS do fechamento já é do ciclo
 * seguinte, e vence um mês depois disso.
 *
 * O dia do fechamento pertence à fatura que fecha — comprar no próprio dia do
 * fechamento ainda entra nela. É a convenção da maioria dos emissores, e é a
 * que deixa o app errar para o lado seguro: antecipar o gasto em vez de
 * atrasá-lo.
 */
export function faturaDaCompra(dataISO: string, diaFechamento: number): Periodo {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-').map(Number)
  const fechamento = diaNoMes(ano, mes, diaFechamento)
  // Fatura que vence no mês seguinte ao ciclo que acabou de fechar.
  const base = dia <= fechamento ? { ano, mes } : proximoMes({ ano, mes })
  return proximoMes(base)
}

/** O intervalo de compras que uma fatura cobre, em ISO — bordas inclusivas. */
export function periodoDaFatura(
  { ano, mes }: Periodo,
  diaFechamento: number,
): { inicioISO: string; fimISO: string } {
  // A fatura de um mês fecha no mês anterior; o ciclo começa no dia seguinte
  // ao fechamento do mês retrasado.
  const fim = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  const inicio = fim.mes === 1 ? { ano: fim.ano - 1, mes: 12 } : { ano: fim.ano, mes: fim.mes - 1 }

  const diaFim = diaNoMes(fim.ano, fim.mes, diaFechamento)
  const diaInicio = diaNoMes(inicio.ano, inicio.mes, diaFechamento)

  const iso = (p: Periodo, d: number) =>
    `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // O dia seguinte ao fechamento anterior. Se o fechamento caiu no último dia
  // do mês, o ciclo começa no dia 1 do mês seguinte.
  const comecouNoUltimo = diaInicio === ultimoDiaDoMes(inicio.ano, inicio.mes)
  const inicioISO = comecouNoUltimo ? iso(fim, 1) : iso(inicio, diaInicio + 1)

  return { inicioISO, fimISO: iso(fim, diaFim) }
}

/**
 * Quando a fatura vence de fato.
 *
 * Vencimento em sábado ou domingo empurra para a segunda: é o que o emissor
 * aceita, sem encargo. Feriado não entra na conta — exigiria um calendário que
 * o app não tem, e chutar erraria mais do que acertaria. A tela diz isso em vez
 * de fingir que sabe.
 *
 * Isto muda só a data mostrada e a noção de atraso. Em qual fatura a compra
 * cai quem decide é o fechamento, não o vencimento.
 */
export function vencimentoDaFatura({ ano, mes }: Periodo, diaVencimento: number): string {
  const dia = diaNoMes(ano, mes, diaVencimento)
  const data = new Date(ano, mes - 1, dia)
  const semana = data.getDay()
  if (semana === 6) data.setDate(data.getDate() + 2) // sábado -> segunda
  if (semana === 0) data.setDate(data.getDate() + 1) // domingo -> segunda
  const a = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/** O vencimento foi empurrado por cair no fim de semana? A tela avisa. */
export function vencimentoAdiado({ ano, mes }: Periodo, diaVencimento: number): boolean {
  const semana = new Date(ano, mes - 1, diaNoMes(ano, mes, diaVencimento)).getDay()
  return semana === 0 || semana === 6
}

/**
 * A regra de fatura vale para uma compra desta data?
 *
 * Mesmo modelo de vigência da 0005: `null` significa "nunca", e é o padrão de
 * todo cartão que já existe. Sem isto, adicionar o dia de fechamento a um
 * cartão reescreveria de uma vez o mês de todo gasto de crédito do histórico —
 * exatamente o que a regra 8 proíbe.
 */
export function faturaVigente(dataISO: string, inicioAno: number | null, inicioMes: number | null): boolean {
  if (inicioAno === null || inicioMes === null) return false
  const [ano, mes] = dataISO.slice(0, 10).split('-').map(Number)
  return ano * 12 + mes >= inicioAno * 12 + inicioMes
}
