import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 a 100 (valores acima são "cortados" na barra) */
  value: number
  indicatorClassName?: string
}

/**
 * Barra de progresso simples com role="progressbar".
 * Não usa Radix para poder animar a largura com transição de CSS sem portal.
 */
export function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const limitado = Math.min(Math.max(value, 0), 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(limitado)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${limitado}%` }}
      />
    </div>
  )
}
