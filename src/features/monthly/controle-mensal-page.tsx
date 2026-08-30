import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightLeft, Download, Upload, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { PainelFaturas } from './components/painel-faturas'
import { TabelaEntradasRecorrentes } from './components/tabela-entradas-recorrentes'
import { FiltroLancamentos } from './components/filtro-lancamentos'
import { SheetMovimentoMeta } from './components/sheet-movimento-meta'
import { PainelOrcamento } from './components/painel-orcamento'
import {
  aplicarFiltro,
  filtroDeParams,
  filtroEstaVazio,
  filtroParaParams,
  type Filtro,
} from '@/lib/filtro-lancamentos'
import { DialogoSerie } from './components/dialogo-serie'
import { BarraMesCelular } from './components/barra-mes-celular'
import type { Transaction } from '@/lib/database.types'
import { usePeriodoStore } from '@/store/periodo'
import { useControleMensal } from './use-controle-mensal'
import { exportarMesCSV } from './exportar'
import { ImportarCSV } from './components/importar-csv'
import { PreencherEmBloco } from './components/preencher-em-bloco'
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
import { useAuthStore } from '@/store/auth'
import { atualizarPerfil } from '@/services/profiles'

export function ControleMensalPage() {
  const { ano, mes, definirPeriodo } = usePeriodoStore()
  const perfil = useAuthStore((s) => s.profile)
  const definirProfile = useAuthStore((s) => s.definirProfile)

  /**
   * O teto vive no perfil, então salvá-lo não passa pelo hook do mês. O store
   * é atualizado na hora para o bloco não piscar o valor antigo, e o servidor
   * confirma depois — se falhar, o valor volta ao que era.
   */
  const definirOrcamento = async (centavos: number) => {
    const anterior = perfil
    if (perfil) definirProfile({ ...perfil, orcamento_centavos: centavos })
    try {
      const salvo = await atualizarPerfil({ orcamento_centavos: centavos })
      definirProfile(salvo)
    } catch (erro) {
      if (anterior) definirProfile(anterior)
      toast.error('Não foi possível salvar o orçamento', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    }
  }
  const {
    dados,
    gastos,
    entradasAvulsas,
    fixosDoMes,
    resumo,
    caixa,
    faturas,
    carregando,
    erro,
    recarregar,
    acoes,
  } = useControleMensal(ano, mes)
  const [aba, definirAba] = useAbaMes()
  const [importando, setImportando] = useState(false)
  const [categorizando, setCategorizando] = useState(false)

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
    const distancia = proximo.ano * 12 + proximo.mes - (ano * 12 + mes)
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

    /**
     * O que não tem categoria vira uma linha própria, no fim.
     *
     * Mapear só `dados.categorias` fazia o gasto sem categoria sumir do
     * painel — e o painel então dividia o mês entre as categorias que
     * sobraram e mostrava 100%. Depois de importar um extrato (que não traz
     * categoria) isso deixa de ser detalhe: a maior parte do mês fica de fora
     * e o número que aparece afirma ser o todo. Mesma correção que a migration
     * 0006 fez do lado do banco, para as duas telas não divergirem.
     */
    const sobra = (mapa: Record<string, number>) => mapa['sem-classificacao'] ?? 0

    return {
      porCategoria: [
        ...dados.categorias.map((c) => ({
          id: c.id as string | null,
          nome: c.nome,
          cor: c.cor,
          limite_centavos: c.limite_centavos,
          gasto_centavos: porCategoriaMapa[c.id] ?? 0,
        })),
        ...(sobra(porCategoriaMapa) > 0
          ? [
              {
                id: null,
                nome: 'Sem categoria',
                cor: '#94a3b8',
                limite_centavos: null,
                gasto_centavos: sobra(porCategoriaMapa),
              },
            ]
          : []),
      ],
      porFormaPagamento: [
        ...dados.formasPagamento.map((f) => ({
          id: f.id as string | null,
          nome: f.nome,
          gasto_centavos: porFormaMapa[f.id] ?? 0,
        })),
        ...(sobra(porFormaMapa) > 0
          ? [{ id: null, nome: 'Sem forma de pagamento', gasto_centavos: sobra(porFormaMapa) }]
          : []),
      ],
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

  const [serie, setSerie] = useState<{ acao: 'excluir' | 'editar'; gasto: Transaction } | null>(null)
  const [editandoSerie, setEditandoSerie] = useState<Transaction | null>(null)
  const [movimentoAberto, setMovimentoAberto] = useState(false)

  /**
   * `?novo=1` abre a folha de lançamento direto — é o atalho "Lançar gasto" da
   * tela inicial (shortcuts do manifest), o caminho mais curto do app inteiro.
   * O parâmetro é consumido na hora para o botão voltar não reabrir a folha.
   */
  const [params, setParams] = useSearchParams()

  /**
   * O filtro vive na URL: o botão voltar desfaz a busca em vez de sair da tela,
   * e um link leva alguém direto ao mesmo recorte. `replace` para o histórico
   * não guardar uma entrada por tecla digitada.
   */
  const filtro = useMemo(() => filtroDeParams(params), [params])
  const definirFiltro = (novo: Filtro) =>
    setParams((atuais) => filtroParaParams(novo, new URLSearchParams(atuais)), { replace: true })

  /**
   * Só a LISTA é filtrada; os totais do mês continuam sendo do mês inteiro.
   * Um filtro que mudasse o saldo faria a pessoa achar que perdeu dinheiro ao
   * digitar no campo de busca.
   */
  const gastosFiltrados = useMemo(() => aplicarFiltro(gastos, filtro), [gastos, filtro])
  useEffect(() => {
    if (params.get('novo') !== '1') return
    setSheetAberta(true)
    setGastoEditando(null)
    setParams(
      (atuais) => {
        const proximos = new URLSearchParams(atuais)
        proximos.delete('novo')
        return proximos
      },
      { replace: true },
    )
  }, [params, setParams])

  const abrirNovo = () => {
    setGastoEditando(null)
    setSheetAberta(true)
  }

  const abrirEdicao = (gasto: Transaction) => {
    setGastoEditando(gasto)
    setSheetAberta(true)
  }

  const salvarGastoDaSheet = (d: DadosGasto) => {
    if (gastoEditando) {
      const { parcelas: _ignorado, ...mudancas } = d
      void acoes.editarLancamento(gastoEditando.id, mudancas)
      return
    }
    // O valor digitado é o TOTAL da compra; quem divide é criarParcelamento.
    if (d.parcelas && d.parcelas > 1) void acoes.adicionarParcelamento({ ...d, parcelas: d.parcelas })
    else void acoes.adicionarLancamento({ ...d, tipo: 'gasto' })
  }

  /**
   * Excluir com desfazer. Optamos por excluir de imediato e recriar no
   * desfazer (em vez de adiar a exclusão): se a pessoa sair da tela antes do
   * prazo, um delete adiado nunca rodaria e o gasto voltaria sozinho.
   * O registro recriado ganha um id novo, o que é invisível na tela.
   */
  /**
   * Excluir e editar param para perguntar quando o gasto é uma parcela.
   * Fora disso o caminho é o de sempre — a pergunta só aparece onde ela existe.
   */
  const pedirExclusao = (gasto: Transaction) => {
    if (gasto.parcelamento_id) setSerie({ acao: 'excluir', gasto })
    else excluirComDesfazer(gasto)
  }

  const pedirEdicao = (gasto: Transaction) => {
    if (gasto.parcelamento_id) setSerie({ acao: 'editar', gasto })
    else abrirEdicao(gasto)
  }

  const resolverSerie = (escopo: 'parcela' | 'serie') => {
    if (!serie) return
    const { acao, gasto } = serie
    setSerie(null)
    if (acao === 'excluir') {
      if (escopo === 'serie') void acoes.removerSerie(gasto.parcelamento_id as string)
      else excluirComDesfazer(gasto)
      return
    }
    // Editar a série inteira: só descrição, forma e categoria. Mudar o valor
    // exige redividir tudo, e isso é apagar e recriar, não um update.
    if (escopo === 'serie') setEditandoSerie(gasto)
    else abrirEdicao(gasto)
  }

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
        id: 'importar-mes',
        rotulo: 'Importar CSV',
        Icone: Upload,
        desabilitada: !dados,
        executar: () => setImportando(true),
      },
      {
        id: 'categorizar-auto',
        rotulo: 'Preencher em bloco',
        Icone: Wand2,
        desabilitada: !dados,
        executar: () => setCategorizando(true),
      },
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
            {/* Só ícone abaixo de xl: com os três rótulos escritos, o
                cabeçalho quebrava em duas linhas em 1024 e 1280 (medido). O
                corte é 2xl e não xl porque em 1280 — com os rótulos de volta —
                ele voltava a quebrar. */}
            <AcaoCabecalho
              rotulo="Preencher"
              Icone={Wand2}
              onClick={() => setCategorizando(true)}
              desabilitada={!dados}
            />
            <AcaoCabecalho
              rotulo="Importar CSV"
              Icone={Upload}
              onClick={() => setImportando(true)}
              desabilitada={!dados}
            />
            <AcaoCabecalho
              rotulo="Exportar CSV"
              Icone={Download}
              onClick={() => dados && exportarMesCSV(ano, mes, dados)}
              desabilitada={!dados}
            />
          </>
        }
      />

      <FaixaMeses ano={ano} mes={mes} onChange={irParaPeriodo} className="sm:hidden" />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <EsqueletoMes />
      ) : dados ? (
        <>
          <BarraMesCelular resumo={resumo} caixa={caixa} aba={aba} onAbaChange={definirAba} />

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
                  <ResumoMes ano={ano} mes={mes} resumo={resumo} caixa={caixa} />
                </SecaoMes>
                <SecaoMes id="analise" aba={aba}>
                  <PainelFormasPagamento formas={porFormaPagamento} />
                </SecaoMes>
                {/* A fatura vive na aba Resumo e não na Análise: ela não é
                    análise do que passou, é dinheiro que vai sair. */}
                <SecaoMes id="resumo" aba={aba}>
                  <PainelOrcamento
                    ano={ano}
                    mes={mes}
                    tetoCentavos={perfil?.orcamento_centavos ?? 0}
                    // Gasto de CAIXA: o que já foi para uma fatura futura não
                    // pesa neste mês, e contá-lo faria o app pedir para
                    // economizar um dinheiro que ainda não precisa existir.
                    gastoCentavos={caixa.totalSaidasCaixa}
                    onSalvarTeto={(centavos) => void definirOrcamento(centavos)}
                  />
                </SecaoMes>

                <SecaoMes id="resumo" aba={aba}>
                  <PainelFaturas
                    ano={ano}
                    mes={mes}
                    faturas={faturas}
                    onAlternarPaga={(id, paga) => void acoes.alternarFaturaPaga(id, paga)}
                  />
                </SecaoMes>
              </div>

              <div className="contents xl:col-span-9 xl:flex xl:min-w-0 xl:flex-col xl:gap-6 2xl:col-span-8">
                <SecaoMes id="entradas" aba={aba}>
                  <TabelaEntradas
                    entradas={dados.entradas}
                    entradasComData={entradasAvulsas}
                    onAdicionar={acoes.adicionarEntrada}
                    recorrentes={
                      <TabelaEntradasRecorrentes
                        ano={ano}
                        mes={mes}
                        recorrentes={dados.entradasRecorrentes}
                        entradasAvulsas={dados.entradas}
                        onAdicionar={(descricao, valor) =>
                          void acoes.adicionarEntradaRecorrente({
                            descricao,
                            valor_centavos: valor,
                            // Começa a valer no mês aberto: sem isso, criar o
                            // salário em agosto o somaria também em janeiro,
                            // inventando entrada em mês que já passou.
                            inicio_ano: ano,
                            inicio_mes: mes,
                          })
                        }
                        onEditar={(id, m) => void acoes.editarEntradaRecorrente(id, m)}
                        onRemover={(id) => void acoes.removerEntradaRecorrente(id)}
                      />
                    }
                    onEditar={acoes.editarEntrada}
                    onRemover={acoes.removerEntrada}
                    onEditarComData={acoes.editarLancamento}
                    onRemoverComData={acoes.removerLancamento}
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
                    gastos={gastosFiltrados}
                    filtro={
                      <FiltroLancamentos
                        filtro={filtro}
                        onMudar={definirFiltro}
                        categorias={dados.categorias}
                        formasPagamento={dados.formasPagamento}
                        totalFiltrado={gastosFiltrados.length}
                        totalGeral={gastos.length}
                      />
                    }
                    temFiltroAtivo={!filtroEstaVazio(filtro)}
                    formasPagamento={dados.formasPagamento}
                    categorias={dados.categorias}
                    onAdicionar={acoes.adicionarLancamento}
                    onEditar={(id, mudancas) => {
                      void acoes.editarLancamento(id, mudancas)
                      // Só a troca de CATEGORIA ensina: mudar valor ou data não
                      // diz nada sobre onde o gasto se encaixa.
                      if ('category_id' in mudancas) {
                        const gasto = gastos.find((g) => g.id === id)
                        if (gasto) acoes.oferecerAprendizado(gasto, mudancas.category_id ?? null)
                      }
                    }}
                    onRemover={pedirExclusao}
                    onAbrirEdicao={pedirEdicao}
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
                    acaoMovimento={
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 shrink-0 md:min-h-0"
                        onClick={() => setMovimentoAberto(true)}
                      >
                        <ArrowRightLeft className="mr-1.5 h-4 w-4" aria-hidden />
                        Resgatar ou transferir
                      </Button>
                    }
                  />

                  <SheetMovimentoMeta
                    aberta={movimentoAberto}
                    onOpenChange={setMovimentoAberto}
                    metas={dados.metas}
                    saldos={dados.saldosMetas}
                    ano={ano}
                    mes={mes}
                    onResgatar={(id, centavos) => void acoes.resgatarDeMeta(id, centavos)}
                    onTransferir={(o, d, centavos) => void acoes.transferirEntreMetas(o, d, centavos)}
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
            onExcluir={gastoEditando ? () => pedirExclusao(gastoEditando) : undefined}
          />

          <PreencherEmBloco
            aberto={categorizando}
            onOpenChange={setCategorizando}
            ano={ano}
            categorias={dados.categorias}
            formas={dados.formasPagamento}
            aoAplicar={(quantidade: number) => {
              toast.success(`${quantidade} ${quantidade === 1 ? 'gasto preenchido' : 'gastos preenchidos'}`)
              void recarregar()
            }}
          />

          <DialogoSerie
            acao={serie?.acao ?? null}
            gasto={serie?.gasto ?? null}
            onEscolher={resolverSerie}
            onCancelar={() => setSerie(null)}
          />

          {editandoSerie && (
            <SheetGasto
              aberta
              onOpenChange={(aberta) => !aberta && setEditandoSerie(null)}
              ano={ano}
              mes={mes}
              formasPagamento={dados.formasPagamento}
              categorias={dados.categorias}
              gasto={editandoSerie}
              onSalvar={(d) => {
                // Valor e data ficam de fora: mudar o total exige redividir a
                // série inteira, e aí é apagar e recriar, não editar.
                void acoes.editarSerie(editandoSerie.parcelamento_id as string, {
                  descricao: d.descricao,
                  payment_method_id: d.payment_method_id,
                  category_id: d.category_id,
                })
                setEditandoSerie(null)
              }}
              onExcluir={() => {
                void acoes.removerSerie(editandoSerie.parcelamento_id as string)
                setEditandoSerie(null)
              }}
            />
          )}

          <ImportarCSV
            aberto={importando}
            onOpenChange={setImportando}
            ano={ano}
            mes={mes}
            categorias={dados.categorias}
            formas={dados.formasPagamento}
            aoImportar={({ novos, jaExistiam }) => {
              const frase = `${novos} ${novos === 1 ? 'lançamento importado' : 'lançamentos importados'}`
              // O banco pode recusar linhas que a prévia não pegou (importação
              // feita em outro aparelho, ou uma que morreu no meio). Se isso
              // acontecer, o número tem que aparecer — senão a conta na tela
              // não bate com a que o usuário viu antes de confirmar.
              toast.success(frase, {
                description:
                  jaExistiam > 0 ? `${jaExistiam} já estavam no app e foram ignorados.` : undefined,
              })
              void recarregar()
            }}
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

/**
 * Ação do cabeçalho no desktop: ícone sozinho até `xl`, ícone + texto a partir
 * dali. O nome nunca some — abaixo de xl ele vive no tooltip e no aria-label,
 * e no celular a mesma ação está escrita por extenso no menu "⋯".
 */
function AcaoCabecalho({
  rotulo,
  Icone,
  onClick,
  desabilitada,
}: {
  rotulo: string
  Icone: typeof Download
  onClick: () => void
  desabilitada?: boolean
}) {
  return (
    // Provider local, mesmo já existindo um no App: sem ele a página não
    // renderiza fora da árvore inteira do app — foi assim que o teste desta
    // página quebrou. Provider aninhado é suportado e página que só monta com
    // um ancestral específico é frágil.
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={onClick}
            disabled={desabilitada}
            aria-label={rotulo}
          >
            <Icone className="h-4 w-4" />
            <span className="hidden 2xl:inline">{rotulo}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="2xl:hidden">{rotulo}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
