import { useEffect, useRef, useState } from 'react'
import { formatCentavos } from '@/lib/money'

/**
 * Número que "conta" até o valor ao carregar/mudar.
 * Respeita prefers-reduced-motion (pula direto para o valor final).
 */
export function NumeroAnimado({
  valor,
  duracao = 700,
  formatar = formatCentavos,
  className,
}: {
  valor: number
  duracao?: number
  formatar?: (v: number) => string
  className?: string
}) {
  const [exibido, setExibido] = useState(valor)
  const anteriorRef = useRef(valor)
  const frameRef = useRef<number>()

  useEffect(() => {
    const reduzir =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const de = anteriorRef.current
    const para = valor
    anteriorRef.current = valor

    if (reduzir || de === para) {
      setExibido(para)
      return
    }

    const inicio = performance.now()
    const passo = (agora: number) => {
      const progresso = Math.min((agora - inicio) / duracao, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progresso, 3)
      setExibido(Math.round(de + (para - de) * eased))
      if (progresso < 1) frameRef.current = requestAnimationFrame(passo)
    }
    frameRef.current = requestAnimationFrame(passo)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [valor, duracao])

  return (
    <span className={className} aria-label={formatar(valor)}>
      {formatar(exibido)}
    </span>
  )
}
