import { Client, types } from 'pg'

/**
 * Fazer o `pg` devolver o que o PostgREST devolveria.
 *
 * Por padrão o driver converte `date` para um Date do JS e `bigint` para
 * string; o app, que fala com o PostgREST, recebe `"2025-08-10"` e um número.
 * Sem estes dois ajustes o teste exercita formas que o app nunca vê — e foi
 * assim que a checagem de duplicata do backup passou a não achar duplicata
 * nenhuma, por comparar um Date com uma string.
 */
types.setTypeParser(types.builtins.DATE, (v) => v)
types.setTypeParser(types.builtins.INT8, (v) => Number(v))

/**
 * Conexão com o Postgres de teste, no papel de um usuário logado.
 *
 * O `set role authenticated` é o coração do arquivo: sem ele a conexão seria
 * `postgres`, dona das tabelas, e o Postgres ignora RLS para o dono. Um teste
 * assim passaria com TODAS as policies apagadas — provaria nada.
 *
 * `request.jwt.claim.sub` é a mesma variável que o PostgREST preenche a partir
 * do JWT, e é de onde `auth.uid()` lê.
 */
export const PORTA = Number(process.env.PGTESTE_PORTA ?? 5433)

export async function conectarComo(userId: string | null): Promise<Client> {
  const cliente = new Client({
    host: process.env.PGTESTE_HOST ?? '/tmp',
    port: PORTA,
    user: 'postgres',
    database: 'finz',
  })
  await cliente.connect()
  await cliente.query('set role authenticated')
  // `set_config` com literal seria injeção; parametrizado é seguro e é como o
  // PostgREST faz.
  await cliente.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userId ?? ''])
  return cliente
}

/** Conexão administrativa (dona das tabelas) — só para montar o cenário. */
export async function conectarAdmin(): Promise<Client> {
  const cliente = new Client({
    host: process.env.PGTESTE_HOST ?? '/tmp',
    port: PORTA,
    user: 'postgres',
    database: 'finz',
  })
  await cliente.connect()
  return cliente
}

/** As tabelas com dado de usuário — a lista que o teste varre uma a uma. */
export const TABELAS_DO_USUARIO = [
  'payment_methods',
  'categories',
  'goals',
  'goal_contributions',
  'wishlist_items',
  'incomes',
  'fixed_expenses',
  'fixed_expense_payments',
  'transactions',
  'investments',
  'invoice_payments',
  'recurring_incomes',
  'category_rules',
] as const
