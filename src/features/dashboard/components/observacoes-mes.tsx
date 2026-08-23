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
  neutro: 'text-foreground',
}

/** Fundo da bolinha do ícone. */
const FUNDO: Record<Tom, string> = {
  atencao: 'bg-destructive/10',
  bom: 'bg-success/10',
  neutro: 'bg-muted',
}

/** Cada observação vira um cartão com borda no tom — dá para varrer com o olho. */
const BORDA: Record<Tom, string> = {
  atencao: 'border-destructive/25 bg-destructive/[0.04]',
  bom: 'border-success/25 bg-success/[0.04]',
  neutro: 'border-border bg-muted/30',
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
        <ul className="space-y-2">
          {observacoes.map((o) => {
            const Icone = ICONE[o.tom]
            const conteudo = (
              <>
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', FUNDO[o.tom])}>
                  <Icone className={cn('h-4 w-4', COR[o.tom])} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  {/* O número em corpo maior e na cor do tom: é o que a pessoa
                      veio ver, e no meio da frase ele tinha o mesmo peso das
                      preposições ao redor. */}
                  <span className={cn('block text-lg font-semibold leading-tight', COR[o.tom])}>
                    {o.destaque}
                  </span>
                  <span className="block text-sm leading-snug text-muted-foreground">{o.texto}</span>
                </span>
                {o.para && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              </>
            )
            return (
              <li key={o.id}>
                {o.para ? (
                  <Link
                    to={o.para}
                    className={cn(
                      'flex min-h-[3.5rem] items-center gap-3 rounded-xl border p-3 transition-colors',
                      BORDA[o.tom],
                      'hover:brightness-[0.98] dark:hover:brightness-125',
                    )}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'flex min-h-[3.5rem] items-center gap-3 rounded-xl border p-3',
                      BORDA[o.tom],
                    )}
                  >
                    {conteudo}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
