import { useCallback, useMemo } from 'react'
import { detectarAssinaturas, type Assinatura } from '@/lib/assinaturas'
import { atualizarPerfil } from '@/services/profiles'
import { executarOtimista } from '@/lib/otimista'
import { useAuthStore } from '@/store/auth'
import type { FixedExpense } from '@/lib/database.types'
import { useGastosRecentes } from '@/lib/use-gastos-recentes'

/** Teto do que a 0018 aceita guardar. O cliente poda antes de o banco recusar. */
export const MAX_IGNORADAS = 200

export function lerIgnoradas(bruto: unknown): string[] {
  return Array.isArray(bruto) ? bruto.filter((c): c is string => typeof c === 'string') : []
}

/**
 * As assinaturas sugeridas e as duas respostas possíveis.
 *
 * Um hook próprio porque a leitura é a única do mês que NÃO vem do
 * `carregar_mes`: a detecção precisa de doze meses, e a RPC entrega um.
 */
export function useAssinaturas(gastosFixos: FixedExpense[]) {
  const perfil = useAuthStore((s) => s.profile)
  const definirProfile = useAuthStore((s) => s.definirProfile)

  const { dados, erro } = useGastosRecentes()

  const ignoradas = useMemo(() => lerIgnoradas(perfil?.assinaturas_ignoradas), [perfil])

  const assinaturas = useMemo(() => {
    // Erro na sugestão não vira alerta na tela de quem veio conferir o mês:
    // o painel é um acréscimo, e some quando não tem o que dizer.
    if (erro || !dados) return []
    const ignoradasSet = new Set(ignoradas)
    return detectarAssinaturas({ lancamentos: dados, gastosFixos }).filter((a) => !ignoradasSet.has(a.chave))
  }, [dados, erro, gastosFixos, ignoradas])

  const ignorar = useCallback(
    (a: Assinatura) => {
      if (!perfil) return
      // Poda pela ponta antiga: quem dispensou 200 destinatários distintos não
      // vai sentir falta do primeiro, e a 0018 recusa o 201º.
      const novas = [...ignoradas.filter((c) => c !== a.chave), a.chave].slice(-MAX_IGNORADAS)
      void executarOtimista({
        chave: 'assinaturas-ignoradas',
        snapshot: perfil,
        aplicar: () => definirProfile({ ...perfil, assinaturas_ignoradas: novas }),
        restaurar: (anterior) => definirProfile(anterior),
        acao: () => atualizarPerfil({ assinaturas_ignoradas: novas }),
        confirmar: (salvo) => definirProfile(salvo),
        mensagemErro: 'Não foi possível dispensar a sugestão.',
      })
    },
    [ignoradas, perfil, definirProfile],
  )

  return { assinaturas, ignorar }
}
