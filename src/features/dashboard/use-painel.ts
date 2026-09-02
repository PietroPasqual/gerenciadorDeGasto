import { useCallback, useMemo, useState } from 'react'
import type { Profile } from '@/lib/database.types'
import { useAuthStore } from '@/store/auth'
import { useGravarPerfil } from '@/lib/use-gravar-perfil'
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
  const gravarPerfil = useGravarPerfil()
  const [editando, setEditando] = useState(false)

  const ordem = useMemo(() => perfil?.painel_ordem ?? [], [perfil?.painel_ordem])
  const ocultos = useMemo(() => perfil?.painel_ocultos ?? [], [perfil?.painel_ocultos])
  const capa = capaValida(perfil?.painel_capa)

  const visiveis = useMemo(
    () => widgetsVisiveis({ conhecidos, ordem, ocultos }),
    [conhecidos, ordem, ocultos],
  )

  /**
   * Sem otimismo, cada clique numa seta esperaria a ida e volta ao Supabase
   * para o card se mexer, e reordenar quatro widgets viraria uma sequência de
   * esperas. O rollback e a mescla da resposta moram no hook compartilhado.
   */
  const gravar = useCallback(
    (mudancas: Partial<Pick<Profile, 'painel_ordem' | 'painel_ocultos' | 'painel_capa'>>) =>
      gravarPerfil(mudancas, 'Não foi possível salvar o painel. O layout voltou ao que era.'),
    [gravarPerfil],
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
