import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Onde o dock fica encostado.
 *
 * Três posições e não arrastar livre. Arrastar exigiria guardar coordenadas,
 * e coordenada guardada num aparelho é lixo em outro — a pessoa deixa o dock
 * a 900px da esquerda no monitor, abre no celular de 390px e ele some da
 * tela. Encostado num lado, a posição continua válida em qualquer largura.
 *
 * Arrastar também custaria caro em teclado e leitor de tela: um alvo que se
 * move sob o ponteiro não tem equivalente por teclado que não seja... uma
 * lista de posições. Que é isto aqui.
 */
export type PosicaoDock = 'baixo' | 'esquerda' | 'direita'

interface EstadoDock {
  posicao: PosicaoDock
  definirPosicao: (posicao: PosicaoDock) => void
}

/**
 * Fica no localStorage, e NÃO no perfil do Supabase.
 *
 * É a única preferência do app que é do APARELHO e não da conta: "à esquerda"
 * é uma boa ideia num monitor deitado e uma péssima num celular, onde o
 * polegar não alcança o topo da lateral. Sincronizar isso pela conta faria a
 * escolha feita no desktop atravessar para o celular e piorar os dois.
 *
 * (O tema faz o contrário — vai para o perfil — porque gostar de escuro é da
 * pessoa, não do aparelho.)
 *
 * Abaixo de lg a posição é ignorada e o dock volta para baixo; ver o mapa de
 * classes em components/layout/dock.tsx. O valor continua guardado: quem
 * escolheu "esquerda" no desktop encontra o dock à esquerda ao voltar para
 * ele, mesmo tendo aberto o celular no meio.
 */
export const useDockStore = create<EstadoDock>()(
  persist(
    (set) => ({
      posicao: 'baixo',
      definirPosicao: (posicao) => set({ posicao }),
    }),
    { name: 'gdg-dock' },
  ),
)
