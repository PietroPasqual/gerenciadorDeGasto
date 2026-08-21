import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { Cabecalho, Campo, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { Estrelas } from '@/components/common/estrelas'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { formatCentavos } from '@/lib/money'
import { MESES_CURTOS, nomeDoMes } from '@/lib/dates'
import { progressoDaMeta, progressoWishlist, totalDeItens } from '@/lib/calculations'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'
import { useMetas } from './use-metas'

export function MetasPage() {
  const { anoComparativo, definirAnoComparativo } = usePeriodoStore()
  const { dados, carregando, erro, recarregar, acoes } = useMetas(anoComparativo)

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Metas e investimentos"
        descricao="O que você quer conquistar e quanto já guardou para isso."
        acoes={
          <SeletorPeriodo
            ano={anoComparativo}
            mostrarMes={false}
            onChange={({ ano }) => definirAnoComparativo(ano)}
          />
        }
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : dados ? (
        <>
          <Wishlist
            itens={dados.wishlist}
            onAdicionar={acoes.adicionarItem}
            onEditar={acoes.editarItem}
            onRemover={acoes.removerItem}
          />
          <GradeMetas
            ano={anoComparativo}
            metas={dados.metas}
            aportes={dados.aportes}
            resumo={dados.resumo}
            onSalvarAporte={acoes.salvarAporte}
          />
        </>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ Wishlist
const TEMPLATE_WISHLIST = 'md:grid-cols-[1fr,10rem,9rem,4rem,2.5rem]'

function Wishlist({
  itens,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  itens: Array<import('@/lib/database.types').WishlistItem>
  onAdicionar: (nome: string, valor: number, prioridade: number) => void
  onEditar: (id: string, mudancas: Partial<import('@/lib/database.types').WishlistItem>) => void
  onRemover: (id: string) => void
}) {
  const [nome, setNome] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)
  const [prioridade, setPrioridade] = useState(3)

  const progresso = progressoWishlist(itens)
  const totalPendente = totalDeItens(itens.filter((i) => !i.concluido))

  const adicionar = () => {
    if (!nome.trim()) return
    onAdicionar(nome.trim(), valorCentavos, prioridade)
    setNome('')
    setValorCentavos(0)
    setPrioridade(3)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Wishlist</CardTitle>
        <CardDescription>Aquela lista de desejos — marque o que já conquistou.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Indicador Icone={CheckCircle2} rotulo="Cumpridas" valor={progresso.cumpridas} className="text-success" />
          <Indicador Icone={Circle} rotulo="Pendentes" valor={progresso.pendentes} />
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm text-muted-foreground">Falta juntar</p>
            <p className="tabular text-lg font-semibold">{formatCentavos(totalPendente)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso da wishlist</span>
            <span className="tabular font-medium">
              {progresso.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            </span>
          </div>
          <Progress value={progresso.percentual} />
        </div>

        {itens.length === 0 ? (
          <EstadoVazio titulo="Sua wishlist está vazia" descricao="Adicione o primeiro desejo abaixo." />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE_WISHLIST}>
              <span>Item</span>
              <span className="text-right">Valor</span>
              <span>Prioridade</span>
              <span className="text-center">Conquistado</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {itens.map((item) => (
              <Linha key={item.id} template={TEMPLATE_WISHLIST} destacada={item.concluido}>
                <Campo rotulo="Item">
                  <Input
                    data-celula
                    aria-label="Nome do item"
                    defaultValue={item.nome}
                    onBlur={(e) => {
                      if (e.target.value !== item.nome) onEditar(item.id, { nome: e.target.value })
                    }}
                    className={cn(
                      'border-transparent bg-transparent hover:border-input focus:bg-card',
                      item.concluido && 'line-through opacity-70',
                    )}
                  />
                </Campo>
                <Campo rotulo="Valor">
                  <MoneyInput
                    data-celula
                    aria-label="Valor do item"
                    value={item.valor_centavos}
                    onValueChange={(v) => onEditar(item.id, { valor_centavos: v })}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <Campo rotulo="Prioridade">
                  <Estrelas valor={item.prioridade} onChange={(p) => onEditar(item.id, { prioridade: p })} />
                </Campo>
                <Campo rotulo="Conquistado" className="md:flex md:justify-center">
                  <Checkbox
                    data-celula
                    checked={item.concluido}
                    onCheckedChange={(marcado) => onEditar(item.id, { concluido: marcado === true })}
                    aria-label={`Marcar ${item.nome} como conquistado`}
                  />
                </Campo>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(item.id)}
                    aria-label={`Excluir ${item.nome}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,10rem,9rem,2.5rem]">
          <Input
            placeholder="Novo desejo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome do novo desejo"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor do novo desejo"
          />
          <div className="flex items-center">
            <Estrelas valor={prioridade} onChange={setPrioridade} />
          </div>
          <Button size="icon" onClick={adicionar} aria-label="Adicionar desejo">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Indicador({
  Icone,
  rotulo,
  valor,
  className,
}: {
  Icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  className?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <Icone className={cn('h-5 w-5', className ?? 'text-muted-foreground')} />
      <div>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="tabular text-lg font-semibold">{valor}</p>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- Grid metas
function GradeMetas({
  ano,
  metas,
  aportes,
  resumo,
  onSalvarAporte,
}: {
  ano: number
  metas: Array<import('@/lib/database.types').Goal>
  aportes: Array<import('@/lib/database.types').GoalContribution>
  resumo: Array<import('@/lib/database.types').ResumoMeta>
  onSalvarAporte: (goalId: string, mes: number, valor: number) => void
}) {
  const valorDe = (goalId: string, mes: number) =>
    aportes.find((a) => a.goal_id === goalId && a.mes === mes)?.valor_centavos ?? 0

  const totalDaMeta = (goalId: string) =>
    aportes.filter((a) => a.goal_id === goalId).reduce((s, a) => s + a.valor_centavos, 0)

  const totalDoMes = (mes: number) =>
    aportes.filter((a) => a.mes === mes).reduce((s, a) => s + a.valor_centavos, 0)

  const totalAno = aportes.reduce((s, a) => s + a.valor_centavos, 0)

  if (metas.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Metas</CardTitle>
        </CardHeader>
        <CardContent>
          <EstadoVazio
            titulo="Nenhuma meta ainda"
            descricao="Crie até 10 metas em Configurações e acompanhe aqui quanto guardou por mês."
            acao={
              <Button asChild size="sm">
                <Link to="/configuracoes">Criar metas</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Quanto guardei em {ano}</CardTitle>
        <CardDescription>
          Edite qualquer célula: o valor é o mesmo que aparece em “Investimentos do mês”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progresso geral de cada meta (valor acumulado de todos os anos) */}
        <div className="grid gap-3 md:grid-cols-2">
          {resumo.map((meta) => {
            const { percentual, bruto } = progressoDaMeta(meta.guardado_total, meta.valor_meta_centavos)
            return (
              <div key={meta.goal_id} className="space-y-1.5 rounded-xl border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{meta.nome}</span>
                  <span className="tabular text-sm text-muted-foreground">
                    {formatCentavos(meta.guardado_total)} / {formatCentavos(meta.valor_meta_centavos)}
                  </span>
                </div>
                <Progress value={percentual} />
                <p className="text-xs text-muted-foreground">
                  {bruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% da meta · {formatCentavos(meta.guardado_ano)} em {ano}
                </p>
              </div>
            )
          })}
        </div>

        {/* Grade mês a mês — rola só dentro do container, nunca a página */}
        <GradeEditavel>
          <div className="tabela-scroll">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">Valores guardados por meta em cada mês de {ano}</caption>
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Meta
                  </th>
                  {MESES_CURTOS.map((mes) => (
                    <th key={mes} scope="col" className="px-2 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                      {mes}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {metas.map((meta) => (
                  <tr key={meta.id} className="border-b border-border last:border-0">
                    <th scope="row" className="sticky left-0 z-10 max-w-[10rem] truncate bg-card px-3 py-1.5 text-left font-medium">
                      {meta.nome}
                    </th>
                    {MESES_CURTOS.map((_, indice) => {
                      const mes = indice + 1
                      return (
                        <td key={mes} className="px-1 py-1">
                          <MoneyInput
                            data-celula
                            aria-label={`${meta.nome} em ${nomeDoMes(mes)}`}
                            value={valorDe(meta.id, mes)}
                            onValueChange={(valor) => onSalvarAporte(meta.id, mes, valor)}
                            className="h-8 w-[6.5rem] border-transparent bg-transparent px-1 text-xs hover:border-input focus:bg-card"
                          />
                        </td>
                      )
                    })}
                    <td className="tabular px-3 py-1.5 text-right font-semibold">
                      {formatCentavos(totalDaMeta(meta.id))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Total do mês
                  </th>
                  {MESES_CURTOS.map((_, indice) => (
                    <td key={indice} className="tabular px-2 py-2 text-right text-xs">
                      {formatCentavos(totalDoMes(indice + 1))}
                    </td>
                  ))}
                  <td className="tabular px-3 py-2 text-right text-sm font-semibold">{formatCentavos(totalAno)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </GradeEditavel>

        <Total
          rotulo={`Total investido em ${ano}`}
          valor={<NumeroAnimado valor={totalAno} className="tabular text-base font-semibold" />}
        />
      </CardContent>
    </Card>
  )
}
