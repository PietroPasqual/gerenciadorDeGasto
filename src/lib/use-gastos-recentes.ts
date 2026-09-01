import { useMemo } from 'react'
import { useConsulta } from './cache'
import { paraDataISO } from './dates'
import { listarGastosRecentes } from '@/services/transactions'

/** Doze meses para trás: menos que isso não distingue assinatura de temporada. */
export const MESES_DA_JANELA = 12

/**
 * A janela de leitura, ancorada em HOJE e não no mês aberto na tela.
 *
 * É de propósito: a chave do cache não pode depender do mês navegado, senão
 * passear por doze meses no desktop dispararia doze leituras de doze meses
 * cada. Ancorada em hoje, a leitura acontece uma vez por sessão.
 */
function janela(hoje = new Date()) {
  const fim = new Date(hoje)
  const inicio = new Date(hoje)
  inicio.setMonth(inicio.getMonth() - (MESES_DA_JANELA - 1))
  inicio.setDate(1)
  return { inicioISO: paraDataISO(inicio), fimISO: paraDataISO(fim) }
}

/**
 * Os últimos doze meses de gasto, compartilhados entre quem precisa de
 * histórico: a detecção de assinatura (6.2) e o alerta de gasto atípico (6.6)
 * fazem a MESMA pergunta ao banco. Uma chave de cache só faz a leitura
 * acontecer uma vez, mesmo com os dois hooks montados juntos na tela do mês.
 */
export function useGastosRecentes() {
  const { inicioISO, fimISO } = useMemo(() => janela(), [])
  return useConsulta(['gastos-recentes', inicioISO, fimISO], () => listarGastosRecentes(inicioISO, fimISO))
}
