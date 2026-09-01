import { AlertTriangle, BellRing, CalendarClock, CreditCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentavos } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Lembrete, TipoLembrete } from '@/lib/lembretes'

const ICONE: Record<TipoLembrete, typeof BellRing> = {
  'fatura-fechando': CreditCard,
  'fatura-vencendo': CalendarClock,
  'fixo-vencendo': CalendarClock,
}

/**
 * O que vence agora.
 *
 * Fica no topo da aba Resumo, acima de tudo: um aviso de vencimento embaixo de
 * três gráficos não é aviso, é rodapé.
 *
 * Some inteiro quando não há nada — um card dizendo "nenhum vencimento por
 * perto" ocuparia a melhor posição da tela para não informar nada.
 */
export function PainelLembretes({ lembretes }: { lembretes: Lembrete[] }) {
  const navegar = useNavigate()
  if (lembretes.length === 0) return null

  const temAtrasado = lembretes.some((l) => l.atrasado)

  return (
    <Card className={cn(temAtrasado ? 'border-destructive/40' : 'border-primary/30')}>
      <CardContent className="space-y-1 p-3">
        <p className="flex items-center gap-2 px-1 pb-1 text-sm font-medium text-muted-foreground">
          <BellRing className="h-4 w-4 shrink-0" aria-hidden />
          {temAtrasado ? 'Tem coisa vencida' : 'Vence por aqui'}
        </p>

        <ul className="space-y-1">
          {lembretes.map((l) => {
            const Icone = l.atrasado ? AlertTriangle : ICONE[l.tipo]
            return (
              <li key={l.id}>
                {/* A linha inteira é o alvo, com 44px — no celular ela é o
                    caminho para a tela onde a pessoa resolve o vencimento. */}
                <button
                  type="button"
                  onClick={() => navegar(l.para)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-realce',
                  )}
                >
                  <Icone
                    className={cn('h-4 w-4 shrink-0', l.atrasado ? 'text-destructive' : 'text-primary')}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {l.titulo} <span className={cn(l.atrasado && 'text-destructive')}>{l.quando}</span>
                    </span>
                  </span>
                  {l.valorCentavos !== null && (
                    <span className="tabular shrink-0 text-sm font-medium">
                      {formatCentavos(l.valorCentavos)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
