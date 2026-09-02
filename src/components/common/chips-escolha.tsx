import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Escolha única em chips, com alvo de 44px.
 *
 * Chips e não `<select>` porque no celular são um toque em vez de abrir uma
 * lista, e porque as opções aqui são poucas e curtas (categorias e formas de
 * pagamento de uma pessoa). Tocar no chip já marcado o desmarca — é assim que
 * se limpa a escolha sem precisar de um item "Nenhum" na lista.
 */
export function ChipsEscolha({
  rotulo,
  opcoes,
  selecionado,
  onSelecionar,
  comCor,
}: {
  rotulo: string
  opcoes: Array<{ id: string; nome: string; cor?: string }>
  selecionado: string | null
  onSelecionar: (id: string | null) => void
  comCor?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{rotulo}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = selecionado === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelecionar(ativo ? null : o.id)}
              aria-pressed={ativo}
              className={cn(
                'flex min-h-[2.75rem] items-center gap-2 rounded-full border px-4 text-corpo transition-colors',
                ativo
                  ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                  : 'border-border hover:bg-accent',
              )}
            >
              {comCor && o.cor && (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: o.cor }}
                />
              )}
              {o.nome}
              {ativo && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
