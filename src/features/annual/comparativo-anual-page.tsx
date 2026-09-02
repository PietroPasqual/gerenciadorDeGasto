import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { Download, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { useRegistrarAcoes } from '@/store/acoes-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { Cabecalho, Total } from '@/components/common/linha-planilha'
import { useEhMobile } from '@/lib/hooks'
import { useConsulta } from '@/lib/cache'
import { obterComparativoAnual } from '@/services/reports'
import { formatCentavos, formatCentavosCompacto } from '@/lib/money'
import { ehFuturo, nomeCurtoDoMes, nomeDoMes } from '@/lib/dates'
import { mediaMensal } from '@/lib/calculations'
import {
  compararAnos,
  separarRealizadoPrevisto,
  tendenciaDeGastos,
  textoDaBase,
  type Comparacao,
  type Tendencia,
} from '@/lib/comparativo'
import { baixarCSV, csvMoeda, gerarCSV } from '@/lib/csv'
import { usePeriodoStore } from '@/store/periodo'
import { cn } from '@/lib/utils'
import { FaixaRolavel } from '@/components/common/faixa-rolavel'

const TEMPLATE = 'md:grid-cols-[1fr,1fr,1fr,1fr]'

export function ComparativoAnualPage() {
  const { anoComparativo, definirAnoComparativo, definirPeriodo } = usePeriodoStore()
  const navegar = useNavigate()

  /**
   * Abrir um mês do comparativo.
   *
   * Antes isto só mexia no período guardado e ficava na mesma tela: você
   * clicava no mês e, da sua parte, nada acontecia. Definir o período sem ir
   * para lá é meio caminho — quem toca num mês quer VER o mês.
   */
  const abrirMes = (mes: number) => {
    definirPeriodo({ ano: anoComparativo, mes })
    navegar('/mes')
  }

  // Agregado calculado no banco (função SQL comparativo_anual)
  const { dados, carregando, erro, recarregar } = useConsulta(['comparativo-anual', anoComparativo], () =>
    obterComparativoAnual(anoComparativo),
  )

  /**
   * O ano anterior, para a comparação.
   *
   * Consulta separada e com a MESMA chave de cache do ano de cima: abrir 2026
   * e depois 2025 reaproveita o que já foi baixado, em vez de perguntar duas
   * vezes a mesma coisa ao banco.
   *
   * O erro dela não vira estado de erro da página. Sem o ano anterior a
   * comparação some e o resto continua de pé — derrubar o comparativo inteiro
   * porque a comparação falhou seria trocar uma tela útil por nada.
   */
  const { dados: dadosAnteriores } = useConsulta(['comparativo-anual', anoComparativo - 1], () =>
    obterComparativoAnual(anoComparativo - 1),
  )

  // O `?? []` precisa ficar memoizado: sem isso ele cria um array novo a cada
  // render e o useMemo abaixo recalcula sempre, que é o oposto do que ele faz ali.
  const meses = useMemo(() => dados ?? [], [dados])

  /**
   * Realizado e previsto, separados.
   *
   * Antes os três indicadores somavam os doze meses. Em abril isso quer dizer
   * que "Total de gastos" já trazia os fixos de dezembro embutidos — um número
   * que mistura fato com previsão e não avisa. Agora o destaque é o realizado,
   * e o previsto aparece embaixo, escrito.
   */
  const separacao = useMemo(() => separarRealizadoPrevisto(meses, anoComparativo), [meses, anoComparativo])

  const totais = useMemo(() => {
    const { entradas, saidas } = separacao.totalRealizado
    return {
      entradas,
      saidas,
      diferenca: entradas - saidas,
      // Média só do que ACONTECEU. Incluir os meses futuros (que já trazem os
      // gastos fixos) fazia a média de gastos ser puxada por uma previsão, e a
      // régua do gráfico marcava um "normal" que ninguém viveu.
      mediaEntradas: mediaMensal(separacao.realizados.map((m) => m.entradas)),
      mediaSaidas: mediaMensal(separacao.realizados.map((m) => m.saidas)),
    }
  }, [separacao])

  const comparacao = useMemo(
    () => compararAnos(meses, dadosAnteriores ?? [], anoComparativo),
    [meses, dadosAnteriores, anoComparativo],
  )

  const tendencia = useMemo(() => tendenciaDeGastos(meses, anoComparativo), [meses, anoComparativo])

  /** O primeiro mês previsto, para marcar a faixa do gráfico onde ele começa. */
  const primeiroPrevisto = separacao.previstos[0]?.mes ?? null

  const dadosGrafico = meses.map((m) => ({
    // `numeroMes` viaja junto com o ponto só para o clique no gráfico saber
    // para qual mês ir. O eixo continua mostrando `mes`, o nome curto.
    numeroMes: m.mes,
    mes: nomeCurtoDoMes(m.mes),
    Entradas: m.entradas / 100,
    Gastos: m.saidas / 100,
  }))

  /**
   * Tocar num mês do gráfico abre aquele mês.
   *
   * A lista "Mês a mês" já fazia isso, mas o gráfico é onde o olho para
   * primeiro — ver um pico e não conseguir tocar nele para saber o que houve
   * era o caminho faltando. O Recharts entrega o ponto ativo no clique; daí
   * sai o número do mês.
   */
  const irParaMesDoGrafico = (estado: { activePayload?: Array<{ payload?: { numeroMes?: number } }> }) => {
    const numero = estado?.activePayload?.[0]?.payload?.numeroMes
    if (numero) abrirMes(numero)
  }

  const exportar = () => {
    const conteudo = gerarCSV(
      ['Mês', 'Entrada (R$)', 'Gastos (R$)', 'Diferença (R$)'],
      meses.map((m) => [nomeDoMes(m.mes), csvMoeda(m.entradas), csvMoeda(m.saidas), csvMoeda(m.diferenca)]),
    )
    baixarCSV(`comparativo-${anoComparativo}.csv`, conteudo)
  }

  const semDados = meses.every((m) => m.entradas === 0 && m.saidas === 0)
  const mesesLancados = meses.filter((m) => m.entradas > 0 || m.saidas > 0).length

  /** Abaixo de md a linha do mês é um card, e o card todo é o alvo. */
  const ehEstreito = useEhMobile(768)

  useRegistrarAcoes(
    () => [
      {
        id: 'exportar-ano',
        rotulo: 'Exportar CSV',
        Icone: Download,
        desabilitada: !dados,
        executar: exportar,
      },
    ],
    [dados, anoComparativo],
  )

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Comparativo anual"
        descricao="Entrada x gastos mês a mês, para enxergar o ano inteiro de uma vez."
        acoes={
          <>
            <SeletorPeriodo
              ano={anoComparativo}
              mostrarMes={false}
              onChange={({ ano }) => definirAnoComparativo(ano)}
            />
            {/* Duplicata visual: no celular a mesma ação está no menu "⋯". */}
            <Button variant="outline" className="hidden sm:inline-flex" onClick={exportar} disabled={!dados}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 w-full lg:col-span-5" />
          <Skeleton className="h-96 w-full lg:col-span-7" />
        </div>
      ) : semDados ? (
        <EstadoVazio
          ilustracao="grafico"
          titulo={`Nada lançado em ${anoComparativo}`}
          descricao="Lance entradas e gastos no controle mensal para ver o comparativo."
        />
      ) : (
        <>
          {/* No celular os três indicadores empilhados eram 260px de altura
              antes do primeiro dado do ano aparecer. Viram uma faixa que
              desliza, com snap para o card parar inteiro; de sm para cima
              voltam a ser as três colunas. */}
          <FaixaRolavel
            rotulo="Totais do ano"
            className={cn(
              '-mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-1',
              'sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0',
            )}
          >
            <CardIndicador
              rotulo="Entradas realizadas"
              valor={totais.entradas}
              className="text-success"
              previsto={separacao.totalPrevisto.entradas}
              delta={<Delta comparacao={comparacao} campo="entradas" anoAnterior={anoComparativo - 1} />}
            />
            <CardIndicador
              rotulo="Gastos realizados"
              valor={totais.saidas}
              className="text-destructive"
              previsto={separacao.totalPrevisto.saidas}
              delta={<Delta comparacao={comparacao} campo="saidas" anoAnterior={anoComparativo - 1} />}
            />
            <CardIndicador
              rotulo="Diferença realizada"
              valor={totais.diferenca}
              className={totais.diferenca < 0 ? 'text-destructive' : 'text-success'}
            />
          </FaixaRolavel>

          <Leitura
            comparacao={comparacao}
            tendencia={tendencia}
            ano={anoComparativo}
            temPrevisto={separacao.previstos.length > 0}
          />

          {/* 5+7 na grade de 12 (D2): a lista de doze meses é texto curto e
              cabe em 5; o gráfico de linhas precisa de largura para os meses
              não se atropelarem no eixo. Meio a meio dava os dois piores. */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle>Mês a mês</CardTitle>
                <CardDescription>Meses com diferença negativa aparecem destacados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Cabecalho template={TEMPLATE}>
                  <span>Mês</span>
                  <span className="text-right">Entrada</span>
                  <span className="text-right">Gastos</span>
                  <span className="text-right">Diferença</span>
                </Cabecalho>

                {/* Aqui a linha NÃO usa o card empilhado padrão: comparar 12 meses
                    exige linhas curtas. No celular vira duas linhas de texto
                    (mês + diferença em cima, entrou/saiu embaixo); no desktop
                    volta a ser a tabela de 4 colunas. */}
                {meses.map((linha) => {
                  const negativo = linha.diferenca < 0
                  const futuro = ehFuturo({ ano: anoComparativo, mes: linha.mes })
                  const ir = () => abrirMes(linha.mes)

                  const classe = cn(
                    'grid grid-cols-1 gap-0.5 rounded-xl border border-border px-3 py-2 text-left transition-colors',
                    'md:grid-cols-[1fr,1fr,1fr,1fr] md:items-center md:gap-2 md:rounded-none md:border-0 md:border-b md:py-1.5',
                    'hover:bg-realce',
                    negativo && !futuro && 'bg-destructive/5',
                    // Fundo tingido, NUNCA opacidade: `opacity` multiplica o
                    // texto junto com o resto e derrubava a linha inteira
                    // abaixo de AA — o valor em text-success ia a 2,54:1 no
                    // claro e 3,17:1 no escuro, contra o mínimo de 4,5:1. E
                    // valia nos quatro temas, porque a opacidade age depois da
                    // cor, contornando por fora a calibração do themes.css.
                    // O que distingue o mês futuro é a etiqueta "previsto",
                    // que é texto; o fundo só reforça.
                    futuro && 'bg-superficie',
                  )

                  const corpo = (
                    <>
                      <div className="flex items-baseline justify-between gap-2 md:block">
                        {ehEstreito ? (
                          <span className="text-sm font-medium">
                            {nomeDoMes(linha.mes)}
                            {futuro && (
                              <Badge variant="outline" className="ml-2">
                                previsto
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={ir}
                            className="rounded-md text-left text-sm font-medium hover:underline"
                          >
                            {nomeDoMes(linha.mes)}
                            {futuro && (
                              <Badge variant="outline" className="ml-2">
                                previsto
                              </Badge>
                            )}
                          </button>
                        )}
                        <span
                          className={cn(
                            'tabular text-sm font-semibold md:hidden',
                            negativo ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {formatCentavos(linha.diferenca)}
                        </span>
                      </div>

                      {/* md:contents devolve estes dois valores às colunas da tabela */}
                      <div className="flex items-baseline gap-3 text-xs text-muted-foreground md:contents">
                        <span className="md:text-right md:text-sm md:text-foreground">
                          <span className="md:hidden">entrou </span>
                          <span className="tabular">{formatCentavos(linha.entradas)}</span>
                        </span>
                        <span className="md:text-right md:text-sm md:text-foreground">
                          <span className="md:hidden">saiu </span>
                          <span className="tabular">{formatCentavos(linha.saidas)}</span>
                        </span>
                      </div>

                      <span
                        className={cn(
                          'hidden tabular text-sm font-medium md:block md:text-right',
                          negativo ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {formatCentavos(linha.diferenca)}
                      </span>
                    </>
                  )

                  // No celular o card INTEIRO leva para o mês: o nome sozinho
                  // era um alvo de 20px de altura. No desktop o card é uma
                  // linha de tabela e quem leva é o nome, que aí tem hover e
                  // não come a linha toda.
                  return ehEstreito ? (
                    <button key={linha.mes} type="button" onClick={ir} className={cn(classe, 'w-full')}>
                      {corpo}
                    </button>
                  ) : (
                    <div key={linha.mes} className={classe}>
                      {corpo}
                    </div>
                  )
                })}

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* "por mês realizado", e não "no ano": a média conta só os
                      meses que aconteceram e tiveram movimento. */}
                  <Total rotulo="Entradas por mês realizado" valor={formatCentavos(totais.mediaEntradas)} />
                  <Total rotulo="Gastos por mês realizado" valor={formatCentavos(totais.mediaSaidas)} />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle>Entrada x gastos</CardTitle>
                <CardDescription>Valores em reais ao longo de {anoComparativo}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[22rem] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={dadosGrafico}
                      margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
                      onClick={irParaMesDoGrafico}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Área com degradê sob cada linha: dá volume ao mês e
                          deixa claro qual das duas está por cima sem precisar
                          seguir a linha com o olho. */}
                      <defs>
                        <linearGradient id="areaEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                        {/* Gastos em `destructive`, e não em `primary`. Com
                            primary a linha herdava a cor da MARCA — e no tema
                            verde ela ficava igualzinha à de entradas, que usa
                            `success`. Duas linhas verdes, legenda inútil. As
                            cores de dinheiro (verde entra, vermelho sai) são as
                            mesmas do resto do app e não dependem do tema. */}
                        <linearGradient id="areaGastos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatCentavosCompacto(v * 100)}
                        width={70}
                      />
                      <Tooltip
                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                        content={<DicaGrafico />}
                      />
                      <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />

                      {/* Média do ano — a régua que responde "este mês foi
                          acima ou abaixo do meu normal?", que era a pergunta
                          que o gráfico não respondia. Só conta mês lançado:
                          incluir os meses zerados do futuro puxaria a média
                          para baixo e mentiria. */}
                      {mesesLancados > 0 && (
                        <ReferenceLine
                          y={totais.mediaSaidas / 100}
                          // Neutra: é uma régua, não uma terceira série. Em
                          // primary ela competia com as linhas — e no tema
                          // verde virava uma terceira linha verde.
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          strokeOpacity={0.6}
                          label={{
                            value: `média de gastos ${formatCentavosCompacto(totais.mediaSaidas)}`,
                            position: 'insideTopRight',
                            fill: 'hsl(var(--muted-foreground))',
                            fontSize: 11,
                          }}
                        />
                      )}

                      {/* A partir daqui é PREVISÃO, não medição. Sem a faixa a
                          linha continua reta até dezembro e parece que o ano
                          inteiro já aconteceu. */}
                      {primeiroPrevisto !== null && (
                        <ReferenceArea
                          x1={nomeCurtoDoMes(primeiroPrevisto)}
                          x2={nomeCurtoDoMes(12)}
                          fill="hsl(var(--muted-foreground))"
                          fillOpacity={0.07}
                          label={{
                            value: 'previsto',
                            position: 'insideTopLeft',
                            fill: 'hsl(var(--muted-foreground))',
                            fontSize: 11,
                          }}
                        />
                      )}

                      {/* legendType="none": a área e a linha usam a mesma
                          dataKey, e sem isto a legenda lista "Entradas" e
                          "Gastos" duas vezes cada. */}
                      <Area
                        type="monotone"
                        dataKey="Entradas"
                        stroke="none"
                        fill="url(#areaEntradas)"
                        legendType="none"
                        tooltipType="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="Gastos"
                        stroke="none"
                        fill="url(#areaGastos)"
                        legendType="none"
                        tooltipType="none"
                      />
                      <Line
                        type="monotone"
                        dataKey="Entradas"
                        stroke="hsl(var(--success))"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Gastos"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Tooltip do gráfico anual.
 *
 * O padrão do Recharts lista "Entradas" e "Gastos" e para por aí. A conta que
 * interessa é a terceira — sobrou ou faltou —, e fazê-la de cabeça olhando
 * dois números formatados em reais é justamente o que o gráfico deveria
 * poupar. Aqui ela vem pronta, com o sinal colorido.
 */
function DicaGrafico({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const valor = (chave: string) => (payload.find((p) => p.dataKey === chave)?.value ?? 0) * 100
  const entradas = valor('Entradas')
  const gastos = valor('Gastos')
  const diferenca = entradas - gastos

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-2">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <dl className="space-y-0.5 text-xs">
        <Linhinha rotulo="Entrou" valor={entradas} className="text-success" />
        <Linhinha rotulo="Saiu" valor={gastos} className="text-destructive" />
        <div className="mt-1 border-t border-border pt-1">
          <Linhinha
            rotulo={diferenca < 0 ? 'Faltou' : 'Sobrou'}
            valor={Math.abs(diferenca)}
            className={diferenca < 0 ? 'text-destructive' : 'text-success'}
            forte
          />
        </div>
      </dl>
    </div>
  )
}

function Linhinha({
  rotulo,
  valor,
  className,
  forte,
}: {
  rotulo: string
  valor: number
  className?: string
  forte?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={cn('tabular', forte ? 'text-sm font-semibold' : 'font-medium', className)}>
        {formatCentavos(valor)}
      </dd>
    </div>
  )
}

function CardIndicador({
  rotulo,
  valor,
  className,
  previsto = 0,
  delta,
}: {
  rotulo: string
  valor: number
  className?: string
  /** O que ainda vai acontecer, dito separado do que já aconteceu. */
  previsto?: number
  delta?: React.ReactNode
}) {
  const Icone = valor < 0 ? TrendingDown : TrendingUp
  return (
    // 72% da largura: o pedaço do próximo card à direita é o que conta que a
    // faixa desliza. 100% esconderia os outros dois.
    <Card className="w-[72%] shrink-0 snap-start sm:w-auto sm:shrink">
      <CardContent className="space-y-1.5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">{rotulo}</p>
            <p className={cn('tabular text-xl font-semibold', className)}>{formatCentavos(valor)}</p>
          </div>
          <Icone className={cn('h-5 w-5 shrink-0', className)} aria-hidden />
        </div>
        {delta}
        {previsto > 0 && (
          <p className="text-xs text-muted-foreground">
            + <span className="tabular">{formatCentavos(previsto)}</span> previstos até dezembro
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * "+12% vs 2025 (Jan–Abr)" — a variação, com a base à vista.
 *
 * A base entre parênteses não é enfeite: é o que separa a frase de um palpite.
 * "Gastei 12% a mais" comparando quatro meses contra doze seria um número
 * bonito e falso, e a única defesa contra isso é dizer sempre sobre quais
 * meses ele foi calculado.
 *
 * Quando o ano anterior era zero naquele recorte, não há percentual que
 * signifique alguma coisa — a tela mostra a diferença em reais.
 */
function Delta({
  comparacao,
  campo,
  anoAnterior,
}: {
  comparacao: Comparacao
  campo: 'entradas' | 'saidas'
  anoAnterior: number
}) {
  if (comparacao.impedimento) return null

  const variacao = campo === 'entradas' ? comparacao.variacaoEntradas : comparacao.variacaoSaidas
  const atual = campo === 'entradas' ? comparacao.entradasAtual : comparacao.saidasAtual
  const anterior = campo === 'entradas' ? comparacao.entradasAnterior : comparacao.saidasAnterior
  const base = textoDaBase(comparacao.mesesComuns)

  // Para entradas, subir é bom; para gastos, é o contrário. A cor segue o
  // SIGNIFICADO, não o sinal — verde em "gastei 30% a mais" seria elogio.
  const diferenca = atual - anterior
  const bom = campo === 'entradas' ? diferenca > 0 : diferenca < 0
  const Icone = diferenca === 0 ? Minus : diferenca > 0 ? TrendingUp : TrendingDown

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-1 text-xs',
        diferenca === 0 ? 'text-muted-foreground' : bom ? 'text-success' : 'text-destructive',
      )}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="tabular font-medium">
        {variacao === null
          ? `${diferenca >= 0 ? '+' : '−'}${formatCentavos(Math.abs(diferenca))}`
          : `${variacao > 0 ? '+' : ''}${variacao.toLocaleString('pt-BR')}%`}
      </span>
      <span className="text-muted-foreground">
        vs {anoAnterior} ({base})
      </span>
    </p>
  )
}

/**
 * Como ler os números acima.
 *
 * Três frases curtas que respondem o que os cartões deixam no ar: de onde saiu
 * a comparação, quanto do ano ainda é previsão, e para onde os gastos estão
 * indo. Elas ficam JUNTAS num bloco porque respondem à mesma pergunta — "posso
 * confiar nesses números?" — e separadas em três cantos da tela ninguém as
 * lê como conjunto.
 *
 * Cada frase some quando não tem o que dizer. Um bloco que insiste em falar
 * sem base é como o app perde a credibilidade dos números que ele acerta.
 */
function Leitura({
  comparacao,
  tendencia,
  ano,
  temPrevisto,
}: {
  comparacao: Comparacao
  tendencia: Tendencia | null
  ano: number
  temPrevisto: boolean
}) {
  const frases: React.ReactNode[] = []

  if (comparacao.impedimento === 'sem-meses-comuns') {
    frases.push(
      <>
        Não dá para comparar com {ano - 1}: não há nenhum mês com movimento nos dois anos. Comparar contra um
        mês vazio devolveria um aumento infinito.
      </>,
    )
  } else if (!comparacao.impedimento) {
    frases.push(
      <>
        A comparação com {ano - 1} usa <strong>{textoDaBase(comparacao.mesesComuns)}</strong> dos dois anos —
        só os meses que já aconteceram e tiveram movimento nos dois lados.
      </>,
    )
  }

  if (temPrevisto) {
    frases.push(
      <>
        Os meses marcados como <strong>previsto</strong> ainda não aconteceram: eles trazem só os gastos fixos
        que se repetem, que é o único que dá para saber com antecedência.
      </>,
    )
  }

  if (tendencia) {
    const verbo =
      tendencia.direcao === 'estavel'
        ? 'estão estáveis'
        : tendencia.direcao === 'subindo'
          ? 'estão subindo'
          : 'estão caindo'
    frases.push(
      <>
        Os gastos {verbo}:{' '}
        <strong>
          {formatCentavos(tendencia.mediaRecente)} por mês em {textoDaBase(tendencia.mesesRecentes)}
        </strong>
        , contra {formatCentavos(tendencia.mediaAnterior)} em {textoDaBase(tendencia.mesesAnteriores)}.
      </>,
    )
  }

  if (frases.length === 0) return null

  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
        {frases.map((frase, i) => (
          <p key={i} className="flex gap-2">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{frase}</span>
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
