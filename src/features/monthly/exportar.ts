import { baixarCSV, csvMoeda, gerarCSV, type LinhaCSV } from '@/lib/csv'
import { formatDataISO, nomeDoMes } from '@/lib/dates'
import type { DadosMes } from './use-controle-mensal'

/** Exporta o mês inteiro (entradas, gastos fixos, gastos e investimentos) em um CSV. */
export function exportarMesCSV(ano: number, mes: number, dados: DadosMes) {
  const nomeForma = (id: string | null) => dados.formasPagamento.find((f) => f.id === id)?.nome ?? ''
  const nomeCategoria = (id: string | null) => dados.categorias.find((c) => c.id === id)?.nome ?? ''
  const nomeMeta = (id: string | null) => dados.metas.find((m) => m.id === id)?.nome ?? ''
  const pago = (id: string) =>
    dados.pagamentos.find((p) => p.fixed_expense_id === id)?.pago ? 'Sim' : 'Não'

  const linhas: LinhaCSV[] = [
    ...dados.entradas.map((e) => ['Entrada', formatDataISO(`${ano}-${String(mes).padStart(2, '0')}-01`), e.descricao, '', '', csvMoeda(e.valor_centavos), '']),
    ...dados.gastosFixos.map((g) => [
      'Gasto fixo',
      g.dia_vencimento ? `dia ${g.dia_vencimento}` : '',
      g.nome,
      nomeForma(g.payment_method_id),
      nomeCategoria(g.category_id),
      csvMoeda(g.valor_centavos),
      pago(g.id),
    ]),
    ...dados.lancamentos.map((l) => [
      l.tipo === 'gasto' ? 'Gasto' : 'Entrada avulsa',
      formatDataISO(l.data),
      l.descricao,
      nomeForma(l.payment_method_id),
      nomeCategoria(l.category_id),
      csvMoeda(l.valor_centavos),
      '',
    ]),
    ...dados.aportes.map((a) => ['Investimento', '', nomeMeta(a.goal_id), '', '', csvMoeda(a.valor_centavos), '']),
    ...dados.investimentos.map((i) => ['Investimento', '', i.descricao, '', '', csvMoeda(i.valor_centavos), '']),
  ]

  const conteudo = gerarCSV(
    ['Tipo', 'Data', 'Descrição', 'Forma de pagamento', 'Categoria', 'Valor (R$)', 'Pago?'],
    linhas,
  )
  baixarCSV(`gastos-${ano}-${String(mes).padStart(2, '0')}-${nomeDoMes(mes).toLowerCase()}.csv`, conteudo)
}
