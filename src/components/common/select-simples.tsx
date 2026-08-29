import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const SEM_VALOR = '__nenhum__'

/** Select de catálogo (forma de pagamento, categoria, meta) com opção "sem valor". */
export const SelectSimples = React.forwardRef<
  HTMLButtonElement,
  {
    valor: string | null
    onChange: (valor: string | null) => void
    opcoes: Array<{ id: string; nome: string }>
    placeholder?: string
    rotuloVazio?: string
    ariaLabel: string
    className?: string
  }
>(
  (
    { valor, onChange, opcoes, placeholder = 'Definir', rotuloVazio = 'Sem definir', ariaLabel, className },
    ref,
  ) => (
    <Select value={valor ?? SEM_VALOR} onValueChange={(novo) => onChange(novo === SEM_VALOR ? null : novo)}>
      <SelectTrigger
        ref={ref}
        data-celula
        aria-label={ariaLabel}
        className={cn('border-transparent bg-transparent hover:border-input', className)}
      >
        {/* Sem seleção, o gatilho mostra o `placeholder` (curto, cabe no
          celular) em vez do rótulo longo do item vazio — que continua
          aparecendo dentro da lista. */}
        <SelectValue placeholder={placeholder}>
          {valor ? opcoes.find((o) => o.id === valor)?.nome : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_VALOR}>{rotuloVazio}</SelectItem>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.id} value={opcao.id}>
            {opcao.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
)
SelectSimples.displayName = 'SelectSimples'
