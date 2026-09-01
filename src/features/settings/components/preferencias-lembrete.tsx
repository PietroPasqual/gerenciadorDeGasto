import * as React from 'react'
import { BellRing } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SwitchTrack } from '@/components/ui/switch'
import { PREFERENCIAS_PADRAO, type PreferenciasLembrete } from '@/lib/lembretes'

const TIPOS: Array<{ chave: keyof PreferenciasLembrete; titulo: string; ajuda: string }> = [
  {
    chave: 'fatura_fechando',
    titulo: 'Fatura fechando',
    ajuda: 'Última chance de decidir se a compra cai nesta fatura ou na próxima.',
  },
  {
    chave: 'fatura_vencendo',
    titulo: 'Fatura vencendo',
    ajuda: 'Fatura atrasada continua aparecendo, mesmo fora da antecedência.',
  },
  {
    chave: 'fixo_vencendo',
    titulo: 'Gasto fixo vencendo',
    ajuda: 'Some assim que você marcar o gasto como pago.',
  },
]

/**
 * Liga e desliga cada aviso.
 *
 * Os três nascem ligados de propósito: um lembrete de vencimento que só aparece
 * depois de a pessoa achar a configuração não lembra ninguém de nada. O que
 * precisa ser fácil é DESLIGAR, e é isso que esta tela faz.
 */
export function PreferenciasLembreteConfig({
  preferencias,
  onMudar,
}: {
  preferencias: PreferenciasLembrete
  onMudar: (p: PreferenciasLembrete) => void
}) {
  const [dias, setDias] = React.useState(String(preferencias.dias_antes))

  React.useEffect(() => {
    setDias(String(preferencias.dias_antes))
  }, [preferencias.dias_antes])

  const algumLigado =
    preferencias.fatura_fechando || preferencias.fatura_vencendo || preferencias.fixo_vencendo

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-muted-foreground" aria-hidden />
          Lembretes
        </CardTitle>
        <CardDescription>
          Avisos na tela do mês, sobre o que vence. Nada é enviado por e-mail nem por notificação do celular.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {TIPOS.map(({ chave, titulo, ajuda }) => (
          <div key={chave} className="rounded-xl border border-border p-3">
            {/* A linha inteira é o alvo, como no chip de vigência: no celular
                acertar só o interruptor é ruim. */}
            <button
              type="button"
              role="switch"
              aria-checked={preferencias[chave] as boolean}
              onClick={() => onMudar({ ...preferencias, [chave]: !preferencias[chave] })}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{titulo}</span>
                <span className="block text-xs text-muted-foreground">{ajuda}</span>
              </span>
              <SwitchTrack checked={preferencias[chave] as boolean} />
            </button>
          </div>
        ))}

        {algumLigado && (
          <div className="space-y-1.5 rounded-xl border border-border p-3">
            <Label htmlFor="dias-antes">Avisar com quantos dias de antecedência</Label>
            <Input
              id="dias-antes"
              type="number"
              inputMode="numeric"
              min={0}
              max={15}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              onBlur={() => {
                const n = Number(dias)
                // Fora da faixa volta ao que estava, em vez de virar zero: zero
                // desligaria o aviso em silêncio.
                const valido =
                  Number.isFinite(n) && n >= 0 && n <= 15 ? Math.trunc(n) : preferencias.dias_antes
                setDias(String(valido))
                if (valido !== preferencias.dias_antes) onMudar({ ...preferencias, dias_antes: valido })
              }}
              className="h-11 md:h-10"
            />
            <p className="text-xs text-muted-foreground">
              Entre 0 e 15. Acima disso o aviso fica ligado o mês inteiro e vira paisagem — o que dá no mesmo
              que não avisar.
            </p>
          </div>
        )}

        {!algumLigado && (
          <p className="rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
            Todos os lembretes estão desligados. O app não vai avisar de vencimento nenhum.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export { PREFERENCIAS_PADRAO }
