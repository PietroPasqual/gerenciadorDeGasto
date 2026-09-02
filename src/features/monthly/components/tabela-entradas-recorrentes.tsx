import { useState } from 'react'
import { AlertTriangle, CalendarClock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Cabecalho, Linha } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { estaVigente } from '@/lib/calculations'
import { nomeDoMes } from '@/lib/dates'
import { normalizar } from '@/lib/importar-csv'
import { SheetVigencia, textoVigencia } from './sheet-vigencia'
import { cn } from '@/lib/utils'
import type { Income, RecurringIncome } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1fr,10rem,2.5rem]'

/**
 * As entradas que se repetem todo mês — o salário.
 *
 * Antes disto, a única entrada garantida do mês era a que exigia mais trabalho:
 * redigitada em janeiro, em fevereiro, em março, sempre igual.
 *
 * A vigência é a mesma dos gastos fixos, e o `fim` é o que faz troca de emprego
 * funcionar sem mentir: encerrar o salário antigo no último mês em que ele caiu
 * deixa os meses anteriores intactos. Excluir a linha reescreveria o passado.
 */
export function TabelaEntradasRecorrentes({
  ano,
  mes,
  recorrentes,
  entradasAvulsas,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  ano: number
  mes: number
  /** Todas as ativas, inclusive as que não valem neste mês (elas aparecem esmaecidas). */
  recorrentes: RecurringIncome[]
  /** Só para avisar de possível contagem dupla — ver `duplicadas` abaixo. */
  entradasAvulsas: Income[]
  onAdicionar: (descricao: string, valor: number) => void
  onEditar: (id: string, mudancas: Partial<RecurringIncome>) => void
  onRemover: (id: string) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)
  const [vigenciaDe, setVigenciaDe] = useState<RecurringIncome | null>(null)

  const adicionar = () => {
    if (!descricao.trim() && valorCentavos === 0) return
    onAdicionar(descricao.trim() || 'Entrada recorrente', valorCentavos)
    setDescricao('')
    setValorCentavos(0)
  }

  /**
   * Uma recorrente vigente e uma avulsa com a mesma descrição no mesmo mês
   * quase sempre são o mesmo salário lançado duas vezes — o app soma as duas e
   * o total fica alto sem motivo aparente. Não dá para apagar sozinho (pode ser
   * um 13º de verdade), então avisa e deixa a pessoa decidir.
   */
  const duplicadas = recorrentes
    .filter((r) => estaVigente(r, ano, mes))
    .filter((r) => entradasAvulsas.some((e) => normalizar(e.descricao) === normalizar(r.descricao)))

  if (recorrentes.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-sm font-medium text-muted-foreground">
          Entradas recorrentes{' '}
          <span className="font-normal">— o que entra todo mês, sem precisar redigitar</span>
        </p>
        <LinhaDeAdicao
          descricao={descricao}
          setDescricao={setDescricao}
          valorCentavos={valorCentavos}
          setValorCentavos={setValorCentavos}
          adicionar={adicionar}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="text-sm font-medium text-muted-foreground">
        Entradas recorrentes{' '}
        <span className="font-normal">— o que entra todo mês, sem precisar redigitar</span>
      </p>

      {duplicadas.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {duplicadas.map((r) => r.descricao).join(', ')} também aparece nas entradas avulsas deste mês. As
            duas estão sendo somadas — se for a mesma coisa, apague uma.
          </span>
        </p>
      )}

      <GradeEditavel className="space-y-2 md:space-y-0">
        <Cabecalho template={TEMPLATE}>
          <span>Descrição</span>
          <span className="text-right">Valor</span>
          <span className="sr-only">Ações</span>
        </Cabecalho>

        {recorrentes.map((item) => {
          const vale = estaVigente(item, ano, mes)
          return (
            <Linha key={item.id} template={TEMPLATE} className={cn(!vale && 'bg-superficie')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                <div className="min-w-0 flex-1 basis-full md:basis-auto">
                  <Input
                    data-celula
                    aria-label="Descrição da entrada recorrente"
                    defaultValue={item.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== item.descricao) onEditar(item.id, { descricao: e.target.value })
                    }}
                    className="min-w-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:font-normal"
                  />
                  {/* Mesmo chip e mesma sheet do gasto fixo: quem já mexeu num
                      reconhece o outro sem aprender nada novo. */}
                  <button
                    type="button"
                    onClick={() => setVigenciaDe(item)}
                    aria-label={
                      vale
                        ? `Quando ${item.descricao} é recebido: ${textoVigencia(item)}`
                        : `${item.descricao} não é recebido em ${nomeDoMes(mes)} (${textoVigencia(item)})`
                    }
                    className="alvo-toque mt-0.5 inline-flex items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground md:py-1"
                  >
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    {textoVigencia(item)}
                    {!vale && ` · não conta em ${nomeDoMes(mes).toLowerCase()}`}
                  </button>
                </div>
                <MoneyInput
                  data-celula
                  aria-label="Valor da entrada recorrente"
                  value={item.valor_centavos}
                  onValueChange={(valor) => onEditar(item.id, { valor_centavos: valor })}
                  className="ml-auto w-32 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:ml-0 md:w-full md:font-normal"
                />
                <div className="acoes-hover flex shrink-0 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(item.id)}
                    aria-label={`Excluir entrada recorrente ${item.descricao}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </Linha>
          )
        })}
      </GradeEditavel>

      <LinhaDeAdicao
        descricao={descricao}
        setDescricao={setDescricao}
        valorCentavos={valorCentavos}
        setValorCentavos={setValorCentavos}
        adicionar={adicionar}
      />

      {vigenciaDe && (
        <SheetVigencia
          aberta
          onOpenChange={(aberta) => !aberta && setVigenciaDe(null)}
          nome={vigenciaDe.descricao}
          verbo="recebe"
          vigencia={vigenciaDe}
          anoAtual={ano}
          mesAtual={mes}
          onSalvar={(v) => onEditar(vigenciaDe.id, v)}
        />
      )}
    </div>
  )
}

function LinhaDeAdicao({
  descricao,
  setDescricao,
  valorCentavos,
  setValorCentavos,
  adicionar,
}: {
  descricao: string
  setDescricao: (v: string) => void
  valorCentavos: number
  setValorCentavos: (v: number) => void
  adicionar: () => void
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 pt-1 ${TEMPLATE}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
        <Input
          placeholder="Nova recorrente (ex.: Salário)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          aria-label="Descrição da nova entrada recorrente"
          className="min-w-0 flex-1 basis-full md:basis-auto"
        />
        <MoneyInput
          value={valorCentavos}
          onValueChange={setValorCentavos}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          aria-label="Valor da nova entrada recorrente"
          className="ml-auto w-32 shrink-0 md:ml-0 md:w-full"
        />
        <Button
          size="icon"
          className="shrink-0"
          onClick={adicionar}
          aria-label="Adicionar entrada recorrente"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
