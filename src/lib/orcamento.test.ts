import { describe, expect, it } from 'vitest'
import { diasRestantesDoMes, situacaoDoOrcamento } from './orcamento'

const HOJE = new Date(2026, 7, 18) // 18 de agosto de 2026 (o mês corrente aqui)

describe('diasRestantesDoMes', () => {
  it('inclui hoje: dia 18 de um mês de 31 deixa 14 dias', () => {
    // Quem pergunta "quanto posso gastar por dia" pergunta a partir de agora,
    // e hoje ainda não acabou.
    expect(diasRestantesDoMes(2026, 8, HOJE)).toBe(14)
  })

  it('no último dia do mês sobra 1, não 0', () => {
    expect(diasRestantesDoMes(2026, 8, new Date(2026, 7, 31))).toBe(1)
  })

  it('no dia 1 sobra o mês inteiro', () => {
    expect(diasRestantesDoMes(2026, 8, new Date(2026, 7, 1))).toBe(31)
  })

  it('mês futuro devolve o mês inteiro; mês passado, zero', () => {
    expect(diasRestantesDoMes(2026, 12, HOJE)).toBe(31)
    expect(diasRestantesDoMes(2026, 2, HOJE)).toBe(0)
    expect(diasRestantesDoMes(2025, 8, HOJE)).toBe(0)
  })

  it('conhece fevereiro, inclusive bissexto', () => {
    expect(diasRestantesDoMes(2028, 2, HOJE)).toBe(29)
    expect(diasRestantesDoMes(2027, 2, HOJE)).toBe(28)
  })
})

describe('situacaoDoOrcamento', () => {
  const base = { ano: 2026, mes: 8, hoje: HOJE }

  it('o caso do dia 18: teto de 3.000, gastei 1.600, sobram 100/dia', () => {
    const s = situacaoDoOrcamento({ ...base, tetoCentavos: 300_000, gastoCentavos: 160_000 })
    expect(s.restanteCentavos).toBe(140_000)
    expect(s.diasRestantes).toBe(14)
    expect(s.porDiaCentavos).toBe(10_000)
    expect(s.estourou).toBe(false)
  })

  it('trunca para baixo: seguir o valor à risca não pode estourar o mês', () => {
    // 1.000 restantes em 3 dias = 333,33...; arredondando para cima daria
    // 333,34 x 3 = 1.000,02 — dois centavos além do teto.
    const s = situacaoDoOrcamento({
      ...base,
      tetoCentavos: 100_000,
      gastoCentavos: 0,
      hoje: new Date(2026, 7, 29),
    })
    expect(s.diasRestantes).toBe(3)
    expect(s.porDiaCentavos).toBe(33_333)
    expect((s.porDiaCentavos as number) * s.diasRestantes).toBeLessThanOrEqual(s.restanteCentavos)
  })

  it('estourou: o restante fica negativo e o por-dia some', () => {
    // "R$ -12,00 por dia" seria pior do que não dizer nada.
    const s = situacaoDoOrcamento({ ...base, tetoCentavos: 100_000, gastoCentavos: 130_000 })
    expect(s.restanteCentavos).toBe(-30_000)
    expect(s.estourou).toBe(true)
    expect(s.porDiaCentavos).toBeNull()
  })

  it('a barra trava em 100 mas o número cru continua verdadeiro', () => {
    const s = situacaoDoOrcamento({ ...base, tetoCentavos: 100_000, gastoCentavos: 130_000 })
    expect(s.percentual).toBe(100)
    expect(s.percentualBruto).toBe(130)
  })

  it('sem teto definido não divide por zero nem inventa percentual', () => {
    const s = situacaoDoOrcamento({ ...base, tetoCentavos: 0, gastoCentavos: 50_000 })
    expect(s.percentual).toBe(0)
    expect(s.percentualBruto).toBe(0)
    expect(s.estourou).toBe(true)
  })

  it('num mês já encerrado o por-dia não divide por zero — e nem aparece', () => {
    // `diasRestantes` continua em 1 para nenhuma conta dividir por zero, mas o
    // por-dia some: num mês fechado ele seria uma frase sem sentido.
    const s = situacaoDoOrcamento({
      ano: 2026,
      mes: 2,
      hoje: HOJE,
      tetoCentavos: 100_000,
      gastoCentavos: 40_000,
    })
    expect(s.diasRestantes).toBe(1)
    expect(s.porDiaCentavos).toBeNull()
    expect(s.restanteCentavos).toBe(60_000)
  })

  it('gasto zerado devolve o teto inteiro distribuído', () => {
    const s = situacaoDoOrcamento({ ...base, tetoCentavos: 280_000, gastoCentavos: 0 })
    expect(s.porDiaCentavos).toBe(20_000)
    expect(s.percentual).toBe(0)
  })

  it('tudo em centavos inteiros — nenhum float escapa', () => {
    for (const teto of [100_001, 99_999, 7, 1]) {
      const s = situacaoDoOrcamento({ ...base, tetoCentavos: teto, gastoCentavos: 3 })
      expect(Number.isInteger(s.restanteCentavos)).toBe(true)
      if (s.porDiaCentavos !== null) expect(Number.isInteger(s.porDiaCentavos)).toBe(true)
    }
  })
})

describe('mês já encerrado', () => {
  const passado = { ano: 2026, mes: 2, hoje: HOJE }

  it('não mostra "por dia" num mês que já acabou', () => {
    // A validação em navegador pegou "R$ 436,66 por dia · para 1 dia" num mês
    // passado: frase sem sentido para quem só quer conferir o que gastou.
    const s = situacaoDoOrcamento({ ...passado, tetoCentavos: 300_000, gastoCentavos: 256_334 })
    expect(s.mesEncerrado).toBe(true)
    expect(s.porDiaCentavos).toBeNull()
    // O restante continua verdadeiro: é ele que a tela mostra no lugar.
    expect(s.restanteCentavos).toBe(43_666)
  })

  it('o mês corrente continua com "por dia"', () => {
    const s = situacaoDoOrcamento({
      ano: 2026,
      mes: 8,
      hoje: HOJE,
      tetoCentavos: 300_000,
      gastoCentavos: 160_000,
    })
    expect(s.mesEncerrado).toBe(false)
    expect(s.porDiaCentavos).toBe(10_000)
  })

  it('mês futuro também tem "por dia" — ele ainda vai acontecer', () => {
    const s = situacaoDoOrcamento({ ano: 2026, mes: 12, hoje: HOJE, tetoCentavos: 310_000, gastoCentavos: 0 })
    expect(s.mesEncerrado).toBe(false)
    expect(s.porDiaCentavos).toBe(10_000)
  })
})
