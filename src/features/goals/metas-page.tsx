import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, ChevronRight, Circle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { Estrelas } from '@/components/common/estrelas'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { formatCentavos } from '@/lib/money'
import { MESES_CURTOS, nomeDoMes } from '@/lib/dates'
import { progressoDaMeta, progressoWishlist, totalDeItens } from '@/lib/calculations'
import { projecaoDaMeta, textoDoPrazo, textoDoRitmo } from '@/lib/meta-prazo'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'
import { FaixaRolavel } from '@/components/common/faixa-rolavel'
import { SheetMeta } from './components/sheet-meta'
import { useEhMobile } from '@/lib/hooks'
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
        {/* Faixa que desliza no celular, três colunas de sm para cima — mesmo
            tratamento dos indicadores do comparativo anual. Empilhados eram
            200px antes do primeiro desejo aparecer. */}
        <FaixaRolavel
          rotulo="Resumo da wishlist"
          className={cn(
            '-mx-5 flex snap-x snap-mandatory gap-3 px-5 pb-1',
            'sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0',
          )}
        >
          <Indicador
            Icone={CheckCircle2}
            rotulo="Cumpridas"
            valor={progresso.cumpridas}
            className="text-success"
          />
          <Indicador Icone={Circle} rotulo="Pendentes" valor={progresso.pendentes} />
          <div className="w-[62%] shrink-0 snap-start rounded-xl border border-border p-3 sm:w-auto sm:shrink">
            <p className="text-sm text-muted-foreground">Falta juntar</p>
            <p className="tabular text-lg font-semibold">{formatCentavos(totalPendente)}</p>
          </div>
        </FaixaRolavel>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso da wishlist</span>
            <span className="tabular font-medium">
              {progresso.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            </span>
          </div>
          <Progress
            value={progresso.percentual}
            aria-label={`Progresso da wishlist: ${Math.round(progresso.percentual)}%`}
          />
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

            {/* CELULAR: card de três faixas — [✓ nome] / [valor 🗑] / [estrelas].
                Antes eram quatro campos empilhados com rótulo cada (~260px por
                desejo) e as estrelas tinham 20px de alvo. O nome fica sozinho
                na 1ª faixa porque dividindo com a lixeira sobravam 158px e
                "Notebook novo para trabalhar" virava "Notebook novo p". A ordem no DOM segue
                as colunas do desktop (item, valor, prioridade, conquistado,
                ações); no celular o `order` reposiciona sem duplicar markup, e
                de md para cima o grid do `Linha` assume e os `order` somem. */}
            {itens.map((item) => (
              <Linha
                key={item.id}
                template={TEMPLATE_WISHLIST}
                destacada={item.concluido}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:grid md:gap-2"
              >
                <Input
                  data-celula
                  aria-label="Nome do item"
                  defaultValue={item.nome}
                  onBlur={(e) => {
                    if (e.target.value !== item.nome) onEditar(item.id, { nome: e.target.value })
                  }}
                  className={cn(
                    'order-2 min-w-0 flex-1 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:order-none md:font-normal',
                    item.concluido && 'line-through opacity-70',
                  )}
                />
                <MoneyInput
                  data-celula
                  aria-label="Valor do item"
                  value={item.valor_centavos}
                  onValueChange={(v) => onEditar(item.id, { valor_centavos: v })}
                  className="order-3 min-w-0 flex-1 basis-[calc(100%-3.25rem)] border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:order-none md:basis-auto md:font-normal"
                />
                <Estrelas
                  valor={item.prioridade}
                  onChange={(p) => onEditar(item.id, { prioridade: p })}
                  className="order-5 basis-full md:order-none md:basis-auto"
                  botaoClassName="h-11 w-11 md:h-auto md:w-auto"
                />
                <BotaoConcluido
                  concluido={item.concluido}
                  nome={item.nome}
                  onAlternar={(concluido) => onEditar(item.id, { concluido })}
                />
                <div className="acoes-hover order-4 flex shrink-0 justify-end md:order-none">
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

        {/* Adição com a mesma forma do card: "+" e nome na 1ª faixa, valor na
            2ª, estrelas na 3ª. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:grid md:grid-cols-[1fr,10rem,9rem,2.5rem] md:gap-2">
          <Input
            placeholder="Novo desejo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome do novo desejo"
            className="min-w-0 flex-1"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor do novo desejo"
            className="basis-full md:basis-auto"
          />
          <div className="flex basis-full items-center md:basis-auto">
            <Estrelas
              valor={prioridade}
              onChange={setPrioridade}
              botaoClassName="h-11 w-11 md:h-auto md:w-auto"
            />
          </div>
          <Button
            size="icon"
            className="order-first shrink-0 md:order-none"
            onClick={adicionar}
            aria-label="Adicionar desejo"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * "Conquistado" como botão único, do tamanho do dedo.
 *
 * Mesmo motivo do BotaoPago dos gastos fixos: o Checkbox do Radix tem 16px de
 * alvo e o <label htmlFor> em volta não repassa o clique. Aqui o alvo inteiro
 * É o controle, e role/aria-checked preservam a semântica.
 */
function BotaoConcluido({
  concluido,
  nome,
  onAlternar,
}: {
  concluido: boolean
  nome: string
  onAlternar: (concluido: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={concluido}
      aria-label={`Marcar ${nome} como conquistado`}
      data-celula
      onClick={() => onAlternar(!concluido)}
      className="order-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg md:order-none md:h-auto md:w-full"
    >
      <span
        aria-hidden
        className={cn(
          'grid h-5 w-5 place-items-center rounded-md border transition-colors',
          concluido ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {concluido && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
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
    <div className="flex w-[62%] shrink-0 snap-start items-center gap-3 rounded-xl border border-border p-3 sm:w-auto sm:shrink">
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

  /** Os doze meses da meta, de janeiro a dezembro, com zero onde não houve aporte. */
  const aportesPorMes = (goalId: string) => Array.from({ length: 12 }, (_, i) => valorDe(goalId, i + 1))

  /**
   * A grade meta x mês precisa de ~900px para caber sem apertar as células.
   * Abaixo disso ela vira lista: cada meta abre uma sheet com os doze meses
   * dela em campos de tamanho de dedo (ver components/sheet-meta.tsx).
   */
  const ehEstreito = useEhMobile(1024)
  const [metaAberta, setMetaAberta] = useState<{ id: string; nome: string } | null>(null)

  if (metas.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Metas</CardTitle>
        </CardHeader>
        <CardContent>
          <EstadoVazio
            ilustracao="meta"
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
        {/* Progresso geral de cada meta (valor acumulado de todos os anos).
            Quando a grade não cabe, este mesmo card é o caminho para editar:
            vira botão e abre a sheet do ano daquela meta. Percorremos `metas`
            e não `resumo` para que uma meta sem linha no agregado ainda
            apareça — senão ela ficaria inalcançável no celular. */}
        <div className="grid gap-3 md:grid-cols-2">
          {metas.map((meta) => {
            const linha = resumo.find((r) => r.goal_id === meta.id)
            const guardadoTotal = linha?.guardado_total ?? totalDaMeta(meta.id)
            const guardadoAno = linha?.guardado_ano ?? totalDaMeta(meta.id)
            const alvo = linha?.valor_meta_centavos ?? meta.valor_meta_centavos
            const { percentual, bruto } = progressoDaMeta(guardadoTotal, alvo)
            const projecao = projecaoDaMeta({
              meta: { ...meta, valor_meta_centavos: alvo },
              guardadoTotal,
              aportesDoAno: aportesPorMes(meta.id),
              anoDosAportes: ano,
            })

            const conteudo = (
              <>
                {/* flex-wrap: em 360px "Reserva de emergência" + os dois
                    valores não cabem na mesma linha, e o nome era o que
                    encolhia até virar "Reserva...". Aqui ele quebra para a
                    linha de cima; no desktop tudo volta para uma linha só. */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="min-w-0 flex-1 basis-full truncate font-medium sm:basis-auto">
                    {meta.nome}
                  </span>
                  <span className="tabular whitespace-nowrap text-sm text-muted-foreground">
                    {formatCentavos(guardadoTotal)} / {formatCentavos(alvo)}
                  </span>
                </div>
                <Progress value={percentual} aria-label={`${meta.nome}: ${Math.round(bruto)}% da meta`} />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {bruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% da meta ·{' '}
                  {formatCentavos(guardadoAno)} em {ano}
                  {ehEstreito && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                </p>
                {/* Só existe quando a meta tem prazo. Sem prazo, esta parte do
                    card não aparece e nada muda em relação a antes da 0019. */}
                {projecao && (
                  <div className="space-y-0.5 border-t border-border/70 pt-1.5 text-xs">
                    {/* A data que passou é fato e merece ser vista; não é
                        veredito sobre a pessoa, por isso âmbar e não vermelho. */}
                    <p
                      className={cn(
                        projecao.concluida && 'text-success',
                        projecao.prazoVencido && !projecao.concluida && 'text-warning',
                      )}
                    >
                      {textoDoPrazo(projecao, {
                        ano: meta.prazo_ano as number,
                        mes: meta.prazo_mes as number,
                      })}
                    </p>
                    {textoDoRitmo(projecao) && (
                      <p className="text-muted-foreground">{textoDoRitmo(projecao)}</p>
                    )}
                  </div>
                )}
              </>
            )

            return ehEstreito ? (
              <button
                key={meta.id}
                type="button"
                onClick={() => setMetaAberta({ id: meta.id, nome: meta.nome })}
                className="space-y-1.5 rounded-xl border border-border p-3 text-left transition-colors active:bg-realce"
              >
                {conteudo}
              </button>
            ) : (
              <div key={meta.id} className="space-y-1.5 rounded-xl border border-border p-3">
                {conteudo}
              </div>
            )
          })}
        </div>

        {/* Grade mês a mês — rola só dentro do container, nunca a página */}
        {!ehEstreito && (
          <GradeEditavel>
            <div className="tabela-scroll">
              <table className="w-full min-w-[52rem] text-sm">
                <caption className="sr-only">Valores guardados por meta em cada mês de {ano}</caption>
                <thead className="bg-superficie">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-superficie px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Meta
                    </th>
                    {MESES_CURTOS.map((mes) => (
                      <th
                        key={mes}
                        scope="col"
                        className="px-2 py-2 text-right text-xs font-semibold uppercase text-muted-foreground"
                      >
                        {mes}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metas.map((meta) => (
                    <tr key={meta.id} className="border-b border-border last:border-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 max-w-[10rem] truncate bg-card px-3 py-1.5 text-left font-medium"
                      >
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
                <tfoot className="bg-superficie">
                  <tr>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-superficie px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground"
                    >
                      Total do mês
                    </th>
                    {MESES_CURTOS.map((_, indice) => (
                      <td key={indice} className="tabular px-2 py-2 text-right text-xs">
                        {formatCentavos(totalDoMes(indice + 1))}
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-right text-sm font-semibold">
                      {formatCentavos(totalAno)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GradeEditavel>
        )}

        {/* O rodapé "Total do mês" da grade não some junto com ela: vira uma
            faixa que desliza, com os doze meses do ano. */}
        {ehEstreito && (
          <div>
            <p className="mb-1.5 text-micro font-medium uppercase tracking-wide text-muted-foreground">
              Total guardado por mês
            </p>
            <FaixaRolavel rotulo="Total guardado por mês" className="-mx-1 flex gap-1.5 px-1 pb-1">
              {MESES_CURTOS.map((nome, indice) => (
                <div key={nome} className="shrink-0 rounded-xl border border-border px-3 py-2 text-center">
                  <p className="text-micro uppercase text-muted-foreground">{nome}</p>
                  <p className="tabular whitespace-nowrap text-sm font-medium">
                    {formatCentavos(totalDoMes(indice + 1))}
                  </p>
                </div>
              ))}
            </FaixaRolavel>
          </div>
        )}

        <Total
          rotulo={`Total investido em ${ano}`}
          valor={<NumeroAnimado valor={totalAno} className="tabular text-base font-semibold" />}
        />

        <SheetMeta
          aberta={metaAberta !== null}
          onOpenChange={(aberta) => !aberta && setMetaAberta(null)}
          ano={ano}
          meta={metaAberta}
          valorDoMes={valorDe}
          onSalvar={onSalvarAporte}
        />
      </CardContent>
    </Card>
  )
}
