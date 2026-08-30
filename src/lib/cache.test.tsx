import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { ProvedorCache, criarClienteCache, useConsulta } from './cache'
import { executarOtimista } from './otimista'

function Tela({ chave, carregar }: { chave: unknown[]; carregar: () => Promise<string> }) {
  const { dados, carregando } = useConsulta(chave, carregar)
  return <p>{carregando ? 'esqueleto' : (dados ?? 'vazio')}</p>
}

describe('useConsulta — cache entre navegações', () => {
  it('não mostra esqueleto de novo num mês que já foi visto', async () => {
    const cliente = criarClienteCache()
    // staleTime alto: aqui interessa o cache, não a revalidação.
    cliente.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } })
    const carregar = vi.fn(async () => 'agosto')

    const { unmount } = render(
      <ProvedorCache cliente={cliente}>
        <Tela chave={['mes', 2025, 8]} carregar={carregar} />
      </ProvedorCache>,
    )
    // Primeira visita: esqueleto e depois o dado.
    expect(screen.getByText('esqueleto')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('agosto')).toBeInTheDocument())
    unmount()

    // Voltando ao mesmo mês: o dado aparece de cara, sem esqueleto nenhum.
    render(
      <ProvedorCache cliente={cliente}>
        <Tela chave={['mes', 2025, 8]} carregar={carregar} />
      </ProvedorCache>,
    )
    expect(screen.queryByText('esqueleto')).not.toBeInTheDocument()
    expect(screen.getByText('agosto')).toBeInTheDocument()
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('cada mês tem seu próprio cache — um não serve pelo outro', async () => {
    const cliente = criarClienteCache()
    cliente.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } })
    const carregar = vi.fn(async () => 'setembro')

    render(
      <ProvedorCache cliente={cliente}>
        <Tela chave={['mes', 2025, 9]} carregar={carregar} />
      </ProvedorCache>,
    )
    expect(screen.getByText('esqueleto')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('setembro')).toBeInTheDocument())
  })
})

describe('invalidação depois de gravar', () => {
  it('uma escrita bem-sucedida marca as leituras como velhas, sem buscar na hora', async () => {
    const cliente = criarClienteCache()
    cliente.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } })
    const carregar = vi.fn(async () => 'antes')

    render(
      <ProvedorCache cliente={cliente}>
        <Tela chave={['mes', 2025, 8]} carregar={carregar} />
      </ProvedorCache>,
    )
    await waitFor(() => expect(screen.getByText('antes')).toBeInTheDocument())
    expect(carregar).toHaveBeenCalledTimes(1)

    await act(async () => {
      await executarOtimista({
        snapshot: null,
        aplicar: () => {},
        restaurar: () => {},
        acao: async () => 'gravado',
      })
    })

    // A tela que gravou NÃO busca de novo: ela já tem o dado certo, e buscar
    // aqui é o que faria um campo de dinheiro recarregar o mês a cada dígito.
    expect(carregar).toHaveBeenCalledTimes(1)
    // Mas a consulta ficou marcada como velha, para revalidar na próxima vez.
    expect(cliente.getQueryState(['mes', 2025, 8])?.isInvalidated).toBe(true)
  })

  it('escrita que FALHA não invalida nada: o rollback já devolveu o estado certo', async () => {
    const cliente = criarClienteCache()
    cliente.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } })
    const carregar = vi.fn(async () => 'antes')

    render(
      <ProvedorCache cliente={cliente}>
        <Tela chave={['mes', 2025, 8]} carregar={carregar} />
      </ProvedorCache>,
    )
    await waitFor(() => expect(screen.getByText('antes')).toBeInTheDocument())

    await act(async () => {
      await executarOtimista({
        snapshot: null,
        aplicar: () => {},
        restaurar: () => {},
        acao: async () => {
          throw new Error('rede caiu')
        },
      })
    })

    expect(cliente.getQueryState(['mes', 2025, 8])?.isInvalidated).toBe(false)
  })
})
