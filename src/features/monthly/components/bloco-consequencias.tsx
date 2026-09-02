import { AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Consequencia } from '@/lib/consequencias'

/**
 * O que vai acontecer, dito antes de salvar.
 *
 * Fica logo acima do botão porque é a última coisa lida antes do toque — e
 * porque a pessoa precisa poder voltar num campo depois de ler, o que não
 * acontece se a explicação só aparecer no toast depois.
 *
 * Sem `role="alert"`: o bloco muda a cada tecla digitada no valor, e um live
 * region nesse ritmo transforma o leitor de tela num ruído contínuo. Ele é
 * um trecho de texto comum, na ordem de leitura, imediatamente antes do
 * botão — quem navega por teclado passa por ele no caminho.
 */
export function BlocoConsequencias({
  consequencias,
  className,
}: {
  consequencias: Consequencia[]
  className?: string
}) {
  if (consequencias.length === 0) return null

  return (
    <ul className={cn('space-y-1.5', className)}>
      {consequencias.map((c) => {
        const alerta = c.tom === 'atencao'
        return (
          <li
            key={c.id}
            className={cn('flex gap-2.5 rounded-xl px-3 py-2.5', alerta ? 'bg-warning/10' : 'bg-superficie')}
          >
            {alerta ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            ) : (
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0 text-sm">
              <strong className="font-medium">{c.titulo}</strong>
              {c.detalhe && <span className="block text-muted-foreground">{c.detalhe}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
