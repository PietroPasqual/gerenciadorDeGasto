import { supabase } from '@/lib/supabase'
import { traduzErro, userIdAtual } from './base'

/**
 * Apagar os dados do usuário.
 *
 * Isto não tem desfazer. Toda a proteção mora antes: a tela conta o que existe
 * e mostra os números, exige que a palavra APAGAR seja digitada, e só então
 * libera o botão. Nada aqui pede confirmação — quando esta função roda, a
 * decisão já foi tomada.
 */

/** O que existe hoje, para a tela poder dizer exatamente o que some. */
export type Contagem = {
  lancamentos: number
  entradas: number
  gastosFixos: number
  investimentos: number
  aportes: number
  metas: number
  desejos: number
  categorias: number
  formasPagamento: number
}

async function contar(tabela: string, user_id: string): Promise<number> {
  const { count, error } = await supabase
    .from(tabela)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
  if (error) throw traduzErro(error, `Não foi possível contar ${tabela}.`)
  return count ?? 0
}

export async function contarDados(): Promise<Contagem> {
  const user_id = await userIdAtual()
  const [
    lancamentos,
    entradas,
    gastosFixos,
    investimentos,
    aportes,
    metas,
    desejos,
    categorias,
    formasPagamento,
  ] = await Promise.all([
    contar('transactions', user_id),
    contar('incomes', user_id),
    contar('fixed_expenses', user_id),
    contar('investments', user_id),
    contar('goal_contributions', user_id),
    contar('goals', user_id),
    contar('wishlist_items', user_id),
    contar('categories', user_id),
    contar('payment_methods', user_id),
  ])
  return {
    lancamentos,
    entradas,
    gastosFixos,
    investimentos,
    aportes,
    metas,
    desejos,
    categorias,
    formasPagamento,
  }
}

/**
 * A movimentação: o que você lança mês a mês.
 *
 * A ordem importa. `fixed_expense_payments` e `goal_contributions` apontam para
 * `fixed_expenses` e `goals` com ON DELETE CASCADE, então some junto — mas
 * apagar explicitamente antes deixa a intenção no código, em vez de depender
 * de um detalhe do esquema que alguém pode mudar depois.
 */
const TABELAS_MOVIMENTO = [
  'fixed_expense_payments',
  'goal_contributions',
  'investments',
  'transactions',
  'incomes',
  'fixed_expenses',
] as const

/**
 * O catálogo: o que você configura uma vez. Metas e lista de desejos entram
 * aqui porque são cadastro, não movimento do mês.
 */
const TABELAS_CATALOGO = ['wishlist_items', 'goals', 'categories', 'payment_methods'] as const

async function apagarTabela(tabela: string, user_id: string): Promise<void> {
  const { error } = await supabase.from(tabela).delete().eq('user_id', user_id)
  if (error) throw traduzErro(error, `Não foi possível apagar ${tabela}.`)
}

/**
 * Apaga os dados do usuário logado.
 *
 * O filtro é sempre `user_id = <o seu>`: mesmo que a RLS já garanta isso do
 * lado do banco, um delete sem filtro é a linha de código mais perigosa que
 * existe num app assim, e ela não vai existir aqui.
 *
 * O perfil e a conta NÃO são tocados: isto limpa os dados, não encerra a
 * conta.
 */
export async function apagarDados({ incluirCatalogo }: { incluirCatalogo: boolean }): Promise<void> {
  const user_id = await userIdAtual()
  for (const tabela of TABELAS_MOVIMENTO) await apagarTabela(tabela, user_id)
  if (incluirCatalogo) {
    for (const tabela of TABELAS_CATALOGO) await apagarTabela(tabela, user_id)
  }
}
