import type { Client } from 'pg'

export const USUARIO_A = '11111111-1111-1111-1111-111111111111'
export const USUARIO_B = '22222222-2222-2222-2222-222222222222'

/** Um id por tabela, para o teste tentar alcançar a linha do outro direto. */
export type Ids = Record<string, string>

/**
 * Monta dois usuários com dado em TODAS as tabelas.
 *
 * Roda como admin de propósito: montar o cenário não é o que está sendo
 * testado, e passar pelas policies aqui só tornaria a montagem frágil.
 */
export async function montarCenario(admin: Client): Promise<{ a: Ids; b: Ids }> {
  await admin.query('delete from auth.users')
  for (const id of [USUARIO_A, USUARIO_B]) {
    await admin.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, '{"nome":"Teste"}'::jsonb)`,
      [id, `${id.slice(0, 4)}@finz.local`],
    )
  }
  return { a: await semear(admin, USUARIO_A), b: await semear(admin, USUARIO_B) }
}

async function semear(admin: Client, u: string): Promise<Ids> {
  const ids: Ids = {}
  const um = async (sql: string, params: unknown[]) => {
    const r = await admin.query(sql, params)
    return r.rows[0].id as string
  }

  // O trigger da 0004 já criou categorias e formas de pagamento; usa as dele.
  const cat = (await admin.query('select id from public.categories where user_id=$1 limit 1', [u])).rows[0]
    .id as string
  const forma = (await admin.query('select id from public.payment_methods where user_id=$1 limit 1', [u]))
    .rows[0].id as string
  ids.categories = cat
  ids.payment_methods = forma

  ids.goals = await um(
    `insert into public.goals (user_id, nome, valor_meta_centavos, ordem)
     values ($1,'Reserva',1000000,1) returning id`,
    [u],
  )
  ids.goal_contributions = await um(
    `insert into public.goal_contributions (user_id, goal_id, ano, mes, valor_centavos)
     values ($1,$2,2025,8,50000) returning id`,
    [u, ids.goals],
  )
  ids.wishlist_items = await um(
    `insert into public.wishlist_items (user_id, nome) values ($1,'Fone') returning id`,
    [u],
  )
  ids.incomes = await um(
    `insert into public.incomes (user_id, ano, mes, descricao, valor_centavos)
     values ($1,2025,8,'Salário',500000) returning id`,
    [u],
  )
  ids.fixed_expenses = await um(
    `insert into public.fixed_expenses (user_id, nome, valor_centavos, ordem)
     values ($1,'Aluguel',180000,1) returning id`,
    [u],
  )
  ids.fixed_expense_payments = await um(
    `insert into public.fixed_expense_payments (user_id, fixed_expense_id, ano, mes, pago)
     values ($1,$2,2025,8,true) returning id`,
    [u, ids.fixed_expenses],
  )
  // A descrição carrega o id do dono para o teste conseguir provar, por texto,
  // que nada de um usuário aparece na tela do outro. Montada em JS porque o
  // mesmo parâmetro usado como uuid e como texto faz o Postgres recusar.
  ids.transactions = await um(
    `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo, category_id, payment_method_id)
     values ($1,'2025-08-10',$4,12345,'gasto',$2,$3) returning id`,
    [u, cat, forma, `SEGREDO DE ${u}`],
  )
  ids.investments = await um(
    `insert into public.investments (user_id, ano, mes, descricao, valor_centavos)
     values ($1,2025,8,'CDB',30000) returning id`,
    [u],
  )
  ids.invoice_payments = await um(
    `insert into public.invoice_payments (user_id, payment_method_id, ano, mes, pago)
     values ($1,$2,2025,8,true) returning id`,
    [u, forma],
  )
  ids.recurring_incomes = await um(
    `insert into public.recurring_incomes (user_id, descricao, valor_centavos, ordem)
     values ($1,'Salário',500000,1) returning id`,
    [u],
  )
  ids.category_rules = await um(
    `insert into public.category_rules (user_id, termo, category_id, exemplo)
     values ($1,'mercadoteste',$2,'MERCADO TESTE') returning id`,
    [u, cat],
  )
  return ids
}
