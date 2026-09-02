import { describe, expect, it } from 'vitest'
import {
  compararAnos,
  separarRealizadoPrevisto,
  tendenciaDeGastos,
  textoDaBase,
  type MesDoAno,
} from './comparativo'

/** 15 de abril de 2026: janeiro a abril já aconteceram. */
const HOJE = new Date('2026-04-15T12:00:00')

/** Um ano com os valores informados a partir de janeiro; o resto zerado. */
function ano(...pares: Array<[entradas: number, saidas: number]>): MesDoAno[] {
  return Array.from({ length: 12 }, (_, i) => {
    const [entradas, saidas] = pares[i] ?? [0, 0]
    return { mes: i + 1, entradas, saidas, diferenca: entradas - saidas }
  })
}

describe('separarRealizadoPrevisto', () => {
  const meses = ano([100, 50], [100, 60], [100, 70], [100, 80], [0, 30], [0, 30])

  it('abril já aconteceu; maio ainda não', () => {
    const r = separarRealizadoPrevisto(meses, 2026, HOJE)
    expect(r.realizados.map((m) => m.mes)).toEqual([1, 2, 3, 4])
    expect(r.previstos.map((m) => m.mes)).toEqual([5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('o total realizado não carrega os fixos de dezembro junto', () => {
    const r = separarRealizadoPrevisto(meses, 2026, HOJE)
    expect(r.totalRealizado).toEqual({ entradas: 400, saidas: 260 })
    expect(r.totalPrevisto).toEqual({ entradas: 0, saidas: 60 })
  })

  it('ano inteiramente passado não tem previsto nenhum', () => {
    const r = separarRealizadoPrevisto(ano([10, 5]), 2025, HOJE)
    expect(r.previstos).toEqual([])
  })

  it('ano inteiramente futuro não tem realizado nenhum', () => {
    const r = separarRealizadoPrevisto(ano([10, 5]), 2027, HOJE)
    expect(r.realizados).toEqual([])
  })
})

describe('compararAnos', () => {
  it('compara só os meses que existem dos DOIS lados', () => {
    const atual = ano([100, 50], [100, 60], [100, 70], [100, 80])
    const anterior = ano([80, 40], [80, 40], [80, 40], [80, 40], [80, 40], [80, 40])
    const c = compararAnos(atual, anterior, 2026, HOJE)
    // Quatro meses de cada lado, e não quatro contra doze.
    expect(c.mesesComuns).toEqual([1, 2, 3, 4])
    expect(c.saidasAtual).toBe(260)
    expect(c.saidasAnterior).toBe(160)
  })

  it('não conta o mês que ainda não chegou', () => {
    const atual = ano([100, 50], [100, 50], [100, 50], [100, 50], [0, 30])
    const anterior = ano([80, 40], [80, 40], [80, 40], [80, 40], [80, 40])
    expect(compararAnos(atual, anterior, 2026, HOJE).mesesComuns).toEqual([1, 2, 3, 4])
  })

  it('não conta o mês em que o app nem era usado no ano anterior', () => {
    const atual = ano([100, 50], [100, 50], [100, 50])
    // O ano anterior só tem movimento a partir de março.
    const anterior = ano([0, 0], [0, 0], [90, 45])
    const c = compararAnos(atual, anterior, 2026, HOJE)
    expect(c.mesesComuns).toEqual([3])
    expect(c.saidasAnterior).toBe(45)
  })

  it('a variação é percentual e arredondada a uma casa', () => {
    const atual = ano([100, 60])
    const anterior = ano([100, 50])
    const c = compararAnos(atual, anterior, 2026, HOJE)
    expect(c.variacaoSaidas).toBe(20)
    expect(c.variacaoEntradas).toBe(0)
  })

  it('gastar menos dá variação negativa', () => {
    const c = compararAnos(ano([100, 40]), ano([100, 50]), 2026, HOJE)
    expect(c.variacaoSaidas).toBe(-20)
  })

  it('sair de zero não é aumento infinito: é null, e a tela mostra reais', () => {
    // O mês entra na base (teve movimento nos dois), mas só a entrada existia
    // no ano anterior.
    const c = compararAnos(ano([100, 300]), ano([100, 0]), 2026, HOJE)
    expect(c.mesesComuns).toEqual([1])
    expect(c.variacaoSaidas).toBeNull()
    expect(c.saidasAtual).toBe(300)
  })

  it('sem ano anterior, diz que não tem — não devolve zeros', () => {
    const c = compararAnos(ano([100, 50]), [], 2026, HOJE)
    expect(c.impedimento).toBe('sem-ano-anterior')
    expect(c.mesesComuns).toEqual([])
  })

  it('sem nenhum mês em comum, diz isso — zero e "não dá" são coisas diferentes', () => {
    const atual = ano([100, 50])
    const anterior = ano([0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [90, 45])
    const c = compararAnos(atual, anterior, 2026, HOJE)
    expect(c.impedimento).toBe('sem-meses-comuns')
  })
})

describe('textoDaBase', () => {
  it('meses seguidos viram intervalo', () => {
    expect(textoDaBase([1, 2, 3, 4])).toBe('Jan–Abr')
  })

  it('um mês só é o próprio mês', () => {
    expect(textoDaBase([3])).toBe('Mar')
  })

  it('buraco no meio fica explícito — ele muda o que o número significa', () => {
    expect(textoDaBase([1, 3, 5])).toBe('Jan, Mar e Mai')
  })

  it('dois meses seguidos ainda são intervalo', () => {
    expect(textoDaBase([7, 8])).toBe('Jul–Ago')
  })

  it('a ordem de entrada não importa', () => {
    expect(textoDaBase([4, 2, 3])).toBe('Fev–Abr')
  })

  it('base vazia não escreve nada', () => {
    expect(textoDaBase([])).toBe('')
  })
})

describe('tendenciaDeGastos', () => {
  /** Dezembro de 2026: o ano inteiro já aconteceu. */
  const FIM = new Date('2026-12-20T12:00:00')

  it('sem seis meses de movimento não há tendência nenhuma', () => {
    const meses = ano([100, 50], [100, 50], [100, 50], [100, 50], [100, 50])
    expect(tendenciaDeGastos(meses, 2026, FIM)).toBeNull()
  })

  it('gasto crescente é "subindo", com a variação entre as duas janelas', () => {
    const meses = ano([100, 100], [100, 100], [100, 100], [100, 150], [100, 150], [100, 150])
    const t = tendenciaDeGastos(meses, 2026, FIM)
    expect(t?.direcao).toBe('subindo')
    expect(t?.variacao).toBe(50)
    expect(t?.mesesRecentes).toEqual([4, 5, 6])
    expect(t?.mesesAnteriores).toEqual([1, 2, 3])
  })

  it('gasto decrescente é "caindo"', () => {
    const meses = ano([100, 200], [100, 200], [100, 200], [100, 100], [100, 100], [100, 100])
    expect(tendenciaDeGastos(meses, 2026, FIM)?.direcao).toBe('caindo')
  })

  it('menos de 5% é ruído do mês, não tendência', () => {
    const meses = ano([100, 100], [100, 100], [100, 100], [100, 102], [100, 102], [100, 102])
    const t = tendenciaDeGastos(meses, 2026, FIM)
    expect(t?.direcao).toBe('estavel')
    expect(t?.variacao).toBe(2)
  })

  it('meses zerados no meio não entram — a janela é de meses com movimento', () => {
    const meses = ano([100, 100], [0, 0], [100, 100], [100, 100], [0, 0], [100, 200], [100, 200], [100, 200])
    const t = tendenciaDeGastos(meses, 2026, FIM)
    expect(t?.mesesAnteriores).toEqual([1, 3, 4])
    expect(t?.mesesRecentes).toEqual([6, 7, 8])
  })

  it('o mês que ainda não chegou fica de fora, mesmo com fixos lançados', () => {
    // Em abril de 2026, os fixos de maio a dezembro já aparecem no agregado.
    const meses = ano([100, 100], [100, 100], [100, 100], [100, 100], [0, 30], [0, 30], [0, 30], [0, 30])
    // Só quatro meses realizados: menos que as duas janelas de três.
    expect(tendenciaDeGastos(meses, 2026, HOJE)).toBeNull()
  })

  it('seis meses só de entrada não têm tendência de gasto para contar', () => {
    const meses = ano([100, 0], [100, 0], [100, 0], [100, 0], [100, 0], [100, 0])
    expect(tendenciaDeGastos(meses, 2026, FIM)).toBeNull()
  })
})
