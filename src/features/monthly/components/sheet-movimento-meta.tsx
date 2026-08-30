import * as React from 'react'
import { ArrowRightLeft, ArrowDownLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/common/money-input'
import { SelectSimples } from '@/components/common/select-simples'
import { formatCentavos } from '@/lib/money'
import { nomeDoMes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Goal } from '@/lib/database.types'

export type TipoMovimento = 'resgate' | 'transferencia'

/**
 * Tirar dinheiro de uma meta, ou mover entre metas.
 *
 * As duas ações moram na mesma sheet porque são a mesma pergunta com um
 * destino a mais: "de onde sai, quanto, e para onde vai (ou para o bolso)".
 * Separá-las em duas telas faria a pessoa escolher antes de saber o que quer.
 *
 * O saldo de cada meta aparece o tempo todo: sem ele, "resgatar R$ 500" é um
 * palpite, e o erro só apareceria depois de o banco recusar.
 */
export function SheetMovimentoMeta({
  aberta,
  onOpenChange,
  metas,
  saldos,
  ano,
  mes,
  onResgatar,
  onTransferir,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  metas: Goal[]
  /** Acumulado de cada meta, por id — é o teto do que dá para tirar. */
  saldos: Record<string, number>
  ano: number
  mes: number
  onResgatar: (goalId: string, centavos: number) => void
  onTransferir: (origem: string, destino: string, centavos: number) => void
}) {
  const [tipo, setTipo] = React.useState<TipoMovimento>('resgate')
  const [origem, setOrigem] = React.useState<string | null>(null)
  const [destino, setDestino] = React.useState<string | null>(null)
  const [centavos, setCentavos] = React.useState(0)

  React.useEffect(() => {
    if (!aberta) return
    setTipo('resgate')
    setOrigem(metas[0]?.id ?? null)
    setDestino(null)
    setCentavos(0)
  }, [aberta, metas])

  const saldoOrigem = origem ? (saldos[origem] ?? 0) : 0
  const passouDoSaldo = centavos > saldoOrigem
  const metasDestino = metas.filter((m) => m.id !== origem)

  const valido =
    origem !== null &&
    centavos > 0 &&
    !passouDoSaldo &&
    (tipo === 'resgate' || (destino !== null && destino !== origem))

  const confirmar = () => {
    if (!valido || !origem) return
    if (tipo === 'resgate') onResgatar(origem, centavos)
    else onTransferir(origem, destino as string, centavos)
    onOpenChange(false)
  }

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="overflow-y-auto">
        <SheetTitle>Mexer no dinheiro das metas</SheetTitle>
        <SheetDescription className="mb-4">
          O movimento entra em {nomeDoMes(mes).toLowerCase()} de {ano}.
        </SheetDescription>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(
              [
                ['resgate', 'Resgatar', ArrowDownLeft],
                ['transferencia', 'Transferir', ArrowRightLeft],
              ] as const
            ).map(([valor, rotulo, Icone]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTipo(valor)}
                aria-pressed={tipo === valor}
                className={cn(
                  'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                  tipo === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-accent',
                )}
              >
                <Icone className="h-4 w-4" aria-hidden />
                {rotulo}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{tipo === 'resgate' ? 'Tirar de' : 'Sai de'}</Label>
            <SelectSimples
              valor={origem}
              onChange={(v) => {
                setOrigem(v)
                if (v === destino) setDestino(null)
              }}
              opcoes={metas}
              placeholder="Escolha a meta"
              rotuloVazio="Escolha a meta"
              ariaLabel={tipo === 'resgate' ? 'Meta de onde tirar' : 'Meta de origem'}
              className="h-11 border-input md:h-10"
            />
            {origem && (
              <p className="text-xs text-muted-foreground">
                Guardado nesta meta: <strong>{formatCentavos(saldoOrigem)}</strong>
              </p>
            )}
          </div>

          {tipo === 'transferencia' && (
            <div className="space-y-1.5">
              <Label>Vai para</Label>
              <SelectSimples
                valor={destino}
                onChange={setDestino}
                opcoes={metasDestino}
                placeholder="Escolha a meta"
                rotuloVazio="Escolha a meta"
                ariaLabel="Meta de destino"
                className="h-11 border-input md:h-10"
              />
              {metasDestino.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Transferir precisa de duas metas. Crie outra em Configurações.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="movimento-valor">Valor</Label>
            <MoneyInput
              id="movimento-valor"
              value={centavos}
              onValueChange={setCentavos}
              aria-label="Valor do movimento"
              className="h-12 text-base"
            />
            {passouDoSaldo && (
              <p className="text-sm text-destructive">
                Essa meta só tem {formatCentavos(saldoOrigem)} guardados.
              </p>
            )}
          </div>

          {/* O efeito no resumo do mês, dito antes de salvar. A diferença entre
              as duas ações é justamente essa, e ela não é óbvia. */}
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {tipo === 'resgate'
              ? 'Resgatar reduz o total investido do mês — é dinheiro que voltou para você.'
              : 'Transferir não muda o total investido do mês: sai de uma meta e entra na outra.'}
          </p>
        </div>

        <Button className="mt-4 min-h-11 w-full" disabled={!valido} onClick={confirmar}>
          {tipo === 'resgate' ? 'Resgatar' : 'Transferir'}
          {centavos > 0 && ` ${formatCentavos(centavos)}`}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
