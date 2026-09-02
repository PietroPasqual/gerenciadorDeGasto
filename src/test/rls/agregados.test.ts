import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { conectarAdmin, conectarComo } from './cliente'
import { USUARIO_A, USUARIO_B, montarCenario } from './cenario'

/**
 * Os agregados anuais, contra um Postgres de verdade.
 *
 * Duas coisas se provam aqui, e nenhuma delas dá para provar em jsdom:
 *
 * 1. O agregado obedece a RLS. Uma função que soma dinheiro é o lugar mais
 *    fácil de vazar o saldo de outra pessoa sem vazar nenhuma linha dela —
 *    basta um `security definer` distraído.
 * 2. A versão anual concorda com a mensal. São a mesma pergunta em dois
 *    recortes, e se elas divergirem o app passa a se contradizer sobre o mesmo
 *    dinheiro, do jeito que a 0016 registra ter acontecido antes.
 *
 * A PROVA DE QUE O `security invoker` NÃO É DECORAÇÃO
 *
 * Medido, não suposto. Apaguei o filtro explícito de `user_id` da função e
 * rodei esta suíte duas vezes:
 *
 *   security definer -> "só devolve o dinheiro de quem chamou" FALHA: A passa
 *                       a somar o dinheiro de B, porque a função roda como
 *                       dona das tabelas e a RLS não se aplica ao dono.
 *   security invoker -> o mesmo teste PASSA. A policy barra as linhas de B
 *                       antes de a soma acontecer.
 *
 * Ou seja: a RLS é uma segunda camada de verdade aqui, e o `security invoker`
 * é o que a mantém ligada. As outras três falhas nesse experimento são
 * estruturais (a função sabotada não trazia fixos nem nome de categoria).
 */
let admin: Client
let comoA: Client
let comoB: Client
let catA: string
let catB: string

/** 2025: fevereiro e março com gasto, mais um fixo vigente a partir de março. */
async function semearAno(u: string, categoria: string, valorBase: number) {
  const forma = (await admin.query('select id from public.payment_methods where user_id=$1 limit 1', [u]))
    .rows[0].id as string

  for (const [data, valor] of [
    ['2025-02-10', valorBase],
    ['2025-02-20', valorBase],
    ['2025-03-05', valorBase * 2],
  ] as const) {
    await admin.query(
      `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo, category_id, payment_method_id)
       values ($1,$2,'Compra',$3,'gasto',$4,$5)`,
      [u, data, valor, categoria, forma],
    )
  }

  // Sem categoria: é o que sobra de um extrato importado.
  await admin.query(
    `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo, category_id)
     values ($1,'2025-04-01','Extrato',7777,'gasto',null)`,
    [u],
  )

  // Fixo vigente de março em diante — não existe em janeiro nem em fevereiro.
  await admin.query(
    `insert into public.fixed_expenses
       (user_id, nome, valor_centavos, dia_vencimento, category_id, ativo, inicio_ano, inicio_mes)
     values ($1,'Aluguel',$2,5,$3,true,2025,3)`,
    [u, valorBase * 10, categoria],
  )
}

beforeAll(async () => {
  admin = await conectarAdmin()
  await montarCenario(admin)
  catA = (
    await admin.query('select id from public.categories where user_id=$1 order by ordem limit 1', [USUARIO_A])
  ).rows[0].id as string
  catB = (
    await admin.query('select id from public.categories where user_id=$1 order by ordem limit 1', [USUARIO_B])
  ).rows[0].id as string

  await semearAno(USUARIO_A, catA, 1000)
  // Valores diferentes de propósito: se A enxergar B, o número muda.
  await semearAno(USUARIO_B, catB, 9000)

  comoA = await conectarComo(USUARIO_A)
  comoB = await conectarComo(USUARIO_B)
}, 30_000)

afterAll(async () => {
  await Promise.all([admin?.end(), comoA?.end(), comoB?.end()])
})

async function anoDe(cliente: Client) {
  const r = await cliente.query('select * from public.gastos_por_categoria_ano($1)', [2025])
  return r.rows as Array<{
    mes: number
    category_id: string | null
    nome: string
    cor: string
    gasto_centavos: number
  }>
}

describe('gastos_por_categoria_ano', () => {
  it('só devolve o dinheiro de quem chamou', async () => {
    const deA = await anoDe(comoA)
    const deB = await anoDe(comoB)

    // Fevereiro de A: duas compras de R$ 10,00.
    const fevA = deA.find((l) => l.mes === 2 && l.category_id === catA)
    expect(fevA?.gasto_centavos).toBe(2000)

    // O mesmo mês de B tem outro número, e A não enxerga a categoria de B.
    const fevB = deB.find((l) => l.mes === 2 && l.category_id === catB)
    expect(fevB?.gasto_centavos).toBe(18000)
    expect(deA.some((l) => l.category_id === catB)).toBe(false)
    expect(deB.some((l) => l.category_id === catA)).toBe(false)
  })

  it('sem sessão não devolve linha nenhuma', async () => {
    const anonimo = await conectarComo(null)
    try {
      expect(await anoDe(anonimo)).toEqual([])
    } finally {
      await anonimo.end()
    }
  })

  it('concorda com a versão mensal, mês a mês — é a mesma pergunta', async () => {
    const ano = await anoDe(comoA)
    for (let mes = 1; mes <= 12; mes++) {
      const mensal = await comoA.query('select * from public.gastos_por_categoria($1, $2)', [2025, mes])
      const doMes = new Map(ano.filter((l) => l.mes === mes).map((l) => [l.category_id, l.gasto_centavos]))

      for (const linha of mensal.rows as Array<{ category_id: string | null; gasto_centavos: number }>) {
        // A mensal devolve categoria zerada; a anual omite. Zero e ausente
        // dizem a mesma coisa, e é a única diferença permitida entre as duas.
        const anual = doMes.get(linha.category_id) ?? 0
        expect(anual, `mês ${mes}, categoria ${linha.category_id}`).toBe(linha.gasto_centavos)
      }
      // E nada aparece na anual que a mensal não conheça.
      for (const [categoria, valor] of doMes) {
        const naMensal = (mensal.rows as Array<{ category_id: string | null; gasto_centavos: number }>).find(
          (l) => l.category_id === categoria,
        )
        expect(naMensal?.gasto_centavos, `mês ${mes}, categoria ${categoria}`).toBe(valor)
      }
    }
  })

  it('o gasto fixo entra nos meses em que ele vale, e só neles', async () => {
    const ano = await anoDe(comoA)
    const daCategoria = (mes: number) =>
      ano.find((l) => l.mes === mes && l.category_id === catA)?.gasto_centavos ?? 0

    // Janeiro: nada. O fixo começa em março.
    expect(daCategoria(1)).toBe(0)
    // Fevereiro: só as duas compras.
    expect(daCategoria(2)).toBe(2000)
    // Março: a compra de R$ 20,00 mais o aluguel de R$ 100,00.
    expect(daCategoria(3)).toBe(2000 + 10000)
    // Dezembro: só o aluguel, que continua vigente.
    expect(daCategoria(12)).toBe(10000)
  })

  it('o que não tem categoria vira a linha sintética, como na mensal', async () => {
    const ano = await anoDe(comoA)
    const semCategoria = (mes: number) =>
      ano.find((l) => l.mes === mes && l.category_id === null)?.gasto_centavos ?? 0

    const abril = ano.find((l) => l.mes === 4 && l.category_id === null)
    expect(abril?.nome).toBe('Sem categoria')
    expect(abril?.cor).toBe('#94a3b8')

    // O cenário compartilhado já traz um fixo sem categoria, vigente o ano
    // todo. Comparar abril com janeiro isola o que ESTE teste plantou, em vez
    // de fixar um número que muda junto com o cenário de outra suíte.
    expect(semCategoria(4) - semCategoria(1)).toBe(7777)
  })

  it('mês sem movimento não devolve linha zerada', async () => {
    const ano = await anoDe(comoA)
    expect(ano.some((l) => l.gasto_centavos === 0)).toBe(false)
  })

  it('entrada não entra em gasto', async () => {
    await admin.query(
      `insert into public.transactions (user_id, data, descricao, valor_centavos, tipo, category_id)
       values ($1,'2025-02-15','Salário',999999,'entrada',$2)`,
      [USUARIO_A, catA],
    )
    const ano = await anoDe(comoA)
    expect(ano.find((l) => l.mes === 2 && l.category_id === catA)?.gasto_centavos).toBe(2000)
  })
})
