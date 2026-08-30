import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { rotuloParcela } from '@/lib/parcelamento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cabecalho, Linha, Total } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { SelectSimples } from '@/components/common/select-simples'
import { EstadoVazio } from '@/components/common/estados'
import { LIMITE_VIRTUALIZACAO, ListaVirtual } from '@/components/common/lista-virtual'
import { formatCentavos } from '@/lib/money'
import { formatDataISO } from '@/lib/dates'
import { totalDeItens } from '@/lib/calculations'
import { primeiroDiaISO, paraDataISO, periodoAtual } from '@/lib/dates'
import type { Category, PaymentMethod, Transaction } from '@/lib/database.types'

// Colunas: Descrição | Valor | Data | Forma | Categoria | Ações.
// Descrição e Valor vêm juntos porque no celular eles formam a 1ª linha do
// card e o resto forma a 2ª — ver o agrupamento com `md:contents` abaixo.
const TEMPLATE = 'md:grid-cols-[1.4fr,9rem,9rem,1fr,1fr,2.5rem]'

/** Data padrão da linha nova: hoje se o mês selecionado for o atual, senão dia 1. */
function dataPadrao(ano: number, mes: number) {
  const hoje = periodoAtual()
  return hoje.ano === ano && hoje.mes === mes ? paraDataISO(new Date()) : primeiroDiaISO({ ano, mes })
}

export function TabelaGastos({
  ano,
  mes,
  gastos,
  formasPagamento,
  categorias,
  onAdicionar,
  onEditar,
  onRemover,
  onAbrirEdicao,
  filtro,
  temFiltroAtivo = false,
}: {
  ano: number
  mes: number
  /** JÁ FILTRADOS. Os totais do mês continuam vindo da lista inteira. */
  gastos: Transaction[]
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  onAdicionar: (dados: {
    data: string
    descricao: string
    payment_method_id: string | null
    category_id: string | null
    valor_centavos: number
    tipo: 'gasto'
  }) => void
  onEditar: (id: string, mudancas: Partial<Transaction>) => void
  /**
   * Recebe o gasto inteiro, e não só o id: quando ele é parcela de uma
   * compra, a tela precisa perguntar se é só esta ou a série toda.
   */
  onRemover: (gasto: Transaction) => void
  /** Só no celular: tocar no card abre a sheet de edição (M4). */
  onAbrirEdicao?: (gasto: Transaction) => void
  /** O bloco de busca e filtro, montado pela página. */
  filtro?: React.ReactNode
  /** Muda o estado vazio: "nada encontrado" não é "nada lançado". */
  temFiltroAtivo?: boolean
}) {
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(() => dataPadrao(ano, mes))
  const [valorCentavos, setValorCentavos] = useState(0)
  const [formaId, setFormaId] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  const adicionar = () => {
    if (!descricao.trim() && valorCentavos === 0) return
    onAdicionar({
      data: data || dataPadrao(ano, mes),
      descricao: descricao.trim() || 'Gasto',
      payment_method_id: formaId,
      category_id: categoriaId,
      valor_centavos: valorCentavos,
      tipo: 'gasto',
    })
    setDescricao('')
    setValorCentavos(0)
    // forma/categoria/data continuam preenchidas: lançar vários seguidos é o caso comum
  }

  /**
   * O card do celular, extraído para servir aos dois caminhos: a lista comum e
   * a virtualizada. Duplicar o markup significaria corrigir bugs duas vezes, e
   * o de cima só apareceria com mais de 200 lançamentos — ou seja, tarde.
   */
  const cardDoGasto = (gasto: Transaction) => {
    const categoria = categorias.find((c) => c.id === gasto.category_id)
    const forma = formasPagamento.find((f) => f.id === gasto.payment_method_id)
    return (
      <button
        type="button"
        onClick={() => onAbrirEdicao?.(gasto)}
        className="flex w-full flex-col gap-1 rounded-xl border border-border px-3 py-2.5 text-left transition-colors active:bg-accent/60"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-corpo font-medium">{gasto.descricao}</span>
          <span className="tabular shrink-0 text-corpo font-semibold">
            {formatCentavos(gasto.valor_centavos)}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular">{formatDataISO(gasto.data)}</span>
          {gasto.parcelas_total !== null && gasto.parcela !== null && (
            <>
              <span aria-hidden>·</span>
              <EtiquetaParcela parcela={gasto.parcela} total={gasto.parcelas_total} />
            </>
          )}
          {forma && (
            <>
              <span aria-hidden>·</span>
              <span>{forma.nome}</span>
            </>
          )}
          {categoria && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: categoria.cor }}
                />
                {categoria.nome}
              </span>
            </>
          )}
        </span>
      </button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Gastos do mês</CardTitle>
        <CardDescription className="hidden md:block">
          Digite na última linha e pressione Enter. Use Tab/Enter para andar entre as células.
        </CardDescription>
        <CardDescription className="md:hidden">Toque num gasto para editar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtro}

        {gastos.length === 0 ? (
          temFiltroAtivo ? (
            // Nada ENCONTRADO é diferente de nada LANÇADO: mandar a pessoa
            // lançar o primeiro gasto quando ela tem 300 e só filtrou errado
            // é dizer que os gastos sumiram.
            <EstadoVazio
              titulo="Nenhum lançamento com esses filtros"
              descricao="Tente uma busca mais curta, ou limpe os filtros para ver o mês inteiro."
              ilustracao="lista"
            />
          ) : (
            <EstadoVazio
              titulo="Nenhum gasto lançado"
              descricao={
                // No celular a linha de adição não existe (é o FAB), então a
                // frase antiga mandava a pessoa procurar algo que não está lá.
                <>
                  <span className="md:hidden">Toque no + para lançar o primeiro gasto.</span>
                  <span className="hidden md:inline">Comece pelo primeiro gasto do mês na linha abaixo.</span>
                </>
              }
            />
          )
        ) : (
          <>
            {/* CELULAR: card em modo leitura. Editar seis campos minúsculos
                dentro de 360px era ilegível e nenhum alvo chegava a 44px;
                aqui o card só mostra, e tocar abre a sheet (mesma do FAB),
                onde os campos têm tamanho de dedo. Inline segue valendo de
                md para cima. */}
            {/* Acima de algumas centenas de linhas o DOM inteiro trava a
                rolagem no celular; abaixo disso virtualizar só atrapalharia
                (quebra o Ctrl+F e a navegação por Tab). */}
            {gastos.length > LIMITE_VIRTUALIZACAO ? (
              <ListaVirtual className="md:hidden" itens={gastos} alturaEstimada={76} chave={(g) => g.id}>
                {(gasto) => <div className="pb-2">{cardDoGasto(gasto)}</div>}
              </ListaVirtual>
            ) : (
              <ul className="space-y-2 md:hidden">
                {gastos.map((gasto) => (
                  <li key={gasto.id}>{cardDoGasto(gasto)}</li>
                ))}
              </ul>
            )}

            <GradeEditavel className="space-y-2 md:space-y-0">
              <Cabecalho template={TEMPLATE}>
                <span>Descrição</span>
                <span className="text-right">Valor</span>
                <span>Data</span>
                <span>Forma de pagamento</span>
                <span>Categoria</span>
                <span className="sr-only">Ações</span>
              </Cabecalho>

              {/* No celular a linha tem duas faixas fixas — nada de wrap, para
                que todos os cards fiquem com a mesma altura e cada controle no
                mesmo lugar. A lixeira fica ancorada no canto superior direito
                (por isso o `pr-9` na 1ª faixa). No desktop `md:contents`
                desmonta os agrupamentos e devolve tudo para as 6 colunas. */}
              {gastos.map((gasto) => (
                <Linha
                  key={gasto.id}
                  template={TEMPLATE}
                  className="relative hidden gap-1.5 md:grid md:static"
                >
                  <div className="flex items-center gap-2 pr-9 md:contents md:pr-0">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Input
                        data-celula
                        aria-label="Descrição do gasto"
                        defaultValue={gasto.descricao}
                        onBlur={(e) => {
                          if (e.target.value !== gasto.descricao)
                            onEditar(gasto.id, { descricao: e.target.value })
                        }}
                        className="min-w-0 flex-1 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:font-normal"
                      />
                      {gasto.parcelas_total !== null && gasto.parcela !== null && (
                        <EtiquetaParcela parcela={gasto.parcela} total={gasto.parcelas_total} />
                      )}
                    </div>
                    <MoneyInput
                      data-celula
                      aria-label="Valor do gasto"
                      value={gasto.valor_centavos}
                      onValueChange={(valor) => onEditar(gasto.id, { valor_centavos: valor })}
                      className="w-24 shrink-0 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:w-full md:font-normal"
                    />
                  </div>

                  <div className="grid grid-cols-[6.25rem,0.85fr,1.15fr] items-center gap-1.5 md:contents">
                    <Input
                      data-celula
                      type="date"
                      aria-label="Data do gasto"
                      defaultValue={gasto.data.slice(0, 10)}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== gasto.data.slice(0, 10)) {
                          onEditar(gasto.id, { data: e.target.value })
                        }
                      }}
                      className="w-full border-transparent bg-transparent px-2 text-muted-foreground hover:border-input focus:bg-card md:px-3 md:text-foreground"
                    />
                    <SelectSimples
                      ariaLabel="Forma de pagamento do gasto"
                      valor={gasto.payment_method_id}
                      opcoes={formasPagamento}
                      onChange={(valor) => onEditar(gasto.id, { payment_method_id: valor })}
                      className="px-2 md:px-3"
                    />
                    <SelectSimples
                      ariaLabel="Categoria do gasto"
                      valor={gasto.category_id}
                      opcoes={categorias}
                      onChange={(valor) => onEditar(gasto.id, { category_id: valor })}
                      className="px-2 md:px-3"
                    />
                  </div>

                  <div className="acoes-hover absolute right-1.5 top-1.5 md:static md:flex md:justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemover(gasto)}
                      aria-label={`Excluir gasto ${gasto.descricao}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Linha>
              ))}
            </GradeEditavel>
          </>
        )}

        {/* Adição rápida (estilo planilha) */}
        {/* Adição inline é do desktop; no celular quem lança é o FAB (M2). */}
        <div
          className={`hidden grid-cols-1 gap-1.5 rounded-xl border border-dashed border-border p-3 md:grid md:gap-2 md:border-0 md:p-0 md:pt-1 ${TEMPLATE}`}
        >
          <div className="flex items-center gap-2 md:contents">
            <Input
              placeholder="Novo gasto"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Descrição do novo gasto"
              className="min-w-0 flex-1"
            />
            <MoneyInput
              value={valorCentavos}
              onValueChange={setValorCentavos}
              onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              aria-label="Valor do novo gasto"
              className="w-28 shrink-0 md:w-full"
            />
          </div>

          <div className="grid grid-cols-[6.25rem,1fr,1fr] items-center gap-1.5 md:contents">
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              aria-label="Data do novo gasto"
              className="w-full px-2 md:px-3"
            />
            <SelectSimples
              ariaLabel="Forma de pagamento do novo gasto"
              valor={formaId}
              placeholder="Forma"
              opcoes={formasPagamento}
              onChange={setFormaId}
              className="border-input px-2 md:px-3"
            />
            <SelectSimples
              ariaLabel="Categoria do novo gasto"
              valor={categoriaId}
              placeholder="Categoria"
              opcoes={categorias}
              onChange={setCategoriaId}
              className="border-input px-2 md:px-3"
            />
          </div>

          {/* No celular um botão de largura total é um alvo bem melhor que um
              "+" de 36px; no desktop volta a ser o ícone da última coluna. */}
          <Button onClick={adicionar} aria-label="Adicionar gasto" className="w-full md:h-10 md:w-10 md:p-0">
            <Plus className="h-4 w-4" />
            <span className="md:hidden">Adicionar gasto</span>
          </Button>
        </div>

        <Total rotulo="Total de gastos do mês" valor={formatCentavos(totalDeItens(gastos))} />
      </CardContent>
    </Card>
  )
}

/**
 * "3/12" ao lado da descrição.
 *
 * Sem ela, uma parcela é indistinguível de um gasto avulso do mesmo valor que
 * se repete — e a pessoa procuraria de onde saiu essa cobrança todo mês.
 */
function EtiquetaParcela({ parcela, total }: { parcela: number; total: number }) {
  return (
    <span
      className="tabular shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      title={`Parcela ${parcela} de ${total}`}
    >
      {rotuloParcela(parcela, total)}
    </span>
  )
}
