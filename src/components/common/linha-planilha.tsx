import { cn } from '@/lib/utils'

/**
 * "Tabela" em grid, responsiva sem duplicar markup.
 *
 * Desktop: uma linha por registro, colunas definidas pela classe `template`
 *          (ex.: "md:grid-cols-[1fr,9rem,3rem]").
 * Mobile:  a mesma linha vira um card empilhado; o rótulo de cada campo
 *          aparece só no mobile (`Campo rotulo="..."`), sem scroll horizontal.
 */
export function Cabecalho({
  template,
  children,
  className,
}: {
  template: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="row"
      className={cn(
        'hidden gap-2 border-b border-border px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid',
        template,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Linha({
  template,
  children,
  className,
  destacada,
}: {
  template: string
  children: React.ReactNode
  className?: string
  destacada?: boolean
}) {
  return (
    <div
      role="row"
      data-linha
      className={cn(
        // `group` para as ações que só aparecem no hover (D5, ver AcoesLinha
        // e os botões de excluir das tabelas).
        'group grid grid-cols-1 gap-2 rounded-xl border border-border p-3 transition-colors',
        'md:items-center md:rounded-none md:border-0 md:border-b md:px-3 md:py-linha-y',
        destacada && 'bg-primary-soft/60',
        'hover:bg-accent/40',
        template,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1 md:space-y-0', className)}>
      <span className="block text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground md:hidden">
        {rotulo}
      </span>
      {children}
    </div>
  )
}

/** Rodapé de total da lista. */
export function Total({
  rotulo,
  valor,
  className,
}: {
  rotulo: string
  valor: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm font-medium md:rounded-none',
        className,
      )}
    >
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="tabular">{valor}</span>
    </div>
  )
}
