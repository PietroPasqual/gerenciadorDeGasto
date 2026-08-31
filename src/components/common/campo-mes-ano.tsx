import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SwitchTrack } from '@/components/ui/switch'
import { MESES, anosDisponiveis } from '@/lib/dates'

/**
 * "Tem data? Qual?" — interruptor mais mês e ano.
 *
 * Nasceu na sheet de vigência e vive aqui porque o prazo da meta (0019) pede
 * exatamente a mesma pergunta. Duas cópias da mesma caixa divergem no primeiro
 * ajuste de altura, e o alvo de 44px é o que costuma se perder no caminho.
 */
export function CampoMesAno({
  rotulo,
  semData,
  ativo,
  ano,
  mes,
  anos = anosDisponiveis(),
  onAlternar,
  onChange,
}: {
  rotulo: string
  /** O que aparece quando não há data. */
  semData: string
  ativo: boolean
  ano: number | null
  mes: number | null
  /** Os anos oferecidos. O ano já salvo entra sempre, mesmo fora da lista. */
  anos?: number[]
  onAlternar: (ligado: boolean) => void
  onChange: (ano: number, mes: number) => void
}) {
  const anoAtual = ano ?? new Date().getFullYear()
  // Um prazo salvo em 2019 não pode sumir do seletor só porque a lista começa
  // em 2026: a pessoa veria um campo vazio e um valor salvo diferente dele.
  const opcoes = anos.includes(anoAtual) ? anos : [...anos, anoAtual].sort((a, b) => a - b)

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      {/* Ligado = tem data. O rótulo não muda junto com o interruptor: um
          switch que aparece desligado com o campo preenchido logo abaixo dele
          é o tipo de coisa que faz a pessoa desconfiar do que salvou.
          A linha inteira é o alvo, mesmo padrão do BotaoPago. */}
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        onClick={() => onAlternar(!ativo)}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{rotulo}</span>
          {!ativo && <span className="block text-xs text-muted-foreground">{semData}</span>}
        </span>
        <SwitchTrack checked={ativo} />
      </button>

      {ativo && (
        <div className="flex gap-2">
          <Select value={String(mes ?? 1)} onValueChange={(v) => onChange(anoAtual, Number(v))}>
            <SelectTrigger className="flex-1" aria-label={`Mês — ${rotulo}`}>
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
          <Select value={String(anoAtual)} onValueChange={(v) => onChange(Number(v), mes ?? 1)}>
            <SelectTrigger className="w-[6.5rem]" aria-label={`Ano — ${rotulo}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
