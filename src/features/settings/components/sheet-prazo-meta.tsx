import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { CampoMesAno } from '@/components/common/campo-mes-ano'
import { anosDeMeta, nomeCurtoDoMes, periodoAtual } from '@/lib/dates'
import { temPrazo } from '@/lib/meta-prazo'

export interface PrazoMeta {
  prazo_ano: number | null
  prazo_mes: number | null
}

/**
 * "Sem prazo" · "Até dez/26" — o texto do chip.
 *
 * Pelo `temPrazo`, e não por um `=== null` próprio: a coluna pode vir ausente
 * (undefined) enquanto a 0019 não rodar, e um teste estrito aqui escreveria
 * "Até /defined" em toda meta.
 */
export function textoPrazo(p: PrazoMeta): string {
  if (!temPrazo(p)) return 'Sem prazo'
  return `Até ${nomeCurtoDoMes(p.prazo_mes as number).toLowerCase()}/${String(p.prazo_ano).slice(2)}`
}

/**
 * Quando você quer ter juntado?
 *
 * O prazo é o que transforma "R$ 10.000" numa pergunta respondível: sem data
 * não há divisão possível, só um número grande. Continua opcional — meta sem
 * prazo é o comportamento de antes da 0019, e desligar o interruptor volta
 * exatamente para ele.
 *
 * Mesma sheet nos dois tamanhos, aberta pelo mesmo chip: o prazo não é
 * configuração de tela grande.
 */
export function SheetPrazoMeta({
  aberta,
  onOpenChange,
  nome,
  prazo,
  onSalvar,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  nome: string
  prazo: PrazoMeta
  onSalvar: (p: PrazoMeta) => void
}) {
  const [rascunho, setRascunho] = React.useState<PrazoMeta>(prazo)
  const hoje = periodoAtual()

  React.useEffect(() => {
    if (aberta) setRascunho(prazo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, prazo.prazo_ano, prazo.prazo_mes])

  // Pelo `temPrazo` de novo: com a coluna ausente, `prazo_ano !== null` é
  // verdadeiro e o interruptor abre LIGADO numa meta que não tem prazo — quem
  // tocasse nele estaria desligando algo que nunca esteve ligado.
  const ativo = temPrazo(rascunho)

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>Quando você quer ter juntado {nome}?</SheetTitle>
        <SheetDescription className="mb-4">
          Com uma data o app mostra quanto falta por mês, e se o ritmo deste ano chega lá. Sem data, a meta
          funciona como sempre funcionou.
        </SheetDescription>

        <CampoMesAno
          rotulo="Quero ter juntado até"
          semData="Sem prazo — nenhuma projeção aparece"
          ativo={ativo}
          ano={rascunho.prazo_ano}
          mes={rascunho.prazo_mes}
          anos={anosDeMeta()}
          onAlternar={(ligado) =>
            setRascunho(
              ligado
                ? // Um ano à frente como padrão: o mês corrente daria "faltam
                  // X neste mês", que é uma projeção inútil no primeiro toque.
                  { prazo_ano: hoje.ano + 1, prazo_mes: hoje.mes }
                : { prazo_ano: null, prazo_mes: null },
            )
          }
          onChange={(ano, mes) => setRascunho({ prazo_ano: ano, prazo_mes: mes })}
        />

        <Button
          className="mt-4 w-full"
          onClick={() => {
            onSalvar(rascunho)
            onOpenChange(false)
          }}
        >
          Salvar
        </Button>
      </SheetContent>
    </Sheet>
  )
}
