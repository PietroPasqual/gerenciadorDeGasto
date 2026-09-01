import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { SelectSimples } from '@/components/common/select-simples'
import { EstadoVazio } from '@/components/common/estados'
import { cn } from '@/lib/utils'
import { formatCentavos } from '@/lib/money'
import { estaVigente, totalDeItens } from '@/lib/calculations'
import { nomeDoMes } from '@/lib/dates'
import { SheetVigencia, textoVigencia } from './sheet-vigencia'
import { CalendarRange } from 'lucide-react'
import type { Category, FixedExpense, FixedExpensePayment, PaymentMethod } from '@/lib/database.types'

// Colunas: Nome | Valor | Forma | Categoria | Pago? | Ações — agrupadas em duas
// faixas no celular (ver `md:contents` abaixo). O "pago?" fica na 2ª faixa
// para o nome do gasto não ficar espremido na 1ª.
const TEMPLATE = 'md:grid-cols-[1.4fr,9rem,1fr,1fr,5rem,2.5rem]'

export function TabelaGastosFixos({
  ano,
  mes,
  gastosFixos,
  pagamentos,
  formasPagamento,
  categorias,
  onAdicionar,
  onEditar,
  onRemover,
  onAlternarPago,
}: {
  ano: number
  mes: number
  gastosFixos: FixedExpense[]
  pagamentos: FixedExpensePayment[]
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  onAdicionar: (dados: {
    nome: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    dia_vencimento: number | null
  }) => void
  onEditar: (id: string, mudancas: Partial<FixedExpense>) => void
  onRemover: (id: string) => void
  onAlternarPago: (fixedExpenseId: string, pago: boolean) => void
}) {
  const [nome, setNome] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)

  const [vigenciaDe, setVigenciaDe] = useState<FixedExpense | null>(null)

  const estaPago = (id: string) => pagamentos.find((p) => p.fixed_expense_id === id)?.pago ?? false
  // Os totais somam só quem vale neste mês — mesma regra da função SQL. A
  // lista mostra todos, para você conseguir mexer na vigência de qualquer um
  // sem ter que caçar o mês certo.
  const vigentes = gastosFixos.filter((g) => estaVigente(g, ano, mes))
  const totalPago = totalDeItens(vigentes.filter((g) => estaPago(g.id)))

  const adicionar = () => {
    if (!nome.trim()) return
    onAdicionar({
      nome: nome.trim(),
      payment_method_id: null,
      category_id: null,
      valor_centavos: valorCentavos,
      dia_vencimento: null,
    })
    setNome('')
    setValorCentavos(0)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Gastos fixos</CardTitle>
        <CardDescription>
          Cadastre uma vez e diga desde quando você paga — ele se repete só nesses meses. O “pago?” é marcado
          mês a mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {gastosFixos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum gasto fixo cadastrado"
            descricao="Aluguel, internet, academia… cadastre uma vez e ele aparece nos meses em que você paga."
          />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Nome</span>
              <span className="text-right">Valor</span>
              <span>Forma de pagamento</span>
              <span>Categoria</span>
              <span className="text-center">Pago?</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {gastosFixos.map((gasto) => {
              const pago = estaPago(gasto.id)
              const vigente = estaVigente(gasto, ano, mes)
              return (
                <Linha
                  key={gasto.id}
                  template={TEMPLATE}
                  destacada={pago && vigente}
                  className={cn('relative gap-1.5 md:static', !vigente && 'opacity-55')}
                >
                  {/* 1ª linha no celular: nome, valor e o "pago?" */}
                  <div className="flex items-center gap-2 pr-9 md:contents md:pr-0">
                    <div className="min-w-0 flex-1">
                      <Input
                        data-celula
                        aria-label="Nome do gasto fixo"
                        defaultValue={gasto.nome}
                        onBlur={(e) => {
                          if (e.target.value !== gasto.nome) onEditar(gasto.id, { nome: e.target.value })
                        }}
                        className="w-full border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:font-normal"
                      />
                      {/* Desde quando isto é pago. Fica embaixo do nome, e não
                          numa 7ª coluna, porque a linha já tem seis. */}
                      <button
                        type="button"
                        onClick={() => setVigenciaDe(gasto)}
                        aria-label={
                          vigente
                            ? `Quando ${gasto.nome} é pago: ${textoVigencia(gasto)}`
                            : `${gasto.nome} não é pago em ${nomeDoMes(mes)} (${textoVigencia(gasto)})`
                        }
                        className={cn(
                          'flex items-center gap-1 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground',
                          // 44px de alvo no celular; no desktop o ponteiro é
                          // preciso e a linha da planilha não pode inchar.
                          'alvo-toque -mt-1 md:mt-0 md:py-0.5',
                        )}
                      >
                        <CalendarRange className="h-3 w-3 shrink-0" />
                        {/* Riscado quando o mês aberto está fora da janela. Um
                            badge "fora de agosto" ao lado quebrava a data em
                            três linhas nos 150px desta célula; a linha já vem
                            apagada, e o leitor de tela recebe a frase inteira
                            pelo aria-label. */}
                        <span className={cn('whitespace-nowrap', !vigente && 'line-through')}>
                          {textoVigencia(gasto)}
                        </span>
                      </button>
                    </div>
                    <MoneyInput
                      data-celula
                      aria-label="Valor do gasto fixo"
                      value={gasto.valor_centavos}
                      onValueChange={(valor) => onEditar(gasto.id, { valor_centavos: valor })}
                      className="w-24 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:w-full md:font-normal"
                    />
                  </div>

                  {/* 2ª linha no celular: forma de pagamento e categoria */}
                  <div className="grid grid-cols-[1fr,1fr,auto] items-center gap-1.5 md:contents">
                    <SelectSimples
                      ariaLabel="Forma de pagamento do gasto fixo"
                      valor={gasto.payment_method_id}
                      opcoes={formasPagamento}
                      onChange={(valor) => onEditar(gasto.id, { payment_method_id: valor })}
                      className="px-2 md:px-3"
                    />
                    <SelectSimples
                      ariaLabel="Categoria do gasto fixo"
                      valor={gasto.category_id}
                      opcoes={categorias}
                      onChange={(valor) => onEditar(gasto.id, { category_id: valor })}
                      className="px-2 md:px-3"
                    />
                    <BotaoPago
                      id={gasto.id}
                      nome={gasto.nome}
                      pago={pago && vigente}
                      desabilitado={!vigente}
                      onAlternar={onAlternarPago}
                    />
                  </div>

                  <div className="acoes-hover absolute right-1.5 top-1.5 md:static md:flex md:justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemover(gasto.id)}
                      aria-label={`Excluir gasto fixo ${gasto.nome}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Linha>
              )
            })}
          </GradeEditavel>
        )}

        <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-[1fr,10rem,2.5rem]">
          <div className="flex items-center gap-2 md:contents">
            <Input
              placeholder="Novo gasto fixo (ex.: Aluguel)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Nome do novo gasto fixo"
              className="min-w-0 flex-1"
            />
            <MoneyInput
              value={valorCentavos}
              onValueChange={setValorCentavos}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Valor do novo gasto fixo"
              className="w-24 shrink-0 md:w-full"
            />
            <Button size="icon" className="shrink-0" onClick={adicionar} aria-label="Adicionar gasto fixo">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Total rotulo="Total de gastos fixos" valor={formatCentavos(totalDeItens(vigentes))} />
          <Total rotulo="Já pago neste mês" valor={formatCentavos(totalPago)} />
        </div>

        <SheetVigencia
          aberta={vigenciaDe !== null}
          onOpenChange={(aberta) => !aberta && setVigenciaDe(null)}
          nome={vigenciaDe?.nome ?? ''}
          vigencia={vigenciaDe ?? { inicio_ano: null, inicio_mes: null, fim_ano: null, fim_mes: null }}
          anoAtual={ano}
          mesAtual={mes}
          onSalvar={(v) => vigenciaDe && onEditar(vigenciaDe.id, v)}
        />
      </CardContent>
    </Card>
  )
}

/**
 * "Pago?" como um botão único que embrulha rótulo + quadradinho.
 *
 * Tentei antes um <label htmlFor> em volta do Checkbox do Radix — o HTML diz
 * que button é rotulável, mas na prática o clique no rótulo não chega ao
 * botão. Aqui o alvo inteiro (44px no celular) É o controle, e role/aria-
 * checked preservam a semântica de caixa de seleção.
 */
function BotaoPago({
  id,
  nome,
  pago,
  desabilitado,
  onAlternar,
}: {
  id: string
  nome: string
  pago: boolean
  /** Mês fora da vigência: não há o que marcar como pago. */
  desabilitado?: boolean
  onAlternar: (id: string, pago: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={pago}
      aria-label={`Marcar ${nome} como pago`}
      data-celula
      disabled={desabilitado}
      onClick={() => onAlternar(id, !pago)}
      className="alvo-toque flex shrink-0 items-center gap-1.5 rounded-lg px-1 md:justify-center md:px-0"
    >
      <span className="text-micro uppercase tracking-wide text-muted-foreground md:hidden">pago</span>
      <span
        aria-hidden
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
          pago ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {pago && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}
