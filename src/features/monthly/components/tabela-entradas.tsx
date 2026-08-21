import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
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

            {/* Só dois campos: cabem na mesma linha até no celular */}
            {entradas.map((entrada) => (
              <Linha key={entrada.id} template={TEMPLATE}>
                <div className="flex items-center gap-2 md:contents">
                  <Input
                    data-celula
                    aria-label="Descrição da entrada"
                    defaultValue={entrada.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== entrada.descricao) onEditar(entrada.id, { descricao: e.target.value })
                    }}
                    className="min-w-0 flex-1 border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                  <MoneyInput
                    data-celula
                    aria-label="Valor da entrada"
                    value={entrada.valor_centavos}
                    onValueChange={(valor) => onEditar(entrada.id, { valor_centavos: valor })}
                    className="w-28 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:w-full md:font-normal"
                  />
                  <div className="flex shrink-0 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 md:h-10 md:w-10"
                      onClick={() => onRemover(entrada.id)}
                      aria-label={`Excluir entrada ${entrada.descricao}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {/* Linha de adição rápida */}
        <div className={`grid grid-cols-1 gap-2 pt-1 ${TEMPLATE}`}>
          <div className="flex items-center gap-2 md:contents">
            <Input
              placeholder="Nova entrada (ex.: Salário)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Descrição da nova entrada"
              className="min-w-0 flex-1"
            />
            <MoneyInput
              value={valorCentavos}
              onValueChange={setValorCentavos}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Valor da nova entrada"
              className="w-28 shrink-0 md:w-full"
            />
            <Button size="icon" className="shrink-0" onClick={adicionar} aria-label="Adicionar entrada">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Total rotulo="Total de entradas" valor={formatCentavos(totalDeItens(entradas))} />
      </CardContent>
    </Card>
  )
}
