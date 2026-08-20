import { AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Estado vazio com CTA — usado em toda listagem sem dados. */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center', className)}>
      <div className="rounded-full bg-primary-soft p-3 text-primary">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        {descricao && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

/** Estado de erro com botão de tentar de novo. */
export function EstadoErro({
  mensagem = 'Não foi possível carregar os dados.',
  onTentarNovamente,
  className,
}: {
  mensagem?: string
  onTentarNovamente?: () => void
  className?: string
}) {
  return (
    <Card className={cn('border-destructive/30 bg-destructive/5', className)} role="alert">
      <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Algo deu errado</p>
            <p className="text-sm text-muted-foreground">{mensagem}</p>
          </div>
        </div>
        {onTentarNovamente && (
          <Button variant="outline" size="sm" onClick={onTentarNovamente}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
