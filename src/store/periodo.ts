import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { periodoAtual, type Periodo } from '@/lib/dates'

interface EstadoPeriodo extends Periodo {
  anoComparativo: number
  definirPeriodo: (periodo: Periodo) => void
  definirAnoComparativo: (ano: number) => void
  irParaHoje: () => void
}

/** Ano/mês selecionados — compartilhados entre controle mensal, metas e comparativo. */
export const usePeriodoStore = create<EstadoPeriodo>()(
  persist(
    (set) => ({
      ...periodoAtual(),
      anoComparativo: periodoAtual().ano,
      definirPeriodo: ({ ano, mes }) => set({ ano, mes }),
      definirAnoComparativo: (anoComparativo) => set({ anoComparativo }),
      irParaHoje: () => set({ ...periodoAtual() }),
    }),
    { name: 'gdg-periodo' },
  ),
)
