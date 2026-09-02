import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/database.types'
import { atualizarPerfil } from '@/services/profiles'
import { useAuthStore } from '@/store/auth'

/** Os campos do perfil que alguma tela grava. */
type CamposGravaveis = Partial<
  Pick<
    Profile,
    | 'nome'
    | 'orcamento_centavos'
    | 'painel_ordem'
    | 'painel_ocultos'
    | 'painel_capa'
    | 'preferencias_lembrete'
    | 'assinaturas_ignoradas'
  >
>

/**
 * Grava no perfil aplicando a mudança na tela primeiro, e desfazendo se o
 * servidor recusar.
 *
 * POR QUE NÃO É O `executarOtimista` DO RESTO DO APP
 *
 * Aquele opera sobre o cache de LEITURA por chave, e o perfil não vive nele —
 * vive no store de auth, que a sessão inteira lê. Ensiná-lo a mexer num store
 * seria mais acoplamento do que as poucas linhas que ele economizaria.
 *
 * POR QUE UM LUGAR SÓ
 *
 * Esta mesma dança — snapshot, aplicar, gravar, restaurar no erro — estava
 * escrita à mão no controle mensal (o teto do orçamento) e no painel (a ordem
 * dos widgets), e o widget de orçamento do painel ia ser a terceira cópia. Três
 * cópias de um rollback é três chances de uma delas restaurar errado, e o erro
 * só aparece quando a rede cai — que é quando ninguém está olhando.
 */
export function useGravarPerfil() {
  const definirProfile = useAuthStore((e) => e.definirProfile)

  return useCallback(
    (mudancas: CamposGravaveis, mensagemDeErro: string) => {
      const anterior = useAuthStore.getState().profile
      if (!anterior) return

      definirProfile({ ...anterior, ...mudancas })
      atualizarPerfil(mudancas)
        // MESCLA a resposta sobre o perfil atual em vez de trocá-lo por ela.
        // Em produção `atualizarPerfil` devolve a linha inteira e os dois dão no
        // mesmo. A diferença aparece com resposta parcial — um `select` que
        // deixou de trazer uma coluna, um dublê de teste —, e aí substituir
        // apagaria do estado campos que o servidor nem tocou, inclusive a
        // mudança recém-aplicada.
        .then((doServidor) => {
          const atual = useAuthStore.getState().profile
          if (atual) definirProfile({ ...atual, ...doServidor })
        })
        .catch((erro) => {
          // Restaura o perfil INTEIRO de antes, e não só os campos mudados: se
          // outra tela gravou nesse meio-tempo, ela já chamou definirProfile, e
          // mesclar campo a campo aqui perderia a gravação dela.
          definirProfile(anterior)
          toast.error(mensagemDeErro, {
            description: erro instanceof Error ? erro.message : undefined,
          })
        })
    },
    [definirProfile],
  )
}
