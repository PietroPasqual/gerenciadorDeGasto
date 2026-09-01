import * as React from 'react'
import { Repeat, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentavos } from '@/lib/money'
import { nomeCurtoDoMes } from '@/lib/dates'
import { type Assinatura, textoDaAssinatura } from '@/lib/assinaturas'

/**
 * "Isto parece uma assinatura. Virar gasto fixo?"
 *
 * Fica acima da tabela de gastos fixos, que é onde a resposta vai morar.
 *
 * TRÊS ESTADOS, E POR QUE ESTE PAINEL NÃO TEM OS TRÊS
 *
 * A regra da casa é esqueleto, vazio com CTA e erro com "tentar novamente" em
 * toda TELA. Este não é uma tela: é um acréscimo em cima de uma que já tem os
 * três. Um esqueleto para algo que quase sempre não tem nada a dizer só
 * empurraria a tabela para baixo a cada abertura, e um alerta vermelho porque
 * a SUGESTÃO falhou colocaria um erro no caminho de quem veio conferir o
 * aluguel. Nos dois casos o painel simplesmente não aparece — que é o
 * comportamento correto para quem opina, e não informa.
 *
 * O "Agora não" é obrigatório e persiste no perfil: a detecção reencontra o
 * mesmo grupo todo mês, e uma sugestão que não aceita não vira ruído.
 */
export function PainelAssinaturas({
  assinaturas,
  onVirarFixo,
  onIgnorar,
}: {
  assinaturas: Assinatura[]
  onVirarFixo: (a: Assinatura) => Promise<void> | void
  onIgnorar: (a: Assinatura) => void
}) {
  const [ocupada, setOcupada] = React.useState<string | null>(null)
  if (assinaturas.length === 0) return null

  const criar = async (a: Assinatura) => {
    setOcupada(a.chave)
    try {
      await onVirarFixo(a)
      toast.success(`“${a.rotulo}” virou gasto fixo.`, {
        description: `Vigência a partir de ${nomeCurtoDoMes(a.inicioMes)}/${a.inicioAno} — o mês em que apareceu pela primeira vez.`,
      })
    } finally {
      setOcupada(null)
    }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-2 p-3">
        <p className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
          <Repeat className="h-4 w-4 shrink-0" aria-hidden />
          {assinaturas.length === 1 ? 'Isto parece uma assinatura' : 'Estas parecem assinaturas'}
        </p>

        <ul className="space-y-2">
          {assinaturas.map((a) => (
            <li key={a.chave} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.rotulo}</p>
                  <p className="text-xs text-muted-foreground">{textoDaAssinatura(a)}</p>
                </div>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatCentavos(a.valorSugerido)}
                </span>
              </div>

              {/* O valor oscilou dentro da tolerância: dizer isso é mais
                  honesto do que mostrar um número só e deixar a pessoa
                  descobrir depois que o gasto fixo não bate com a fatura. */}
              {a.menorValor !== a.maiorValor && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Variou entre {formatCentavos(a.menorValor)} e {formatCentavos(a.maiorValor)}.
                </p>
              )}

              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="min-h-11 flex-1 md:min-h-9"
                  disabled={ocupada !== null}
                  onClick={() => void criar(a)}
                >
                  Virar gasto fixo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11 md:min-h-9"
                  disabled={ocupada !== null}
                  onClick={() => onIgnorar(a)}
                  aria-label={`Não sugerir ${a.rotulo} de novo`}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Agora não
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
