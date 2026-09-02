import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  HelpCircle,
  LineChart,
  PiggyBank,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { NumeroAnimado } from '@/components/common/numero-animado'
import { EstadoErro } from '@/components/common/estados'
import { Donut } from '@/components/common/donut'
import { useConsulta } from '@/lib/cache'
import { obterResumoMensal, obterGastosPorCategoria, obterComparativoAnual } from '@/services/reports'
import { nomeDoMes, periodoAtual } from '@/lib/dates'
import { formatCentavos } from '@/lib/money'
import { useAuthStore } from '@/store/auth'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'
import { observacoesDoMes, projecaoFimDoMes } from '@/lib/observacoes'
import { gastoMaisAtipico, historicoPorCategoria } from '@/lib/gasto-atipico'
import { useGastosRecentes } from '@/lib/use-gastos-recentes'
import { estaVigente, vaiParaFatura } from '@/lib/calculations'
import { carregarMes } from '@/services/mes'
import { ObservacoesMes } from './components/observacoes-mes'
import { Capa, SeletorDeCapa } from './components/capa'
import { Widget } from './components/widget'
import { usePainel } from './use-painel'
import { Button } from '@/components/ui/button'
import { MOV } from '@/lib/movimento'

const ATALHOS = [
  {
    para: '/mes',
    titulo: 'Controle mensal',
    descricao: 'Entradas, gastos fixos, gastos do mês e investimentos.',
    Icone: CalendarDays,
  },
  {
    para: '/comparativo',
    titulo: 'Comparativo anual',
    descricao: 'Entrada x gastos nos 12 meses do ano.',
    Icone: LineChart,
  },
  {
    para: '/metas',
    titulo: 'Metas e wishlist',
    descricao: 'O quanto você já guardou para cada objetivo.',
    Icone: Target,
  },
  {
    para: '/configuracoes',
    titulo: 'Configurações',
    descricao: 'Categorias, limites, formas de pagamento e tema.',
    Icone: Settings,
  },
  { para: '/ajuda', titulo: 'Ajuda', descricao: 'Como usar cada tela do app.', Icone: HelpCircle },
]

/**
 * Os blocos do painel, e os nomes pelos quais a pessoa os move e esconde.
 *
 * A ORDEM DAQUI É A ORDEM DE FÁBRICA, e é a mesma de antes da fase 4 — donut,
 * frases, cards de resumo, atalhos. Quem nunca tocou em "Personalizar" tem uma
 * `painel_ordem` vazia, e `widgetsVisiveis` devolve exatamente esta lista:
 * ninguém abre o app amanhã com o painel remontado.
 *
 * Acrescentar um widget é acrescentar uma linha aqui e um `case` no
 * `desenhar` lá embaixo. Ele aparece no fim do painel de todo mundo — inclusive
 * de quem já personalizou —, porque é isso que a lista separada de escondidos
 * da 0023 torna possível distinguir.
 *
 * O `titulo` não aparece em lugar nenhum fora do modo de edição: é o nome que
 * os botões anunciam ("Mover Atalhos para baixo"), e por isso ele nomeia o
 * BLOCO, e não repete o título que o card já desenha por dentro.
 */
const WIDGETS = [
  { id: 'categorias', titulo: 'Gastos por categoria' },
  { id: 'observacoes', titulo: 'Observações do mês' },
  { id: 'saldo', titulo: 'Resumo do mês' },
  { id: 'atalhos', titulo: 'Atalhos' },
] as const

/** Fora do componente: entra como dependência de memo dentro do usePainel. */
const IDS = WIDGETS.map((w) => w.id)

const TITULO_DO_WIDGET = new Map(WIDGETS.map((w) => [w.id as string, w.titulo]))

export function DashboardPage() {
  const perfil = useAuthStore((s) => s.profile)
  const definirPeriodo = usePeriodoStore((s) => s.definirPeriodo)
  const hoje = periodoAtual()

  // Resumo vem pronto do banco (função SQL resumo_mensal) — o painel não carrega linhas.
  const {
    dados: resumo,
    carregando,
    erro,
    recarregar,
  } = useConsulta(['resumo-mensal', hoje.ano, hoje.mes], () => obterResumoMensal(hoje.ano, hoje.mes))

  const {
    dados: gastosCategoria,
    carregando: carregandoCategorias,
    erro: erroCategorias,
    recarregar: recarregarCategorias,
  } = useConsulta(['gastos-por-categoria', hoje.ano, hoje.mes], () =>
    obterGastosPorCategoria(hoje.ano, hoje.mes),
  )

  // O ano inteiro serve só para comparar o mês com a SUA média — é a mesma
  // função que o comparativo usa, então não é consulta nova para o banco.
  const { dados: meses } = useConsulta(['comparativo-anual', hoje.ano], () => obterComparativoAnual(hoje.ano))

  /**
   * Com cartão de fatura, o donut de categorias (competência: o mês da compra)
   * e o total de saídas (caixa: o mês em que sai da conta) deixam de bater.
   *
   * A tela do mês já mostra os dois com nomes diferentes; o painel não mostrava,
   * e ficava com um donut somando R$ 2.922,56 embaixo de um card dizendo
   * R$ 2.631,85, sem nada explicando a diferença — o mesmo defeito que a 0006
   * consertou. Sem cartão configurado os dois são iguais, `temFatura` é falso e
   * o painel fica idêntico ao de antes.
   *
   * A soma vem das categorias porque o painel não carrega os lançamentos: ela é
   * exatamente o que o donut desenha, então o número explicado é o número visto.
   */
  const gastoCompetencia = useMemo(
    () => (gastosCategoria ?? []).reduce((s, c) => s + c.gasto_centavos, 0),
    [gastosCategoria],
  )
  const temFatura = Boolean(resumo) && gastoCompetencia !== resumo?.total_saidas

  /**
   * O mês cru, só para a projeção de fechamento.
   *
   * Mesma chave de cache da tela do mês (`['mes', ano, mes]`), então num app em
   * que a tela do mês é a mais visitada isto quase sempre já está em memória —
   * e quando não está, é uma RPC só, que é para o que a 0011 existe.
   *
   * Não dá para projetar a partir do que o painel já tinha: `resumo_mensal`
   * entrega um total de saídas onde aluguel, fatura e compra do dia estão
   * somados, e a régua de três só vale para a última parte. Multiplicar o total
   * pela média diária transformaria um aluguel lançado no dia 5 em seis vezes
   * ele mesmo.
   */
  const { dados: mesCru } = useConsulta(['mes', hoje.ano, hoje.mes], () => carregarMes(hoje.ano, hoje.mes))

  const projecao = useMemo(() => {
    if (!resumo || !mesCru) return null
    // `vaiParaFatura` é o mesmo filtro do `calcularCaixaDoMes` (regra 9): a
    // compra que só sai numa fatura futura não pesa neste mês, e contá-la aqui
    // E na fatura do mês em que ela vence é o defeito da família
    // competência × caixa.
    const gastosDoDia = mesCru.lancamentos.filter(
      (l) => l.tipo === 'gasto' && !vaiParaFatura(l, mesCru.formasPagamento),
    )
    return projecaoFimDoMes({
      ano: hoje.ano,
      mes: hoje.mes,
      totalEntradas: resumo.total_entradas,
      fixosCentavos: mesCru.gastosFixos
        .filter((f) => f.ativo && estaVigente(f, hoje.ano, hoje.mes))
        .reduce((soma, f) => soma + f.valor_centavos, 0),
      faturasCentavos: mesCru.faturas.reduce((soma, f) => soma + f.total_centavos, 0),
      gastosDoDia,
    })
  }, [resumo, mesCru, hoje.ano, hoje.mes])

  /**
   * A janela de doze meses é a MESMA leitura da detecção de assinatura (6.2):
   * mesma chave de cache do `useGastosRecentes`, então o painel não dispara
   * uma segunda consulta grande só porque este widget existe.
   */
  const { dados: gastosRecentes } = useGastosRecentes()

  const gastoAtipico = useMemo(() => {
    if (!mesCru || !gastosRecentes) return null
    const candidatos = mesCru.lancamentos.filter((l) => l.tipo === 'gasto')
    const historico = historicoPorCategoria({
      gastos: gastosRecentes,
      periodoAvaliado: { ano: hoje.ano, mes: hoje.mes },
    })
    return gastoMaisAtipico({ candidatos, historico })
  }, [mesCru, gastosRecentes, hoje.ano, hoje.mes])

  const observacoes = useMemo(
    () =>
      resumo
        ? observacoesDoMes({
            resumo,
            categorias: gastosCategoria ?? [],
            meses: meses ?? [],
            mes: hoje.mes,
            ano: hoje.ano,
            projecao,
            gastoAtipico,
          })
        : [],
    [resumo, gastosCategoria, meses, hoje.mes, hoje.ano, projecao, gastoAtipico],
  )

  const primeiroNome = (perfil?.nome ?? '').split(' ')[0]

  const painel = usePainel(IDS)

  /**
   * O conteúdo de cada widget.
   *
   * É um `switch` sobre o id e não um objeto de componentes porque todos eles
   * fecham sobre os mesmos dados já calculados acima — `resumo`, `observacoes`,
   * `gastosCategoria`. Como componentes separados, cada um precisaria receber
   * meia dúzia de props, ou o painel viraria um provider para servir quatro
   * blocos que só ele usa.
   *
   * Nenhum bloco aqui foi reescrito: é a mesma marcação que o painel desenhava
   * antes da fase 4, recortada. O que mudou é QUEM decide a ordem em que eles
   * entram na tela.
   */
  function desenhar(id: string) {
    switch (id) {
      case 'categorias':
        if (carregandoCategorias && !gastosCategoria) return <Skeleton className="h-72 w-full" />
        if (!gastosCategoria) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoria</CardTitle>
              <CardDescription>
                {temFatura ? (
                  <>
                    Os <strong>{formatCentavos(gastoCompetencia)}</strong> que você gastou em{' '}
                    {nomeDoMes(hoje.mes)}, pela data da compra. O card &ldquo;sai da conta&rdquo; abaixo é
                    outro número: ele conta a fatura no mês em que ela vence.
                  </>
                ) : (
                  <>Como as saídas de {nomeDoMes(hoje.mes)} se dividem.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Donut
                dados={gastosCategoria.map((g) => ({ nome: g.nome, valor: g.gasto_centavos, cor: g.cor }))}
                vazioTexto="Nenhum gasto lançado neste mês ainda."
              />
            </CardContent>
          </Card>
        )

      // Depois do gráfico na ordem de fábrica: o desenho responde "para onde
      // foi" num relance, e as frases entram para dizer o que ele não mostra —
      // comparação com os seus outros meses, limite estourado, quanto ficou sem
      // categoria. Quem preferir o contrário agora pode trocar.
      case 'observacoes':
        return <ObservacoesMes observacoes={observacoes} />

      case 'saldo':
        if (carregando && !resumo)
          return (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )
        if (!resumo) return null
        return (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <CardResumo
              rotulo="Entradas"
              valor={resumo.total_entradas}
              Icone={TrendingUp}
              className="text-success"
            />
            <CardResumo
              rotulo={temFatura ? 'Sai da conta' : 'Saídas'}
              valor={resumo.total_saidas}
              Icone={TrendingDown}
              className="text-destructive"
            />
            {/* Saldo é a resposta que a pessoa abre o app para ver — ganha destaque */}
            <CardResumo
              rotulo="Saldo"
              valor={resumo.saldo}
              Icone={Wallet}
              destaque
              className={resumo.saldo < 0 ? 'text-destructive' : 'text-foreground'}
            />
            <Card>
              <CardContent className="flex h-full flex-col justify-between gap-2 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Investido</p>
                  <PiggyBank className="h-4 w-4 shrink-0 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="tabular text-lg font-semibold sm:text-xl">
                    {formatCentavos(resumo.total_investido)}
                  </p>
                  <Progress
                    value={Math.min(resumo.percentual_investido, 100)}
                    aria-label={`${resumo.percentual_investido}% do que entrou foi investido`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {Number(resumo.percentual_investido).toLocaleString('pt-BR', {
                      maximumFractionDigits: 0,
                    })}
                    % do que entrou
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      // Atalhos: no celular viram blocos compactos de 2 colunas; a descrição
      // só aparece quando há largura para ela.
      case 'atalhos':
        return (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {ATALHOS.map((atalho, indice) => (
              <motion.div
                key={atalho.para}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * indice, duration: MOV.normal }}
              >
                <Link
                  to={atalho.para}
                  onClick={() => atalho.para === '/mes' && definirPeriodo(hoje)}
                  className="group block h-full"
                >
                  <Card className="h-full transition-all group-hover:-translate-y-1 group-hover:shadow-2">
                    <CardHeader className="gap-2 p-4 sm:p-6">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary sm:h-10 sm:w-10">
                        <atalho.Icone className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        {atalho.titulo}
                        <ArrowRight className="hidden h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                      </CardTitle>
                      <CardDescription className="hidden sm:block">{atalho.descricao}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )

      // Id que veio do perfil e o app não conhece mais. `widgetsVisiveis` já o
      // filtra antes de chegar aqui; este default é o cinto do suspensório.
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Capa nome={painel.capa} />

      <CabecalhoPagina
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
        descricao={`Aqui está o resumo de ${nomeDoMes(hoje.mes)} de ${hoje.ano}.`}
        acoes={
          <Button
            variant={painel.editando ? 'default' : 'outline'}
            onClick={() => painel.setEditando(!painel.editando)}
            aria-pressed={painel.editando}
          >
            {painel.editando ? <Check className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            {painel.editando ? 'Concluir' : 'Personalizar'}
          </Button>
        }
      />

      {/* A personalização mora AQUI, no próprio painel, e não numa página de
          configurações. Mexer no arranjo de uma tela olhando para um formulário
          noutra é escolher no escuro: aqui cada seta move um card que está à
          vista, e a capa troca embaixo do dedo que a escolheu. */}
      {painel.editando && (
        <section
          aria-label="Personalizar o painel"
          className="space-y-4 rounded-lg border border-border bg-superficie p-4"
        >
          <div className="space-y-2">
            <h2 className="text-rotulo uppercase text-muted-foreground">Capa</h2>
            <SeletorDeCapa atual={painel.capa} onEscolher={painel.definirCapa} />
          </div>

          {painel.escondidos.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-rotulo uppercase text-muted-foreground">Escondidos</h2>
              {/* Sem esta bandeja, esconder seria caminho só de ida: o card
                  sumiria da tela e não haveria de onde trazê-lo de volta. */}
              <div className="flex flex-wrap gap-2">
                {painel.escondidos.map((id) => (
                  <Button key={id} variant="outline" onClick={() => painel.mostrar(id)}>
                    <Eye className="h-4 w-4" />
                    {TITULO_DO_WIDGET.get(id) ?? id}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              O painel é seu e acompanha a sua conta — no celular e no computador.
            </p>
            <Button variant="ghost" onClick={painel.restaurar}>
              <RotateCcw className="h-4 w-4" />
              Voltar ao padrão
            </Button>
          </div>
        </section>
      )}

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {erroCategorias && (
        <EstadoErro mensagem={erroCategorias} onTentarNovamente={() => void recarregarCategorias()} />
      )}

      {painel.visiveis.map((id, i) => (
        <Widget
          key={id}
          id={id}
          titulo={TITULO_DO_WIDGET.get(id) ?? id}
          editando={painel.editando}
          primeiro={i === 0}
          ultimo={i === painel.visiveis.length - 1}
          onMover={painel.moverWidget}
          onEsconder={painel.esconder}
        >
          {desenhar(id)}
        </Widget>
      ))}

      {/* Painel inteiro escondido é uma escolha legítima, mas não pode virar
          uma tela em branco sem saída: sem isto, a única porta de volta seria
          o botão "Personalizar" lá em cima, que a pessoa acabou de usar para
          chegar aqui. */}
      {painel.visiveis.length === 0 && !painel.editando && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-corpo text-muted-foreground">Você escondeu todos os blocos do painel.</p>
          <Button variant="outline" className="mt-3" onClick={() => painel.setEditando(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Personalizar o painel
          </Button>
        </div>
      )}
    </div>
  )
}

function CardResumo({
  rotulo,
  valor,
  Icone,
  className,
  destaque,
}: {
  rotulo: string
  valor: number
  Icone: React.ComponentType<{ className?: string }>
  className?: string
  destaque?: boolean
}) {
  return (
    <Card className={cn(destaque && 'border-primary/30 bg-primary-soft/50')}>
      <CardContent className="flex h-full flex-col justify-between gap-2 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <Icone className={cn('h-4 w-4 shrink-0', className)} />
        </div>
        {/* No celular o card tem meia largura (~140px úteis): um degrau a menos
            deixa folga para valores como R$ 123.456,78 sem quebrar linha.
            O destaque do Saldo vem sobretudo do fundo tingido. */}
        <NumeroAnimado
          valor={valor}
          className={cn(
            'block',
            // Saldo e numero de destaque -> Fraunces. Os demais ficam em Inter
            // tabular, para as colunas do grid continuarem alinhadas.
            destaque ? 'numero-serif text-xl sm:text-2xl' : 'tabular font-semibold text-lg sm:text-xl',
            className,
          )}
        />
      </CardContent>
    </Card>
  )
}
