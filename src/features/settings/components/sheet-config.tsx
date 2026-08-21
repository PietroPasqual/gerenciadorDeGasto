import * as React from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

/**
 * Editor de um item de Configurações no celular (M11).
 *
 * Nas listas antigas cada item era uma linha com quatro campos minúsculos e
 * uma lixeira de 44px encostada neles: dava para apagar uma categoria por
 * engano com um toque, sem confirmação e sem volta. Aqui o item vira um card
 * de leitura e a edição acontece nesta sheet, com espaço para os campos, para
 * reordenar e para uma exclusão que pergunta antes.
 *
 * Excluir é o único caminho sem desfazer no app, de propósito: recriar a
 * categoria devolve um id NOVO, e os lançamentos que apontavam para a antiga
 * não voltam a apontar para ela. Um "desfazer" que só parece desfazer é pior
 * do que perguntar antes.
 */
export function SheetConfig({
  aberta,
  onOpenChange,
  titulo,
  descricao,
  children,
  onSalvar,
  rotuloSalvar = 'Salvar',
  salvarDesabilitado,
  onExcluir,
  avisoExclusao,
  onMover,
  podeSubir,
  podeDescer,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  titulo: string
  descricao?: string
  children: React.ReactNode
  onSalvar: () => void
  rotuloSalvar?: string
  salvarDesabilitado?: boolean
  /** Ausente = sheet de criação: não há o que excluir nem reordenar. */
  onExcluir?: () => void
  avisoExclusao?: string
  onMover?: (direcao: -1 | 1) => void
  podeSubir?: boolean
  podeDescer?: boolean
}) {
  const [confirmando, setConfirmando] = React.useState(false)

  // Reabrir a sheet num item novo não pode herdar o "tem certeza?" do anterior.
  React.useEffect(() => {
    if (!aberta) setConfirmando(false)
  }, [aberta])

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{titulo}</SheetTitle>
        {descricao && <SheetDescription className="mb-4">{descricao}</SheetDescription>}

        <div className={descricao ? 'space-y-4' : 'mt-4 space-y-4'}>{children}</div>

        {onMover && (
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!podeSubir}
              onClick={() => onMover(-1)}
            >
              <ArrowUp className="h-4 w-4" />
              Subir
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={!podeDescer}
              onClick={() => onMover(1)}
            >
              <ArrowDown className="h-4 w-4" />
              Descer
            </Button>
          </div>
        )}

        <Button className="mt-3 w-full" onClick={onSalvar} disabled={salvarDesabilitado}>
          {rotuloSalvar}
        </Button>

        {onExcluir &&
          (confirmando ? (
            <div className="mt-5 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{avisoExclusao ?? 'Isto não pode ser desfeito.'}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={onExcluir}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="mt-5 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          ))}
      </SheetContent>
    </Sheet>
  )
}

/** Campo rotulado dentro da sheet. */
export function CampoSheet({
  rotulo,
  children,
  dica,
}: {
  rotulo: string
  children: React.ReactNode
  dica?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-muted-foreground">{dica}</span>}
    </label>
  )
}

/** Card de leitura de um item da lista; tocar abre a sheet. */
export function CartaoConfig({
  onClick,
  enfeite,
  titulo,
  detalhe,
}: {
  onClick: () => void
  enfeite?: React.ReactNode
  titulo: string
  detalhe?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[3rem] w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors active:bg-accent/60"
    >
      {enfeite}
      <span className="min-w-0 flex-1 truncate font-medium">{titulo}</span>
      {detalhe && <span className="shrink-0 text-sm text-muted-foreground">{detalhe}</span>}
    </button>
  )
}
