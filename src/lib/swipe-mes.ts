import * as React from 'react'

/** Distância mínima, em px, para o gesto valer como troca de mês. */
const DISTANCIA = 70
/** A partir daqui já dá para saber se o dedo foi para o lado ou para baixo. */
const DECISAO = 12

export type Direcao = -1 | 0 | 1

/**
 * Swipe horizontal para trocar de mês.
 *
 * Não usamos `drag` do framer-motion nem `touch-action: none`: a área que
 * escuta o gesto é a mesma que rola verticalmente, e travar o eixo Y para
 * capturar o X deixaria a lista de gastos presa. Aqui só escutamos — quem
 * decide o eixo é o primeiro movimento do dedo, e um gesto que começou
 * descendo é abandonado de vez (`decidido = 'vertical'`), para uma diagonal
 * no fim da rolagem não jogar a pessoa em outro mês.
 *
 * `direcao` sai +1 quando o dedo foi para a ESQUERDA (o mês seguinte entra
 * pela direita, como uma página virando) e -1 no sentido contrário.
 */
export function useSwipeMes(aoTrocar: (direcao: 1 | -1) => void, ativo: boolean) {
  const inicio = React.useRef<{ x: number; y: number } | null>(null)
  const decidido = React.useRef<'indefinido' | 'horizontal' | 'vertical'>('indefinido')

  const onTouchStart = (e: React.TouchEvent) => {
    if (!ativo || e.touches.length !== 1) return
    const t = e.touches[0]
    inicio.current = { x: t.clientX, y: t.clientY }
    decidido.current = 'indefinido'
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!inicio.current || decidido.current !== 'indefinido') return
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - inicio.current.x)
    const dy = Math.abs(t.clientY - inicio.current.y)
    if (dx < DECISAO && dy < DECISAO) return
    decidido.current = dx > dy ? 'horizontal' : 'vertical'
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const partida = inicio.current
    inicio.current = null
    if (!partida || decidido.current !== 'horizontal') return
    const dx = e.changedTouches[0].clientX - partida.x
    if (Math.abs(dx) < DISTANCIA) return
    aoTrocar(dx < 0 ? 1 : -1)
  }

  return ativo ? { onTouchStart, onTouchMove, onTouchEnd } : {}
}

/** mês + delta, virando o ano quando passa de dezembro ou de janeiro. */
export function mesVizinho(ano: number, mes: number, delta: number) {
  const total = ano * 12 + (mes - 1) + delta
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
}
