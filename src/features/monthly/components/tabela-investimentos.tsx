import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { totalDeItens } from '@/lib/calculations'
import type { Goal, GoalContribution, Investment } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1fr,10rem]'
const TEMPLATE_AVULSO = 'md:grid-cols-[1fr,10rem,2.5rem]'

/**
 * Investimentos do mês.
 * Aporte com meta -> goal_contributions (mesma célula editada na tela de Metas).
 * Aporte sem meta -> investments. Assim nada é contado duas vezes.
 */
export function TabelaInvestimentos({
  metas,
  aportes,
  investimentos,
  onSalvarAporte,
  onAdicionarAvulso,
  onEditarAvulso,
  onRemoverAvulso,
}: {
  metas: Goal[]
  aportes: GoalContribution[]
  investimentos: Investment[]
  onSalvarAporte: (goalId: string, valor: number) => void
  onAdicionarAvulso: (descricao: string, valor: number) => void
  onEditarAvulso: (id: string, mudancas: Partial<Investment>) => void
  onRemoverAvulso: (id: string) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)

  const valorDaMeta = (goalId: string) => aportes.find((a) => a.goal_id === goalId)?.valor_centavos ?? 0
  const total = totalDeItens(aportes) + totalDeItens(investimentos)

  const adicionar = () => {
    if (!descricao.trim() && valorCentavos === 0) return
    onAdicionarAvulso(descricao.trim() || 'Investimento', valorCentavos)
    setDescricao('')
    setValorCentavos(0)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Investimentos do mês</CardTitle>
        <CardDescription>Quanto você guardou em cada meta neste mês.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metas.length === 0 ? (
          <EstadoVazio
            titulo="Você ainda não tem metas"
            descricao="Crie até 10 metas para acompanhar o quanto guarda por mês."
            acao={
              <Button asChild size="sm">
                <Link to="/metas">Criar metas</Link>
              </Button>
            }
          />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Meta</span>
              <span className="text-right">Valor guardado</span>
            </Cabecalho>
            {metas.map((meta) => (
              <Linha key={meta.id} template={TEMPLATE}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                  {/* "Reserva de emergência" não cabe ao lado do campo em 360px:
                      no celular o nome fica inteiro na 1ª linha. */}
                  <span className="min-w-0 flex-1 basis-full truncate py-1 text-sm font-medium md:basis-auto md:py-2">
                    {meta.nome}
                  </span>
                  <MoneyInput
                    data-celula
                    aria-label={`Valor guardado na meta ${meta.nome}`}
                    value={valorDaMeta(meta.id)}
                    onValueChange={(valor) => onSalvarAporte(meta.id, valor)}
                    className="ml-auto w-32 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:ml-0 md:w-full md:font-normal"
                  />
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {/* Aportes sem meta */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outros aportes</p>
          <GradeEditavel className="space-y-2 md:space-y-0">
            {investimentos.map((investimento) => (
              <Linha key={investimento.id} template={TEMPLATE_AVULSO}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
                  <Input
                    data-celula
                    aria-label="Descrição do investimento"
                    defaultValue={investimento.descricao}
                    onBlur={(e) => {
                      if (e.target.value !== investimento.descricao) {
                        onEditarAvulso(investimento.id, { descricao: e.target.value })
                      }
                    }}
                    className="min-w-0 flex-1 basis-full border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:basis-auto md:font-normal"
                  />
                  <MoneyInput
                    data-celula
                    aria-label="Valor do investimento"
                    value={investimento.valor_centavos}
                    onValueChange={(valor) => onEditarAvulso(investimento.id, { valor_centavos: valor })}
                    className="ml-auto w-32 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:ml-0 md:w-full md:font-normal"
                  />
                  <div className="flex shrink-0 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoverAvulso(investimento.id)}
                      aria-label={`Excluir investimento ${investimento.descricao}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </Linha>
            ))}
          </GradeEditavel>

          <div className={`grid grid-cols-1 gap-2 ${TEMPLATE_AVULSO}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
              <Input
                placeholder="Aporte sem meta (ex.: Tesouro Selic)"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionar()}
                aria-label="Descrição do novo investimento"
                className="min-w-0 flex-1 basis-full md:basis-auto"
              />
              <MoneyInput
                value={valorCentavos}
                onValueChange={setValorCentavos}
                onKeyDown={(e) => e.key === 'Enter' && adicionar()}
                aria-label="Valor do novo investimento"
                className="ml-auto w-32 shrink-0 md:ml-0 md:w-full"
              />
              <Button
                size="icon"
                className="shrink-0"
                onClick={adicionar}
                aria-label="Adicionar investimento"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Total rotulo="Total investido no mês" valor={formatCentavos(total)} />
      </CardContent>
    </Card>
  )
}
