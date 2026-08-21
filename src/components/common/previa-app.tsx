import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const GASTOS = [
  { nome: 'Mercado', valor: '234,50', cor: '#f472b6' },
  { nome: 'Transporte', valor: '32,00', cor: '#60a5fa' },
  { nome: 'Farmácia', valor: '156,70', cor: '#fbbf24' },
  { nome: 'Lazer', valor: '80,00', cor: '#4ade80' },
]

/**
 * Miniatura do controle mensal, para a landing e o login (D8).
 *
 * É DOM, não imagem. Um print viraria quatro arquivos (uma cor de tema x
 * claro/escuro) que envelhecem no dia em que a tela mudar, pesam no primeiro
 * carregamento e ficam borrados no retina. Aqui a prévia usa as mesmas
 * variáveis do app: acompanha o tema e o modo escuro sozinha, e o "print"
 * nunca fica desatualizado.
 *
 * Decorativa de ponta a ponta — `aria-hidden`, sem foco e sem link. Quem lê
 * com leitor de tela recebe o texto ao lado, que é onde está a informação.
 */
export function PreviaApp({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none select-none overflow-hidden rounded-2xl border border-border bg-background shadow-2',
        className,
      )}
    >
      {/* topo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="h-3 w-3" />
        </span>
        <span className="titulo-serif text-sm">
          fin<span className="text-primary-strong">Z</span>
        </span>
        <span className="ml-auto text-[0.65rem] text-muted-foreground">Agosto</span>
      </div>

      <div className="space-y-3 p-4">
        {/* faixa de resumo */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { rotulo: 'Entradas', valor: 'R$ 6.434', classe: 'text-success' },
            { rotulo: 'Saídas', valor: 'R$ 2.630', classe: 'text-destructive' },
            { rotulo: 'Saldo', valor: 'R$ 3.804', classe: 'text-foreground' },
          ].map((c) => (
            <div key={c.rotulo}>
              <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{c.rotulo}</p>
              <p className={cn('tabular text-xs font-semibold', c.classe)}>{c.valor}</p>
            </div>
          ))}
        </div>

        {/* lista de gastos */}
        <div className="space-y-1.5 rounded-xl border border-border p-2.5">
          <p className="text-[0.65rem] font-medium">Gastos do mês</p>
          {GASTOS.map((g) => (
            <div key={g.nome} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: g.cor }} />
              <span className="flex-1 truncate text-[0.65rem] text-muted-foreground">{g.nome}</span>
              <span className="tabular text-[0.65rem] font-medium">{g.valor}</span>
            </div>
          ))}
        </div>

        {/* meta com barra de progresso */}
        <div className="space-y-1.5 rounded-xl border border-border p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[0.65rem] font-medium">Reserva de emergência</span>
            <span className="tabular text-[0.6rem] text-muted-foreground">62%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[62%] rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
