import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, ChevronRight, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { formatCentavos } from '@/lib/money'
import { MESES_CURTOS, nomeDoMes, periodoAtual } from '@/lib/dates'
import { progressoDaMeta } from '@/lib/calculations'
import {
  previsaoDeConclusao,
  projecaoDaMeta,
  textoDaPrevisao,
  textoDoPrazo,
  textoDoRitmo,
} from '@/lib/meta-prazo'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'
import { FaixaRolavel } from '@/components/common/faixa-rolavel'
import { SheetMeta } from './components/sheet-meta'
import { SheetAporteRapido } from './components/sheet-aporte-rapido'
import { SheetMovimentoMeta } from './components/sheet-movimento-meta'
import { Wishlist } from './components/wishlist'
import { useEhMobile } from '@/lib/hooks'
import { useMetas } from './use-metas'

export function MetasPage() {
  const { anoComparativo, definirAnoComparativo } = usePeriodoStore()
  const { dados, carregando, erro, recarregar, acoes } = useMetas(anoComparativo)

  /**
   * As metas como a wishlist precisa vê-las: nome e quanto já tem.
   *
   * O `guardado_total` vem do agregado; sem ele (meta recém-criada, que ainda
   * não apareceu no resumo) fica zero, que é a verdade — ela não tem aporte.
   */
  const metasLigaveis = useMemo(
    () =>
      (dados?.metas ?? []).map((meta) => ({
        goal_id: meta.id,
        nome: meta.nome,
        guardado_total: dados?.resumo.find((r) => r.goal_id === meta.id)?.guardado_total ?? 0,
      })),
    [dados],
  )

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
            metas={metasLigaveis}
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
            onResgatar={acoes.resgatar}
            onTransferir={acoes.transferir}
          />
        </>
      ) : null}
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
  onResgatar,
  onTransferir,
}: {
  ano: number
  metas: Array<import('@/lib/database.types').Goal>
  aportes: Array<import('@/lib/database.types').GoalContribution>
  resumo: Array<import('@/lib/database.types').ResumoMeta>
  onSalvarAporte: (goalId: string, mes: number, valor: number) => void
  onResgatar: (goalId: string, centavos: number) => void
  onTransferir: (origem: string, destino: string, centavos: number) => void
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
  const [guardandoEm, setGuardandoEm] = useState<{ id: string; nome: string } | null>(null)
  const [movimentoAberto, setMovimentoAberto] = useState(false)

  /**
   * O saldo de cada meta — o teto do que dá para resgatar.
   *
   * Vem de `guardado_total` do agregado, que é a mesma soma que o controle
   * mensal usa (`saldosMetas` da 0013): todos os meses, e não só o ano aberto.
   * Quem guardou em março de 2024 pode resgatar hoje.
   */
  const saldos = Object.fromEntries(resumo.map((r) => [r.goal_id, r.guardado_total]))

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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>Quanto guardei em {ano}</CardTitle>
            <CardDescription>
              Edite qualquer célula: o valor é o mesmo que aparece em “Investimentos do mês”.
            </CardDescription>
          </div>
          {/* Tirar e mover dinheiro entre metas vivia só no controle mensal —
              inalcançável da tela em que alguém pensa "quero tirar daqui". É a
              MESMA folha, importada, e não uma cópia. */}
          <Button
            variant="outline"
            size="sm"
            className="alvo-toque shrink-0"
            onClick={() => setMovimentoAberto(true)}
          >
            <ArrowRightLeft className="mr-1.5 h-4 w-4" aria-hidden />
            Resgatar ou transferir
          </Button>
        </div>
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
            /**
             * A meta SEM prazo também tem uma resposta honesta para "quando eu
             * chego lá?" — e ela usa a mesma base do ritmo. Uma das duas é
             * sempre `null`: `projecaoDaMeta` só existe com prazo, esta só sem.
             */
            const previsao = previsaoDeConclusao({
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
                {previsao && (
                  <p className="border-t border-border/70 pt-1.5 text-xs text-muted-foreground">
                    {textoDaPrevisao(previsao)}
                  </p>
                )}
              </>
            )

            /**
             * "Guardar" fica FORA do bloco que abre os doze meses.
             *
             * No celular o card inteiro é um botão que abre a grade daquela
             * meta, e botão dentro de botão é HTML inválido — além de deixar
             * ambíguo o que o toque faz. Aqui o card é um `<div>`, o conteúdo
             * é que vira botão quando precisa, e "Guardar" é sempre um alvo
             * próprio, do mesmo tamanho nos dois tamanhos de tela.
             */
            return (
              <div key={meta.id} className="space-y-1.5 rounded-xl border border-border p-3">
                {ehEstreito ? (
                  <button
                    type="button"
                    onClick={() => setMetaAberta({ id: meta.id, nome: meta.nome })}
                    aria-label={`Ver e editar os doze meses de ${meta.nome}`}
                    className="w-full space-y-1.5 rounded-lg text-left transition-colors active:bg-realce"
                  >
                    {conteudo}
                  </button>
                ) : (
                  conteudo
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="alvo-toque w-full"
                  onClick={() => setGuardandoEm({ id: meta.id, nome: meta.nome })}
                >
                  <PiggyBank className="mr-1.5 h-4 w-4" aria-hidden />
                  Guardar em {meta.nome}
                </Button>
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

        <SheetAporteRapido
          meta={guardandoEm}
          ano={ano}
          valorDoMes={(mes) => (guardandoEm ? valorDe(guardandoEm.id, mes) : 0)}
          onFechar={() => setGuardandoEm(null)}
          onSalvar={onSalvarAporte}
        />

        <SheetMovimentoMeta
          aberta={movimentoAberto}
          onOpenChange={setMovimentoAberto}
          metas={metas}
          saldos={saldos}
          // O movimento é sempre de HOJE, e não do ano no seletor: tirar
          // dinheiro é um fato do presente. A folha só mostra o mês; quem
          // grava é `acoes.resgatar`, que usa o relógio.
          ano={periodoAtual().ano}
          mes={periodoAtual().mes}
          onResgatar={onResgatar}
          onTransferir={onTransferir}
        />
      </CardContent>
    </Card>
  )
}
