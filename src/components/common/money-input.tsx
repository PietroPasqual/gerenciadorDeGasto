import * as React from 'react'
import { Input } from '@/components/ui/input'
import { centavosParaTexto } from '@/lib/money'
import { cn } from '@/lib/utils'

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  /** Valor em centavos */
  value: number | null
  /** Chamado a cada dígito digitado, já convertido para centavos */
  onValueChange: (centavos: number) => void
}

const LIMITE_DIGITOS = 15 // até R$ 999.999.999.999,99 — não precisa de mais

function posicionarNoFim(el: HTMLInputElement | null) {
  if (!el) return
  const fim = el.value.length
  el.setSelectionRange(fim, fim)
}

/**
 * Input de dinheiro estilo "caixa eletrônico": os dígitos entram da direita
 * para a esquerda, como em apps bancários. Digitar "1" em cima de "0,00"
 * vira "0,01", "12" vira "0,12", "123" vira "1,23"...
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, className, onFocus, onClick, ...props }, ref) => {
    const localRef = React.useRef<HTMLInputElement | null>(null)
    const [centavos, setCentavos] = React.useState(() => Math.abs(value ?? 0))

    React.useEffect(() => {
      setCentavos(Math.abs(value ?? 0))
    }, [value])

    const texto = centavosParaTexto(centavos)

    React.useEffect(() => {
      if (document.activeElement === localRef.current) posicionarNoFim(localRef.current)
    }, [texto])

    return (
      <Input
        ref={(el) => {
          localRef.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) (ref as { current: HTMLInputElement | null }).current = el
        }}
        inputMode="numeric"
        className={cn('tabular text-right', className)}
        value={texto}
        onFocus={(e) => {
          posicionarNoFim(e.currentTarget)
          onFocus?.(e)
        }}
        onClick={(e) => {
          posicionarNoFim(e.currentTarget)
          onClick?.(e)
        }}
        onChange={(e) => {
          const digitos = e.target.value
            .replace(/\D/g, '')
            .replace(/^0+(?=\d)/, '')
            .slice(0, LIMITE_DIGITOS)
          const novo = digitos === '' ? 0 : Number(digitos)
          setCentavos(novo)
          onValueChange(novo)
        }}
        {...props}
      />
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
