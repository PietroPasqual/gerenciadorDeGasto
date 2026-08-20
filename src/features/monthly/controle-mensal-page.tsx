import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton, SkeletonTabela } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro } from '@/components/common/estados'
import { usePeriodoStore } from '@/store/periodo'
import { useControleMensal } from './use-controle-mensal'
import { exportarMesCSV } from './exportar'
import { ResumoMes } from './components/resumo-mes'
import { TabelaEntradas } from './components/tabela-entradas'
import { TabelaGastosFixos } from './components/tabela-gastos-fixos'
import { TabelaGastos } from './components/tabela-gastos'
import { TabelaInvestimentos } from './components/tabela-investimentos'
import { PainelCategorias } from './components/painel-categorias'
import { PainelFormasPagamento } from './components/painel-formas-pagamento'
import { GraficosMes } from './components/graficos-mes'
import { agruparPorChave } from '@/lib/calculations'
import { nomeDoMes } from '@/lib/dates'

export function ControleMensalPage() {
  const { ano, mes, definirPeriodo } = usePeriodoStore()
  const { dados, gastos, resumo, carregando, erro, recarregar, acoes } = useControleMensal(ano, mes)

  /**
   * Totais por categoria e por forma de pagamento incluem os gastos fixos
   * (que se repetem todo mês) + os lançamentos do mês — mesma regra da
   * função SQL `gastos_por_categoria`.
   */
  const { porCategoria, porFormaPagamento, porMeta } = useMemo(() => {
    if (!dados) return { porCategoria: [], porFormaPagamento: [], porMeta: [] }

    const gastosDoMes = dados.lancamentos.filter((l) => l.tipo === 'gasto')
    const porCategoriaMapa = agruparPorChave([...gastosDoMes, ...dados.gastosFixos], (i) => i.category_id)
    const porFormaMapa = agruparPorChave([...gastosDoMes, ...dados.gastosFixos], (i) => i.payment_method_id)

    return {
      porCategoria: dados.categorias.map((c) => ({
        id: c.id,
        nome: c.nome,
        cor: c.cor,
        limite_centavos: c.limite_centavos,
        gasto_centavos: porCategoriaMapa[c.id] ?? 0,
      })),
      porFormaPagamento: dados.formasPagamento.map((f) => ({
        id: f.id,
        nome: f.nome,
        gasto_centavos: porFormaMapa[f.id] ?? 0,
      })),
      porMeta: dados.metas.map((m) => ({
        nome: m.nome,
        valor: dados.aportes.find((a) => a.goal_id === m.id)?.valor_centavos ?? 0,
      })),
    }
  }, [dados])

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Controle mensal"
        descricao={`Tudo o que entrou e saiu em ${nomeDoMes(mes)} de ${ano}.`}
        acoes={
          <>
            <SeletorPeriodo ano={ano} mes={mes} onChange={definirPeriodo} />
            <Button
              variant="outline"
              onClick={() => dados && exportarMesCSV(ano, mes, dados)}
              disabled={!dados}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <EsqueletoMes />
      ) : dados ? (
        <div className="grid gap-6 lg:grid-cols-[20rem,1fr] xl:grid-cols-[22rem,1fr]">
          <div className="space-y-6">
            <ResumoMes ano={ano} mes={mes} resumo={resumo} />
            <PainelFormasPagamento formas={porFormaPagamento} />
          </div>

          <div className="min-w-0 space-y-6">
            <TabelaEntradas
              entradas={dados.entradas}
              onAdicionar={acoes.adicionarEntrada}
              onEditar={acoes.editarEntrada}
              onRemover={acoes.removerEntrada}
            />

            <TabelaGastosFixos
              gastosFixos={dados.gastosFixos}
              pagamentos={dados.pagamentos}
              formasPagamento={dados.formasPagamento}
              categorias={dados.categorias}
              onAdicionar={acoes.adicionarGastoFixo}
              onEditar={acoes.editarGastoFixo}
              onRemover={acoes.removerGastoFixo}
              onAlternarPago={acoes.alternarPago}
            />

            <TabelaGastos
              ano={ano}
              mes={mes}
              gastos={gastos}
              formasPagamento={dados.formasPagamento}
              categorias={dados.categorias}
              onAdicionar={acoes.adicionarLancamento}
              onEditar={acoes.editarLancamento}
              onRemover={acoes.removerLancamento}
            />

            <TabelaInvestimentos
              metas={dados.metas}
              aportes={dados.aportes}
              investimentos={dados.investimentos}
              onSalvarAporte={acoes.salvarAporteMeta}
              onAdicionarAvulso={acoes.adicionarInvestimentoAvulso}
              onEditarAvulso={acoes.editarInvestimentoAvulso}
              onRemoverAvulso={acoes.removerInvestimentoAvulso}
            />

            <PainelCategorias categorias={porCategoria} />

            <GraficosMes
              porFormaPagamento={porFormaPagamento.map((f) => ({ nome: f.nome, valor: f.gasto_centavos }))}
              porMeta={porMeta}
              porCategoria={porCategoria.map((c) => ({ nome: c.nome, valor: c.gasto_centavos, cor: c.cor }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EsqueletoMes() {
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem,1fr]">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <SkeletonTabela />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
