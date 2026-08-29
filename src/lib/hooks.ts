import { useCallback, useEffect, useRef, useState } from 'react'

interface EstadoRecurso<T> {
  dados: T | null
  carregando: boolean
  erro: string | null
}

/**
 * Carrega dados assíncronos com os três estados obrigatórios do app:
 * loading, erro e sucesso — mais `recarregar()` e `definirDados()`
 * (este último é o que permite updates otimistas com rollback).
 */
export function useRecurso<T>(
  carregar: () => Promise<T>,
  deps: unknown[] = [],
): EstadoRecurso<T> & {
  recarregar: () => Promise<void>
  definirDados: (atualizar: T | ((anterior: T) => T)) => void
} {
  const [estado, setEstado] = useState<EstadoRecurso<T>>({ dados: null, carregando: true, erro: null })
  const montado = useRef(true)
  const carregarRef = useRef(carregar)
  carregarRef.current = carregar

  /**
   * Número da carga em andamento. Sem ele, trocar de mês rápido (o swipe do
   * celular convida a isso) deixa a resposta do mês anterior chegar depois da
   * do mês novo e sobrescrever a tela com números de outro período. Só a carga
   * mais recente tem direito de escrever no estado.
   */
  const geracao = useRef(0)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const executar = useCallback(async () => {
    const minhaGeracao = ++geracao.current
    const atual = () => montado.current && geracao.current === minhaGeracao
    setEstado((anterior) => ({ ...anterior, carregando: true, erro: null }))
    try {
      const dados = await carregarRef.current()
      if (atual()) setEstado({ dados, carregando: false, erro: null })
    } catch (erro) {
      if (atual()) {
        setEstado((anterior) => ({
          ...anterior,
          carregando: false,
          erro: erro instanceof Error ? erro.message : 'Erro inesperado ao carregar.',
        }))
      }
    }
  }, [])

  useEffect(() => {
    void executar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const definirDados = useCallback((atualizar: T | ((anterior: T) => T)) => {
    setEstado((anterior) => ({
      ...anterior,
      dados:
        typeof atualizar === 'function'
          ? (atualizar as (a: T) => T)(anterior.dados as T)
          : atualizar,
    }))
  }, [])

  return { ...estado, recarregar: executar, definirDados }
}

/** Detecta viewport mobile para trocar tabela por cards. */
export function useEhMobile(breakpoint = 768): boolean {
  const [ehMobile, setEhMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const aoMudar = () => setEhMobile(media.matches)
    aoMudar()
    media.addEventListener('change', aoMudar)
    return () => media.removeEventListener('change', aoMudar)
  }, [breakpoint])

  return ehMobile
}
