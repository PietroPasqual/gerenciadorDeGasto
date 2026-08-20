import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MESES, anosDisponiveis } from '@/lib/dates'

/** Seletor de ano + mês com navegação por setas (usado no controle mensal). */
export function SeletorPeriodo({
  ano,
  mes,
  onChange,
  mostrarMes = true,
}: {
  ano: number
  mes?: number
  onChange: (periodo: { ano: number; mes: number }) => void
  mostrarMes?: boolean
}) {
  const mesAtual = mes ?? 1

  const navegar = (delta: number) => {
    let novoMes = mesAtual + delta
    let novoAno = ano
    if (novoMes < 1) {
      novoMes = 12
      novoAno -= 1
    } else if (novoMes > 12) {
      novoMes = 1
      novoAno += 1
    }
    onChange({ ano: novoAno, mes: novoMes })
  }

  return (
    <div className="flex items-center gap-2">
      {mostrarMes && (
        <Button variant="outline" size="icon" onClick={() => navegar(-1)} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {mostrarMes && (
        <Select value={String(mesAtual)} onValueChange={(v) => onChange({ ano, mes: Number(v) })}>
          <SelectTrigger className="w-[9.5rem]" aria-label="Mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((nome, i) => (
              <SelectItem key={nome} value={String(i + 1)}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={String(ano)} onValueChange={(v) => onChange({ ano: Number(v), mes: mesAtual })}>
        <SelectTrigger className="w-[6.5rem]" aria-label="Ano">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anosDisponiveis().map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mostrarMes && (
        <Button variant="outline" size="icon" onClick={() => navegar(1)} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
