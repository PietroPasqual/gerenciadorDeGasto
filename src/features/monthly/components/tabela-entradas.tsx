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
import { formatDataISO } from '@/lib/dates'
import type { Income, Transaction } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1fr,10rem,2.5rem]'
/** As com data ganham uma coluna a mais, à esquerda. */
const TEMPLATE_DATADA = 'md:grid-cols-[7rem,1fr,10rem,2.5rem]'

/**
 * As entradas do mês, que vêm de DUAS origens:
 *
 * - `entradas` (tabela incomes): o salário e os freelas que você digita aqui,
 *   sem data, porque valem para o mês inteiro.
 * - `entradasComData` (lançamentos de tipo entrada): o que veio da importação
 *   de um extrato, ou de um lançamento avulso. Estas têm dia.
 *
 * As duas SEMPRE contaram no total do mês, mas só as primeiras apareciam nesta
 * tela. Depois de importar um extrato, a faixa do topo dizia R$ 7.261 e este
 * card listava R$ 3.580: a diferença existia no banco e não tinha linha em
 * lugar nenhum. Dinheiro que o app conta mas não mostra é pior do que dinheiro
 * que ele não conta — não dá nem para conferir.
 */
export function TabelaEntradas({
  entradas,
  entradasComData = [],
  recorrentes,
  onAdicionar,
  onEditar,
  onRemover,
  onEditarComData,
  onRemoverComData,
}: {
  entradas: Income[]
  entradasComData?: Transaction[]
  /** As recorrentes vêm como um bloco pronto — ver tabela-entradas-recorrentes. */
  recorrentes?: React.ReactNode
  onAdicionar: (descricao: string, valor: number) => void
  onEditar: (id: string, mudancas: Partial<Income>) => void
  onRemover: (id: string) => void
  onEditarComData?: (id: string, mudancas: Partial<Transaction>) => void
  onRemoverComData?: (id: string) => void
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
        {entradas.length === 0 && entradasComData.length === 0 && !recorrentes ? (
          <EstadoVazio
            titulo="Nenhuma entrada neste mês"
            descricao="Lance seu salário, freelas e qualquer dinheiro que entrou."
          />
        ) : entradas.length === 0 ? null : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {/* No celular a descrição fica sozinha na 1ª linha (`basis-full`) e
                valor + lixeira dividem a 2ª. Numa linha só sobravam 88px para
                o texto e "Freela de design" virava "Freela d". No desktop o
                `md:contents` desfaz o agrupamento e as três colunas voltam. */}
            {entradas.map((entrada) => (
              <Linha key={entrada.id} template={TEMPLATE}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                  <Input
                    data-celula
                    aria-label="Descrição da entrada"
                    defaultValue={entrada.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== entrada.descricao)
                        onEditar(entrada.id, { descricao: e.target.value })
                    }}
                    className="min-w-0 flex-1 basis-full border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:basis-auto md:font-normal"
                  />
                  <MoneyInput
                    data-celula
                    aria-label="Valor da entrada"
                    value={entrada.valor_centavos}
                    onValueChange={(valor) => onEditar(entrada.id, { valor_centavos: valor })}
                    className="ml-auto w-32 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:ml-0 md:w-full md:font-normal"
                  />
                  <div className="acoes-hover flex shrink-0 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
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

        {entradasComData.length > 0 && (
          <div className="space-y-2 pt-2">
            {/* Separadas das de cima porque são outra coisa: têm dia, vieram de
                um extrato ou de um lançamento avulso, e não do salário que se
                digita aqui. Misturar as duas listas esconderia a origem. */}
            <p className="text-sm font-medium text-muted-foreground">
              Entradas com data{' '}
              <span className="font-normal">— de lançamentos avulsos ou de um extrato importado</span>
            </p>
            <GradeEditavel className="space-y-2 md:space-y-0">
              <Cabecalho template={TEMPLATE_DATADA}>
                <span>Data</span>
                <span>Descrição</span>
                <span className="text-right">Valor</span>
                <span className="sr-only">Ações</span>
              </Cabecalho>

              {entradasComData.map((item) => (
                <Linha key={item.id} template={TEMPLATE_DATADA}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                    <span className="order-first shrink-0 text-sm text-muted-foreground md:self-center">
                      {formatDataISO(item.data)}
                    </span>
                    <Input
                      data-celula
                      aria-label="Descrição da entrada"
                      defaultValue={item.descricao}
                      disabled={!onEditarComData}
                      onBlur={(e) => {
                        if (e.target.value !== item.descricao)
                          onEditarComData?.(item.id, { descricao: e.target.value })
                      }}
                      className="min-w-0 flex-1 basis-full border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:basis-auto md:font-normal"
                    />
                    <MoneyInput
                      data-celula
                      aria-label="Valor da entrada"
                      value={item.valor_centavos}
                      disabled={!onEditarComData}
                      onValueChange={(valor) => onEditarComData?.(item.id, { valor_centavos: valor })}
                      className="ml-auto w-32 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:ml-0 md:w-full md:font-normal"
                    />
                    <div className="acoes-hover flex shrink-0 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!onRemoverComData}
                        onClick={() => onRemoverComData?.(item.id)}
                        aria-label={`Excluir entrada ${item.descricao}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </Linha>
              ))}
            </GradeEditavel>
          </div>
        )}

        {recorrentes}

        {/* Linha de adição rápida */}
        <div className={`grid grid-cols-1 gap-2 pt-1 ${TEMPLATE}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
            <Input
              placeholder="Nova entrada (ex.: Salário)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Descrição da nova entrada"
              className="min-w-0 flex-1 basis-full md:basis-auto"
            />
            <MoneyInput
              value={valorCentavos}
              onValueChange={setValorCentavos}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Valor da nova entrada"
              className="ml-auto w-32 shrink-0 md:ml-0 md:w-full"
            />
            <Button size="icon" className="shrink-0" onClick={adicionar} aria-label="Adicionar entrada">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Total
          rotulo="Total de entradas"
          valor={formatCentavos(totalDeItens(entradas) + totalDeItens(entradasComData))}
        />
      </CardContent>
    </Card>
  )
}
