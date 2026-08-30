import * as React from 'react'
import { CalendarDays, Target, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/common/money-input'
import { formatCentavos } from '@/lib/money'
import { situacaoDoOrcamento } from '@/lib/orcamento'
import { cn } from '@/lib/utils'

/**
 * O teto do mês e quanto sobra por dia.
 *
 * O número grande é o "por dia", e não o restante total, porque é o que
 * responde a pergunta de quem abre o app no dia 18. O restante total fica
 * embaixo, menor — ele é o contexto, não a resposta.
 *
 * O gasto usado é o de CAIXA: o que já foi para uma fatura futura não pesa
 * neste mês, e contá-lo faria o app pedir para a pessoa economizar um dinheiro
 * que ela ainda não precisa ter.
 */
export function PainelOrcamento({
  ano,
  mes,
  tetoCentavos,
  gastoCentavos,
  onSalvarTeto,
}: {
  ano: number
  mes: number
  tetoCentavos: number
  gastoCentavos: number
  onSalvarTeto: (centavos: number) => void
}) {
  const [aberta, setAberta] = React.useState(false)
  const [rascunho, setRascunho] = React.useState(tetoCentavos)

  React.useEffect(() => {
    if (aberta) setRascunho(tetoCentavos)
  }, [aberta, tetoCentavos])

  const s = situacaoDoOrcamento({ tetoCentavos, gastoCentavos, ano, mes })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" aria-hidden />
            Orçamento do mês
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 md:min-h-0"
            onClick={() => setAberta(true)}
          >
            {tetoCentavos > 0 ? 'Mudar teto' : 'Definir teto'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {tetoCentavos === 0 ? (
          <p className="text-sm text-muted-foreground">
            Defina um teto e o app passa a mostrar quanto dá para gastar por dia até o fim do mês.
          </p>
        ) : (
          <>
            {s.estourou ? (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Passou <strong>{formatCentavos(Math.abs(s.restanteCentavos))}</strong> do teto de{' '}
                  {formatCentavos(s.tetoCentavos)}.
                </span>
              </p>
            ) : (
              <div>
                {/* O "por dia" é o número grande: é o que responde a pergunta
                    de quem abre o app no meio do mês. */}
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCentavos(s.porDiaCentavos ?? 0)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">por dia</span>
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {formatCentavos(s.restanteCentavos)} para {s.diasRestantes}{' '}
                  {s.diasRestantes === 1 ? 'dia' : 'dias'}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Progress
                value={s.percentual}
                className={cn(s.estourou && '[&>div]:bg-destructive')}
                aria-label={`${s.percentualBruto}% do orçamento usado`}
              />
              <p className="text-xs text-muted-foreground">
                {formatCentavos(s.gastoCentavos)} de {formatCentavos(s.tetoCentavos)} ·{' '}
                {s.percentualBruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
              </p>
            </div>
          </>
        )}
      </CardContent>

      <Sheet open={aberta} onOpenChange={setAberta}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Teto de gastos do mês</SheetTitle>
          <SheetDescription className="mb-4">
            Vale para todos os meses. Zero desliga o orçamento e some com este bloco.
          </SheetDescription>

          <div className="space-y-1.5">
            <Label htmlFor="orcamento-teto">Quanto você quer gastar, no máximo</Label>
            <MoneyInput
              id="orcamento-teto"
              value={rascunho}
              onValueChange={setRascunho}
              aria-label="Teto de gastos do mês"
              className="h-12 text-base"
            />
          </div>

          <Button
            className="mt-4 min-h-11 w-full"
            onClick={() => {
              onSalvarTeto(rascunho)
              setAberta(false)
            }}
          >
            Salvar
          </Button>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
