import { CalendarClock, CheckCircle2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { formatDataISO, paraDataISO } from '@/lib/dates'
import { vencimentoAdiado, vencimentoDaFatura } from '@/lib/fatura'
import type { FaturaDoMes } from '@/services/invoices'
import { cn } from '@/lib/utils'

/**
 * As faturas que vencem no mês aberto.
 *
 * Existe porque o cartão é a única saída do mês que a pessoa não consegue
 * conferir olhando os lançamentos: as compras que compõem a fatura estão nos
 * meses ANTERIORES. Sem este bloco, o número do saldo mudaria por causa de
 * algo que não aparece em lugar nenhum da tela.
 */
export function PainelFaturas({
  ano,
  mes,
  faturas,
  onAlternarPaga,
}: {
  ano: number
  mes: number
  faturas: FaturaDoMes[]
  onAlternarPaga: (payment_method_id: string, paga: boolean) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
          Faturas que vencem neste mês
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {faturas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma fatura neste mês"
            descricao="Cartões de crédito com fechamento configurado aparecem aqui, com o que vence e quando."
            ilustracao="lista"
          />
        ) : (
          <ul className="space-y-2">
            {faturas.map((f) => (
              <li key={f.payment_method_id}>
                <LinhaFatura
                  fatura={f}
                  ano={ano}
                  mes={mes}
                  onAlternarPaga={(paga) => onAlternarPaga(f.payment_method_id, paga)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function LinhaFatura({
  fatura,
  ano,
  mes,
  onAlternarPaga,
}: {
  fatura: FaturaDoMes
  ano: number
  mes: number
  onAlternarPaga: (paga: boolean) => void
}) {
  const vencimentoISO =
    fatura.dia_vencimento !== null ? vencimentoDaFatura({ ano, mes }, fatura.dia_vencimento) : null
  const adiado = fatura.dia_vencimento !== null && vencimentoAdiado({ ano, mes }, fatura.dia_vencimento)
  // Atrasada só faz sentido para fatura não paga com vencimento no passado.
  const atrasada = !fatura.paga && vencimentoISO !== null && vencimentoISO < paraDataISO(new Date())

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        fatura.paga ? 'border-success/40 bg-success/5' : 'border-border',
        atrasada && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{fatura.nome}</p>
          <p className="text-xs text-muted-foreground">
            Compras de {formatDataISO(fatura.primeira_compra)} a {formatDataISO(fatura.ultima_compra)}
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums">{formatCentavos(fatura.total_centavos)}</p>
      </div>

      {vencimentoISO && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-sm',
            atrasada ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
          {atrasada ? 'Venceu em' : 'Vence em'} {formatDataISO(vencimentoISO)}
          {adiado && ' (caiu no fim de semana)'}
        </p>
      )}

      {/* Pagar é uma tocada só, e o alvo tem 44px porque no celular esta é a
          única forma de marcar. */}
      <Button
        variant={fatura.paga ? 'outline' : 'default'}
        className="mt-3 min-h-11 w-full"
        onClick={() => onAlternarPaga(!fatura.paga)}
      >
        {fatura.paga ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4 text-success" aria-hidden />
            Fatura paga — desmarcar
          </>
        ) : (
          'Marcar fatura como paga'
        )}
      </Button>
    </div>
  )
}
