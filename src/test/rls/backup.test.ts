import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { conectarAdmin, conectarComo } from './cliente'
import { USUARIO_A, USUARIO_B, montarCenario } from './cenario'
import { randomUUID } from 'node:crypto'
import {
  TABELAS_BACKUP,
  aplicarRemapa,
  montarBackup,
  prepararRestauracao,
  type Linha,
  type Remapa,
  type TabelaBackup,
} from '@/lib/backup'

/**
 * A viagem de ida e volta, contra um Postgres de verdade.
 *
 * Os testes puros de `src/lib/backup.test.ts` provam a DECISÃO — o que entra e
 * o que fica de fora. Só não provam as duas coisas que dependem do banco:
 *
 * 1. A ORDEM DAS TABELAS. `goal_contributions` aponta para `goals`; inserir na
 *    ordem errada é violação de chave estrangeira no meio da restauração, com
 *    metade dos dados dentro. Nenhum teste em memória sente isso.
 * 2. Que restaurar DE VERDADE duas vezes não duplica. O plano diz que não vai
 *    duplicar; o índice único é quem decide.
 *
 * A restauração aqui roda como `authenticated`, sob RLS — é assim que ela roda
 * no app, e um teste que rodasse como dono das tabelas não provaria nada.
 */

let admin: Client
let comoA: Client
let comoB: Client

beforeAll(async () => {
  admin = await conectarAdmin()
  await montarCenario(admin)
  comoA = await conectarComo(USUARIO_A)
  comoB = await conectarComo(USUARIO_B)
})

afterAll(async () => {
  await Promise.all([admin?.end(), comoA?.end(), comoB?.end()])
})

/** O que `obterBackupCompleto` faz, na mesma ordem das tabelas. */
async function exportar(cliente: Client): Promise<Partial<Record<TabelaBackup, Linha[]>>> {
  const dados: Partial<Record<TabelaBackup, Linha[]>> = {}
  for (const tabela of TABELAS_BACKUP) {
    const r = await cliente.query(`select * from public.${tabela}`)
    dados[tabela] = r.rows as Linha[]
  }
  return dados
}

/**
 * O que `restaurar` faz, com as mesmas duas passadas do serviço.
 *
 * A segunda passada é o ponto do teste: os ids do arquivo já existem neste
 * banco (são os da conta A), a RLS os esconde de B, e sem o remapa o
 * `on conflict do nothing` engoliria tudo em silêncio.
 */
async function gravar(cliente: Client, plano: ReturnType<typeof prepararRestauracao>) {
  const mapa: Remapa = new Map()
  let gravadas = 0
  let renomeadas = 0

  const inserir = async (tabela: string, linha: Linha) => {
    const colunas = Object.keys(linha)
    const valores = colunas.map((c) => linha[c])
    const marcadores = colunas.map((_, i) => `$${i + 1}`).join(',')
    const r = await cliente.query(
      `insert into public.${tabela} (${colunas.map((c) => `"${c}"`).join(',')})
       values (${marcadores}) on conflict (id) do nothing returning id`,
      valores,
    )
    return (r.rowCount ?? 0) > 0
  }

  for (const item of plano.itens) {
    for (const bruta of item.linhas) {
      const linha = aplicarRemapa(bruta, item.tabela, mapa)
      if (await inserir(item.tabela, linha)) {
        gravadas += 1
        continue
      }
      const novo = randomUUID()
      mapa.set(String(linha.id), novo)
      if (await inserir(item.tabela, { ...linha, id: novo })) {
        gravadas += 1
        renomeadas += 1
      }
    }
  }
  return { gravadas, renomeadas }
}

const contar = async (cliente: Client) => {
  const saida: Record<string, number> = {}
  for (const t of TABELAS_BACKUP) {
    const r = await cliente.query(`select count(*)::int as n from public.${t}`)
    saida[t] = r.rows[0].n as number
  }
  return saida
}

describe('backup de ida e volta', () => {
  it('o backup de A entra inteiro em B, com as chaves estrangeiras de pé', async () => {
    const dadosDeA = await exportar(comoA)
    const backup = montarBackup(dadosDeA)

    // B começa com o que o trigger da 0004 semeou (categorias e formas).
    const antes = await contar(comoB)

    const plano = prepararRestauracao({
      backup,
      existentes: await exportar(comoB),
      userId: USUARIO_B,
    })
    const { gravadas, renomeadas } = await gravar(comoB, plano)

    expect(gravadas).toBe(plano.totalEntram)
    expect(gravadas).toBeGreaterThan(0)
    // Todas colidiram: os ids do arquivo são os da conta A, que vive neste
    // mesmo banco. É exatamente o caso que a primeira versão gravava a zero.
    expect(renomeadas).toBe(gravadas)

    const depois = await contar(comoB)
    for (const t of TABELAS_BACKUP) {
      expect(depois[t], `${t} não recebeu o que o plano prometeu`).toBe(
        antes[t] + (plano.itens.find((i) => i.tabela === t)?.entram ?? 0),
      )
    }
  })

  it('as linhas restauradas pertencem a B, nunca a A', async () => {
    // A RLS recusaria a linha com dono errado, mas a garantia tem de estar no
    // plano: é ele que troca o user_id antes de a escrita sair.
    for (const t of TABELAS_BACKUP) {
      const r = await comoB.query(`select count(*)::int as n from public.${t} where user_id <> $1`, [
        USUARIO_B,
      ])
      expect(r.rows[0].n, `${t} tem linha de outro dono visível para B`).toBe(0)
    }
  })

  it('restaurar o MESMO arquivo de novo não grava nada', async () => {
    const backup = montarBackup(await exportar(comoA))
    const plano = prepararRestauracao({
      backup,
      existentes: await exportar(comoB),
      userId: USUARIO_B,
    })
    expect(plano.totalEntram).toBe(0)
    expect((await gravar(comoB, plano)).gravadas).toBe(0)
  })

  it('a ordem do plano sobrevive a uma inserção real com chave estrangeira', () => {
    // Documenta a razão de TABELAS_BACKUP existir nesta ordem. O teste real da
    // consequência é o de baixo, que tenta gravar de fato na ordem errada.
    const pos = (t: string) => TABELAS_BACKUP.indexOf(t as never)
    expect(pos('goals')).toBeLessThan(pos('goal_contributions'))
  })

  it('gravar na ordem inversa estoura na chave estrangeira', async () => {
    // Uma meta que ninguém tem e um aporte apontando para ela: o aporte só
    // pode entrar depois. É o que a ordem de TABELAS_BACKUP garante, e o que
    // nenhum teste em memória consegue ver.
    const idDaMeta = randomUUID()
    const invertido = {
      itens: [
        {
          tabela: 'goal_contributions' as const,
          rotulo: 'Aportes em metas',
          noArquivo: 1,
          entram: 1,
          jaExistem: 0,
          linhas: [
            {
              id: randomUUID(),
              user_id: USUARIO_B,
              goal_id: idDaMeta,
              ano: 2031,
              mes: 4,
              valor_centavos: 1000,
            },
          ],
        },
        {
          tabela: 'goals' as const,
          rotulo: 'Metas',
          noArquivo: 1,
          entram: 1,
          jaExistem: 0,
          linhas: [
            { id: idDaMeta, user_id: USUARIO_B, nome: 'Meta da ordem', valor_meta_centavos: 1, ordem: 99 },
          ],
        },
      ],
      totalEntram: 2,
      totalJaExistem: 0,
      descartadas: 0,
    }

    await comoB.query('begin')
    await expect(gravar(comoB, invertido)).rejects.toThrow(/violates foreign key/i)
    await comoB.query('rollback')
  })
})
