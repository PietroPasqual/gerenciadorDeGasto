import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LimiteDeErro } from './limite-de-erro'

function Quebra({ quebrar }: { quebrar: boolean }): JSX.Element {
  if (quebrar) throw new Error('undefined is not a function')
  return <p>conteúdo normal</p>
}

describe('LimiteDeErro', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('mostra saída em vez de tela branca quando a tela quebra', () => {
    render(
      <LimiteDeErro>
        <Quebra quebrar />
      </LimiteDeErro>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Essa tela travou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /voltar ao início/i })).toBeInTheDocument()
  })

  it('não vaza a mensagem técnica para o usuário', () => {
    render(
      <LimiteDeErro>
        <Quebra quebrar />
      </LimiteDeErro>,
    )
    expect(screen.queryByText(/undefined is not a function/)).not.toBeInTheDocument()
  })

  it('"tentar novamente" volta a renderizar a tela quando o erro passou', () => {
    // A falha é controlada de fora para imitar um erro transitório: a primeira
    // renderização quebra, e quando o usuário toca em "tentar novamente" a
    // causa já foi embora.
    const fonte = { quebrado: true }
    function Instavel() {
      return <Quebra quebrar={fonte.quebrado} />
    }

    render(
      <LimiteDeErro>
        <Instavel />
      </LimiteDeErro>,
    )
    expect(screen.getByText('Essa tela travou')).toBeInTheDocument()

    fonte.quebrado = false
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(screen.getByText('conteúdo normal')).toBeInTheDocument()
  })

  it('sai do erro sozinho quando a rota muda', () => {
    const { rerender } = render(
      <LimiteDeErro chave="/mes">
        <Quebra quebrar />
      </LimiteDeErro>,
    )
    expect(screen.getByText('Essa tela travou')).toBeInTheDocument()

    rerender(
      <LimiteDeErro chave="/painel">
        <Quebra quebrar={false} />
      </LimiteDeErro>,
    )
    expect(screen.getByText('conteúdo normal')).toBeInTheDocument()
  })
})
