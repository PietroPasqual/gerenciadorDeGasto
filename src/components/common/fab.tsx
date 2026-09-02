import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botão flutuante da ação principal da tela, no celular.
 * Some a partir de sm — no desktop a mesma ação já está visível na tabela.
 *
 * Ele sobe acima do dock pela MESMA reserva que o conteúdo usa
 * (`--dock-reserva`), e não por um `bottom-24` escolhido no olho. Era assim
 * antes, e o número tinha sido calibrado para a altura da barra inferior de
 * então: qualquer mudança na navegação o deixava colado ou boiando.
 */
export function Fab({
  onClick,
  rotulo,
  className,
}: {
  onClick: () => void
  rotulo: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={cn(
        'fixed bottom-dock-reserva z-30 mb-2 grid h-14 w-14 place-items-center rounded-full',
        'bg-primary text-primary-foreground shadow-2 transition-transform active:scale-95 sm:hidden',
        // O inset de baixo já está DENTRO de --dock-reserva; repeti-lo aqui
        // empurraria o botão duas vezes. O da direita continua, para o botão
        // não cair sob o notch em paisagem.
        'right-[max(1rem,env(safe-area-inset-right))]',
        className,
      )}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
