import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { formatCentavos } from '@/lib/money'
import { nomeDoMes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { ResumoCalculado } from '@/lib/calculations'

/** Resumo lateral do mês: entradas, saídas, saldo e donut de % investido. */
export function ResumoMes({ ano, mes, resumo }: { ano: number; mes: number; resumo: ResumoCalculado }) {
  const percentual = Math.min(resumo.percentualInvestido, 100)
  const dadosDonut = [
    { nome: 'investido', valor: percentual },
    { nome: 'restante', valor: Math.max(100 - percentual, 0) },
  ]

  return (
    <Card className="lg:sticky lg:top-32">
      <CardHeader className="pb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ano}</p>
        <CardTitle className="text-2xl">{nomeDoMes(mes)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* No celular estes três números já estão na faixa fixa logo acima
            (M6), visíveis o tempo todo — repetir aqui só empurraria o donut
            para fora da tela. Não é função escondida: é a mesma informação em
            outro lugar da MESMA tela. */}
        <div className="hidden space-y-4 sm:block">
          <ItemResumo
            Icone={ArrowUpRight}
            rotulo="Entradas"
            valor={resumo.totalEntradas}
            className="text-success"
          />
          <ItemResumo
            Icone={ArrowDownRight}
            rotulo="Saídas"
            valor={resumo.totalSaidas}
            className="text-destructive"
          />
          <ItemResumo
            Icone={Wallet}
            rotulo="Saldo"
            valor={resumo.saldo}
            className={resumo.saldo < 0 ? 'text-destructive' : 'text-foreground'}
            destaque
          />
        </div>

        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosDonut}
                    dataKey="valor"
                    innerRadius="70%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular">
                {resumo.percentualInvestido.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
              </span>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PiggyBank className="h-4 w-4 text-primary" />
                Investido no mês
              </p>
              <p className="tabular text-lg font-semibold">{formatCentavos(resumo.totalInvestido)}</p>
              <p className="text-xs text-muted-foreground">do total que entrou</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ItemResumo({
  Icone,
  rotulo,
  valor,
  className,
  destaque,
}: {
  Icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  className?: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icone className="h-4 w-4" />
        {rotulo}
      </span>
      <NumeroAnimado
        valor={valor}
        className={cn('tabular font-semibold', destaque ? 'text-lg' : 'text-base', className)}
      />
    </div>
  )
}
