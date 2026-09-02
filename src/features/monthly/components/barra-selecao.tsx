import * as React from 'react'
import { Copy, FolderTree, Trash2, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ChipsEscolha } from '@/components/common/chips-escolha'
import { formatCentavos } from '@/lib/money'
import { textoDaExclusao, textoDaQuantidade, textoDoEscopo, type ResumoSelecao } from '@/lib/selecao'
import type { Category, PaymentMethod } from '@/lib/database.types'

/**
 * A barra que aparece quando há lançamentos marcados.
 *
 * Ela existe para responder, sem que ninguém precise perguntar, as três coisas
 * que o prompt exige de toda ação em lote: quantos são, de onde eles saíram
 * (escopo), e uma confirmação quando a ação destrói. As duas primeiras ficam
 * escritas o tempo todo; a terceira só na exclusão, que é a única daqui que
 * não dá para desfazer sozinha.
 *
 * Fica presa ao rodapé no celular — acima da barra de navegação, no lugar onde
 * o FAB estaria (a página esconde o FAB enquanto isto está na tela, senão os
 * dois disputam o mesmo canto). No desktop ela é `sticky` dentro do card: com
 * cem linhas na tabela, uma barra que rola para fora obriga a subir de volta
 * depois de marcar a última linha.
 */
export function BarraSelecao({
  resumo,
  totalFiltrado,
  totalGeral,
  todosMarcados,
  categorias,
  formasPagamento,
  onMarcarTodos,
  onLimpar,
  onAplicar,
  onDuplicar,
  onExcluir,
}: {
  resumo: ResumoSelecao
  totalFiltrado: number
  totalGeral: number
  todosMarcados: boolean
  categorias: Category[]
  formasPagamento: PaymentMethod[]
  onMarcarTodos: () => void
  onLimpar: () => void
  onAplicar: (mudancas: { category_id?: string | null; payment_method_id?: string | null }) => void
  onDuplicar: () => void
  onExcluir: () => void
}) {
  const [escolhendo, setEscolhendo] = React.useState<'categoria' | 'forma' | null>(null)
  const [confirmando, setConfirmando] = React.useState(false)

  const vazia = resumo.quantidade === 0
  const { titulo, descricao } = textoDaExclusao(resumo)

  return (
    <>
      <div
        // A barra é uma região à parte para quem usa leitor de tela: ela
        // aparece e some conforme a marcação, e sem um nome ela seria só um
        // punhado de botões soltos no meio da tabela.
        role="group"
        aria-label="Ações para os lançamentos marcados"
        className={
          'fixed inset-x-2 bottom-[4.75rem] z-30 space-y-2 rounded-2xl border border-border bg-card p-3 shadow-2 ' +
          'mb-[env(safe-area-inset-bottom)] sm:sticky sm:inset-x-auto sm:bottom-2 sm:mb-0'
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-corpo font-medium">
              {textoDaQuantidade(resumo.quantidade)} · {formatCentavos(resumo.totalCentavos)}
            </p>
            <p className="text-xs text-muted-foreground">
              {textoDoEscopo(resumo.quantidade, totalFiltrado, totalGeral)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onLimpar}
            aria-label="Sair da seleção"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Rola de lado no celular: quatro ações escritas não cabem em 360px, e
            abreviá-las para caber esconderia justamente o que cada uma faz.
            Sem tabIndex na faixa — os botões dentro dela já recebem foco, e é
            por eles que o teclado alcança o que está fora da vista. */}
        <div className="sem-barra-rolagem -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          <Button
            variant="outline"
            className="alvo-toque shrink-0"
            disabled={vazia}
            onClick={() => setEscolhendo('categoria')}
          >
            <FolderTree className="mr-1.5 h-4 w-4" aria-hidden />
            Categoria
          </Button>
          <Button
            variant="outline"
            className="alvo-toque shrink-0"
            disabled={vazia}
            onClick={() => setEscolhendo('forma')}
          >
            <Wallet className="mr-1.5 h-4 w-4" aria-hidden />
            Forma
          </Button>
          <Button variant="outline" className="alvo-toque shrink-0" disabled={vazia} onClick={onDuplicar}>
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />
            Duplicar
          </Button>
          <Button
            variant="outline"
            className="alvo-toque shrink-0 text-destructive hover:text-destructive"
            disabled={vazia}
            onClick={() => setConfirmando(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
            Excluir
          </Button>
          <Button variant="ghost" className="alvo-toque shrink-0" onClick={onMarcarTodos}>
            {todosMarcados ? 'Desmarcar todos' : `Marcar os ${totalFiltrado}`}
          </Button>
        </div>
      </div>

      <Sheet open={escolhendo !== null} onOpenChange={(a) => !a && setEscolhendo(null)}>
        <SheetContent aria-describedby={undefined} className="overflow-y-auto">
          <SheetTitle className="mb-1">
            {escolhendo === 'forma' ? 'Forma de pagamento' : 'Categoria'}
          </SheetTitle>
          {/* O escopo de novo aqui: a barra fica atrás da folha, e sem repetir
              o número a confirmação viria sem o "em quantos". */}
          <p className="mb-4 text-sm text-muted-foreground">
            Vale para {textoDaQuantidade(resumo.quantidade)}{' '}
            {resumo.quantidade === 1 ? 'marcado' : 'marcados'}.
          </p>

          {escolhendo === 'forma' ? (
            <ChipsEscolha
              rotulo="Escolha a forma"
              opcoes={formasPagamento}
              selecionado={null}
              onSelecionar={(id) => {
                onAplicar({ payment_method_id: id })
                setEscolhendo(null)
              }}
            />
          ) : (
            <ChipsEscolha
              rotulo="Escolha a categoria"
              opcoes={categorias}
              selecionado={null}
              onSelecionar={(id) => {
                onAplicar({ category_id: id })
                setEscolhendo(null)
              }}
              comCor
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="max-w-md">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>

          <div className="mt-4 space-y-2">
            <Button
              variant="destructive"
              className="min-h-11 w-full"
              onClick={() => {
                setConfirmando(false)
                onExcluir()
              }}
            >
              Excluir
            </Button>
            <Button variant="ghost" className="min-h-11 w-full" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
