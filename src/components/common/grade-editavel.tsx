import * as React from 'react'

/**
 * Navegação por teclado em tabelas editáveis (estilo planilha).
 *
 * Marque cada campo editável com `data-celula` e envolva a tabela com
 * <GradeEditavel>. Comportamento:
 *   Enter / Tab      -> próxima célula (Tab é nativo)
 *   Shift+Enter      -> célula anterior
 *   Seta baixo/cima  -> mesma coluna, linha seguinte/anterior
 *
 * As linhas são identificadas por <tr> ou por qualquer elemento com data-linha
 * (usado na versão mobile em cards).
 */
export function GradeEditavel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  const celulas = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-celula]') ?? []).filter(
      (el) => !el.hasAttribute('disabled'),
    )

  const linhaDe = (el: HTMLElement) => el.closest('tr, [data-linha]') as HTMLElement | null

  const handleKeyDown = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    const alvo = evento.target as HTMLElement
    if (!alvo?.hasAttribute?.('data-celula')) return

    const lista = celulas()
    const indice = lista.indexOf(alvo)
    if (indice === -1) return

    if (evento.key === 'Enter') {
      // Deixa o Enter passar em textarea e em botões (checkbox "pago?", ações)
      const tag = alvo.tagName.toLowerCase()
      if (tag === 'textarea' || tag === 'button') return
      evento.preventDefault()
      const proxima = evento.shiftKey ? lista[indice - 1] : lista[indice + 1]
      proxima?.focus()
      if (proxima instanceof HTMLInputElement) proxima.select()
      return
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      const linhaAtual = linhaDe(alvo)
      if (!linhaAtual) return
      const celulasDaLinha = Array.from(linhaAtual.querySelectorAll<HTMLElement>('[data-celula]'))
      const coluna = celulasDaLinha.indexOf(alvo)
      if (coluna === -1) return

      const linhas = Array.from(ref.current?.querySelectorAll<HTMLElement>('tr, [data-linha]') ?? []).filter(
        (l) => l.querySelector('[data-celula]'),
      )
      const posLinha = linhas.indexOf(linhaAtual)
      const destinoLinha = linhas[posLinha + (evento.key === 'ArrowDown' ? 1 : -1)]
      if (!destinoLinha) return

      const destino = destinoLinha.querySelectorAll<HTMLElement>('[data-celula]')[coluna]
      if (destino) {
        evento.preventDefault()
        destino.focus()
        if (destino instanceof HTMLInputElement) destino.select()
      }
    }
  }

  return (
    <div ref={ref} className={className} onKeyDown={handleKeyDown}>
      {children}
    </div>
  )
}
