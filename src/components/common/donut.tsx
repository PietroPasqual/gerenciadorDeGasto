import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCentavos } from '@/lib/money'
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
  const comValor = dados.filter((d) => d.valor > 0)
  const total = comValor.reduce((s, d) => s + d.valor, 0)

  if (comValor.length === 0) {
    return <EstadoVazio titulo={titulo ?? 'Sem dados'} descricao={vazioTexto} className="py-8" />
  }

  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={comValor}
            dataKey="valor"
            nameKey="nome"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isAnimationActive
          >
            {comValor.map((fatia, i) => (
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
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(valor) => <span className="text-xs text-muted-foreground">{valor}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
