import * as React from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { aoGravar } from './otimista'

/**
 * Cache de leitura entre navegações.
 *
 * Antes disto, voltar ao painel refazia a carga inteira toda vez — inclusive
 * quando a pessoa tinha saído dele três segundos antes. Num app aberto o dia
 * todo no celular, isso é a maior parte das requisições que ele faz.
 */
export const clienteCache = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Cinco minutos. Os dados só mudam quando o próprio usuário grava algo, e
       * toda gravação invalida o cache explicitamente (ver ProvedorCache) — o
       * staleTime não é uma aposta sobre quando o dado muda, é o quanto vale
       * confiar no cache entre duas telas.
       */
      staleTime: 5 * 60 * 1000,
      /** Meia hora fora da tela antes de o cache ser descartado de vez. */
      gcTime: 30 * 60 * 1000,
      /**
       * Isto importa mais no celular do que no desktop: o app fica aberto em
       * segundo plano por horas, e voltar a ele depois de lançar um gasto pelo
       * PC precisa mostrar o número novo, não o de ontem.
       */
      refetchOnWindowFocus: true,
      /** Uma tentativa a mais. Rede de metrô cai e volta; três tentativas só atrasam o erro. */
      retry: 1,
    },
  },
})

/**
 * Um cliente novo, isolado. Usado em teste: com o cliente compartilhado, o
 * primeiro teste deixaria dados em cache que o segundo leria como se fossem
 * dele — e um teste que passa por causa do lixo do anterior não prova nada.
 */
export function criarClienteCache(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
}

export function ProvedorCache({
  children,
  cliente = clienteCache,
}: {
  children: React.ReactNode
  cliente?: QueryClient
}) {
  React.useEffect(
    () =>
      /**
       * Qualquer escrita otimista bem-sucedida marca TODAS as leituras como
       * velhas. Invalidar só a consulta afetada exigiria mapear cada escrita
       * para as telas que ela mexe, e errar esse mapa dá número errado na tela
       * — bem pior do que uma requisição a mais.
       *
       * `refetchType: 'none'` é o que faz isso conviver com a escrita otimista.
       * Sem ele, a tela que acabou de gravar buscaria tudo de novo na hora: um
       * campo de dinheiro dispara uma gravação por dígito, então digitar
       * "1.234,56" viraria sete recargas do mês — e cada resposta que chegasse
       * atrasada sobrescreveria o que a pessoa continuou digitando.
       *
       * Marcar como velho sem buscar agora é o comportamento certo: quem
       * gravou já tem o dado correto na tela (foi ele quem o escreveu), e as
       * OUTRAS telas revalidam quando forem abertas ou quando a aba voltar ao
       * foco.
       */
      aoGravar(() => {
        void cliente.invalidateQueries({ refetchType: 'none' })
      }),
    [cliente],
  )

  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

/**
 * Mesma forma de retorno do `useRecurso`, por cima do cache.
 *
 * Existe para as telas migrarem uma a uma sem reescrever quem consome: a tela
 * troca `useRecurso` por `useConsulta` e mais nada muda. `dadosAntigos` é a
 * única coisa nova, e é o que permite não mostrar esqueleto num mês já visto.
 */
export function useConsulta<T>(
  chave: unknown[],
  carregar: () => Promise<T>,
): {
  dados: T | null
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
  definirDados: (atualizar: T | ((anterior: T) => T)) => void
} {
  const cliente = useQueryClient()
  const consulta = useQuery({ queryKey: chave, queryFn: carregar })

  const definirDados = React.useCallback(
    (atualizar: T | ((anterior: T) => T)) => {
      cliente.setQueryData<T>(chave, (anterior) =>
        typeof atualizar === 'function' ? (atualizar as (a: T) => T)(anterior as T) : atualizar,
      )
    },
    // A chave é um array novo a cada render; serializar é o que a mantém estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cliente, JSON.stringify(chave)],
  )

  const recarregar = React.useCallback(async () => {
    await consulta.refetch()
  }, [consulta])

  return {
    dados: consulta.data ?? null,
    // `isPending` e não `isFetching`: revalidar em segundo plano um dado que já
    // está na tela não pode trocar a tela por um esqueleto.
    carregando: consulta.isPending,
    erro: consulta.error ? ((consulta.error as Error).message ?? 'Erro inesperado ao carregar.') : null,
    recarregar,
    definirDados,
  }
}
