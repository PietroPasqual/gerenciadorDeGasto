import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Densidade = 'confortavel' | 'compacto'

interface EstadoDensidade {
  densidade: Densidade
  definirDensidade: (d: Densidade) => void
  aplicar: () => void
}

/**
 * Densidade das telas grandes (D3).
 *
 * Mesmo mecanismo do tema: um atributo no <html> troca um punhado de CSS
 * variables (--campo-altura, --linha-y, --card-padding) e os componentes
 * seguem, sem condicional espalhada por arquivo. Fica só no localStorage — não
 * é preferência de conta, é de máquina: a mesma pessoa quer compacto no
 * monitor grande e confortável no notebook.
 *
 * As variáveis só entram atrás de `md:` nos componentes, então no celular
 * nada encolhe e os alvos de 44px continuam de pé.
 */
export const useDensidadeStore = create<EstadoDensidade>()(
  persist(
    (set, get) => ({
      densidade: 'confortavel',

      definirDensidade: (densidade) => {
        set({ densidade })
        get().aplicar()
      },

      aplicar: () => {
        const raiz = document.documentElement
        if (get().densidade === 'compacto') raiz.setAttribute('data-densidade', 'compacto')
        else raiz.removeAttribute('data-densidade')
      },
    }),
    { name: 'finz-densidade' },
  ),
)
