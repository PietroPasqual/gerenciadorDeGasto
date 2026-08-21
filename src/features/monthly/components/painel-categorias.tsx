import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { calcularPercentualLimite, nivelDoLimite } from '@/lib/calculations'
import { cn } from '@/lib/utils'

export interface LinhaCategoria {
  id: string
  nome: string
  cor: string
  limite_centavos: number | null
  gasto_centavos: number
}

const CORES_BARRA: Record<string, string> = {
  ok: 'bg-success',
  atencao: 'bg-warning',
  estourado: 'bg-destructive',
}

/** Gastos por categoria com barra verde/amarela/vermelha em relação ao limite. */
export function PainelCategorias({ categorias }: { categorias: LinhaCategoria[] }) {
  const comMovimento = categorias.filter((c) => c.gasto_centavos > 0 || c.limite_centavos)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Gastos por categoria</CardTitle>
        <CardDescription>O limite mensal de cada categoria é definido em Configurações.</CardDescription>
      </CardHeader>
      <CardContent>
        {comMovimento.length === 0 ? (
          <EstadoVazio
            ilustracao="grafico"
            titulo="Nada gasto ainda"
            descricao="Assim que você lançar um gasto, ele aparece aqui."
          />
        ) : (
          <ul className="space-y-4">
            {comMovimento.map((categoria) => {
              const percentual = calcularPercentualLimite(categoria.gasto_centavos, categoria.limite_centavos)
              const nivel = nivelDoLimite(categoria.gasto_centavos, categoria.limite_centavos)
              return (
                <li key={categoria.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      {categoria.nome}
                    </span>
                    <span className="tabular text-muted-foreground">
                      {formatCentavos(categoria.gasto_centavos)}
                      {categoria.limite_centavos ? (
                        <>
                          {' / '}
                          {formatCentavos(categoria.limite_centavos)}{' '}
                          <span
                            className={cn(
                              'font-medium',
                              nivel === 'estourado' && 'text-destructive',
                              nivel === 'atencao' && 'text-warning',
                              nivel === 'ok' && 'text-success',
                            )}
                          >
                            ({percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)
                          </span>
                        </>
                      ) : (
                        <span className="ml-1 text-xs">sem limite</span>
                      )}
                    </span>
                  </div>
                  {categoria.limite_centavos ? (
                    <Progress value={percentual} indicatorClassName={CORES_BARRA[nivel]} />
                  ) : (
                    <Progress value={0} className="opacity-40" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
