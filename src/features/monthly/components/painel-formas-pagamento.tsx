import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoVazio } from '@/components/common/estados'
import { formatCentavos } from '@/lib/money'
import { Total } from '@/components/common/linha-planilha'

export interface LinhaFormaPagamento {
  /** NULL na linha sintética "Sem forma de pagamento". */
  id: string | null
  nome: string
  gasto_centavos: number
}

/** Total gasto em cada forma de pagamento (Dinheiro, Pix, Débito, Boleto, Crédito…). */
export function PainelFormasPagamento({ formas }: { formas: LinhaFormaPagamento[] }) {
  const total = formas.reduce((soma, f) => soma + f.gasto_centavos, 0)

  /**
   * Forma sem movimento no mês não entra na lista.
   *
   * Mostrando todas, um mês pago inteiro por Pix virava cinco linhas de
   * R$ 0,00 — Dinheiro, Pix, Débito, Boleto, Crédito — e a única linha com
   * valor ficava embaixo delas, fora da primeira tela no celular. O painel de
   * categorias ao lado já fazia esse filtro; este ficou para trás.
   *
   * Diferente das categorias, aqui não há exceção por limite: forma de
   * pagamento não tem limite mensal, então zero é só zero.
   */
  const comMovimento = formas.filter((f) => f.gasto_centavos > 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Saídas por forma de pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {formas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma forma de pagamento"
            descricao="Cadastre suas formas em Configurações."
          />
        ) : comMovimento.length === 0 ? (
          <EstadoVazio
            titulo="Nada gasto ainda"
            descricao="Assim que você lançar um gasto, ele aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {comMovimento.map((forma) => (
              <li key={forma.id ?? 'sem-forma'} className="flex items-center justify-between py-2 text-sm">
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
