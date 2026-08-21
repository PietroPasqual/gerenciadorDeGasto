import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton, SkeletonTabela } from '@/components/ui/skeleton'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { useRegistrarAcoes } from '@/store/acoes-pagina'
import { SeletorPeriodo } from '@/components/common/seletor-periodo'
import { FaixaMeses } from '@/components/common/faixa-meses'
import { EstadoErro } from '@/components/common/estados'
import { Fab } from '@/components/common/fab'
import { SheetGasto, type DadosGasto } from './components/sheet-gasto'
import { SecaoMes, useAbaMes } from './components/abas-mes'
import { BarraMesCelular } from './components/barra-mes-celular'
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
import { useSwipeMes, mesVizinho, type Direcao } from '@/lib/swipe-mes'
import { useEhMobile } from '@/lib/hooks'

export function ControleMensalPage() {
  const { ano, mes, definirPeriodo } = usePeriodoStore()
  const { dados, gastos, fixosDoMes, resumo, carregando, erro, recarregar, acoes } = useControleMensal(ano, mes)
  const [aba, definirAba] = useAbaMes()

  /**
   * Swipe horizontal troca de mês (M7). A direção fica guardada para a
   * transição entrar pelo lado certo; um toque numa pílula não tem lado, e
   * então a troca só aparece.
   */
  const ehCelular = useEhMobile(640)
  const direcao = useRef<Direcao>(0)

  const irParaPeriodo = (proximo: { ano: number; mes: number }) => {
    // Só passo de um mês tem lado. Pular de Março para Setembro pela lista
    // não "veio" de lugar nenhum, então entra só com fade.
    const distancia = (proximo.ano * 12 + proximo.mes) - (ano * 12 + mes)
    direcao.current = distancia === 1 ? 1 : distancia === -1 ? -1 : 0
    definirPeriodo(proximo)
  }

  const gestos = useSwipeMes((delta) => {
    const proximo = mesVizinho(ano, mes, delta)
    irParaPeriodo(proximo)
    // Rolado até o meio da lista, a faixa de meses está fora da tela: sem
    // este aviso a pessoa vê os números mudarem sem saber para onde foi.
    toast.info(`${nomeDoMes(proximo.mes)} de ${proximo.ano}`)
  }, ehCelular)

  /**
   * Totais por categoria e por forma de pagamento incluem os gastos fixos
   * (que se repetem todo mês) + os lançamentos do mês — mesma regra da
   * função SQL `gastos_por_categoria`.
   */
  const { porCategoria, porFormaPagamento, porMeta } = useMemo(() => {
    if (!dados) return { porCategoria: [], porFormaPagamento: [], porMeta: [] }

    const gastosDoMes = dados.lancamentos.filter((l) => l.tipo === 'gasto')
    // `fixosDoMes` e não `dados.gastosFixos`: aqui também só entram os fixos
    // vigentes neste mês, senão os painéis de categoria e forma de pagamento
    // discordariam do total de saídas logo acima deles.
    const porCategoriaMapa = agruparPorChave([...gastosDoMes, ...fixosDoMes], (i) => i.category_id)
    const porFormaMapa = agruparPorChave([...gastosDoMes, ...fixosDoMes], (i) => i.payment_method_id)

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
  }, [dados, fixosDoMes])

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
            {/* No celular quem faz este trabalho é a FaixaMeses, logo abaixo:
                mesma função, outra forma. */}
            <div className="hidden sm:flex">
              <SeletorPeriodo ano={ano} mes={mes} onChange={irParaPeriodo} />
            </div>
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

      <FaixaMeses ano={ano} mes={mes} onChange={irParaPeriodo} className="sm:hidden" />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <EsqueletoMes />
      ) : dados ? (
        <>
          <BarraMesCelular resumo={resumo} aba={aba} onAbaChange={definirAba} />

          {/* `key` no mês: trocar de mês remonta o bloco, então o
              initial->animate roda de novo e o conteúdo entra pelo lado de
              onde veio. Sem AnimatePresence de propósito — animar a saída
              exigiria manter os dois meses montados, e o mês antigo continuaria
              buscando dados que ninguém vai ver. */}
          <motion.div
            key={`${ano}-${mes}`}
            initial={{ opacity: 0, x: direcao.current * 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onAnimationComplete={() => {
              direcao.current = 0
            }}
            className="space-y-6"
            {...gestos}
          >

          {/* Grade de 12 colunas (D2): 3 + 9. Era `[20rem,1fr]`, uma largura
              fixa que não conversava com nenhuma outra tela.

              A divisão em duas colunas só entra em `xl` e não em `lg`: a barra
              lateral do D1 come 224px, e em 1024px o que sobrava para a tabela
              de gastos ficava abaixo do mínimo dela — a página estourava 122px
              de lado. Entre lg e xl a barra lateral já é o ganho; o conteúdo
              usa a largura toda.

              Abaixo de `lg` os dois invólucros de coluna viram `contents`: as
              seções passam a ser filhas diretas desta coluna flex, então a
              ordem no celular é a ordem de leitura e o `gap` não sobra quando
              o SecaoMes não renderiza nada. A partir de `lg` eles voltam a ser
              as duas colunas da grade. */}
          <div className="flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:gap-6">
            <div className="contents xl:col-span-3 xl:flex xl:flex-col xl:gap-6 2xl:col-span-4">
              <SecaoMes id="resumo" aba={aba}>
                <ResumoMes ano={ano} mes={mes} resumo={resumo} />
              </SecaoMes>
              <SecaoMes id="analise" aba={aba}>
                <PainelFormasPagamento formas={porFormaPagamento} />
              </SecaoMes>
            </div>

            <div className="contents xl:col-span-9 xl:flex xl:min-w-0 xl:flex-col xl:gap-6 2xl:col-span-8">
              <SecaoMes id="entradas" aba={aba}>
                <TabelaEntradas
                  entradas={dados.entradas}
                  onAdicionar={acoes.adicionarEntrada}
                  onEditar={acoes.editarEntrada}
                  onRemover={acoes.removerEntrada}
                />
              </SecaoMes>

              <SecaoMes id="fixos" aba={aba}>
                <TabelaGastosFixos
                  ano={ano}
                  mes={mes}
                  gastosFixos={dados.gastosFixos}
                  pagamentos={dados.pagamentos}
                  formasPagamento={dados.formasPagamento}
                  categorias={dados.categorias}
                  onAdicionar={acoes.adicionarGastoFixo}
                  onEditar={acoes.editarGastoFixo}
                  onRemover={acoes.removerGastoFixo}
                  onAlternarPago={acoes.alternarPago}
                />
              </SecaoMes>

              <SecaoMes id="gastos" aba={aba}>
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
              </SecaoMes>

              <SecaoMes id="investir" aba={aba}>
                <TabelaInvestimentos
                  metas={dados.metas}
                  aportes={dados.aportes}
                  investimentos={dados.investimentos}
                  onSalvarAporte={acoes.salvarAporteMeta}
                  onAdicionarAvulso={acoes.adicionarInvestimentoAvulso}
                  onEditarAvulso={acoes.editarInvestimentoAvulso}
                  onRemoverAvulso={acoes.removerInvestimentoAvulso}
                />
              </SecaoMes>

              <SecaoMes id="analise" aba={aba}>
                <PainelCategorias categorias={porCategoria} />
              </SecaoMes>

              <SecaoMes id="analise" aba={aba}>
                <GraficosMes
                  porFormaPagamento={porFormaPagamento.map((f) => ({
                    nome: f.nome,
                    valor: f.gasto_centavos,
                  }))}
                  porMeta={porMeta}
                  porCategoria={porCategoria.map((c) => ({
                    nome: c.nome,
                    valor: c.gasto_centavos,
                    cor: c.cor,
                  }))}
                />
              </SecaoMes>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}

      {dados && (
        <>
          {/* Só na aba de gastos: nas outras o botão de "+" da própria tabela
              fica embaixo do FAB (ele tapava o total das Entradas), e um FAB
              que lança GASTO na aba de Entradas ainda por cima mente sobre o
              que faz. Lançar gasto continua a um toque, na aba ao lado. */}
          {aba === 'gastos' && <Fab rotulo="Novo gasto" onClick={abrirNovo} />}
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
    <div className="space-y-6">
      {/* No celular a barra fixa (abas + resumo) some junto com os dados;
          sem um lugar guardado para ela a página inteira pula ~90px quando
          o mês carrega. */}
      <div className="space-y-2 sm:hidden">
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-3 gap-1.5">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:gap-6">
        {/* O card de resumo só aparece de sm para cima: abaixo disso ele é
            a aba "Resumo", e o que carrega primeiro é a aba "Gastos". */}
        <Card className="hidden sm:block xl:col-span-3 2xl:col-span-4">
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

        <div className="flex flex-col gap-6 xl:col-span-9 2xl:col-span-8">
          {[0, 1, 2].map((i) => (
            // Uma aba mostra um bloco só: no celular os outros dois seriam
            // rolagem que não vai existir.
            <Card key={i} className={i > 0 ? 'hidden sm:block' : undefined}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                {/* 8 e não 5: o placeholder é a altura que a página vai ter, e
                    um mês com menos de oito gastos é raro. Errar para menos faz
                    a página crescer embaixo do dedo quando os dados chegam. */}
                <SkeletonTabela linhas={8} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
