import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Prioridade de 1 a 5 estrelas. Navegável por teclado (setas). */
export function Estrelas({
  valor,
  onChange,
  somenteLeitura = false,
  className,
}: {
  valor: number
  onChange?: (novo: number) => void
  somenteLeitura?: boolean
  className?: string
}) {
  if (somenteLeitura || !onChange) {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`Prioridade ${valor} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn('h-4 w-4', n <= valor ? 'fill-primary text-primary' : 'text-muted-foreground/40')}
          />
        ))}
      </span>
    )
  }

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="radiogroup"
      aria-label="Prioridade"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          onChange(Math.min(valor + 1, 5))
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          onChange(Math.max(valor - 1, 1))
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === valor}
          aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          tabIndex={n === valor ? 0 : -1}
          onClick={() => onChange(n)}
          className="rounded-full p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn('h-4 w-4', n <= valor ? 'fill-primary text-primary' : 'text-muted-foreground/40')} />
        </button>
      ))}
    </span>
  )
}
