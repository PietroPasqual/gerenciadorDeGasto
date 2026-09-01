import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { formatCentavos } from '@/lib/money'
import { nomeDoMes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { CaixaDoMes, ResumoCalculado } from '@/lib/calculations'

/**
 * Resumo lateral do mês: entradas, saídas, saldo e donut de % investido.
 *
 * Com cartão de crédito, "quanto gastei" e "quanto sai da conta" deixam de ser
 * o mesmo número, e o saldo passa a usar o segundo. Os dois aparecem juntos,
 * com nomes diferentes — mostrar um só deixaria o donut de categorias somando
 * um valor que não bate com o cabeçalho, sem nada explicando a diferença.
 *
 * Quem não tem cartão com fatura configurada vê exatamente a tela de antes: os
 * dois números são iguais e só um é mostrado.
 */
export function ResumoMes({
  ano,
  mes,
  resumo,
  caixa,
}: {
  ano: number
  mes: number
  resumo: ResumoCalculado
  caixa: CaixaDoMes
}) {
  const percentual = Math.min(resumo.percentualInvestido, 100)
  // Sem cartão com fatura os dois totais são idênticos; nesse caso a tela não
  // ganha uma linha nova para dizer a mesma coisa duas vezes.
  const temFatura = caixa.totalSaidasCaixa !== resumo.totalSaidas
  const saldoCaixa = resumo.totalEntradas - caixa.totalSaidasCaixa
  const dadosDonut = [
    { nome: 'investido', valor: percentual },
    { nome: 'restante', valor: Math.max(100 - percentual, 0) },
  ]

  return (
    // top-8 e não top-32: o 32 descontava o header + as abas, que a partir de
    // lg deram lugar à barra lateral (D1) e não ocupam mais altura nenhuma.
    <Card className="xl:sticky xl:top-8">
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
            rotulo={temFatura ? 'Gastei' : 'Saídas'}
            valor={resumo.totalSaidas}
            className="text-destructive"
          />
          {temFatura && (
            <ItemResumo
              Icone={CreditCard}
              rotulo="Sai da conta"
              valor={caixa.totalSaidasCaixa}
              className="text-destructive"
            />
          )}
          <ItemResumo
            Icone={Wallet}
            rotulo="Saldo"
            valor={saldoCaixa}
            className={saldoCaixa < 0 ? 'text-destructive' : 'text-foreground'}
            destaque
          />
          {temFatura && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {caixa.adiadoParaFatura > 0 && (
                <>
                  <strong>{formatCentavos(caixa.adiadoParaFatura)}</strong> deste mês foram no crédito e só
                  saem numa fatura futura.{' '}
                </>
              )}
              {caixa.totalFaturas > 0 && (
                <>
                  <strong>{formatCentavos(caixa.totalFaturas)}</strong> em faturas de meses anteriores vencem
                  agora.
                </>
              )}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-superficie p-4">
          {/* Empilhado e não lado a lado: na coluna de 3/12 (D2) sobravam 82px
              para o texto e "do total que entrou" quebrava em quatro linhas. */}
          <div className="flex flex-col items-center gap-2 text-center">
            {/* O anel é decorativo: o percentual que ele desenha já está em
                texto no <span> logo abaixo, e o valor investido embaixo dele.
                Fora da árvore de acessibilidade, o leitor de tela lê o número
                em vez de dois caminhos SVG sem nome (axe `svg-img-alt`). */}
            <div aria-hidden className="relative h-24 w-24 shrink-0">
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
                    // Ver donut.tsx: sem isto o <g> raiz fica tabulável dentro
                    // do aria-hidden.
                    rootTabIndex={-1}
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
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
                <PiggyBank className="h-4 w-4 shrink-0 text-primary" />
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
