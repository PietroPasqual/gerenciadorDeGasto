import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Observacao, Tom } from '@/lib/observacoes'

const ICONE: Record<Tom, typeof Info> = {
  atencao: AlertTriangle,
  bom: CheckCircle2,
  neutro: Info,
}

const COR: Record<Tom, string> = {
  atencao: 'text-destructive',
  bom: 'text-success',
  neutro: 'text-muted-foreground',
}

/**
 * O que os números do mês dizem, em frases.
 *
 * São FATOS, não conselhos: cada linha é conferível no card ao lado. O app tem
 * a sua planilha, não a sua vida — ele não sabe se aquele mercado caro foi a
 * compra do mês da família inteira ou um deslize, então não manda cortar nada.
 *
 * Quando há para onde ir, a linha inteira vira link: ler "38% das saídas estão
 * sem categoria" e não ter como agir dali seria só uma reclamação.
 */
export function ObservacoesMes({ observacoes }: { observacoes: Observacao[] }) {
  if (observacoes.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>O que este mês diz</CardTitle>
        <CardDescription>Tirado dos seus próprios números, comparando com você mesmo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {observacoes.map((o) => {
            const Icone = ICONE[o.tom]
            const conteudo = (
              <>
                <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', COR[o.tom])} aria-hidden />
                <span className="flex-1 text-sm">{o.texto}</span>
                {o.para && (
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </>
            )
            return (
              <li key={o.id}>
                {o.para ? (
                  <Link
                    to={o.para}
                    className="flex min-h-[2.75rem] items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <span className="flex min-h-[2.75rem] items-start gap-3 px-2 py-2">{conteudo}</span>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
