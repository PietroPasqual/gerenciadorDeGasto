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
 *
 * Também dá o "flash ao salvar" (D4): a grade guarda o valor da célula no foco
 * e, se ele mudou quando o foco sai, pisca o campo. Fica aqui e não em cada
 * onBlur porque são umas quinze chamadas espalhadas por seis tabelas — e
 * porque a condição é exatamente a mesma que dispara o save.
 */
export function GradeEditavel({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)

  const celulas = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-celula]') ?? []).filter(
      (el) => !el.hasAttribute('disabled'),
    )

  const linhaDe = (el: HTMLElement) => el.closest('tr, [data-linha]') as HTMLElement | null

  // Valor de cada célula no momento em que ela ganhou o foco.
  const valorAoFocar = React.useRef(new WeakMap<HTMLElement, string>())

  const valorDe = (el: HTMLElement) =>
    el instanceof HTMLInputElement || el instanceof HTMLSelectElement
      ? el.value
      : (el.getAttribute('aria-checked') ?? el.textContent ?? '')

  const aoFocar = (e: React.FocusEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement
    if (alvo?.hasAttribute?.('data-celula')) valorAoFocar.current.set(alvo, valorDe(alvo))
  }

  const aoDesfocar = (e: React.FocusEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement
    if (!alvo?.hasAttribute?.('data-celula')) return
    const antes = valorAoFocar.current.get(alvo)
    valorAoFocar.current.delete(alvo)
    if (antes === undefined || antes === valorDe(alvo)) return
    // reflow no meio: sem isto, reeditar a mesma célula não reinicia a animação
    alvo.classList.remove('flash-salvo')
    void alvo.offsetWidth
    alvo.classList.add('flash-salvo')
    window.setTimeout(() => alvo.classList.remove('flash-salvo'), 700)
  }

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

    if (evento.key === 'Escape') {
      /**
       * Cancela a edição, devolvendo o valor que a célula tinha ao ganhar foco.
       *
       * O README promete isso desde sempre e o código nunca implementou — o
       * teste de contrato desta fase é que descobriu. Quem digita num campo de
       * dinheiro e percebe o erro no meio não tinha saída a não ser lembrar o
       * valor antigo e redigitar.
       *
       * O setter nativo é necessário porque o MoneyInput é controlado: mexer em
       * `.value` direto seria desfeito no próximo render do React. Disparar o
       * evento pelo setter do protótipo é o que faz o onChange do componente
       * enxergar a mudança e atualizar o estado dele.
       */
      const antes = valorAoFocar.current.get(alvo)
      if (antes === undefined) return
      evento.preventDefault()

      if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement) {
        const proto =
          alvo instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        setter?.call(alvo, antes)
        alvo.dispatchEvent(new Event('input', { bubbles: true }))
        alvo.select()
      }
      // O valor voltou ao original, então o onBlur não vai marcar como salvo:
      // ele só anima quando o valor mudou de verdade.
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
    <div ref={ref} className={className} onKeyDown={handleKeyDown} onFocus={aoFocar} onBlur={aoDesfocar}>
      {children}
    </div>
  )
}
