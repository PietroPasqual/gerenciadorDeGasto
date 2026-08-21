import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Campo, Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { totalDeItens } from '@/lib/calculations'
import type { Income } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1fr,10rem,2.5rem]'

export function TabelaEntradas({
  entradas,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  entradas: Income[]
  onAdicionar: (descricao: string, valor: number) => void
  onEditar: (id: string, mudancas: Partial<Income>) => void
  onRemover: (id: string) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)

  const adicionar = () => {
    if (!descricao.trim() && valorCentavos === 0) return
    onAdicionar(descricao.trim() || 'Entrada', valorCentavos)
    setDescricao('')
    setValorCentavos(0)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Entradas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entradas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma entrada neste mês"
            descricao="Lance seu salário, freelas e qualquer dinheiro que entrou."
          />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {entradas.map((entrada) => (
              <Linha key={entrada.id} template={TEMPLATE}>
                <Campo rotulo="Descrição">
                  <Input
                    data-celula
                    aria-label="Descrição da entrada"
                    defaultValue={entrada.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== entrada.descricao) onEditar(entrada.id, { descricao: e.target.value })
                    }}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <Campo rotulo="Valor">
                  <MoneyInput
                    data-celula
                    aria-label="Valor da entrada"
                    value={entrada.valor_centavos}
                    onValueChange={(valor) => onEditar(entrada.id, { valor_centavos: valor })}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(entrada.id)}
                    aria-label={`Excluir entrada ${entrada.descricao}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {/* Linha de adição rápida */}
        <div className={`grid grid-cols-1 gap-2 pt-1 ${TEMPLATE}`}>
          <Input
            placeholder="Nova entrada (ex.: Salário)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Descrição da nova entrada"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor da nova entrada"
          />
          <Button size="icon" onClick={adicionar} aria-label="Adicionar entrada">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Total rotulo="Total de entradas" valor={formatCentavos(totalDeItens(entradas))} />
      </CardContent>
    </Card>
  )
}
