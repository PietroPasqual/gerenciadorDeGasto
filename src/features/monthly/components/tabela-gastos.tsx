import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Campo, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { SelectSimples } from '@/components/common/select-simples'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { totalDeItens } from '@/lib/calculations'
import { primeiroDiaISO, paraDataISO, periodoAtual } from '@/lib/dates'
import type { Category, PaymentMethod, Transaction } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1.4fr,9rem,1fr,1fr,9rem,2.5rem]'

/** Data padrão da linha nova: hoje se o mês selecionado for o atual, senão dia 1. */
function dataPadrao(ano: number, mes: number) {
  const hoje = periodoAtual()
  return hoje.ano === ano && hoje.mes === mes ? paraDataISO(new Date()) : primeiroDiaISO({ ano, mes })
}

export function TabelaGastos({
  ano,
  mes,
  gastos,
  formasPagamento,
  categorias,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  ano: number
  mes: number
  gastos: Transaction[]
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  onAdicionar: (dados: {
    data: string
    descricao: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    tipo: 'gasto'
  }) => void
  onEditar: (id: string, mudancas: Partial<Transaction>) => void
  onRemover: (id: string) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(() => dataPadrao(ano, mes))
  const [valorCentavos, setValorCentavos] = useState(0)
  const [formaId, setFormaId] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  const adicionar = () => {
    if (!descricao.trim() && valorCentavos === 0) return
    onAdicionar({
      data: data || dataPadrao(ano, mes),
      descricao: descricao.trim() || 'Gasto',
      payment_method_id: formaId,
      category_id: categoriaId,
      valor_centavos: valorCentavos,
      tipo: 'gasto',
    })
    setDescricao('')
    setValorCentavos(0)
    // forma/categoria/data continuam preenchidas: lançar vários seguidos é o caso comum
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Gastos do mês</CardTitle>
        <CardDescription>
          Digite na última linha e pressione Enter. Use Tab/Enter para andar entre as células.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {gastos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum gasto lançado"
            descricao="Comece pelo primeiro gasto do mês na linha abaixo."
          />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Descrição</span>
              <span>Data</span>
              <span>Forma de pagamento</span>
              <span>Categoria</span>
              <span className="text-right">Valor</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {gastos.map((gasto) => (
              <Linha key={gasto.id} template={TEMPLATE}>
                <Campo rotulo="Descrição">
                  <Input
                    data-celula
                    aria-label="Descrição do gasto"
                    defaultValue={gasto.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== gasto.descricao) onEditar(gasto.id, { descricao: e.target.value })
                    }}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>

                <Campo rotulo="Data">
                  <Input
                    data-celula
                    type="date"
                    aria-label="Data do gasto"
                    defaultValue={gasto.data.slice(0, 10)}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value !== gasto.data.slice(0, 10)) {
                        onEditar(gasto.id, { data: e.target.value })
                      }
                    }}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>

                <Campo rotulo="Forma de pagamento">
                  <SelectSimples
                    ariaLabel="Forma de pagamento do gasto"
                    valor={gasto.payment_method_id}
                    opcoes={formasPagamento}
                    onChange={(valor) => onEditar(gasto.id, { payment_method_id: valor })}
                  />
                </Campo>

                <Campo rotulo="Categoria">
                  <SelectSimples
                    ariaLabel="Categoria do gasto"
                    valor={gasto.category_id}
                    opcoes={categorias}
                    onChange={(valor) => onEditar(gasto.id, { category_id: valor })}
                  />
                </Campo>

                <Campo rotulo="Valor">
                  <MoneyInput
                    data-celula
                    aria-label="Valor do gasto"
                    value={gasto.valor_centavos}
                    onValueChange={(valor) => onEditar(gasto.id, { valor_centavos: valor })}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(gasto.id)}
                    aria-label={`Excluir gasto ${gasto.descricao}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {/* Adição rápida (estilo planilha) */}
        <div className={`grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border p-3 md:border-0 md:p-0 md:pt-1 ${TEMPLATE}`}>
          <Input
            placeholder="Novo gasto"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Descrição do novo gasto"
          />
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data do novo gasto" />
          <SelectSimples
            ariaLabel="Forma de pagamento do novo gasto"
            valor={formaId}
            opcoes={formasPagamento}
            onChange={setFormaId}
            className="border-input"
          />
          <SelectSimples
            ariaLabel="Categoria do novo gasto"
            valor={categoriaId}
            opcoes={categorias}
            onChange={setCategoriaId}
            className="border-input"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor do novo gasto"
          />
          <Button size="icon" onClick={adicionar} aria-label="Adicionar gasto">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Total rotulo="Total de gastos do mês" valor={formatCentavos(totalDeItens(gastos))} />
      </CardContent>
    </Card>
  )
}
