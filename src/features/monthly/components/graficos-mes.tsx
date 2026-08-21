import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Donut, type FatiaDonut } from '@/components/common/donut'

/** Os três donuts do mês: forma de pagamento, metas e categorias. */
export function GraficosMes({
  porFormaPagamento,
  porMeta,
  porCategoria,
}: {
  porFormaPagamento: FatiaDonut[]
  porMeta: FatiaDonut[]
  porCategoria: FatiaDonut[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <CardGrafico titulo="Saídas por forma de pagamento" dados={porFormaPagamento} />
      <CardGrafico titulo="Investimentos por meta" dados={porMeta} vazio="Nenhum aporte neste mês." />
      <CardGrafico titulo="Gastos por categoria" dados={porCategoria} />
    </div>
  )
}

function CardGrafico({ titulo, dados, vazio }: { titulo: string; dados: FatiaDonut[]; vazio?: string }) {
  return (
    // min-w-0: a legenda tem nomes com `truncate` (nowrap), e sem isto o
    // mínimo automático do item de grade cresce até caber "Cartão de crédito"
    // inteiro — a coluna estica e o card fica mais largo que a tela.
    <Card className="min-w-0">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <Donut dados={dados} titulo="Sem dados" vazioTexto={vazio} />
      </CardContent>
    </Card>
  )
}
