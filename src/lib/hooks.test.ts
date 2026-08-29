import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useRecurso } from './hooks'

/** Promise que só resolve quando alguém chamar `resolver`. */
function promessaControlada<T>() {
  let resolver!: (valor: T) => void
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

describe('useRecurso — sequenciamento', () => {
  it('descarta a resposta antiga que chega depois da nova', async () => {
    const primeira = promessaControlada<string>()
    const segunda = promessaControlada<string>()
    const filas = [primeira.promessa, segunda.promessa]
    let chamada = 0

    const { result, rerender } = renderHook(({ mes }) => useRecurso(() => filas[chamada++], [mes]), {
      initialProps: { mes: 1 },
    })

    // Troca de mês antes de a primeira carga responder — o swipe do celular.
    rerender({ mes: 2 })

    // A segunda (mês atual) responde primeiro.
    await act(async () => {
      segunda.resolver('mês 2')
    })
    await waitFor(() => expect(result.current.dados).toBe('mês 2'))

    // A primeira (mês antigo) chega atrasada e não pode sobrescrever nada.
    await act(async () => {
      primeira.resolver('mês 1')
    })
    expect(result.current.dados).toBe('mês 2')
    expect(result.current.carregando).toBe(false)
  })

  it('não deixa o erro de uma carga vencida apagar os dados da carga atual', async () => {
    const segunda = promessaControlada<string>()
    let rejeitarPrimeira!: (erro: Error) => void
    const primeiraComErro = new Promise<string>((_, reject) => {
      rejeitarPrimeira = reject
    })
    const filas = [primeiraComErro, segunda.promessa]
    let chamada = 0

    const { result, rerender } = renderHook(({ mes }) => useRecurso(() => filas[chamada++], [mes]), {
      initialProps: { mes: 1 },
    })
    rerender({ mes: 2 })

    await act(async () => {
      segunda.resolver('mês 2')
    })
    await waitFor(() => expect(result.current.dados).toBe('mês 2'))

    await act(async () => {
      rejeitarPrimeira(new Error('rede caiu no mês antigo'))
      await Promise.resolve()
    })
    expect(result.current.erro).toBeNull()
    expect(result.current.dados).toBe('mês 2')
  })
})
