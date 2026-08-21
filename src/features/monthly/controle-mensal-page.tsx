import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton, SkeletonTabela } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { useRegistrarAcoes } from '@/store/acoes-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { EstadoErro } from '@/components/common/estados'
import { Fab } from '@/components/common/fab'
import { SheetGasto, type DadosGasto } from './components/sheet-gasto'
import type { Transaction } from '@/lib/database.types'
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

  // Lançamento rápido do celular (M2). No desktop a linha de adição da
  // tabela continua sendo o caminho, então o FAB e a sheet só existem abaixo
  // de sm.
  const [sheetAberta, setSheetAberta] = useState(false)
  const [gastoEditando, setGastoEditando] = useState<Transaction | null>(null)

  const abrirNovo = () => {
    setGastoEditando(null)
    setSheetAberta(true)
  }

  const abrirEdicao = (gasto: Transaction) => {
    setGastoEditando(gasto)
    setSheetAberta(true)
  }

  const salvarGastoDaSheet = (d: DadosGasto) => {
    if (gastoEditando) acoes.editarLancamento(gastoEditando.id, d)
    else acoes.adicionarLancamento({ ...d, tipo: 'gasto' })
  }

  /**
   * Excluir com desfazer. Optamos por excluir de imediato e recriar no
   * desfazer (em vez de adiar a exclusão): se a pessoa sair da tela antes do
   * prazo, um delete adiado nunca rodaria e o gasto voltaria sozinho.
   * O registro recriado ganha um id novo, o que é invisível na tela.
   */
  const excluirComDesfazer = (gasto: Transaction) => {
    acoes.removerLancamento(gasto.id)
    toast('Gasto excluído', {
      description: gasto.descricao,
      action: {
        label: 'Desfazer',
        onClick: () =>
          acoes.adicionarLancamento({
            data: gasto.data,
            descricao: gasto.descricao,
            payment_method_id: gasto.payment_method_id,
            category_id: gasto.category_id,
            valor_centavos: gasto.valor_centavos,
            tipo: 'gasto',
          }),
      },
    })
  }

  // Declarada para o menu "⋯" do celular; no desktop o botão fica inline.
  useRegistrarAcoes(
    () => [
      {
        id: 'exportar-mes',
        rotulo: 'Exportar CSV',
        Icone: Download,
        desabilitada: !dados,
        executar: () => dados && exportarMesCSV(ano, mes, dados),
      },
    ],
    [dados, ano, mes],
  )

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Controle mensal"
        descricao={`Tudo o que entrou e saiu em ${nomeDoMes(mes)} de ${ano}.`}
        acoes={
          <>
            <SeletorPeriodo ano={ano} mes={mes} onChange={definirPeriodo} />
            {/* Só decoração duplicada: no celular esta mesma ação aparece no
                menu "⋯" do topo (ver useRegistrarAcoes acima). */}
            <Button
              variant="outline"
              className="hidden sm:inline-flex"
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
              onAbrirEdicao={abrirEdicao}
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

      {dados && (
        <>
          <Fab rotulo="Novo gasto" onClick={abrirNovo} />
          <SheetGasto
            aberta={sheetAberta}
            onOpenChange={(a) => {
              setSheetAberta(a)
              if (!a) setGastoEditando(null)
            }}
            ano={ano}
            mes={mes}
            formasPagamento={dados.formasPagamento}
            categorias={dados.categorias}
            gasto={gastoEditando}
            onSalvar={salvarGastoDaSheet}
            onExcluir={gastoEditando ? () => excluirComDesfazer(gastoEditando) : undefined}
          />
        </>
      )}
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
