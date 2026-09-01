import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SwitchTrack } from '@/components/ui/switch'
import { MESES, anosDisponiveis, formatDataISO, nomeCurtoDoMes } from '@/lib/dates'
import { faturaDaCompra, vencimentoAdiado, vencimentoDaFatura } from '@/lib/fatura'

export interface ConfigFatura {
  dia_fechamento: number | null
  dia_vencimento: number | null
  fatura_inicio_ano: number | null
  fatura_inicio_mes: number | null
}

/** "sem fatura" · "fecha dia 20, vence dia 10 · desde ago/25" */
export function textoFatura(c: ConfigFatura): string {
  if (c.dia_fechamento === null || c.fatura_inicio_ano === null) return 'sem fatura'
  const desde = `${nomeCurtoDoMes(c.fatura_inicio_mes ?? 1).toLowerCase()}/${String(c.fatura_inicio_ano).slice(2)}`
  const vence = c.dia_vencimento !== null ? `, vence dia ${c.dia_vencimento}` : ''
  return `fecha dia ${c.dia_fechamento}${vence} · desde ${desde}`
}

/**
 * Configura a fatura de um cartão de crédito.
 *
 * Duas coisas acontecem aqui, e a segunda é a que precisa de cuidado:
 *
 * 1. Os dias de fechamento e vencimento, que é o que permite derivar em qual
 *    mês cada compra pesa no bolso.
 * 2. DESDE QUANDO essa regra vale. Sem esse "desde", ligar a fatura reescreveria
 *    de uma vez o mês de todo gasto de crédito do histórico — e o usuário abriria
 *    o app com os saldos de meses passados diferentes, sem ter pedido nada.
 *    Por isso a vigência começa no mês aberto na tela, e mudá-la para trás é uma
 *    escolha consciente, com o efeito mostrado antes de salvar.
 */
export function SheetFatura({
  aberta,
  onOpenChange,
  nome,
  config,
  anoAtual,
  mesAtual,
  onSalvar,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  nome: string
  config: ConfigFatura
  /** Mês aberto na tela — vira o padrão de "vale desde". */
  anoAtual: number
  mesAtual: number
  onSalvar: (c: ConfigFatura) => void
}) {
  const [rascunho, setRascunho] = React.useState<ConfigFatura>(config)

  React.useEffect(() => {
    if (aberta) setRascunho(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aberta,
    config.dia_fechamento,
    config.dia_vencimento,
    config.fatura_inicio_ano,
    config.fatura_inicio_mes,
  ])

  const ligada = rascunho.dia_fechamento !== null
  const valido = !ligada || (rascunho.dia_fechamento !== null && rascunho.fatura_inicio_ano !== null)

  const alternar = (ligar: boolean) =>
    setRascunho(
      ligar
        ? { dia_fechamento: 20, dia_vencimento: 10, fatura_inicio_ano: anoAtual, fatura_inicio_mes: mesAtual }
        : { dia_fechamento: null, dia_vencimento: null, fatura_inicio_ano: null, fatura_inicio_mes: null },
    )

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="overflow-y-auto">
        <SheetTitle>Fatura do {nome}</SheetTitle>
        <SheetDescription className="mb-4">
          Um gasto no crédito acontece num mês e sai da conta em outro. Com a fatura ligada, o saldo do mês
          passa a mostrar o que realmente sai da sua conta naquele mês.
        </SheetDescription>

        <div className="space-y-4">
          <div className="rounded-xl border border-border p-3">
            <button
              type="button"
              role="switch"
              aria-checked={ligada}
              onClick={() => alternar(!ligada)}
              className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Este cartão tem fatura</span>
                {!ligada && (
                  <span className="block text-xs text-muted-foreground">
                    Sem fatura, o gasto conta no mês da compra — como está hoje
                  </span>
                )}
              </span>
              <SwitchTrack checked={ligada} />
            </button>
          </div>

          {ligada && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <CampoDia
                  rotulo="Fecha no dia"
                  valor={rascunho.dia_fechamento}
                  onChange={(d) => setRascunho((r) => ({ ...r, dia_fechamento: d }))}
                  ajuda="Compra até esse dia entra na fatura do mês que vem"
                />
                <CampoDia
                  rotulo="Vence no dia"
                  valor={rascunho.dia_vencimento}
                  onChange={(d) => setRascunho((r) => ({ ...r, dia_vencimento: d }))}
                  ajuda="Só para mostrar a data e avisar de atraso"
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <span className="block text-sm font-medium">Vale desde</span>
                <p className="text-xs text-muted-foreground">
                  Compras anteriores a esse mês continuam contando no mês da compra. É o que impede seus meses
                  passados de mudarem de número sozinhos.
                </p>
                <div className="flex gap-2">
                  <Select
                    value={String(rascunho.fatura_inicio_mes ?? mesAtual)}
                    onValueChange={(v) => setRascunho((r) => ({ ...r, fatura_inicio_mes: Number(v) }))}
                  >
                    <SelectTrigger className="flex-1" aria-label="Mês em que a fatura passa a valer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(rascunho.fatura_inicio_ano ?? anoAtual)}
                    onValueChange={(v) => setRascunho((r) => ({ ...r, fatura_inicio_ano: Number(v) }))}
                  >
                    <SelectTrigger className="w-[6.5rem]" aria-label="Ano em que a fatura passa a valer">
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
              </div>

              <Exemplo config={rascunho} />
            </>
          )}
        </div>

        <Button
          className="mt-4 min-h-11 w-full"
          disabled={!valido}
          onClick={() => {
            onSalvar(rascunho)
            onOpenChange(false)
          }}
        >
          Salvar
        </Button>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Mostra o efeito da configuração antes de salvar, com uma compra de exemplo.
 *
 * A regra de fechamento é fácil de entender errado (um dia de diferença muda o
 * mês inteiro), e o custo de errar aqui é o saldo de vários meses. Um exemplo
 * concreto resolve isso melhor do que qualquer frase explicando.
 */
function Exemplo({ config }: { config: ConfigFatura }) {
  if (config.dia_fechamento === null) return null
  const hoje = new Date()
  const dia = String(config.dia_fechamento).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dentro = `${hoje.getFullYear()}-${mes}-${dia}`
  const fora = new Date(hoje.getFullYear(), hoje.getMonth(), config.dia_fechamento + 1)
  const foraISO = `${fora.getFullYear()}-${String(fora.getMonth() + 1).padStart(2, '0')}-${String(fora.getDate()).padStart(2, '0')}`

  const faturaDentro = faturaDaCompra(dentro, config.dia_fechamento)
  const faturaFora = faturaDaCompra(foraISO, config.dia_fechamento)
  const nomeFatura = (f: { ano: number; mes: number }) => `${nomeCurtoDoMes(f.mes)}/${String(f.ano).slice(2)}`

  const adiado = config.dia_vencimento !== null && vencimentoAdiado(faturaDentro, config.dia_vencimento)

  return (
    <div className="space-y-1 rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
      <p>
        Compra em <strong>{formatDataISO(dentro)}</strong> → fatura de{' '}
        <strong>{nomeFatura(faturaDentro)}</strong>
      </p>
      <p>
        Compra em <strong>{formatDataISO(foraISO)}</strong> → fatura de{' '}
        <strong>{nomeFatura(faturaFora)}</strong>
      </p>
      {config.dia_vencimento !== null && (
        <p>
          Essa fatura vence em{' '}
          <strong>{formatDataISO(vencimentoDaFatura(faturaDentro, config.dia_vencimento))}</strong>
          {adiado && ' (empurrado do fim de semana)'}
        </p>
      )}
      <p className="pt-1 text-xs">
        O app não conhece feriado: se o vencimento cair num, a data mostrada é a do dia útil pelo calendário
        comum.
      </p>
    </div>
  )
}

function CampoDia({
  rotulo,
  valor,
  onChange,
  ajuda,
}: {
  rotulo: string
  valor: number | null
  onChange: (dia: number | null) => void
  ajuda: string
}) {
  return (
    <label className="space-y-1">
      <span className="block text-sm font-medium">{rotulo}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={31}
        value={valor ?? ''}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(e.target.value === '' ? null : Math.min(31, Math.max(1, n)))
        }}
        aria-label={rotulo}
      />
      <span className="block text-xs text-muted-foreground">{ajuda}</span>
    </label>
  )
}
