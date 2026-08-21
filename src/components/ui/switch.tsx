import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Só o desenho do interruptor (trilho + bolinha), sem interação.
 * Existe separado para uma linha inteira poder virar o alvo de toque: nesse
 * caso quem carrega o role="switch" é a linha, e isto aqui é só o indicador.
 */
export function SwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className,
      )}
    >
      <span
        className={cn(
          'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </span>
  )
}

/**
 * Interruptor liga/desliga.
 *
 * Um botão rotulado com o estado ("Ativado") é ambíguo: não dá para saber se
 * clicar liga ou desliga. Aqui a posição do controle é o estado, e o
 * role="switch" + aria-checked deixam isso explícito para leitores de tela.
 */
export const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
  }
>(({ checked, onCheckedChange, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn('rounded-full', className)}
    {...props}
  >
    <SwitchTrack checked={checked} />
  </button>
))
Switch.displayName = 'Switch'
