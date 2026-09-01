import * as React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ChevronDown } from 'lucide-react'
import { formatCentavos } from '@/lib/money'
import { useEhMobile } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { EstadoVazio } from './estados'

export interface FatiaDonut {
  nome: string
  valor: number
  cor?: string
}

/** Paleta pastel derivada do tema (usada quando a fatia não traz cor própria). */
const PALETA = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.72)',
  'hsl(var(--primary) / 0.5)',
  '#8fbcd4',
  '#c3b1f6',
  '#f6cfa5',
  '#b1e5c3',
  '#f6a5a5',
  '#a5d8f6',
  '#d8a5f6',
]

/** Acima disso as fatias viram fiapos e a legenda não cabe na tela. */
const TOPO = 5
const COR_OUTROS = 'hsl(var(--muted-foreground) / 0.55)'

export function Donut({
  dados,
  titulo,
  vazioTexto = 'Nada lançado ainda neste mês.',
  altura = 240,
}: {
  dados: FatiaDonut[]
  titulo?: string
  vazioTexto?: string
  altura?: number
}) {
  const ehCelular = useEhMobile(640)
  const [expandido, setExpandido] = React.useState(false)

  const ordenado = React.useMemo(
    () => dados.filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor),
    [dados],
  )
  const total = ordenado.reduce((s, d) => s + d.valor, 0)

  // Agrupar só compensa se sobrarem pelo menos duas fatias para juntar: um
  // "Outros" com um item só é pior do que mostrar o item.
  const agrupa = ordenado.length > TOPO + 1
  const resto = agrupa && !expandido ? ordenado.slice(TOPO) : []
  const fatias: FatiaDonut[] = resto.length
    ? [
        ...ordenado.slice(0, TOPO),
        { nome: `Outros (${resto.length})`, valor: resto.reduce((s, d) => s + d.valor, 0), cor: COR_OUTROS },
      ]
    : ordenado

  if (ordenado.length === 0) {
    return (
      <EstadoVazio
        ilustracao="grafico"
        titulo={titulo ?? 'Sem dados'}
        descricao={vazioTexto}
        className="py-6"
      />
    )
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* No celular o donut encolhe e a legenda desce para uma lista: a
          <Legend> do Recharts empilha os nomes em duas ou três linhas de 10px
          e ainda esconde o valor atrás de um tooltip que dedo nenhum abre. */}
      {/* O desenho fica FORA da árvore de acessibilidade, de propósito.
          A <Legenda> logo abaixo já entrega os mesmos dados em texto — nome,
          valor e percentual, um item de lista por fatia —, e é uma forma
          melhor de ler um gráfico do que caminho por caminho. Sem isto o axe
          marcava `svg-img-alt` (serious) no painel e no resumo do mês: o
          recharts emite <path> sem nome acessível, e o leitor de tela
          anunciava um punhado de formas anônimas antes de chegar na lista que
          de fato responde a pergunta. O tooltip do recharts é de ponteiro, e
          não se perde nada com isto. */}
      <div aria-hidden style={{ height: ehCelular ? 150 : altura }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={fatias}
              dataKey="valor"
              nameKey="nome"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive
              // O <g> raiz do Pie nasce com tabindex=0: uma parada de tabulação
              // dentro de um container aria-hidden, que é armadilha de teclado
              // (axe `aria-hidden-focus`). -1 tira do caminho sem mexer no
              // desenho.
              rootTabIndex={-1}
            >
              {fatias.map((fatia, i) => (
                <Cell key={fatia.nome} fill={fatia.cor || PALETA[i % PALETA.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(valor: number, nome: string) => [
                `${formatCentavos(valor)} (${total ? Math.round((valor / total) * 100) : 0}%)`,
                nome,
              ]}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Legenda fatias={fatias} total={total} />

      {agrupa && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="alvo-toque flex w-full items-center justify-center gap-1 rounded-lg text-sm text-primary-strong md:py-1"
        >
          {expandido ? 'Mostrar só as maiores' : `Mostrar as outras ${ordenado.length - TOPO}`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expandido && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

/** Nome, valor e fatia do total — uma linha por item, alinhados em coluna. */
function Legenda({ fatias, total }: { fatias: FatiaDonut[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {fatias.map((fatia, i) => (
        <li key={fatia.nome} className="flex items-baseline gap-2 text-sm">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-full"
            style={{ backgroundColor: fatia.cor || PALETA[i % PALETA.length] }}
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{fatia.nome}</span>
          <span className="tabular shrink-0 font-medium">{formatCentavos(fatia.valor)}</span>
          <span className="tabular w-9 shrink-0 text-right text-xs text-muted-foreground">
            {total ? Math.round((fatia.valor / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  )
}
