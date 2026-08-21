import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // No celular: 44px de alvo e fonte 16px. Abaixo de 16px o iOS dá zoom
        // ao focar o campo e desalinha a tela inteira. De md para cima volta
        // ao tamanho de planilha.
        'flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors',
        'md:h-10 md:text-sm',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
