import { supabase } from '@/lib/supabase'
import type {
  ComparativoAnualMes,
  GastoCategoria,
  InvestimentoMeta,
  ResumoMensal,
  ResumoMeta,
  SaidaFormaPagamento,
} from '@/lib/database.types'
import { unwrap } from './base'

/** Agregados calculados no banco (funções SQL) — nada de somar linha a linha aqui. */

export async function obterResumoMensal(ano: number, mes: number): Promise<ResumoMensal> {
  const linhas = unwrap(await supabase.rpc('resumo_mensal', { p_ano: ano, p_mes: mes })) ?? []
  return (
    linhas[0] ?? {
      total_entradas: 0,
      total_saidas: 0,
      saldo: 0,
      total_investido: 0,
      percentual_investido: 0,
    }
  )
}

export async function obterGastosPorCategoria(ano: number, mes: number): Promise<GastoCategoria[]> {
  return unwrap(await supabase.rpc('gastos_por_categoria', { p_ano: ano, p_mes: mes })) ?? []
}

export async function obterSaidasPorFormaPagamento(ano: number, mes: number): Promise<SaidaFormaPagamento[]> {
  return unwrap(await supabase.rpc('saidas_por_forma_pagamento', { p_ano: ano, p_mes: mes })) ?? []
}

export async function obterInvestimentosPorMeta(ano: number, mes: number): Promise<InvestimentoMeta[]> {
  return unwrap(await supabase.rpc('investimentos_por_meta', { p_ano: ano, p_mes: mes })) ?? []
}

export async function obterComparativoAnual(ano: number): Promise<ComparativoAnualMes[]> {
  return unwrap(await supabase.rpc('comparativo_anual', { p_ano: ano })) ?? []
}

export async function obterResumoMetas(ano: number): Promise<ResumoMeta[]> {
  return unwrap(await supabase.rpc('resumo_metas', { p_ano: ano })) ?? []
}
