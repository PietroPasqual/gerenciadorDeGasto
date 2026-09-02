import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/database.types'
import { atualizarPerfil } from '@/services/profiles'
import { useAuthStore } from '@/store/auth'
import { CAPA_PADRAO, capaValida, mover, ordemParaSalvar, widgetsVisiveis, type Capa } from '@/lib/painel'

/**
 * O painel da pessoa: o que aparece, em que ordem, e com qual capa.
 *
 * MORA NO PERFIL, E NÃO NO localStorage
 *
 * É o contrário da posição do dock (store/dock.ts), e a diferença não é
 * gosto. A posição do dock é do APARELHO: "à esquerda" faz sentido num
 * monitor deitado e não faz nenhum num celular. Já "quero ver o saldo antes
 * do donut" é da PESSOA — ela quer isso no telefone de manhã e no computador
 * à noite. Guardar no aparelho obrigaria a remontar o painel em cada um, e a
 * remontar de novo a cada navegador novo.
 *
 * O custo é que personalizar exige estar logado e online. O painel só existe
 * atrás de rota protegida, então a primeira parte é de graça; a segunda é o
 * que o update otimista abaixo trata.
 */
export function usePainel(conhecidos: readonly string[]) {
  const perfil = useAuthStore((e) => e.profile)
  const definirProfile = useAuthStore((e) => e.definirProfile)
  const [editando, setEditando] = useState(false)

  const ordem = useMemo(() => perfil?.painel_ordem ?? [], [perfil?.painel_ordem])
  const ocultos = useMemo(() => perfil?.painel_ocultos ?? [], [perfil?.painel_ocultos])
  const capa = capaValida(perfil?.painel_capa)

  const visiveis = useMemo(
    () => widgetsVisiveis({ conhecidos, ordem, ocultos }),
    [conhecidos, ordem, ocultos],
  )

  /**
   * Grava no perfil aplicando a mudança na tela primeiro.
   *
   * Mesma forma do `executarOtimista` do resto do app, escrita à mão aqui por
   * um motivo: aquele opera sobre o cache de LEITURA por chave, e o perfil não
   * vive nele — vive no store de auth, que a sessão inteira lê. Reaproveitá-lo
   * exigiria ensiná-lo a mexer num store, o que é mais acoplamento do que as
   * seis linhas que ele economizaria.
   *
   * Sem otimismo, cada clique numa seta esperaria a ida e volta ao Supabase
   * para o card se mexer, e reordenar quatro widgets viraria uma sequência de
   * esperas. Com ele, a tela responde na hora e o erro — que é raro — devolve
   * o painel ao que era e diz o que houve.
   */
  const gravar = useCallback(
    (mudancas: Partial<Pick<Profile, 'painel_ordem' | 'painel_ocultos' | 'painel_capa'>>) => {
      const anterior = useAuthStore.getState().profile
      if (!anterior) return

      definirProfile({ ...anterior, ...mudancas })
      atualizarPerfil(mudancas)
        // MESCLA a resposta sobre o perfil atual, em vez de trocá-lo por ela.
        // Em produção `atualizarPerfil` devolve a linha inteira e os dois dão
        // no mesmo. A diferença aparece quando a resposta vem parcial — um
        // `select` que deixou de trazer uma coluna, um dublê de teste —, e aí
        // substituir apagaria do estado campos que o servidor nem tocou,
        // inclusive a mudança que acabou de ser aplicada aqui.
        .then((doServidor) => {
          const atual = useAuthStore.getState().profile
          if (atual) definirProfile({ ...atual, ...doServidor })
        })
        .catch(() => {
          // Restaura o perfil INTEIRO de antes, e não só os campos do painel:
          // se outra tela gravou nesse meio-tempo, ela já chamou
          // definirProfile e este catch perderia a gravação dela ao mesclar
          // campo a campo.
          definirProfile(anterior)
          toast.error('Não foi possível salvar o painel. O layout voltou ao que era.')
        })
    },
    [definirProfile],
  )

  /** Sobe ou desce um widget uma casa, entre os que estão à vista. */
  const moverWidget = useCallback(
    (id: string, direcao: -1 | 1) => {
      const nova = mover(visiveis, id, direcao)
      // Identidade: nos extremos `mover` devolve a mesma lista, e gravar aí
      // seria uma escrita no Supabase por um clique que não mudou nada.
      if (nova === visiveis) return
      gravar({ painel_ordem: ordemParaSalvar({ visiveis: nova, ordemAntiga: ordem, ocultos }) })
    },
    [visiveis, ordem, ocultos, gravar],
  )

  const esconder = useCallback(
    (id: string) => {
      if (ocultos.includes(id)) return
      // A ordem é gravada JUNTO, e a partir da lista de antes de esconder:
      // assim o widget guarda a âncora de onde saiu e volta para o mesmo
      // lugar se a pessoa se arrepender.
      gravar({
        painel_ocultos: [...ocultos, id],
        painel_ordem: ordemParaSalvar({ visiveis, ordemAntiga: ordem, ocultos }),
      })
    },
    [ocultos, visiveis, ordem, gravar],
  )

  const mostrar = useCallback(
    (id: string) => gravar({ painel_ocultos: ocultos.filter((o) => o !== id) }),
    [ocultos, gravar],
  )

  const definirCapa = useCallback(
    (nova: Capa) => {
      if (nova === capa) return
      gravar({ painel_capa: nova })
    },
    [capa, gravar],
  )

  /** Devolve o painel ao desenho de fábrica, sem tocar em dado nenhum. */
  const restaurar = useCallback(
    () => gravar({ painel_ordem: [], painel_ocultos: [], painel_capa: CAPA_PADRAO }),
    [gravar],
  )

  return {
    capa,
    visiveis,
    /** Só os que o app conhece: id órfão no perfil não vira botão fantasma. */
    escondidos: useMemo(() => conhecidos.filter((id) => ocultos.includes(id)), [conhecidos, ocultos]),
    editando,
    setEditando,
    moverWidget,
    esconder,
    mostrar,
    definirCapa,
    restaurar,
  }
}
