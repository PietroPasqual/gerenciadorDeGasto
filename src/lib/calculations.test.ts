import { describe, expect, it } from 'vitest'
import {
  agruparPorChave,
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
      progressoWishlist([{ concluido: true }, { concluido: false }, { concluido: true }, { concluido: false }]),
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
