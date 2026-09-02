import { Link } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Como funciona" — o link para a explicação longa.
 *
 * A regra que ele obedece: a decisão principal aparece na TELA onde ela
 * acontece, e este link leva ao porquê. Ele nunca é o único lugar onde uma
 * regra importante está escrita; se for, o texto está no lugar errado.
 *
 * Só entra onde sair da tela não custa nada — um painel, uma seção de
 * configuração. Dentro de um formulário com rascunho preenchido ele seria uma
 * armadilha: a explicação chegaria junto com a perda do que foi digitado.
 *
 * O `topico` é o id de um bloco de `features/help/conteudo.ts`, e um teste
 * confere que todo id usado aqui existe lá — link de ajuda quebrado é pior que
 * link nenhum, porque a página abre e não responde.
 */
export function LinkAjuda({
  topico,
  children = 'Como funciona',
  className,
}: {
  topico: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={`/ajuda#${topico}`}
      className={cn(
        'alvo-toque inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline',
        className,
      )}
    >
      <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </Link>
  )
}
