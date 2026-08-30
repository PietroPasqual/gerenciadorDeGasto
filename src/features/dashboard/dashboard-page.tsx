import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  HelpCircle,
  LineChart,
  PiggyBank,
  Settings,
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
import { observacoesDoMes } from '@/lib/observacoes'
import { ObservacoesMes } from './components/observacoes-mes'

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

  const observacoes = useMemo(
    () =>
      resumo
        ? observacoesDoMes({
            resumo,
            categorias: gastosCategoria ?? [],
            meses: meses ?? [],
            mes: hoje.mes,
            ano: hoje.ano,
          })
        : [],
    [resumo, gastosCategoria, meses, hoje.mes, hoje.ano],
  )

  const primeiroNome = (perfil?.nome ?? '').split(' ')[0]

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
        descricao={`Aqui está o resumo de ${nomeDoMes(hoje.mes)} de ${hoje.ano}.`}
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {erroCategorias && (
        <EstadoErro mensagem={erroCategorias} onTentarNovamente={() => void recarregarCategorias()} />
      )}

      {carregandoCategorias && !gastosCategoria ? (
        <Skeleton className="h-72 w-full" />
      ) : gastosCategoria ? (
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
            <CardDescription>
              {temFatura ? (
                <>
                  Os <strong>{formatCentavos(gastoCompetencia)}</strong> que você gastou em{' '}
                  {nomeDoMes(hoje.mes)}, pela data da compra. O card &ldquo;sai da conta&rdquo; abaixo é outro
                  número: ele conta a fatura no mês em que ela vence.
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
      ) : null}

      {/* Depois do gráfico: o desenho responde "para onde foi" num relance, e
          as frases entram para dizer o que ele não mostra — comparação com os
          seus outros meses, limite estourado, quanto ficou sem categoria. */}
      <ObservacoesMes observacoes={observacoes} />

      {carregando && !resumo ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : resumo ? (
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
                  {Number(resumo.percentual_investido).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                  do que entrou
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Atalhos: no celular viram blocos compactos de 2 colunas; a descrição
          só aparece quando há largura para ela. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {ATALHOS.map((atalho, indice) => (
          <motion.div
            key={atalho.para}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * indice, duration: 0.3 }}
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
