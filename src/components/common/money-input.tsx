import * as React from 'react'
import { Input } from '@/components/ui/input'
import { centavosParaTexto, parseParaCentavos } from '@/lib/money'
import { cn } from '@/lib/utils'

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** Valor em centavos */
  value: number | null
  /** Chamado no blur/Enter, já convertido para centavos */
  onValueChange: (centavos: number) => void
}

/**
 * Input de dinheiro. Enquanto o usuário digita, guarda o texto cru;
 * ao sair do campo (ou Enter) converte para centavos e propaga.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, onBlur, onKeyDown, ...props }, ref) => {
    const [texto, setTexto] = React.useState(() => centavosParaTexto(value))
    const [editando, setEditando] = React.useState(false)

    React.useEffect(() => {
      if (!editando) setTexto(centavosParaTexto(value))
    }, [value, editando])

    const confirmar = () => {
      const centavos = parseParaCentavos(texto)
      const final = centavos ?? 0
      setEditando(false)
      setTexto(centavosParaTexto(final))
      if (final !== (value ?? 0)) onValueChange(final)
    }

    return (
      <Input
        ref={ref}
        inputMode="decimal"
        className={cn('tabular text-right', className)}
        value={texto}
        onFocus={(e) => {
          setEditando(true)
          e.currentTarget.select()
        }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={(e) => {
          confirmar()
          onBlur?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar()
          if (e.key === 'Escape') {
            setEditando(false)
            setTexto(centavosParaTexto(value))
          }
          onKeyDown?.(e)
        }}
        {...props}
      />
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
