import { describe, expect, it } from 'vitest'
import {
  agruparPorChave,
  calcularCaixaDoMes,
  calcularPercentualInvestido,
  calcularPercentualLimite,
  calcularResumoMensal,
  calcularSaldo,
  estaVigente,
  mediaMensal,
  nivelDoLimite,
  progressoDaMeta,
  progressoWishlist,
  totalDeItens,
} from './calculations'

const item = (valor_centavos: number, extra: Record<string, unknown> = {}) => ({ valor_centavos, ...extra })

describe('calcularSaldo', () => {
  it('subtrai saídas das entradas', () => {
    expect(calcularSaldo(500_000, 320_000)).toBe(180_000)
  })

  it('fica negativo quando gasta mais do que entra', () => {
    expect(calcularSaldo(100_000, 150_000)).toBe(-50_000)
  })

  it('trabalha em centavos inteiros, sem erro de ponto flutuante', () => {
    // 0,10 + 0,20 em centavos: 10 + 20 = 30, e não 30.000000000000004
    expect(calcularSaldo(10 + 20, 0)).toBe(30)
  })
})

describe('calcularPercentualInvestido', () => {
  it('calcula o percentual sobre as entradas', () => {
    expect(calcularPercentualInvestido(50_000, 500_000)).toBe(10)
  })

  it('arredonda com duas casas', () => {
    expect(calcularPercentualInvestido(33_333, 100_000)).toBe(33.33)
  })

  it('devolve 0 quando não houve entrada (evita divisão por zero)', () => {
    expect(calcularPercentualInvestido(20_000, 0)).toBe(0)
  })
})

describe('calcularPercentualLimite', () => {
  it('calcula o quanto do limite já foi usado', () => {
    expect(calcularPercentualLimite(40_000, 50_000)).toBe(80)
  })

  it('passa de 100% quando estoura', () => {
    expect(calcularPercentualLimite(75_000, 50_000)).toBe(150)
  })

  it('devolve 0 para categoria sem limite', () => {
    expect(calcularPercentualLimite(40_000, null)).toBe(0)
    expect(calcularPercentualLimite(40_000, 0)).toBe(0)
  })
})

describe('nivelDoLimite', () => {
  it('verde abaixo de 80%', () => {
    expect(nivelDoLimite(39_999, 50_000)).toBe('ok')
  })

  it('amarelo a partir de 80% e até 100%', () => {
    expect(nivelDoLimite(40_000, 50_000)).toBe('atencao')
    expect(nivelDoLimite(50_000, 50_000)).toBe('atencao')
  })

  it('vermelho ao passar do limite', () => {
    expect(nivelDoLimite(50_001, 50_000)).toBe('estourado')
  })

  it('sem limite é sempre ok', () => {
    expect(nivelDoLimite(999_999, null)).toBe('ok')
  })
})

describe('totalDeItens e agruparPorChave', () => {
  it('soma uma lista de lançamentos', () => {
    expect(totalDeItens([item(1_050), item(2_500), item(725)])).toBe(4_275)
  })

  it('soma lista vazia como zero', () => {
    expect(totalDeItens([])).toBe(0)
  })

  it('agrupa por categoria somando os valores', () => {
    const lancamentos = [
      item(1_000, { category_id: 'mercado' }),
      item(2_500, { category_id: 'mercado' }),
      item(4_000, { category_id: 'lazer' }),
    ] as Array<{ valor_centavos: number; category_id: string }>

    expect(agruparPorChave(lancamentos, (l) => l.category_id)).toEqual({
      mercado: 3_500,
      lazer: 4_000,
    })
  })

  it('joga itens sem categoria no bucket padrão', () => {
    const lancamentos = [item(1_000, { category_id: null })] as Array<{
      valor_centavos: number
      category_id: string | null
    }>
    expect(agruparPorChave(lancamentos, (l) => l.category_id)).toEqual({ 'sem-classificacao': 1_000 })
  })
})

describe('calcularResumoMensal', () => {
  const base = {
    entradasAvulsas: [item(300_000), item(50_000)], // salário + freela
    entradasLancamentos: [item(10_000)], // entrada lançada como transação
    gastos: [item(25_000), item(13_550)],
    gastosFixos: [item(120_000), item(9_990)],
    investimentos: [item(40_000)],
  }

  it('soma entradas de incomes e de transactions', () => {
    expect(calcularResumoMensal(base).totalEntradas).toBe(360_000)
  })

  it('inclui os gastos fixos nas saídas', () => {
    expect(calcularResumoMensal(base).totalSaidas).toBe(168_540)
  })

  it('calcula saldo e percentual investido juntos', () => {
    const resumo = calcularResumoMensal(base)
    expect(resumo.saldo).toBe(360_000 - 168_540)
    expect(resumo.totalInvestido).toBe(40_000)
    expect(resumo.percentualInvestido).toBe(11.11)
  })

  it('zera tudo quando o mês está vazio', () => {
    expect(
      calcularResumoMensal({
        entradasAvulsas: [],
        entradasLancamentos: [],
        gastos: [],
        gastosFixos: [],
        investimentos: [],
      }),
    ).toEqual({
      totalEntradas: 0,
      totalSaidas: 0,
      saldo: 0,
      totalInvestido: 0,
      percentualInvestido: 0,
    })
  })
})

describe('progressoDaMeta', () => {
  it('devolve o percentual limitado a 100 para a barra', () => {
    expect(progressoDaMeta(150_000, 100_000)).toEqual({ percentual: 100, bruto: 150 })
  })

  it('calcula progresso parcial', () => {
    expect(progressoDaMeta(25_000, 100_000)).toEqual({ percentual: 25, bruto: 25 })
  })

  it('protege meta sem valor-alvo', () => {
    expect(progressoDaMeta(25_000, 0)).toEqual({ percentual: 0, bruto: 0 })
  })
})

describe('progressoWishlist', () => {
  it('conta cumpridas, pendentes e percentual', () => {
    expect(
      progressoWishlist([
        { concluido: true },
        { concluido: false },
        { concluido: true },
        { concluido: false },
      ]),
    ).toEqual({ cumpridas: 2, pendentes: 2, percentual: 50 })
  })

  it('lista vazia não quebra', () => {
    expect(progressoWishlist([])).toEqual({ cumpridas: 0, pendentes: 0, percentual: 0 })
  })
})

describe('mediaMensal', () => {
  it('ignora meses sem movimento', () => {
    expect(mediaMensal([300_000, 0, 100_000, 0])).toBe(200_000)
  })

  it('devolve 0 quando o ano inteiro está zerado', () => {
    expect(mediaMensal([0, 0, 0])).toBe(0)
  })
})

describe('estaVigente', () => {
  const janela = (ia: number | null, im: number | null, fa: number | null, fm: number | null) => ({
    inicio_ano: ia,
    inicio_mes: im,
    fim_ano: fa,
    fim_mes: fm,
  })

  it('sem vigência informada, vale em qualquer mês', () => {
    expect(estaVigente(janela(null, null, null, null), 2020, 1)).toBe(true)
    expect(estaVigente(janela(null, null, null, null), 2099, 12)).toBe(true)
  })

  it('a linha que ainda não passou pela migration 0005 continua valendo', () => {
    // Sem os campos (undefined, não null) o comportamento tem que ser o de
    // antes — e não sumir das saídas.
    expect(estaVigente({} as never, 2026, 3)).toBe(true)
  })

  it('não vale antes do início', () => {
    const v = janela(2026, 8, null, null)
    expect(estaVigente(v, 2026, 7)).toBe(false)
    expect(estaVigente(v, 2026, 8)).toBe(true)
    expect(estaVigente(v, 2026, 9)).toBe(true)
    expect(estaVigente(v, 2025, 12)).toBe(false)
    expect(estaVigente(v, 2027, 1)).toBe(true)
  })

  it('não vale depois do fim', () => {
    const v = janela(null, null, 2026, 6)
    expect(estaVigente(v, 2026, 6)).toBe(true)
    expect(estaVigente(v, 2026, 7)).toBe(false)
    expect(estaVigente(v, 2027, 1)).toBe(false)
  })

  it('janela fechada inclui as duas pontas', () => {
    const v = janela(2026, 2, 2026, 6)
    expect(estaVigente(v, 2026, 1)).toBe(false)
    expect(estaVigente(v, 2026, 2)).toBe(true)
    expect(estaVigente(v, 2026, 6)).toBe(true)
    expect(estaVigente(v, 2026, 7)).toBe(false)
  })

  it('a virada de ano não confunde a comparação', () => {
    const v = janela(2026, 11, 2027, 2)
    expect(estaVigente(v, 2026, 10)).toBe(false)
    expect(estaVigente(v, 2026, 12)).toBe(true)
    expect(estaVigente(v, 2027, 2)).toBe(true)
    expect(estaVigente(v, 2027, 3)).toBe(false)
    // mês maior num ano anterior não pode "ganhar" de um mês menor no ano seguinte
    expect(estaVigente(janela(2027, 1, null, null), 2026, 12)).toBe(false)
  })
})

describe('calcularCaixaDoMes — competência x caixa', () => {
  const cartao = {
    id: 'cartao',
    dia_fechamento: 20,
    fatura_inicio_ano: 2025,
    fatura_inicio_mes: 1,
  }
  const pix = { id: 'pix', dia_fechamento: null, fatura_inicio_ano: null, fatura_inicio_mes: null }
  const formas = [cartao, pix]

  it('sem cartão com fatura, caixa e competência são o mesmo número', () => {
    const gastos = [
      { data: '2025-08-05', valor_centavos: 5000, payment_method_id: 'pix' },
      { data: '2025-08-19', valor_centavos: 3000, payment_method_id: null },
    ]
    const caixa = calcularCaixaDoMes({ gastos, formasPagamento: formas, gastosFixos: [], faturas: [] })
    expect(caixa.totalSaidasCaixa).toBe(8000)
    expect(caixa.adiadoParaFatura).toBe(0)
  })

  it('gasto no crédito sai do mês e vira dinheiro adiado', () => {
    const gastos = [
      { data: '2025-08-05', valor_centavos: 5000, payment_method_id: 'pix' },
      { data: '2025-08-10', valor_centavos: 9000, payment_method_id: 'cartao' },
    ]
    const caixa = calcularCaixaDoMes({ gastos, formasPagamento: formas, gastosFixos: [], faturas: [] })
    expect(caixa.totalSaidasCaixa).toBe(5000)
    expect(caixa.adiadoParaFatura).toBe(9000)
  })

  it('a fatura que vence agora entra no caixa, mesmo sendo de compras antigas', () => {
    const caixa = calcularCaixaDoMes({
      gastos: [{ data: '2025-08-05', valor_centavos: 5000, payment_method_id: 'pix' }],
      formasPagamento: formas,
      gastosFixos: [],
      faturas: [{ total_centavos: 12000 }],
    })
    expect(caixa.totalSaidasCaixa).toBe(17000)
    expect(caixa.totalFaturas).toBe(12000)
  })

  it('gasto anterior à vigência continua pesando no mês da compra', () => {
    // A vigência começa em 2025-01; uma compra de dezembro/2024 no mesmo
    // cartão mantém o comportamento antigo. É a regra 8 na prática.
    const caixa = calcularCaixaDoMes({
      gastos: [{ data: '2024-12-10', valor_centavos: 7000, payment_method_id: 'cartao' }],
      formasPagamento: formas,
      gastosFixos: [],
      faturas: [],
    })
    expect(caixa.totalSaidasCaixa).toBe(7000)
    expect(caixa.adiadoParaFatura).toBe(0)
  })

  it('cartão com dia de fechamento mas sem vigência não tem fatura nenhuma', () => {
    const semVigencia = [
      { id: 'cartao', dia_fechamento: 20, fatura_inicio_ano: null, fatura_inicio_mes: null },
    ]
    const caixa = calcularCaixaDoMes({
      gastos: [{ data: '2025-08-10', valor_centavos: 9000, payment_method_id: 'cartao' }],
      formasPagamento: semVigencia,
      gastosFixos: [],
      faturas: [],
    })
    expect(caixa.totalSaidasCaixa).toBe(9000)
  })

  it('os fixos entram no caixa como sempre entraram', () => {
    const caixa = calcularCaixaDoMes({
      gastos: [],
      formasPagamento: formas,
      gastosFixos: [{ valor_centavos: 180000 }],
      faturas: [],
    })
    expect(caixa.totalSaidasCaixa).toBe(180000)
  })

  it('nada some: o gasto ou pesa neste mês ou é adiado, nunca os dois nem nenhum', () => {
    const gastos = [
      { data: '2025-08-05', valor_centavos: 5000, payment_method_id: 'pix' },
      { data: '2025-08-10', valor_centavos: 9000, payment_method_id: 'cartao' },
      { data: '2025-08-25', valor_centavos: 1234, payment_method_id: 'cartao' },
      { data: '2025-08-30', valor_centavos: 777, payment_method_id: null },
    ]
    const caixa = calcularCaixaDoMes({ gastos, formasPagamento: formas, gastosFixos: [], faturas: [] })
    const total = gastos.reduce((s, g) => s + g.valor_centavos, 0)
    expect(caixa.totalSaidasCaixa + caixa.adiadoParaFatura).toBe(total)
  })
})

describe('entrada recorrente no resumo', () => {
  it('sem nenhuma recorrente, o total é idêntico ao de antes da 0012', () => {
    const base = {
      entradasAvulsas: [{ valor_centavos: 300_000 }],
      entradasLancamentos: [{ valor_centavos: 50_000 }],
      gastos: [{ valor_centavos: 25_000 }],
      gastosFixos: [{ valor_centavos: 120_000 }],
      investimentos: [],
    }
    const semCampo = calcularResumoMensal(base)
    const comListaVazia = calcularResumoMensal({ ...base, entradasRecorrentes: [] })
    expect(semCampo).toEqual(comListaVazia)
    expect(semCampo.totalEntradas).toBe(350_000)
  })

  it('a recorrente vigente soma nas entradas e muda o saldo', () => {
    const resumo = calcularResumoMensal({
      entradasAvulsas: [],
      entradasLancamentos: [],
      entradasRecorrentes: [{ valor_centavos: 550_000 }],
      gastos: [{ valor_centavos: 25_000 }],
      gastosFixos: [],
      investimentos: [],
    })
    expect(resumo.totalEntradas).toBe(550_000)
    expect(resumo.saldo).toBe(525_000)
  })

  it('quem filtra pela vigência é o chamador — estaVigente decide o mês', () => {
    // Salário antigo até maio, novo de junho: a mesma regra dos gastos fixos.
    const antigo = { inicio_ano: null, inicio_mes: null, fim_ano: 2025, fim_mes: 5 }
    const novo = { inicio_ano: 2025, inicio_mes: 6, fim_ano: null, fim_mes: null }

    expect(estaVigente(antigo, 2025, 5)).toBe(true)
    expect(estaVigente(antigo, 2025, 6)).toBe(false)
    expect(estaVigente(novo, 2025, 5)).toBe(false)
    expect(estaVigente(novo, 2025, 6)).toBe(true)

    // Em nenhum mês do ano os dois valem ao mesmo tempo, nem os dois faltam:
    // é o que garante que a troca de emprego não duplica nem some.
    for (let mes = 1; mes <= 12; mes++) {
      const quantos = [antigo, novo].filter((v) => estaVigente(v, 2025, mes)).length
      expect(quantos, `mês ${mes}`).toBe(1)
    }
  })
})
