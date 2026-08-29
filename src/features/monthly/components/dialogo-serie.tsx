import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { rotuloParcela } from '@/lib/parcelamento'
import type { Transaction } from '@/lib/database.types'

export type EscopoSerie = 'parcela' | 'serie'

/**
 * "Só esta parcela ou a compra inteira?" — a mesma pergunta que um calendário
 * faz ao mexer num evento que se repete.
 *
 * Ela é obrigatória porque as duas respostas são plausíveis e as consequências
 * são muito diferentes: excluir a série apaga lançamentos de meses que a pessoa
 * não está vendo, inclusive de meses passados que ela já conferiu. Escolher por
 * ela, em qualquer direção, seria decidir sobre dinheiro que não é nosso.
 */
export function DialogoSerie({
  acao,
  gasto,
  onEscolher,
  onCancelar,
}: {
  /** null = fechado. */
  acao: 'excluir' | 'editar' | null
  gasto: Transaction | null
  onEscolher: (escopo: EscopoSerie) => void
  onCancelar: () => void
}) {
  if (!acao || !gasto || gasto.parcela === null || gasto.parcelas_total === null) return null

  const etiqueta = rotuloParcela(gasto.parcela, gasto.parcelas_total)
  const restantes = gasto.parcelas_total - gasto.parcela

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onCancelar()}>
      <DialogContent className="max-w-md">
        <DialogTitle>
          {acao === 'excluir' ? 'Excluir' : 'Editar'} {gasto.descricao}
        </DialogTitle>
        <DialogDescription>
          Esta é a parcela <strong>{etiqueta}</strong> de uma compra parcelada
          {restantes > 0 && `, com mais ${restantes} ${restantes === 1 ? 'parcela' : 'parcelas'} pela frente`}
          .
        </DialogDescription>

        <div className="mt-4 space-y-2">
          {/* Alvos de 44px e empilhados: no celular esta é a mesma tela. */}
          <Button variant="outline" className="min-h-11 w-full" onClick={() => onEscolher('parcela')}>
            {acao === 'excluir' ? `Excluir só a parcela ${etiqueta}` : `Editar só a parcela ${etiqueta}`}
          </Button>
          <Button
            variant={acao === 'excluir' ? 'destructive' : 'default'}
            className="min-h-11 w-full"
            onClick={() => onEscolher('serie')}
          >
            {acao === 'excluir'
              ? `Excluir as ${gasto.parcelas_total} parcelas`
              : `Editar as ${gasto.parcelas_total} parcelas`}
          </Button>
          <Button variant="ghost" className="min-h-11 w-full" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>

        {acao === 'excluir' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Excluir a compra inteira apaga também as parcelas de outros meses, inclusive de meses já passados.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
