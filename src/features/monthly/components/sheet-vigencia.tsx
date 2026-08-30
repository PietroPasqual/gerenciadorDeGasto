import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SwitchTrack } from '@/components/ui/switch'
import { MESES, anosDisponiveis, nomeCurtoDoMes } from '@/lib/dates'
import type { Vigencia } from '@/lib/calculations'

/** "todo mês" · "desde ago/26" · "até jun/26" · "ago/26 – jun/26" */
export function textoVigencia(v: Vigencia): string {
  const de =
    v.inicio_ano !== null && v.inicio_mes !== null
      ? `${nomeCurtoDoMes(v.inicio_mes).toLowerCase()}/${String(v.inicio_ano).slice(2)}`
      : null
  const ate =
    v.fim_ano !== null && v.fim_mes !== null
      ? `${nomeCurtoDoMes(v.fim_mes).toLowerCase()}/${String(v.fim_ano).slice(2)}`
      : null
  if (de && ate) return `${de} – ${ate}`
  if (de) return `desde ${de}`
  if (ate) return `até ${ate}`
  return 'todo mês'
}

/**
 * Desde quando (e até quando) este gasto fixo é pago.
 *
 * Sem isto um aluguel cadastrado em agosto era somado nos doze meses do ano,
 * inventando saída em janeiro; e a única forma de encerrar um fixo era apagá-lo
 * de todos os meses, inclusive dos que foram pagos. Duas datas resolvem os dois
 * lados.
 */
export function SheetVigencia({
  aberta,
  onOpenChange,
  nome,
  vigencia,
  anoAtual,
  mesAtual,
  onSalvar,
  verbo = 'paga',
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  nome: string
  vigencia: Vigencia
  /**
   * 'paga' para gasto fixo, 'recebe' para entrada recorrente. A mecânica é a
   * mesma dos dois lados (0012 reusa a mesma `fixo_vigente`), só a frase muda —
   * e "Quando você paga Salário?" seria absurdo o bastante para a pessoa
   * desconfiar do que está salvando.
   */
  verbo?: 'paga' | 'recebe'
  /** Mês aberto na tela — vira o padrão de "encerrar" e de "desde". */
  anoAtual: number
  mesAtual: number
  onSalvar: (v: Vigencia) => void
}) {
  const [rascunho, setRascunho] = React.useState<Vigencia>(vigencia)

  // Reabrir a sheet noutro gasto fixo não pode mostrar o rascunho do anterior.
  React.useEffect(() => {
    if (aberta) setRascunho(vigencia)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, vigencia.inicio_ano, vigencia.inicio_mes, vigencia.fim_ano, vigencia.fim_mes])

  const temInicio = rascunho.inicio_ano !== null
  const temFim = rascunho.fim_ano !== null

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>
          Quando você {verbo} {nome}?
        </SheetTitle>
        <SheetDescription className="mb-4">
          {verbo === 'paga'
            ? 'Fora deste período o gasto não entra na conta do mês — é o que evita ele aparecer em meses que você ainda não pagava.'
            : 'Fora deste período a entrada não conta no mês. Encerrar aqui preserva o histórico: os meses em que você recebeu continuam com o valor certo.'}
        </SheetDescription>

        <div className="space-y-4">
          <LinhaPeriodo
            rotulo={verbo === 'paga' ? 'Pago desde' : 'Recebo desde'}
            semData="Desde sempre"
            ativo={temInicio}
            ano={rascunho.inicio_ano}
            mes={rascunho.inicio_mes}
            onAlternar={(ligado) =>
              setRascunho((r) => ({
                ...r,
                inicio_ano: ligado ? anoAtual : null,
                inicio_mes: ligado ? mesAtual : null,
              }))
            }
            onChange={(ano, mes) => setRascunho((r) => ({ ...r, inicio_ano: ano, inicio_mes: mes }))}
          />

          <LinhaPeriodo
            rotulo={verbo === 'paga' ? 'Pago até' : 'Recebo até'}
            semData={verbo === 'paga' ? 'Ainda pago (sem data de fim)' : 'Ainda recebo (sem data de fim)'}
            ativo={temFim}
            ano={rascunho.fim_ano}
            mes={rascunho.fim_mes}
            onAlternar={(ligado) =>
              setRascunho((r) => ({
                ...r,
                fim_ano: ligado ? anoAtual : null,
                fim_mes: ligado ? mesAtual : null,
              }))
            }
            onChange={(ano, mes) => setRascunho((r) => ({ ...r, fim_ano: ano, fim_mes: mes }))}
          />
        </div>

        <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          {resumoDoPeriodo(rascunho)}
        </p>

        <Button
          className="mt-4 w-full"
          disabled={!periodoValido(rascunho)}
          onClick={() => {
            onSalvar(rascunho)
            onOpenChange(false)
          }}
        >
          Salvar
        </Button>
        {!periodoValido(rascunho) && (
          <p className="mt-2 text-center text-sm text-destructive">O fim não pode vir antes do início.</p>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** O mesmo check que o banco faz (constraint fixed_expenses_vigencia_ck). */
function periodoValido(v: Vigencia) {
  if (v.inicio_ano === null || v.fim_ano === null) return true
  return v.fim_ano * 12 + (v.fim_mes ?? 1) >= v.inicio_ano * 12 + (v.inicio_mes ?? 1)
}

function resumoDoPeriodo(v: Vigencia) {
  const temInicio = v.inicio_ano !== null
  const temFim = v.fim_ano !== null
  if (!temInicio && !temFim) return 'Conta em todos os meses, de qualquer ano.'
  return `Conta ${textoVigencia(v)}.`
}

function LinhaPeriodo({
  rotulo,
  semData,
  ativo,
  ano,
  mes,
  onAlternar,
  onChange,
}: {
  rotulo: string
  /** O que aparece quando não há data daquele lado. */
  semData: string
  ativo: boolean
  ano: number | null
  mes: number | null
  onAlternar: (ligado: boolean) => void
  onChange: (ano: number, mes: number) => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {/* Ligado = tem data. O rótulo não muda junto com o interruptor: um
          switch que aparece desligado com o campo preenchido logo abaixo dele
          é o tipo de coisa que faz a pessoa desconfiar do que salvou.
          A linha inteira é o alvo, mesmo padrão do BotaoPago. */}
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        onClick={() => onAlternar(!ativo)}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{rotulo}</span>
          {!ativo && <span className="block text-xs text-muted-foreground">{semData}</span>}
        </span>
        <SwitchTrack checked={ativo} />
      </button>

      {ativo && (
        <div className="flex gap-2">
          <Select
            value={String(mes ?? 1)}
            onValueChange={(v) => onChange(ano ?? new Date().getFullYear(), Number(v))}
          >
            <SelectTrigger className="flex-1" aria-label={`Mês — ${rotulo}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((nome, i) => (
                <SelectItem key={nome} value={String(i + 1)}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(ano ?? new Date().getFullYear())}
            onValueChange={(v) => onChange(Number(v), mes ?? 1)}
          >
            <SelectTrigger className="w-[6.5rem]" aria-label={`Ano — ${rotulo}`}>
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
        </div>
      )}
    </div>
  )
}
