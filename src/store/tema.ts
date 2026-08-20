import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TemaCor } from '@/lib/database.types'
import { atualizarPerfil } from '@/services/profiles'
import { useAuthStore } from './auth'

interface EstadoTema {
  tema: TemaCor
  escuro: boolean
  definirTema: (tema: TemaCor, salvarNoPerfil?: boolean) => void
  alternarEscuro: () => void
  aplicar: () => void
}

/**
 * Tema de cor + dark mode.
 * A cor vive em CSS variables (data-tema no <html>); dark mode é a classe `.dark`.
 * O valor persiste em localStorage e também no perfil do usuário no Supabase.
 */
export const useTemaStore = create<EstadoTema>()(
  persist(
    (set, get) => ({
      tema: 'rosa',
      escuro: false,

      definirTema: (tema, salvarNoPerfil = true) => {
        set({ tema })
        get().aplicar()
        if (salvarNoPerfil && useAuthStore.getState().user) {
          atualizarPerfil({ tema })
            .then((profile) => useAuthStore.getState().definirProfile(profile))
            .catch(() => {
              /* falha ao persistir não deve reverter a UI; recarrega no próximo login */
            })
        }
      },

      alternarEscuro: () => {
        set({ escuro: !get().escuro })
        get().aplicar()
      },

      aplicar: () => {
        const { tema, escuro } = get()
        const raiz = document.documentElement
        raiz.setAttribute('data-tema', tema)
        raiz.classList.toggle('dark', escuro)
        raiz.classList.toggle('light', !escuro)
      },
    }),
    { name: 'gdg-tema' },
  ),
)
