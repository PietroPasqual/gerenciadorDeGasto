import { useMemo } from 'react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { useRegistrarAcoes } from '@/store/acoes-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { Cabecalho, Total } from '@/components/common/linha-planilha'
import { useRecurso } from '@/lib/hooks'
import { obterComparativoAnual } from '@/services/reports'
import { formatCentavos, formatCentavosCompacto } from '@/lib/money'
import { ehFuturo, nomeCurtoDoMes, nomeDoMes } from '@/lib/dates'
import { mediaMensal } from '@/lib/calculations'
import { baixarCSV, csvMoeda, gerarCSV } from '@/lib/csv'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'

const TEMPLATE = 'md:grid-cols-[1fr,1fr,1fr,1fr]'

export function ComparativoAnualPage() {
  const { anoComparativo, definirAnoComparativo, definirPeriodo } = usePeriodoStore()

  // Agregado calculado no banco (função SQL comparativo_anual)
  const { dados, carregando, erro, recarregar } = useRecurso(
    () => obterComparativoAnual(anoComparativo),
    [anoComparativo],
  )

  const meses = dados ?? []

  const totais = useMemo(() => {
    const entradas = meses.reduce((s, m) => s + m.entradas, 0)
    const saidas = meses.reduce((s, m) => s + m.saidas, 0)
    return {
      entradas,
      saidas,
      diferenca: entradas - saidas,
      mediaEntradas: mediaMensal(meses.map((m) => m.entradas)),
      mediaSaidas: mediaMensal(meses.map((m) => m.saidas)),
    }
  }, [meses])

  const dadosGrafico = meses.map((m) => ({
    mes: nomeCurtoDoMes(m.mes),
    Entradas: m.entradas / 100,
    Gastos: m.saidas / 100,
  }))

  const exportar = () => {
    const conteudo = gerarCSV(
      ['Mês', 'Entrada (R$)', 'Gastos (R$)', 'Diferença (R$)'],
      meses.map((m) => [nomeDoMes(m.mes), csvMoeda(m.entradas), csvMoeda(m.saidas), csvMoeda(m.diferenca)]),
    )
    baixarCSV(`comparativo-${anoComparativo}.csv`, conteudo)
  }

  const semDados = meses.every((m) => m.entradas === 0 && m.saidas === 0)

  useRegistrarAcoes(
    () => [
      {
        id: 'exportar-ano',
        rotulo: 'Exportar CSV',
        Icone: Download,
        desabilitada: !dados,
        executar: exportar,
      },
    ],
    [dados, anoComparativo],
  )

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Comparativo anual"
        descricao="Entrada x gastos mês a mês, para enxergar o ano inteiro de uma vez."
        acoes={
          <>
            <SeletorPeriodo
              ano={anoComparativo}
              mostrarMes={false}
              onChange={({ ano }) => definirAnoComparativo(ano)}
            />
            {/* Duplicata visual: no celular a mesma ação está no menu "⋯". */}
            <Button variant="outline" className="hidden sm:inline-flex" onClick={exportar} disabled={!dados}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : semDados ? (
        <EstadoVazio
          titulo={`Nada lançado em ${anoComparativo}`}
          descricao="Lance entradas e gastos no controle mensal para ver o comparativo."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <CardIndicador rotulo="Total de entradas" valor={totais.entradas} className="text-success" />
            <CardIndicador rotulo="Total de gastos" valor={totais.saidas} className="text-destructive" />
            <CardIndicador
              rotulo="Diferença no ano"
              valor={totais.diferenca}
              className={totais.diferenca < 0 ? 'text-destructive' : 'text-success'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Mês a mês</CardTitle>
                <CardDescription>Meses com diferença negativa aparecem destacados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Cabecalho template={TEMPLATE}>
                  <span>Mês</span>
                  <span className="text-right">Entrada</span>
                  <span className="text-right">Gastos</span>
                  <span className="text-right">Diferença</span>
                </Cabecalho>

                {/* Aqui a linha NÃO usa o card empilhado padrão: comparar 12 meses
                    exige linhas curtas. No celular vira duas linhas de texto
                    (mês + diferença em cima, entrou/saiu embaixo); no desktop
                    volta a ser a tabela de 4 colunas. */}
                {meses.map((linha) => {
                  const negativo = linha.diferenca < 0
                  const futuro = ehFuturo({ ano: anoComparativo, mes: linha.mes })
                  return (
                    <div
                      key={linha.mes}
                      role="row"
                      className={cn(
                        'grid grid-cols-1 gap-0.5 rounded-xl border border-border px-3 py-2 transition-colors',
                        'md:grid-cols-[1fr,1fr,1fr,1fr] md:items-center md:gap-2 md:rounded-none md:border-0 md:border-b md:py-1.5',
                        'hover:bg-accent/40',
                        negativo && !futuro && 'bg-destructive/5',
                        futuro && 'opacity-60',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2 md:block">
                        <button
                          type="button"
                          onClick={() => definirPeriodo({ ano: anoComparativo, mes: linha.mes })}
                          className="rounded-md text-left text-sm font-medium hover:underline"
                        >
                          {nomeDoMes(linha.mes)}
                          {futuro && (
                            <Badge variant="outline" className="ml-2">
                              previsto
                            </Badge>
                          )}
                        </button>
                        <span
                          className={cn(
                            'tabular text-sm font-semibold md:hidden',
                            negativo ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {formatCentavos(linha.diferenca)}
                        </span>
                      </div>

                      {/* md:contents devolve estes dois valores às colunas da tabela */}
                      <div className="flex items-baseline gap-3 text-xs text-muted-foreground md:contents">
                        <span className="md:text-right md:text-sm md:text-foreground">
                          <span className="md:hidden">entrou </span>
                          <span className="tabular">{formatCentavos(linha.entradas)}</span>
                        </span>
                        <span className="md:text-right md:text-sm md:text-foreground">
                          <span className="md:hidden">saiu </span>
                          <span className="tabular">{formatCentavos(linha.saidas)}</span>
                        </span>
                      </div>

                      <span
                        className={cn(
                          'hidden tabular text-sm font-medium md:block md:text-right',
                          negativo ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {formatCentavos(linha.diferenca)}
                      </span>
                    </div>
                  )
                })}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Total rotulo="Média de entradas" valor={formatCentavos(totais.mediaEntradas)} />
                  <Total rotulo="Média de gastos" valor={formatCentavos(totais.mediaSaidas)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Entrada x gastos</CardTitle>
                <CardDescription>Valores em reais ao longo de {anoComparativo}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[22rem] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosGrafico} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatCentavosCompacto(v * 100)}
                        width={70}
                      />
                      <Tooltip
                        formatter={(valor: number) => formatCentavos(valor * 100)}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: 12,
                        }}
                      />
                      <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                      <Line
                        type="monotone"
                        dataKey="Entradas"
                        stroke="hsl(var(--success))"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Gastos"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function CardIndicador({ rotulo, valor, className }: { rotulo: string; valor: number; className?: string }) {
  const Icone = valor < 0 ? TrendingDown : TrendingUp
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <p className={cn('tabular text-xl font-semibold', className)}>{formatCentavos(valor)}</p>
        </div>
        <Icone className={cn('h-5 w-5', className)} />
      </CardContent>
    </Card>
  )
}
