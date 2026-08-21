import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MESES_CURTOS, anosDisponiveis } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Escolha de mês no celular: ano fixo à esquerda, doze pílulas deslizando à
 * direita.
 *
 * O seletor antigo (‹ + combo de mês + combo de ano + ›) gastava a largura
 * toda e ainda escondia onde você está no ano: para ir de Março a Setembro
 * eram seis toques na seta ou dois toques e uma lista. Aqui o ano inteiro
 * está ali, um toque para qualquer mês, e a pílula acesa mostra a posição.
 * No desktop continua o SeletorPeriodo — lá o combo é mais rápido que
 * arrastar.
 */
export function FaixaMeses({
  ano,
  mes,
  onChange,
  className,
}: {
  ano: number
  mes: number
  onChange: (periodo: { ano: number; mes: number }) => void
  className?: string
}) {
  const faixaRef = React.useRef<HTMLDivElement | null>(null)
  const refs = React.useRef(new Map<number, HTMLButtonElement>())
  const jaMontou = React.useRef(false)

  // Centraliza o mês ativo — inclusive quando ele muda pelo swipe (M7), que é
  // o caso em que a pílula certa costuma estar fora da parte visível.
  React.useEffect(() => {
    const faixa = faixaRef.current
    const pilula = refs.current.get(mes)
    if (!faixa || !pilula) return
    // `offsetLeft` é medido a partir do offsetParent — por isso a faixa é
    // `relative`. Sem isso a conta usa a posição de um ancestral qualquer e a
    // pílula ativa para cortada na borda.
    faixa.scrollTo?.({
      left: Math.max(pilula.offsetLeft - (faixa.clientWidth - pilula.offsetWidth) / 2, 0),
      behavior: jaMontou.current ? 'smooth' : 'auto',
    })
    jaMontou.current = true
  }, [mes, ano])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={String(ano)} onValueChange={(v) => onChange({ ano: Number(v), mes })}>
        <SelectTrigger className="w-[5.5rem] shrink-0" aria-label="Ano">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anosDisponiveis().map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* -mr-4 + pr-4: as pílulas deslizam até a borda da tela, senão a última
          fica sempre meio escondida atrás da margem do container. */}
      <div
        ref={faixaRef}
        role="group"
        aria-label="Mês"
        className="sem-barra-rolagem relative -mr-4 min-w-0 flex-1 overflow-x-auto pr-4"
      >
        <div className="flex w-max gap-1.5">
          {MESES_CURTOS.map((nome, i) => {
            const numero = i + 1
            const ativo = numero === mes
            return (
              <button
                key={nome}
                type="button"
                ref={(el) => {
                  if (el) refs.current.set(numero, el)
                  else refs.current.delete(numero)
                }}
                aria-current={ativo ? 'true' : undefined}
                onClick={() => onChange({ ano, mes: numero })}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm transition-colors',
                  ativo ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {nome}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
