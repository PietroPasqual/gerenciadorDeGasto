import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} {...props} />
}

/** Skeleton com formato de tabela — usado nos estados de loading das telas. */
export function SkeletonTabela({ linhas = 5, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}>
          {Array.from({ length: colunas }).map((__, j) => (
            <Skeleton key={j} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  )
}
