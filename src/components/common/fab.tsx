import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botão flutuante da ação principal da tela, no celular.
 * Fica acima da barra de navegação (bottom-24) para não cobri-la, e some a
 * partir de sm — no desktop a mesma ação já está visível na própria tabela.
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
        'fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full',
        'bg-primary text-primary-foreground shadow-2 transition-transform active:scale-95 sm:hidden',
        'mb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
