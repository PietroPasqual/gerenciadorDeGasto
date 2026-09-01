import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GradeEditavel } from '@/components/common/grade-editavel'

/**
 * O contrato de teclado da grade editável, que o README promete:
 *
 *   Enter          -> próxima célula
 *   Shift+Enter    -> célula anterior
 *   ↑ / ↓          -> mesma coluna, linha vizinha
 *   Esc            -> cancela a edição do valor
 *
 * Sem teste, isso é uma promessa escrita num arquivo de texto. Quem edita 300
 * linhas de extrato no desktop usa esse caminho o tempo todo, e ele quebra em
 * silêncio: nada na tela indica que o Enter parou de andar.
 */
function Grade() {
  return (
    <GradeEditavel>
      <div data-linha>
        <input data-celula aria-label="a1" defaultValue="a1" />
        <input data-celula aria-label="a2" defaultValue="a2" />
      </div>
      <div data-linha>
        <input data-celula aria-label="b1" defaultValue="b1" />
        <input data-celula aria-label="b2" defaultValue="b2" />
      </div>
    </GradeEditavel>
  )
}

const foco = () => (document.activeElement as HTMLElement)?.getAttribute('aria-label')

describe('grade editável — teclado', () => {
  it('Enter anda para a próxima célula', () => {
    render(<Grade />)
    const a1 = screen.getByLabelText('a1')
    a1.focus()
    fireEvent.keyDown(a1, { key: 'Enter' })
    expect(foco()).toBe('a2')
  })

  it('Shift+Enter volta para a anterior', () => {
    render(<Grade />)
    const a2 = screen.getByLabelText('a2')
    a2.focus()
    fireEvent.keyDown(a2, { key: 'Enter', shiftKey: true })
    expect(foco()).toBe('a1')
  })

  it('seta para baixo desce na MESMA coluna, não para a próxima célula', () => {
    // É a diferença entre andar em tabela e andar em formulário; trocar os dois
    // deixa a navegação parecendo aleatória em quem tem 6 colunas.
    render(<Grade />)
    const a2 = screen.getByLabelText('a2')
    a2.focus()
    fireEvent.keyDown(a2, { key: 'ArrowDown' })
    expect(foco()).toBe('b2')
  })

  it('seta para cima sobe na mesma coluna', () => {
    render(<Grade />)
    const b1 = screen.getByLabelText('b1')
    b1.focus()
    fireEvent.keyDown(b1, { key: 'ArrowUp' })
    expect(foco()).toBe('a1')
  })

  it('Enter na última célula não estoura nem tira o foco da grade', () => {
    render(<Grade />)
    const b2 = screen.getByLabelText('b2')
    b2.focus()
    fireEvent.keyDown(b2, { key: 'Enter' })
    expect(foco()).toBe('b2')
  })

  it('Esc devolve o valor que estava lá quando a célula ganhou foco', () => {
    render(<Grade />)
    const a1 = screen.getByLabelText('a1') as HTMLInputElement
    a1.focus()
    fireEvent.focusIn(a1)
    fireEvent.change(a1, { target: { value: 'digitado errado' } })
    expect(a1.value).toBe('digitado errado')
    fireEvent.keyDown(a1, { key: 'Escape' })
    expect(a1.value).toBe('a1')
  })
})
