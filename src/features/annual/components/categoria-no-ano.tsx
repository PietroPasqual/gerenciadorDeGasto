import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoVazio } from '@/components/common/estados'
import { LinkAjuda } from '@/components/common/link-ajuda'
import { formatCentavos, formatCentavosCompacto } from '@/lib/money'
import { nomeCurtoDoMes, nomeDoMes } from '@/lib/dates'
import { chaveDaSerie, type SerieCategoria } from '@/lib/categoria-no-ano'
import { textoDaBase } from '@/lib/comparativo'
import { cn } from '@/lib/utils'

/**
 * Uma categoria, doze meses.
 *
 * O comparativo respondia "quanto entrou e quanto saiu" e parava aí. A pergunta
 * que traz alguém a esta tela é outra — "o mercado está subindo?" —, e até
 * agora respondê-la exigia abrir doze meses e anotar o número de cada um.
 *
 * MEDIDA DIFERENTE DO RESTO DA TELA, E POR ISSO ESCRITA
 *
 * Os números de cima são de CAIXA (o mês em que a fatura vence), decisão da
 * migration 0016. Este bloco é de COMPETÊNCIA — o mês da compra —, porque
 * "onde meu dinheiro foi" é a pergunta de competência, e é a mesma medida do
 * donut do painel e da aba Análise. Duas medidas na mesma tela só é honesto se
 * as duas se apresentarem, então esta se apresenta.
 */
export function CategoriaNoAno({
  series,
  ano,
  mesesRealizados,
  primeiroPrevisto,
}: {
  series: SerieCategoria[]
  ano: number
  /** Os meses (1–12) que já aconteceram — vira o rótulo do total. */
  mesesRealizados: number[]
  /** Onde a previsão começa, para marcar a faixa. `null` = ano todo realizado. */
  primeiroPrevisto: number | null
}) {
  const [escolhida, setEscolhida] = React.useState<string | null>(null)

  // A maior é o padrão: quem abre isto quase sempre veio olhar a que mais pesa,
  // e obrigar a escolher antes de mostrar qualquer coisa é um passo a mais por
  // nada. `?? series[0]` e não um estado inicial derivado porque a lista chega
  // depois do primeiro render.
  const serie = series.find((s) => chaveDaSerie(s) === escolhida) ?? series[0]

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Uma categoria ao longo do ano</CardTitle>
        </CardHeader>
        <CardContent>
          <EstadoVazio
            ilustracao="grafico"
            titulo={`Nenhum gasto por categoria em ${ano}`}
            descricao="Lance gastos com categoria no controle mensal para acompanhar cada uma ao longo do ano."
          />
        </CardContent>
      </Card>
    )
  }

  const dados = serie.valores.map((valor, i) => ({
    mes: nomeCurtoDoMes(i + 1),
    numeroMes: i + 1,
    valor: valor / 100,
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Uma categoria ao longo do ano</CardTitle>
        <CardDescription>
          Pela data da compra, e não pelo vencimento da fatura — diferente dos números do topo desta tela.
        </CardDescription>
        <LinkAjuda topico="competencia-e-caixa">O que muda entre uma medida e a outra</LinkAjuda>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rola de lado no celular: uma pessoa tem dez, doze categorias, e
            abreviar os nomes para caber esconderia justamente qual é qual.
            Sem tabIndex na faixa — os botões dentro dela já recebem foco. */}
        <div
          role="group"
          aria-label="Escolher a categoria"
          className="sem-barra-rolagem -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {series.map((s) => {
            const chave = chaveDaSerie(s)
            const ativa = chaveDaSerie(serie) === chave
            return (
              <button
                key={chave}
                type="button"
                onClick={() => setEscolhida(chave)}
                aria-pressed={ativa}
                className={cn(
                  'alvo-toque flex shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors',
                  ativa
                    ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                    : 'border-border hover:bg-accent',
                )}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.cor }}
                />
                {s.nome}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Total em {textoDaBase(mesesRealizados)}: </span>
            <strong className="tabular">{formatCentavos(serie.totalRealizado)}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Média por mês com gasto: </span>
            <strong className="tabular">{formatCentavos(serie.media)}</strong>
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCentavosCompacto(v * 100)}
                width={70}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--realce))' }}
                content={<DicaCategoria nome={serie.nome} />}
              />
              {primeiroPrevisto !== null && (
                <ReferenceArea
                  x1={nomeCurtoDoMes(primeiroPrevisto)}
                  x2={nomeCurtoDoMes(12)}
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.07}
                  label={{
                    value: 'previsto',
                    position: 'insideTopLeft',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                  }}
                />
              )}
              <Bar dataKey="valor" fill={serie.cor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* O gráfico é a única forma de ler estes doze números na tela, e ele
            não existe para quem usa leitor de tela. A lista abaixo é a mesma
            informação em texto — barata de manter porque sai da mesma série. */}
        <ul className="sr-only">
          {serie.valores.map((valor, i) => (
            <li key={i}>
              {nomeDoMes(i + 1)}: {formatCentavos(valor)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function DicaCategoria({
  active,
  payload,
  label,
  nome,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
  nome: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{nome}</p>
      <p className="tabular mt-1 text-sm font-semibold">{formatCentavos((payload[0].value ?? 0) * 100)}</p>
    </div>
  )
}
