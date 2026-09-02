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
 * Cor da barra do sistema (a do topo no Android/Chrome, a de trás no iOS
 * instalado) igual ao fundo do app.
 *
 * O <meta> do index.html só consegue reagir ao prefers-color-scheme, e aqui o
 * tema é escolhido dentro do app: quem estava no escuro com o sistema no claro
 * via uma faixa branca em cima de uma tela preta. Lemos o --background já
 * aplicado em vez de manter uma tabela de cores em duplicata — assim mexer no
 * themes.css basta.
 */
function pintarBarraDoNavegador(raiz: HTMLElement) {
  const meta = document.querySelector<HTMLMetaElement>('meta#theme-color')
  if (!meta) return
  const fundo = getComputedStyle(raiz).getPropertyValue('--background').trim()
  // "40 40% 99%" -> "hsl(40 40% 99%)". Vazio (teste em jsdom) fica como está.
  if (fundo) meta.content = `hsl(${fundo})`
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
      /**
       * Escuro é o padrão do app.
       *
       * Isto vale só para quem ainda não escolheu: o `persist` abaixo hidrata
       * antes, então quem já usava o claro continua no claro sem perceber
       * nada — o padrão é o que preenche a ausência, não o que sobrescreve a
       * escolha. Conta nova, aparelho novo e navegador com o storage limpo é
       * que abrem no escuro.
       *
       * O claro NÃO virou versão secundária por isso: os dois seguem
       * calibrados no themes.css, com as mesmas contas de contraste, e o e2e
       * de acessibilidade continua medindo os quatro temas nos dois modos.
       * O que mudou foi qual deles atende a quem não pediu nada.
       *
       * O index.html sabe deste padrão e o repete no <html class="dark">, para
       * o primeiro quadro já sair na cor certa. Mudou aqui, mude lá.
       */
      escuro: true,

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
        pintarBarraDoNavegador(raiz)
      },
    }),
    { name: 'gdg-tema' },
  ),
)
