import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { Total } from '@/components/common/linha-planilha'

export interface LinhaFormaPagamento {
  id: string
  nome: string
  gasto_centavos: number
}

/** Total gasto em cada forma de pagamento (Dinheiro, Pix, Débito, Boleto, Crédito…). */
export function PainelFormasPagamento({ formas }: { formas: LinhaFormaPagamento[] }) {
  const total = formas.reduce((soma, f) => soma + f.gasto_centavos, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Saídas por forma de pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {formas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma forma de pagamento" descricao="Cadastre suas formas em Configurações." />
        ) : (
          <ul className="divide-y divide-border">
            {formas.map((forma) => (
              <li key={forma.id} className="flex items-center justify-between py-2 text-sm">
                <span>{forma.nome}</span>
                <span className="tabular font-medium">{formatCentavos(forma.gasto_centavos)}</span>
              </li>
            ))}
          </ul>
        )}
        <Total rotulo="Total de saídas" valor={formatCentavos(total)} />
      </CardContent>
    </Card>
  )
}
