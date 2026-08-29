import { cn } from '@/lib/utils'
import type { TemaCor } from '@/lib/database.types'

/**
 * Miniatura do app num tema (D7).
 *
 * Antes cada tema era uma bolinha da cor primária — e a cor primária é só uma
 * das dez variáveis que o tema troca. Dava para escolher "o azul" e só
 * descobrir depois como ficavam o fundo, o card e o realce.
 *
 * O truque é que `data-tema` e `.dark` são seletores em elemento, não no
 * <html>: pondo os dois nesta div, as variáveis do tema valem só aqui dentro e
 * a miniatura fica de verdade naquele tema, sem trocar o app inteiro. Por isso
 * a prévia acompanha o modo escuro sozinha.
 */
export function PreviaTema({
  tema,
  escuro,
  className,
}: {
  tema: TemaCor
  escuro: boolean
  className?: string
}) {
  return (
    <div
      data-tema={tema}
      className={cn(
        escuro && 'dark',
        'pointer-events-none select-none overflow-hidden rounded-lg border border-border bg-background p-2',
        className,
      )}
      aria-hidden
    >
      <div className="space-y-1.5 rounded-md bg-card p-1.5 shadow-1">
        {/* cabeçalho: o "Z" da marca é o que mais mostra a cor do tema */}
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-1 w-6 rounded-full bg-muted-foreground/35" />
        </div>

        {/* duas linhas de dinheiro: verde e vermelho não mudam com o tema, e
            é justamente isso que a miniatura precisa deixar claro */}
        <div className="flex items-center justify-between gap-2">
          <span className="h-1 w-5 rounded-full bg-muted-foreground/25" />
          <span className="h-1.5 w-7 rounded-full bg-success" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="h-1 w-4 rounded-full bg-muted-foreground/25" />
          <span className="h-1.5 w-6 rounded-full bg-destructive" />
        </div>

        {/* barra de progresso e "botão": o primary como preenchimento */}
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary" />
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-8 rounded-full bg-primary" />
          <span className="h-3 w-6 rounded-full bg-primary-soft" />
        </div>
      </div>
    </div>
  )
}
