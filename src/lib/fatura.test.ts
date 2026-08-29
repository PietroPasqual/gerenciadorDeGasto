import { describe, expect, it } from 'vitest'
import {
  diaNoMes,
  faturaDaCompra,
  faturaVigente,
  periodoDaFatura,
  ultimoDiaDoMes,
  vencimentoAdiado,
  vencimentoDaFatura,
} from './fatura'

describe('faturaDaCompra', () => {
  it('compra antes do fechamento vai para a fatura do mês seguinte', () => {
    // Fechamento dia 20: compra em 05/08 fecha em 20/08 e vence em setembro.
    expect(faturaDaCompra('2025-08-05', 20)).toEqual({ ano: 2025, mes: 9 })
  })

  it('compra no próprio dia do fechamento ainda entra na fatura que fecha', () => {
    expect(faturaDaCompra('2025-08-20', 20)).toEqual({ ano: 2025, mes: 9 })
  })

  it('compra um dia depois do fechamento pula para a fatura seguinte', () => {
    expect(faturaDaCompra('2025-08-21', 20)).toEqual({ ano: 2025, mes: 10 })
  })

  it('vira o ano corretamente', () => {
    expect(faturaDaCompra('2025-11-25', 20)).toEqual({ ano: 2026, mes: 1 })
    expect(faturaDaCompra('2025-12-21', 20)).toEqual({ ano: 2026, mes: 2 })
    expect(faturaDaCompra('2025-12-01', 20)).toEqual({ ano: 2026, mes: 1 })
  })

  it('fechamento no dia 31 se ajusta a fevereiro em vez de invadir março', () => {
    // Não existe 31/02: o ciclo fecha no dia 28, então uma compra em 28/02
    // ainda é da fatura de março.
    expect(faturaDaCompra('2025-02-28', 31)).toEqual({ ano: 2025, mes: 3 })
    // E em ano bissexto o limite é o dia 29.
    expect(faturaDaCompra('2024-02-29', 31)).toEqual({ ano: 2024, mes: 3 })
  })

  it('fechamento dia 1: só a compra do dia 1 fica no ciclo que fecha', () => {
    expect(faturaDaCompra('2025-08-01', 1)).toEqual({ ano: 2025, mes: 9 })
    expect(faturaDaCompra('2025-08-02', 1)).toEqual({ ano: 2025, mes: 10 })
  })
})

describe('periodoDaFatura', () => {
  it('cobre o dia seguinte ao fechamento anterior até o fechamento', () => {
    // Fatura de setembro/2025, fechamento dia 20: de 21/07... não — o ciclo
    // que ela cobra fechou em 20/08, e começou em 21/07.
    expect(periodoDaFatura({ ano: 2025, mes: 9 }, 20)).toEqual({
      inicioISO: '2025-07-21',
      fimISO: '2025-08-20',
    })
  })

  it('é o inverso exato de faturaDaCompra', () => {
    // Toda compra dentro do período tem que cair nesta fatura, e nenhuma de
    // fora pode cair. É o teste que pega erro de borda de um dia.
    for (const fechamento of [1, 5, 15, 20, 28, 31]) {
      for (let mes = 1; mes <= 12; mes++) {
        const alvo = { ano: 2025, mes }
        const { inicioISO, fimISO } = periodoDaFatura(alvo, fechamento)
        expect(faturaDaCompra(inicioISO, fechamento)).toEqual(alvo)
        expect(faturaDaCompra(fimISO, fechamento)).toEqual(alvo)

        // Um dia antes do início e um dia depois do fim caem em outra fatura.
        const antes = new Date(inicioISO + 'T12:00:00')
        antes.setDate(antes.getDate() - 1)
        const depois = new Date(fimISO + 'T12:00:00')
        depois.setDate(depois.getDate() + 1)
        const iso = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        expect(faturaDaCompra(iso(antes), fechamento)).not.toEqual(alvo)
        expect(faturaDaCompra(iso(depois), fechamento)).not.toEqual(alvo)
      }
    }
  })

  it('nenhum dia do ano fica sem fatura nem em duas', () => {
    // Varre 2025 dia a dia e confere que cada dia cai em exatamente uma fatura,
    // conferindo pelos períodos. Um buraco aqui seria gasto sumindo.
    const fechamento = 20
    // De dez/2024 a fev/2026: uma compra de 21/12/2025 já cai na fatura de
    // fevereiro, então parar em janeiro deixaria um falso buraco.
    const faturas = []
    for (let n = 2024 * 12 + 12; n <= 2026 * 12 + 2; n++) {
      const ano = Math.floor((n - 1) / 12)
      const mes = ((n - 1) % 12) + 1
      faturas.push({ ano, mes, ...periodoDaFatura({ ano, mes }, fechamento) })
    }
    for (let dia = new Date(2025, 0, 1); dia < new Date(2026, 0, 1); dia.setDate(dia.getDate() + 1)) {
      const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
      const cobrem = faturas.filter((f) => iso >= f.inicioISO && iso <= f.fimISO)
      expect(cobrem, `dia ${iso}`).toHaveLength(1)
    }
  })
})

describe('vencimentoDaFatura', () => {
  it('devolve o dia configurado num dia útil', () => {
    // 10/09/2025 é uma quarta.
    expect(vencimentoDaFatura({ ano: 2025, mes: 9 }, 10)).toBe('2025-09-10')
    expect(vencimentoAdiado({ ano: 2025, mes: 9 }, 10)).toBe(false)
  })

  it('sábado vira segunda', () => {
    // 06/09/2025 é um sábado.
    expect(vencimentoDaFatura({ ano: 2025, mes: 9 }, 6)).toBe('2025-09-08')
    expect(vencimentoAdiado({ ano: 2025, mes: 9 }, 6)).toBe(true)
  })

  it('domingo vira segunda', () => {
    // 07/09/2025 é um domingo.
    expect(vencimentoDaFatura({ ano: 2025, mes: 9 }, 7)).toBe('2025-09-08')
    expect(vencimentoAdiado({ ano: 2025, mes: 9 }, 7)).toBe(true)
  })

  it('empurrar do fim de semana pode virar o mês', () => {
    // 31/05/2025 é um sábado -> segunda 02/06.
    expect(vencimentoDaFatura({ ano: 2025, mes: 5 }, 31)).toBe('2025-06-02')
  })

  it('dia 31 num mês de 30 usa o último dia', () => {
    // 30/09/2025 é uma terça.
    expect(vencimentoDaFatura({ ano: 2025, mes: 9 }, 31)).toBe('2025-09-30')
  })

  it('o vencimento nunca cai em sábado ou domingo', () => {
    for (let mes = 1; mes <= 12; mes++) {
      for (const dia of [1, 5, 10, 15, 20, 25, 28, 31]) {
        const iso = vencimentoDaFatura({ ano: 2025, mes }, dia)
        const semana = new Date(iso + 'T12:00:00').getDay()
        expect(semana, `${iso}`).not.toBe(0)
        expect(semana, `${iso}`).not.toBe(6)
      }
    }
  })
})

describe('faturaVigente — a regra 8 em código', () => {
  it('cartão sem vigência não tem fatura nenhuma, seja qual for a data', () => {
    expect(faturaVigente('2025-08-05', null, null)).toBe(false)
    expect(faturaVigente('1999-01-01', null, null)).toBe(false)
  })

  it('compra anterior à vigência mantém o comportamento antigo', () => {
    expect(faturaVigente('2025-07-31', 2025, 8)).toBe(false)
  })

  it('compra a partir do mês da vigência usa a fatura', () => {
    expect(faturaVigente('2025-08-01', 2025, 8)).toBe(true)
    expect(faturaVigente('2026-03-15', 2025, 8)).toBe(true)
  })
})

describe('diaNoMes e ultimoDiaDoMes', () => {
  it('conhece fevereiro, inclusive bissexto', () => {
    expect(ultimoDiaDoMes(2025, 2)).toBe(28)
    expect(ultimoDiaDoMes(2024, 2)).toBe(29)
    expect(diaNoMes(2025, 2, 31)).toBe(28)
    expect(diaNoMes(2024, 2, 31)).toBe(29)
  })

  it('não mexe num dia que existe', () => {
    expect(diaNoMes(2025, 8, 15)).toBe(15)
    expect(diaNoMes(2025, 8, 31)).toBe(31)
  })
})
