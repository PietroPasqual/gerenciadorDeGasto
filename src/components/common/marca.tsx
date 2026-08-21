import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Nome do app. O "Z" é o que dá identidade ao finZ, então fica destacado na
 * cor do tema — e vive aqui, num componente só, para o destaque não sair
 * diferente em cada tela.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('titulo-serif', className)}>
      {/* aria-label: leitores de tela devem falar "finZ", não "fin" + "Z" */}
      <span aria-hidden>
        fin<span className="text-primary-strong">Z</span>
      </span>
      <span className="sr-only">finZ</span>
    </span>
  )
}

/** Marca completa: símbolo + nome. Usada no topo do app, na landing e no login. */
export function Marca({ className, textoClassName }: { className?: string; textoClassName?: string }) {
  return (
    <span className={cn('flex min-h-[2.75rem] items-center gap-2 md:min-h-0', className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Wallet className="h-4 w-4" />
      </span>
      <Wordmark className={cn('text-lg', textoClassName)} />
    </span>
  )
}
