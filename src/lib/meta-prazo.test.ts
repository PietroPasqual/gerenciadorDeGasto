import { describe, expect, it } from 'vitest'
import { formatCentavos } from './money'
import {
  MESES_MINIMOS_DE_RITMO,
  projecaoDaMeta,
  ritmoMensal,
  temPrazo,
  textoDoPrazo,
  textoDoRitmo,
} from './meta-prazo'

/** 15 de agosto de 2025: cinco meses decorridos além do corrente. */
const HOJE = new Date('2025-08-15T12:00:00')

/** Doze meses, com os valores informados a partir de janeiro. */
function aportes(...valores: number[]): number[] {
  return Array.from({ length: 12 }, (_, i) => valores[i] ?? 0)
}

const projetar = (
  meta: { valor_meta_centavos: number; prazo_ano: number | null; prazo_mes: number | null },
  guardadoTotal: number,
  aportesDoAno = aportes(),
  anoDosAportes = 2025,
) => projecaoDaMeta({ meta, guardadoTotal, aportesDoAno, anoDosAportes, hoje: HOJE })

describe('temPrazo', () => {
  it('exige os dois campos, como a 0019', () => {
    expect(temPrazo({ prazo_ano: 2026, prazo_mes: 3 })).toBe(true)
    expect(temPrazo({ prazo_ano: null, prazo_mes: null })).toBe(false)
    expect(temPrazo({ prazo_ano: 2026, prazo_mes: null })).toBe(false)
  })

  it('coluna AUSENTE é o mesmo que sem prazo', () => {
    // Enquanto a 0019 não rodar, o Supabase devolve a linha sem as colunas.
    // Com um teste estrito, `undefined` passava por prazo e a tela escrevia
    // "Até /defined" em toda meta — o E2E pegou isso.
    const semColunas = {} as { prazo_ano: number | null; prazo_mes: number | null }
    expect(temPrazo(semColunas)).toBe(false)
    expect(
      projecaoDaMeta({
        meta: { ...semColunas, valor_meta_centavos: 1000000 },
        guardadoTotal: 0,
        aportesDoAno: aportes(),
        anoDosAportes: 2025,
        hoje: HOJE,
      }),
    ).toBeNull()
  })
})

describe('ritmoMensal', () => {
  it('cala com menos de três meses decorridos', () => {
    expect(MESES_MINIMOS_DE_RITMO).toBe(3)
    expect(ritmoMensal(aportes(50000, 50000), 2)).toBeNull()
  })

  it('cala quando não foi guardado nada', () => {
    expect(ritmoMensal(aportes(), 8)).toBeNull()
  })

  it('conta os meses vazios, e é isso que faz o número honesto', () => {
    // Guardou R$ 500 uma vez em março e mais nada até agosto: o ritmo é
    // 500/8, não 500. Contar só o mês com aporte diria "R$ 500 por mês".
    expect(ritmoMensal(aportes(0, 0, 50000), 8)).toBe(6250)
  })

  it('não olha para o futuro do ano', () => {
    // Dezembro ainda não aconteceu em agosto; incluí-lo inventaria aporte.
    expect(ritmoMensal(aportes(0, 0, 0, 0, 0, 0, 0, 80000, 0, 0, 0, 999999), 8)).toBe(10000)
  })
})

describe('projecaoDaMeta', () => {
  it('meta sem prazo continua exatamente como antes (regra 8)', () => {
    expect(projetar({ valor_meta_centavos: 1000000, prazo_ano: null, prazo_mes: null }, 0)).toBeNull()
  })

  it('divide o que falta pelos meses que restam', () => {
    // R$ 4.200 faltando, prazo em fevereiro de 2026: ago..fev = 7 meses.
    const p = projetar({ valor_meta_centavos: 1000000, prazo_ano: 2026, prazo_mes: 2 }, 580000)
    expect(p?.mesesRestantes).toBe(7)
    expect(p?.faltaCentavos).toBe(420000)
    expect(p?.porMes).toBe(60000)
    expect(textoDoPrazo(p!, { ano: 2026, mes: 2 })).toBe(
      `Faltam ${formatCentavos(420000)} em 7 meses — ${formatCentavos(60000)} por mês.`,
    )
  })

  it('arredonda para cima: o valor exato deixaria faltar centavo', () => {
    const p = projetar({ valor_meta_centavos: 100, prazo_ano: 2025, prazo_mes: 10 }, 0)
    // R$ 1,00 em 3 meses dá 33,33 centavos por mês; 33 três vezes dá 99.
    expect(p?.porMes).toBe(34)
  })

  it('o mês do prazo conta, e sozinho vira "neste mês"', () => {
    const p = projetar({ valor_meta_centavos: 100000, prazo_ano: 2025, prazo_mes: 8 }, 40000)
    expect(p?.mesesRestantes).toBe(1)
    expect(p?.prazoVencido).toBe(false)
    expect(textoDoPrazo(p!, { ano: 2025, mes: 8 })).toBe(
      `Faltam ${formatCentavos(60000)} neste mês — ${formatCentavos(60000)} por mês.`,
    )
  })

  it('prazo vencido é fato, não cobrança', () => {
    const p = projetar({ valor_meta_centavos: 100000, prazo_ano: 2025, prazo_mes: 3 }, 40000)
    expect(p?.prazoVencido).toBe(true)
    expect(p?.porMes).toBeNull()
    const texto = textoDoPrazo(p!, { ano: 2025, mes: 3 })
    expect(texto).toBe(`O prazo era mar/25. Faltam ${formatCentavos(60000)}.`)
    // A régua do observacoes.ts: nenhuma frase diz o que a pessoa deveria fazer.
    expect(texto).not.toMatch(/deveria|precisa|tente|guarde|atrasad/i)
  })

  it('meta alcançada não pede mais nada', () => {
    const p = projetar({ valor_meta_centavos: 100000, prazo_ano: 2026, prazo_mes: 1 }, 120000)
    expect(p?.concluida).toBe(true)
    expect(p?.faltaCentavos).toBe(0)
    expect(p?.porMes).toBeNull()
    expect(textoDoPrazo(p!, { ano: 2026, mes: 1 })).toBe('Meta alcançada. O prazo era jan/26.')
    expect(textoDoRitmo(p!)).toBeNull()
  })

  it('o ritmo diz quando a meta fecha, e se anuncia como ritmo', () => {
    // R$ 800 por mês guardados nos oito meses; faltam R$ 4.000 = 5 meses.
    const p = projetar(
      { valor_meta_centavos: 1000000, prazo_ano: 2026, prazo_mes: 6 },
      600000,
      aportes(80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000),
    )
    expect(p?.ritmoMensal).toBe(80000)
    expect(p?.chegaEm).toEqual({ ano: 2025, mes: 12 })
    expect(p?.chegaNoPrazo).toBe(true)
    expect(textoDoRitmo(p!)).toBe(`No ritmo deste ano (${formatCentavos(80000)} por mês), chega em dez/25.`)
  })

  it('o ritmo que não chega diz isso sem adjetivo', () => {
    const p = projetar(
      { valor_meta_centavos: 1000000, prazo_ano: 2025, prazo_mes: 12 },
      100000,
      aportes(10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000),
    )
    expect(p?.ritmoMensal).toBe(10000)
    expect(p?.chegaNoPrazo).toBe(false)
    const texto = textoDoRitmo(p!)
    expect(texto).toMatch(/^No ritmo deste ano/)
    expect(texto).not.toMatch(/deveria|precisa|atrasad|nunca/i)
  })

  it('cala sobre o ritmo quando a base é pequena', () => {
    const p = projetar({ valor_meta_centavos: 1000000, prazo_ano: 2026, prazo_mes: 6 }, 0)
    expect(p?.ritmoMensal).toBeNull()
    expect(p?.chegaNoPrazo).toBeNull()
    expect(textoDoRitmo(p!)).toBeNull()
    // A parte aritmética continua: ela não depende de histórico. E o valor é
    // inteiro em centavos — R$ 10.000 em 11 meses não dá conta redonda, e é
    // aqui que um float entraria no app se fosse entrar.
    expect(p?.porMes).toBe(90910)
    expect(Number.isInteger(p?.porMes)).toBe(true)
  })

  it('aportes de outro ano não viram "ritmo atual"', () => {
    const p = projetar(
      { valor_meta_centavos: 1000000, prazo_ano: 2026, prazo_mes: 6 },
      600000,
      aportes(80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000),
      2024,
    )
    expect(p?.ritmoMensal).toBeNull()
    expect(textoDoRitmo(p!)).toBeNull()
  })

  it('nenhuma frase inventa número que a tela não mostre', () => {
    const p = projetar({ valor_meta_centavos: 1000000, prazo_ano: 2026, prazo_mes: 2 }, 580000)
    // Todo valor citado é formatCentavos de um campo da própria projeção.
    expect(textoDoPrazo(p!, { ano: 2026, mes: 2 })).toContain(formatCentavos(p!.faltaCentavos))
  })
})
