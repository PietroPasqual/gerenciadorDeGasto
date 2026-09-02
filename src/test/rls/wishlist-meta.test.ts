import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { conectarAdmin, conectarComo } from './cliente'
import { USUARIO_A, USUARIO_B, montarCenario } from './cenario'

/**
 * A ligação entre um desejo e uma meta (0021).
 *
 * A chave estrangeira sozinha NÃO resolve: a checagem de FK do Postgres não
 * passa pela RLS, então um cliente que adivinhasse o uuid de uma meta alheia
 * conseguiria apontar o próprio desejo para ela. Isto prova que o trigger
 * fecha esse caminho — e, tão importante quanto, que ele não atrapalha o uso
 * legítimo.
 */
let admin: Client
let comoA: Client
let comoB: Client
let metaA: string
let metaB: string
let desejoA: string

beforeAll(async () => {
  admin = await conectarAdmin()
  const cenario = await montarCenario(admin)
  metaA = cenario.a.goals
  metaB = cenario.b.goals
  desejoA = cenario.a.wishlist_items
  comoA = await conectarComo(USUARIO_A)
  comoB = await conectarComo(USUARIO_B)
}, 30_000)

afterAll(async () => {
  await Promise.all([admin?.end(), comoA?.end(), comoB?.end()])
})

describe('desejo ligado a meta', () => {
  it('aponta para a própria meta sem reclamar', async () => {
    await comoA.query('update public.wishlist_items set goal_id = $1 where id = $2', [metaA, desejoA])
    const r = await comoA.query('select goal_id from public.wishlist_items where id = $1', [desejoA])
    expect(r.rows[0].goal_id).toBe(metaA)
  })

  it('desligar volta para "quero comprar"', async () => {
    await comoA.query('update public.wishlist_items set goal_id = null where id = $1', [desejoA])
    const r = await comoA.query('select goal_id from public.wishlist_items where id = $1', [desejoA])
    expect(r.rows[0].goal_id).toBeNull()
  })

  it('não aponta para a meta de outra pessoa, mesmo sabendo o uuid dela', async () => {
    await expect(
      comoA.query('update public.wishlist_items set goal_id = $1 where id = $2', [metaB, desejoA]),
    ).rejects.toThrow(/precisa ser sua/)
  })

  it('nem ao criar o desejo já apontando para a meta alheia', async () => {
    await expect(
      comoA.query(`insert into public.wishlist_items (user_id, nome, goal_id) values ($1, 'Fone', $2)`, [
        USUARIO_A,
        metaB,
      ]),
    ).rejects.toThrow(/precisa ser sua/)
  })

  it('apagar a meta não apaga o desejo — a vontade continua, o plano é que acabou', async () => {
    const meta = (
      await comoB.query(
        `insert into public.goals (user_id, nome, valor_meta_centavos, ordem)
         values ($1,'Viagem',500000,9) returning id`,
        [USUARIO_B],
      )
    ).rows[0].id as string
    const desejo = (
      await comoB.query(
        `insert into public.wishlist_items (user_id, nome, goal_id) values ($1,'Mala',$2) returning id`,
        [USUARIO_B, meta],
      )
    ).rows[0].id as string

    await comoB.query('delete from public.goals where id = $1', [meta])

    const r = await comoB.query('select goal_id from public.wishlist_items where id = $1', [desejo])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].goal_id).toBeNull()
  })

  it('o desejo do outro continua invisível, ligado ou não', async () => {
    const r = await comoA.query('select count(*)::int as n from public.wishlist_items where user_id = $1', [
      USUARIO_B,
    ])
    expect(r.rows[0].n).toBe(0)
  })
})
