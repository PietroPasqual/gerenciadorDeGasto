import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/common/money-input'
import { formatCentavos } from '@/lib/money'
import { MESES_CURTOS, nomeDoMes, periodoAtual } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Guardar dinheiro numa meta, a dois toques.
 *
 * O caminho existia — a grade de doze meses no PC, a folha de doze campos no
 * celular —, mas os dois pedem que a pessoa ache a célula certa antes de
 * digitar. Guardar é a ação mais frequente da tela, e a mais frequente merece
 * o caminho mais curto.
 *
 * A AMBIGUIDADE QUE PRECISAVA MORRER
 *
 * `salvarAporte` SUBSTITUI o valor do mês; ele não soma. Um botão "Guardar"
 * com campo vazio, num mês que já tem R$ 500,00, apagaria os R$ 500,00 sem
 * avisar — e ninguém perceberia até conferir o total. Por isso o campo já
 * abre com o valor do mês dentro e o rótulo diz de que mês ele é: o que se vê
 * é o que fica.
 */
export function SheetAporteRapido({
  meta,
  ano,
  valorDoMes,
  onFechar,
  onSalvar,
}: {
  /** `null` = fechada. */
  meta: { id: string; nome: string } | null
  ano: number
  /** Quanto já está guardado naquele mês — vem da mesma fonte da grade. */
  valorDoMes: (mes: number) => number
  onFechar: () => void
  onSalvar: (goalId: string, mes: number, centavos: number) => void
}) {
  const aberta = meta !== null
  // Mês corrente quando o ano aberto é o de hoje; senão janeiro, que é o
  // começo do ano que a pessoa está consultando. Chutar "dezembro" faria um
  // aporte cair no fim de um ano que ela só veio olhar.
  const padrao = () => {
    const agora = periodoAtual()
    return agora.ano === ano ? agora.mes : 1
  }

  const [mes, setMes] = React.useState(padrao)
  const [centavos, setCentavos] = React.useState(0)

  React.useEffect(() => {
    if (!aberta) return
    const inicial = padrao()
    setMes(inicial)
    setCentavos(valorDoMes(inicial))
    // `valorDoMes` muda de identidade a cada render do pai; incluí-la aqui
    // reabriria o formulário a cada tecla digitada em outra parte da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, ano])

  const trocarMes = (novo: number) => {
    setMes(novo)
    // O campo acompanha o mês: é o valor daquele mês que vai ser substituído.
    setCentavos(valorDoMes(novo))
  }

  const jaGuardado = valorDoMes(mes)

  return (
    <Sheet open={aberta} onOpenChange={(a) => !a && onFechar()}>
      <SheetContent aria-describedby={undefined} className="overflow-y-auto">
        <SheetTitle className="mb-1">Guardar em {meta?.nome}</SheetTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          O valor substitui o que estiver guardado no mês escolhido — ele não soma.
        </p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Mês</Label>
            {/* Os doze meses ficam à mão: a fase 6 pede que a edição dos doze
                continue existindo, e aqui ela existe em dois toques. */}
            <div className="grid grid-cols-4 gap-2">
              {MESES_CURTOS.map((nome, i) => {
                const numero = i + 1
                const ativo = numero === mes
                const temValor = valorDoMes(numero) > 0
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => trocarMes(numero)}
                    aria-pressed={ativo}
                    aria-label={`${nomeDoMes(numero)}${temValor ? `, ${formatCentavos(valorDoMes(numero))} guardados` : ''}`}
                    className={cn(
                      'min-h-11 rounded-lg border text-sm transition-colors',
                      ativo
                        ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    {nome}
                    {/* O ponto conta quais meses já têm aporte sem precisar
                        abrir um por um. */}
                    {temValor && (
                      <span
                        aria-hidden
                        className={cn(
                          'mx-auto mt-0.5 block h-1 w-1 rounded-full',
                          ativo ? 'bg-accent-foreground' : 'bg-primary',
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aporte-valor">Guardado em {nomeDoMes(mes)}</Label>
            <MoneyInput
              id="aporte-valor"
              value={centavos}
              onValueChange={setCentavos}
              aria-label={`Valor guardado em ${nomeDoMes(mes)}`}
              className="h-12 text-base"
            />
            {jaGuardado > 0 && centavos !== jaGuardado && (
              <p className="text-xs text-muted-foreground">
                {nomeDoMes(mes)} tinha <strong>{formatCentavos(jaGuardado)}</strong> e vai passar a ter{' '}
                <strong>{formatCentavos(centavos)}</strong>.
              </p>
            )}
          </div>

          <Button
            className="h-12 w-full text-base"
            onClick={() => {
              if (meta) onSalvar(meta.id, mes, centavos)
              onFechar()
            }}
          >
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
