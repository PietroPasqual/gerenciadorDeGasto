import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} {...props} />
}

/**
 * Placeholder de tabela.
 *
 * Duas formas, porque a tabela tem duas: no celular cada registro é um card de
 * duas linhas (~68px) e no desktop é uma linha de células (~40px). Um
 * placeholder de 32px para os dois fazia a página encolher na hora que os
 * dados chegavam, e o dedo acertava outro botão.
 */
export function SkeletonTabela({ linhas = 5, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {/* cabeçalho de colunas: só existe no desktop */}
      <Skeleton className="hidden h-9 w-full md:block" />

      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-[4.25rem] w-full md:hidden" />
          <div className="hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}>
            {Array.from({ length: colunas }).map((__, j) => (
              <Skeleton key={j} className="h-10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
