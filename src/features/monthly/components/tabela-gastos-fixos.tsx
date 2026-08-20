import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Campo, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { SelectSimples } from '@/components/common/select-simples'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos, parseParaCentavos } from '@/lib/money'
import { totalDeItens } from '@/lib/calculations'
import type { Category, FixedExpense, FixedExpensePayment, PaymentMethod } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1.4fr,1fr,1fr,9rem,5rem,2.5rem]'

export function TabelaGastosFixos({
  gastosFixos,
  pagamentos,
  formasPagamento,
  categorias,
  onAdicionar,
  onEditar,
  onRemover,
  onAlternarPago,
}: {
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
  const [valorTexto, setValorTexto] = useState('')

  const estaPago = (id: string) => pagamentos.find((p) => p.fixed_expense_id === id)?.pago ?? false
  const totalPago = totalDeItens(gastosFixos.filter((g) => estaPago(g.id)))

  const adicionar = () => {
    if (!nome.trim()) return
    onAdicionar({
      nome: nome.trim(),
      payment_method_id: null,
      category_id: null,
      valor_centavos: parseParaCentavos(valorTexto) ?? 0,
      dia_vencimento: null,
    })
    setNome('')
    setValorTexto('')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Gastos fixos</CardTitle>
        <CardDescription>
          A definição vale para todos os meses. O “pago?” é registrado mês a mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {gastosFixos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum gasto fixo cadastrado"
            descricao="Aluguel, internet, academia… cadastre uma vez e ele aparece todo mês."
          />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Nome</span>
              <span>Forma de pagamento</span>
              <span>Categoria</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Pago?</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {gastosFixos.map((gasto) => {
              const pago = estaPago(gasto.id)
              return (
                <Linha key={gasto.id} template={TEMPLATE} destacada={pago}>
                  <Campo rotulo="Nome">
                    <Input
                      data-celula
                      aria-label="Nome do gasto fixo"
                      defaultValue={gasto.nome}
                      onBlur={(e) => {
                        if (e.target.value !== gasto.nome) onEditar(gasto.id, { nome: e.target.value })
                      }}
                      className="border-transparent bg-transparent hover:border-input focus:bg-card"
                    />
                  </Campo>

                  <Campo rotulo="Forma de pagamento">
                    <SelectSimples
                      ariaLabel="Forma de pagamento do gasto fixo"
                      valor={gasto.payment_method_id}
                      opcoes={formasPagamento}
                      onChange={(valor) => onEditar(gasto.id, { payment_method_id: valor })}
                    />
                  </Campo>

                  <Campo rotulo="Categoria">
                    <SelectSimples
                      ariaLabel="Categoria do gasto fixo"
                      valor={gasto.category_id}
                      opcoes={categorias}
                      onChange={(valor) => onEditar(gasto.id, { category_id: valor })}
                    />
                  </Campo>

                  <Campo rotulo="Valor">
                    <MoneyInput
                      data-celula
                      aria-label="Valor do gasto fixo"
                      value={gasto.valor_centavos}
                      onValueChange={(valor) => onEditar(gasto.id, { valor_centavos: valor })}
                      className="border-transparent bg-transparent hover:border-input focus:bg-card"
                    />
                  </Campo>

                  <Campo rotulo="Pago?" className="md:flex md:justify-center">
                    <Checkbox
                      data-celula
                      checked={pago}
                      onCheckedChange={(marcado) => onAlternarPago(gasto.id, marcado === true)}
                      aria-label={`Marcar ${gasto.nome} como pago`}
                    />
                  </Campo>

                  <div className="flex justify-end">
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
          <Input
            placeholder="Novo gasto fixo (ex.: Aluguel)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome do novo gasto fixo"
          />
          <Input
            placeholder="0,00"
            inputMode="decimal"
            className="tabular text-right"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor do novo gasto fixo"
          />
          <Button size="icon" onClick={adicionar} aria-label="Adicionar gasto fixo">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Total rotulo="Total de gastos fixos" valor={formatCentavos(totalDeItens(gastosFixos))} />
          <Total rotulo="Já pago neste mês" valor={formatCentavos(totalPago)} />
        </div>
      </CardContent>
    </Card>
  )
}
