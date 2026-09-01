import { diaNoMes, vencimentoAdiado, vencimentoDaFatura } from './fatura'
import { estaVigente } from './calculations'
import { paraDataISO, periodoAtual, type Periodo } from './dates'

/**
 * Lembretes de vencimento.
 *
 * `dia_vencimento` do gasto fixo existe desde a 0001 e nunca avisou ninguém; a
 * fatura ganhou vencimento na 0009 e também não. O app sabia exatamente o que
 * vencia quando, e guardava para si.
 *
 * Tudo aqui é função pura sobre a data de hoje: nada agenda, nada dispara. É o
 * que torna o lembrete testável e imune a fuso — quem calcula é o navegador da
 * pessoa, em horário local.
 */

export interface PreferenciasLembrete {
  fatura_fechando: boolean
  fatura_vencendo: boolean
  fixo_vencendo: boolean
  /** Quantos dias antes o aviso começa a aparecer. */
  dias_antes: number
}

export const PREFERENCIAS_PADRAO: PreferenciasLembrete = {
  fatura_fechando: true,
  fatura_vencendo: true,
  fixo_vencendo: true,
  dias_antes: 3,
}

/** Lê as preferências do perfil com tolerância a campo faltando ou inválido. */
export function lerPreferencias(bruto: unknown): PreferenciasLembrete {
  if (typeof bruto !== 'object' || bruto === null) return PREFERENCIAS_PADRAO
  const p = bruto as Record<string, unknown>
  const bool = (chave: keyof PreferenciasLembrete) =>
    typeof p[chave] === 'boolean' ? (p[chave] as boolean) : PREFERENCIAS_PADRAO[chave] === true
  const dias = Number(p.dias_antes)
  return {
    fatura_fechando: bool('fatura_fechando'),
    fatura_vencendo: bool('fatura_vencendo'),
    fixo_vencendo: bool('fixo_vencendo'),
    // Valor fora da faixa vira o padrão, e não zero: zero desligaria o aviso
    // em silêncio, que é o oposto do que alguém quis ao digitar errado.
    dias_antes:
      Number.isFinite(dias) && dias >= 0 && dias <= 15 ? Math.trunc(dias) : PREFERENCIAS_PADRAO.dias_antes,
  }
}

export type TipoLembrete = 'fatura-fechando' | 'fatura-vencendo' | 'fixo-vencendo'

export interface Lembrete {
  id: string
  tipo: TipoLembrete
  /** O que vence. */
  titulo: string
  /** "vence hoje" · "vence em 3 dias" · "venceu há 2 dias" */
  quando: string
  /** Negativo = já passou. Zero = hoje. */
  diasRestantes: number
  /** Atrasado só existe para o que tinha data e passou sem ser marcado. */
  atrasado: boolean
  valorCentavos: number | null
  /** Para onde a tela leva ao tocar. */
  para: string
}

/** Dias inteiros entre duas datas ISO, positivo quando a segunda é no futuro. */
export function diasEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO.slice(0, 10)}T12:00:00`)
  const ate = new Date(`${ateISO.slice(0, 10)}T12:00:00`)
  return Math.round((ate.getTime() - de.getTime()) / 86_400_000)
}

/** "hoje" · "em 3 dias" · "há 2 dias" — a frase que a tela mostra. */
export function textoQuando(dias: number): string {
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  return dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`
}

interface FaturaParaLembrete {
  payment_method_id: string
  nome: string
  dia_fechamento: number
  dia_vencimento: number | null
  total_centavos: number
  paga: boolean
}

interface FixoParaLembrete {
  id: string
  nome: string
  valor_centavos: number
  dia_vencimento: number | null
  ativo: boolean
  inicio_ano: number | null
  inicio_mes: number | null
  fim_ano: number | null
  fim_mes: number | null
}

/**
 * Os lembretes do mês aberto, já filtrados pelas preferências.
 *
 * Só olha o mês que está na tela: um aviso sobre outubro enquanto a pessoa
 * confere agosto é ruído, não ajuda.
 *
 * Fatura já paga e fixo já marcado como pago somem — avisar sobre o que a
 * pessoa acabou de resolver é a forma mais rápida de fazer alguém desligar
 * todos os avisos.
 */
export function lembretesDoMes(params: {
  periodo: Periodo
  faturas: FaturaParaLembrete[]
  fixos: FixoParaLembrete[]
  /** Ids dos gastos fixos já marcados como pagos neste mês. */
  fixosPagos: Set<string>
  preferencias: PreferenciasLembrete
  hoje?: Date
}): Lembrete[] {
  const { periodo, faturas, fixos, fixosPagos, preferencias } = params
  const hoje = params.hoje ?? new Date()
  const hojeISO = paraDataISO(hoje)
  const atual = periodoAtual(hoje)

  // Mês passado ou futuro não gera lembrete: no passado não há o que lembrar, e
  // no futuro o aviso apareceria meses antes, virando paisagem.
  if (periodo.ano !== atual.ano || periodo.mes !== atual.mes) return []

  const dentroDaJanela = (dias: number) => dias <= preferencias.dias_antes
  const saida: Lembrete[] = []

  for (const f of faturas) {
    if (f.paga) continue

    if (preferencias.fatura_fechando) {
      const diaFecha = diaNoMes(periodo.ano, periodo.mes, f.dia_fechamento)
      const fechaISO = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-${String(diaFecha).padStart(2, '0')}`
      const dias = diasEntre(hojeISO, fechaISO)
      // Fechamento só interessa ANTES de acontecer: depois, o que importa é o
      // vencimento, e dois avisos sobre a mesma fatura viram ruído.
      if (dias >= 0 && dentroDaJanela(dias)) {
        saida.push({
          id: `fecha:${f.payment_method_id}`,
          tipo: 'fatura-fechando',
          titulo: `Fatura do ${f.nome} fecha`,
          quando: textoQuando(dias),
          diasRestantes: dias,
          atrasado: false,
          valorCentavos: f.total_centavos,
          para: '/mes?aba=resumo',
        })
      }
    }

    if (preferencias.fatura_vencendo && f.dia_vencimento !== null) {
      const venceISO = vencimentoDaFatura(periodo, f.dia_vencimento)
      const dias = diasEntre(hojeISO, venceISO)
      // Atrasada aparece sempre, mesmo fora da janela: dívida vencida não é
      // lembrete que caduca.
      if (dias < 0 || dentroDaJanela(dias)) {
        saida.push({
          id: `vence:${f.payment_method_id}`,
          tipo: 'fatura-vencendo',
          titulo: `Fatura do ${f.nome} ${dias < 0 ? 'venceu' : 'vence'}`,
          quando: textoQuando(dias),
          diasRestantes: dias,
          atrasado: dias < 0,
          valorCentavos: f.total_centavos,
          para: '/mes?aba=resumo',
        })
      }
    }
  }

  if (preferencias.fixo_vencendo) {
    for (const g of fixos) {
      if (!g.ativo || g.dia_vencimento === null) continue
      if (!estaVigente(g, periodo.ano, periodo.mes)) continue
      if (fixosPagos.has(g.id)) continue

      const dia = diaNoMes(periodo.ano, periodo.mes, g.dia_vencimento)
      const venceISO = `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const dias = diasEntre(hojeISO, venceISO)
      if (dias < 0 || dentroDaJanela(dias)) {
        saida.push({
          id: `fixo:${g.id}`,
          tipo: 'fixo-vencendo',
          titulo: `${g.nome} ${dias < 0 ? 'venceu' : 'vence'}`,
          quando: textoQuando(dias),
          diasRestantes: dias,
          atrasado: dias < 0,
          valorCentavos: g.valor_centavos,
          para: '/mes?aba=fixos',
        })
      }
    }
  }

  // O que já venceu primeiro, depois o que vence antes. Dentro do mesmo dia, o
  // de maior valor: se a pessoa só for resolver um, que seja o que pesa mais.
  return saida.sort(
    (a, b) => a.diasRestantes - b.diasRestantes || (b.valorCentavos ?? 0) - (a.valorCentavos ?? 0),
  )
}

/** O vencimento foi empurrado do fim de semana? A tela avisa junto. */
export function faturaAdiada(periodo: Periodo, diaVencimento: number | null): boolean {
  return diaVencimento !== null && vencimentoAdiado(periodo, diaVencimento)
}
