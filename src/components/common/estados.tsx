import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ILUSTRACOES, type NomeIlustracao } from './ilustracoes'
import { cn } from '@/lib/utils'

/** Estado vazio com CTA — usado em toda listagem sem dados. */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  ilustracao = 'lista',
  className,
}: {
  titulo: string
  /** ReactNode e não string: às vezes o caminho é outro no celular e no
      desktop, e a frase precisa mudar junto (ver tabela-gastos.tsx). */
  descricao?: React.ReactNode
  acao?: React.ReactNode
  /** Qual desenho combina com o que falta ali (ver ilustracoes.tsx). */
  ilustracao?: NomeIlustracao
  className?: string
}) {
  const Desenho = ILUSTRACOES[ilustracao]
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-8 text-center',
        className,
      )}
    >
      <Desenho />
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
