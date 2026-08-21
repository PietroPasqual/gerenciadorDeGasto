import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/common/money-input'
import { Total } from '@/components/common/linha-planilha'
import { formatCentavos } from '@/lib/money'
import { MESES, nomeDoMes } from '@/lib/dates'

/**
 * Os doze meses de UMA meta.
 *
 * A grade meta x mês tem 52rem de largura: no celular ela virava uma tabela
 * rolando de lado com campos de 32px — abaixo do mínimo de toque, e sem o nome
 * da meta à vista depois da segunda coluna. Aqui a pessoa escolhe a meta e
 * edita o ano dela inteiro numa lista de campos em tamanho de dedo.
 */
export function SheetMeta({
  aberta,
  onOpenChange,
  ano,
  meta,
  valorDoMes,
  onSalvar,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  ano: number
  meta: { id: string; nome: string } | null
  valorDoMes: (goalId: string, mes: number) => number
  onSalvar: (goalId: string, mes: number, valor: number) => void
}) {
  if (!meta) return null

  const total = MESES.reduce((soma, _, i) => soma + valorDoMes(meta.id, i + 1), 0)

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{meta.nome}</SheetTitle>
        <SheetDescription className="mb-4">Quanto você guardou em cada mês de {ano}.</SheetDescription>

        <ul className="space-y-1.5">
          {MESES.map((nome, indice) => {
            const mes = indice + 1
            return (
              <li key={nome} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-muted-foreground">{nome}</span>
                <MoneyInput
                  aria-label={`${meta.nome} em ${nomeDoMes(mes)}`}
                  value={valorDoMes(meta.id, mes)}
                  onValueChange={(valor) => onSalvar(meta.id, mes, valor)}
                  className="min-w-0 flex-1"
                />
              </li>
            )
          })}
        </ul>

        <Total className="mt-4" rotulo={`Total em ${ano}`} valor={formatCentavos(total)} />
      </SheetContent>
    </Sheet>
  )
}
