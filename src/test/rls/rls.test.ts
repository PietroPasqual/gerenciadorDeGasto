import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { TABELAS_DO_USUARIO, conectarAdmin, conectarComo } from './cliente'
import { USUARIO_A, USUARIO_B, montarCenario, type Ids } from './cenario'

/**
 * A prova de que um usuário não enxerga o dado de outro.
 *
 * Antes desta suíte, a garantia de privacidade inteira do app dependia de
 * policies que só tinham sido lidas. "Parece certo" não é garantia sobre dinheiro
 * de outra pessoa.
 *
 * O teste roda como o papel `authenticated`, que não é dono de nenhuma tabela e
 * não tem bypassrls — ver supabase/testes/auth-shim.sql. É isso que faz o
 * resultado significar alguma coisa: como `postgres`, tudo passaria mesmo sem
 * policy nenhuma.
 */
let admin: Client
let comoA: Client
let comoB: Client
let idsA: Ids
let idsB: Ids

beforeAll(async () => {
  admin = await conectarAdmin()
  const cenario = await montarCenario(admin)
  idsA = cenario.a
  idsB = cenario.b
  comoA = await conectarComo(USUARIO_A)
  comoB = await conectarComo(USUARIO_B)
}, 30_000)

afterAll(async () => {
  await Promise.all([admin?.end(), comoA?.end(), comoB?.end()])
})

describe('o papel de teste não pode ignorar RLS', () => {
  it('não é superusuário, não tem bypassrls e não é dono das tabelas', async () => {
    // Se esta asserção cair, TODO o resto da suíte passa sem provar nada.
    const papel = await comoA.query(
      `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    )
    expect(papel.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })

    const donas = await admin.query(
      `select count(*)::int as n from pg_tables
        where schemaname='public' and tableowner = 'authenticated'`,
    )
    expect(donas.rows[0].n).toBe(0)
  })

  it('toda tabela de usuário tem RLS ligada', async () => {
    const r = await admin.query(
      `select tablename from pg_tables t
        where schemaname='public'
          and tablename = any($1)
          and not exists (
            select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
             where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity
          )`,
      [[...TABELAS_DO_USUARIO]],
    )
    expect(r.rows.map((x) => x.tablename)).toEqual([])
  })
})

describe('leitura: A não enxerga nada de B', () => {
  it.each([...TABELAS_DO_USUARIO])('%s — listagem só traz as próprias linhas', async (tabela) => {
    const r = await comoA.query(`select user_id from public.${tabela}`)
    expect(r.rows.length).toBeGreaterThan(0)
    for (const linha of r.rows) expect(linha.user_id).toBe(USUARIO_A)
  })

  it.each([...TABELAS_DO_USUARIO])('%s — buscar pelo id de B devolve zero linhas', async (tabela) => {
    // Listar filtrado é fácil de acertar; pedir a linha pelo id é o caminho que
    // um bug de policy deixaria passar.
    const r = await comoA.query(`select id from public.${tabela} where id = $1`, [idsB[tabela]])
    expect(r.rowCount).toBe(0)
  })

  it('o texto secreto de B nunca aparece para A', async () => {
    const r = await comoA.query(`select descricao from public.transactions`)
    const textos = r.rows.map((x) => x.descricao as string)
    expect(textos.some((t) => t.includes(USUARIO_B))).toBe(false)
    expect(textos.some((t) => t.includes(USUARIO_A))).toBe(true)
  })
})

describe('escrita: A não altera nem apaga nada de B', () => {
  /**
   * Cada tentativa de escrita roda numa transação desfeita no fim.
   *
   * Não é zelo: sem isso, uma policy quebrada faz o delete FUNCIONAR, a linha
   * de B some, e os testes seguintes passam porque não há mais nada para vazar.
   * Foi exatamente o que aconteceu ao exercitar o controle negativo — a suíte
   * relatou 7 falhas quando havia 8. Um teste que apaga o que o próximo iria
   * conferir é pior que teste nenhum, porque parece cobertura.
   */
  const tentarDesfazendo = async <T>(acao: () => Promise<T>): Promise<T> => {
    await comoA.query('begin')
    try {
      return await acao()
    } finally {
      await comoA.query('rollback')
    }
  }

  it.each([...TABELAS_DO_USUARIO])('%s — update na linha de B não afeta nenhuma', async (tabela) => {
    const r = await tentarDesfazendo(() =>
      comoA.query(`update public.${tabela} set user_id = user_id where id = $1`, [idsB[tabela]]),
    )
    expect(r.rowCount).toBe(0)
  })

  it.each([...TABELAS_DO_USUARIO])('%s — delete na linha de B não apaga nada', async (tabela) => {
    const r = await tentarDesfazendo(() =>
      comoA.query(`delete from public.${tabela} where id = $1`, [idsB[tabela]]),
    )
    expect(r.rowCount).toBe(0)
    // E a linha continua lá, vista pelo dono.
    const ainda = await comoB.query(`select id from public.${tabela} where id = $1`, [idsB[tabela]])
    expect(ainda.rowCount).toBe(1)
  })

  it('A não consegue roubar uma linha própria para B nem o contrário', async () => {
    // O `with check` da policy é o que impede reatribuir dono.
    await comoA.query('begin')
    await expect(
      comoA.query(`update public.transactions set user_id = $1 where id = $2`, [
        USUARIO_B,
        idsA.transactions,
      ]),
    ).rejects.toThrow()
    await comoA.query('rollback')
  })
})

describe('insert: não dá para gravar em nome de outro', () => {
  it('insert com o user_id de B é recusado', async () => {
    await expect(
      comoA.query(
        `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo)
         values ($1,'2025-08-11','forjado',999,'gasto')`,
        [USUARIO_B],
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('insert com o próprio user_id funciona — a policy não bloqueia o dono', async () => {
    // Sem esta asserção, uma policy que negasse TUDO passaria na suíte inteira.
    const r = await comoA.query(
      `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo)
       values ($1,'2025-08-12','legítimo',100,'gasto') returning id`,
      [USUARIO_A],
    )
    expect(r.rowCount).toBe(1)
    await comoA.query(`delete from public.transactions where id = $1`, [r.rows[0].id])
  })
})

describe('agregados: as funções não vazam nada', () => {
  const chamadas: Array<[string, string]> = [
    ['resumo_mensal', 'select * from public.resumo_mensal(2025, 8)'],
    ['gastos_por_categoria', 'select * from public.gastos_por_categoria(2025, 8)'],
    ['saidas_por_forma_pagamento', 'select * from public.saidas_por_forma_pagamento(2025, 8)'],
    ['comparativo_anual', 'select * from public.comparativo_anual(2025)'],
    ['resumo_metas', 'select * from public.resumo_metas(2025)'],
    ['investimentos_por_meta', 'select * from public.investimentos_por_meta(2025, 8)'],
    ['faturas_do_mes', 'select * from public.faturas_do_mes(2025, 8)'],
  ]

  it.each(chamadas)('%s: A e B veem o mesmo TAMANHO, cada um com os próprios ids', async (_n, sql) => {
    const [ra, rb] = await Promise.all([comoA.query(sql), comoB.query(sql)])

    // Os dois têm dados idênticos em valor. Ver o DOBRO de linhas é o sintoma
    // direto de vazamento; comparar o JSON inteiro seria errado, porque os ids
    // são legitimamente diferentes.
    expect(ra.rows.length).toBe(rb.rows.length)

    // E nenhum id que aparece para A pode aparecer para B — se aparecesse,
    // alguém estaria lendo a linha do outro.
    const idsEm = (linhas: Array<Record<string, unknown>>) =>
      new Set(
        linhas.flatMap((l) =>
          Object.entries(l)
            .filter(([k, v]) => k.endsWith('_id') && typeof v === 'string')
            .map(([, v]) => v as string),
        ),
      )
    const deA = idsEm(ra.rows)
    const deB = idsEm(rb.rows)
    for (const id of deA) expect(deB.has(id), `id ${id} apareceu para os dois`).toBe(false)
  })

  it('carregar_mes de A não contém nada de B', async () => {
    const r = await comoA.query('select public.carregar_mes(2025, 8) as j')
    const texto = JSON.stringify(r.rows[0].j)
    expect(texto).not.toContain(USUARIO_B)
    expect(texto).toContain(USUARIO_A)
  })

  it('carregar_mes traz exatamente 1 lançamento para cada um, não 2', async () => {
    for (const [cliente, quem] of [
      [comoA, 'A'],
      [comoB, 'B'],
    ] as const) {
      const r = await cliente.query('select public.carregar_mes(2025, 8) as j')
      expect(r.rows[0].j.lancamentos, `usuário ${quem}`).toHaveLength(1)
    }
  })

  it('nenhuma função de agregado é SECURITY DEFINER', async () => {
    // DEFINER faria a função rodar como dona das tabelas, ignorando RLS — e
    // devolvendo o mês de qualquer um para qualquer um.
    const r = await admin.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and p.proname = any($1)`,
      [
        [
          'resumo_mensal',
          'gastos_por_categoria',
          'saidas_por_forma_pagamento',
          'comparativo_anual',
          'resumo_metas',
          'investimentos_por_meta',
          'faturas_do_mes',
          'carregar_mes',
        ],
      ],
    )
    expect(r.rows.map((x) => x.proname)).toEqual([])
  })
})

describe('sem sessão, ninguém vê nada', () => {
  it('conexão sem JWT devolve zero linhas em todas as tabelas', async () => {
    const anonimo = await conectarComo(null)
    try {
      for (const tabela of TABELAS_DO_USUARIO) {
        const r = await anonimo.query(`select id from public.${tabela}`)
        expect(r.rowCount, tabela).toBe(0)
      }
    } finally {
      await anonimo.end()
    }
  })
})
