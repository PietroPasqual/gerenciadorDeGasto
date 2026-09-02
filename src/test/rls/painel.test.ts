import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { conectarAdmin, conectarComo } from './cliente'
import { USUARIO_A, USUARIO_B, montarCenario } from './cenario'

/**
 * As colunas de painel da 0023, contra Postgres de verdade.
 *
 * Duas coisas que só o banco pode provar:
 *
 * 1. **Isolamento.** `painel_ordem`, `painel_ocultos` e `painel_capa` entram
 *    numa tabela que já tinha policy, então a garantia é herdada — e "é
 *    herdada" é exatamente o tipo de afirmação que se escreve sem conferir.
 *    Uma coluna nova num `update` que a policy não cubra é vazamento de
 *    escrita, não de leitura, e não aparece em teste de tela nenhum.
 *
 * 2. **Os tetos de tamanho.** São campos que o CLIENTE escreve, e um array que
 *    cresce sem limite é vetor de abuso barato: mil widgets gravados no perfil
 *    de alguém não quebram a tela (a lista é filtrada pelos ids conhecidos),
 *    quebram a linha. O mesmo vale para a capa, que aceitaria um CSS inteiro
 *    sem o `length <= 32` — e ele volta para dentro de um `style` do painel.
 */
let admin: Client
let comoA: Client
let comoB: Client

beforeAll(async () => {
  admin = await conectarAdmin()
  await montarCenario(admin)
  comoA = await conectarComo(USUARIO_A)
  comoB = await conectarComo(USUARIO_B)
}, 30_000)

afterAll(async () => {
  await Promise.all([admin?.end(), comoA?.end(), comoB?.end()])
})

describe('painel_* respeita o dono', () => {
  it('nasce no padrão de fábrica, e o padrão é "nunca personalizei"', async () => {
    // Lista vazia é o que faz `widgetsVisiveis` devolver a ordem declarada
    // pelo app. Se o default fosse outra coisa, toda conta existente abriria
    // com o painel remontado.
    const r = await comoA.query(
      `select painel_ordem, painel_ocultos, painel_capa from profiles where id = $1`,
      [USUARIO_A],
    )
    expect(r.rows[0]).toEqual({ painel_ordem: [], painel_ocultos: [], painel_capa: 'aurora' })
  })

  it('cada um só vê e só escreve o próprio painel', async () => {
    await comoA.query(`update profiles set painel_capa = 'noite', painel_ordem = '{saldo}'`)

    // B não enxerga o painel de A...
    const oQueBVe = await comoB.query(`select painel_capa from profiles where id = $1`, [USUARIO_A])
    expect(oQueBVe.rowCount).toBe(0)

    // ...e um update sem WHERE, feito por B, não encosta na linha de A. É o
    // caso que importa: a policy é o único filtro, e um `update` que ela não
    // cobrisse alcançaria a tabela inteira.
    await comoB.query(`update profiles set painel_capa = 'brasa'`)
    const deA = await comoA.query(`select painel_capa from profiles where id = $1`, [USUARIO_A])
    expect(deA.rows[0].painel_capa).toBe('noite')
  })
})

describe('os tetos de tamanho seguram', () => {
  it('recusa uma ordem com mais de 40 widgets', async () => {
    const demais = Array.from({ length: 41 }, (_, i) => `w${i}`)
    await expect(
      comoA.query(`update profiles set painel_ordem = $1 where id = $2`, [demais, USUARIO_A]),
    ).rejects.toThrow(/painel_ordem_curta/)
  })

  it('recusa uma lista de escondidos com mais de 40', async () => {
    const demais = Array.from({ length: 41 }, (_, i) => `w${i}`)
    await expect(
      comoA.query(`update profiles set painel_ocultos = $1 where id = $2`, [demais, USUARIO_A]),
    ).rejects.toThrow(/painel_ocultos_curta/)
  })

  it('recusa uma capa que não é um nome curto', async () => {
    await expect(
      comoA.query(`update profiles set painel_capa = $1 where id = $2`, [
        'linear-gradient(135deg, red, blue, green, yellow, purple)',
        USUARIO_A,
      ]),
    ).rejects.toThrow(/painel_capa_curta/)
  })

  it('aceita o tamanho de uso real', async () => {
    // O teto existe para impedir megabytes, não para apertar o produto: os
    // quatro widgets de hoje têm folga de dez vezes.
    await expect(
      comoA.query(`update profiles set painel_ordem = $1, painel_capa = $2 where id = $3`, [
        ['categorias', 'observacoes', 'saldo', 'atalhos'],
        'sereno',
        USUARIO_A,
      ]),
    ).resolves.toBeDefined()
  })
})
