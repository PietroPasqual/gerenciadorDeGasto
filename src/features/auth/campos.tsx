import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Campo de formulário de autenticação, com erro E dica no lugar certo.
 *
 * Antes cada página repetia label + input + <p role="alert">, e a dica de
 * senha só existia depois de a pessoa errar — "a senha precisa ter pelo menos
 * 6 caracteres" chegava como correção, não como instrução.
 *
 * `aria-describedby` amarra dica e erro ao campo: quem usa leitor de tela
 * ouve os dois ao chegar nele, e não precisa caçar o texto solto embaixo.
 */
export const CampoAuth = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<'input'> & {
    rotulo: string
    erro?: string
    dica?: string
    /** Botão ou link mostrado na mesma linha do rótulo. */
    acao?: React.ReactNode
  }
>(function CampoAuth({ rotulo, erro, dica, acao, id, className, ...props }, ref) {
  const idErro = `${id}-erro`
  const idDica = `${id}-dica`
  return (
    <div className="space-y-1.5">
      {/* `acao` divide a linha com o rótulo — é onde mora o "Esqueci minha
          senha". Fora daqui ele viraria um segundo rótulo visível ao lado do
          verdadeiro. */}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{rotulo}</Label>
        {acao}
      </div>
      <Input
        ref={ref}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={cn(dica && idDica, erro && idErro) || undefined}
        className={cn(erro && 'border-destructive focus-visible:ring-destructive', className)}
        {...props}
      />
      {dica && !erro && (
        <p id={idDica} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </div>
  )
})

/**
 * O erro que não é de um campo só — credencial recusada, e-mail não
 * confirmado, limite de tentativas.
 *
 * Fica DENTRO do formulário, e não num toast: o toast some sozinho em poucos
 * segundos, e quem lê devagar, ou voltou para a aba depois, perde a única
 * explicação do que aconteceu. Com `role="alert"` o leitor de tela anuncia na
 * hora, sem precisar mover o foco.
 */
export function ErroDoFormulario({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
