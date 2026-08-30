import { describe, expect, it } from 'vitest'
import { PREFERENCIAS_PADRAO, diasEntre, lembretesDoMes, lerPreferencias, textoQuando } from './lembretes'

// 18 de agosto de 2026, uma terça. O mês aberto nos testes é sempre esse.
const HOJE = new Date(2026, 7, 18)
const PERIODO = { ano: 2026, mes: 8 }

const fatura = (p: Partial<Parameters<typeof lembretesDoMes>[0]['faturas'][0]> = {}) => ({
  payment_method_id: 'c1',
  nome: 'Nubank',
  dia_fechamento: 20,
  dia_vencimento: 28,
  total_centavos: 248790,
  paga: false,
  ...p,
})

const fixo = (p: Partial<Parameters<typeof lembretesDoMes>[0]['fixos'][0]> = {}) => ({
  id: 'f1',
  nome: 'Aluguel',
  valor_centavos: 180000,
  dia_vencimento: 20,
  ativo: true,
  inicio_ano: null,
  inicio_mes: null,
  fim_ano: null,
  fim_mes: null,
  ...p,
})

const chamar = (over: Partial<Parameters<typeof lembretesDoMes>[0]> = {}) =>
  lembretesDoMes({
    periodo: PERIODO,
    faturas: [],
    fixos: [],
    fixosPagos: new Set<string>(),
    preferencias: PREFERENCIAS_PADRAO,
    hoje: HOJE,
    ...over,
  })

describe('diasEntre e textoQuando', () => {
  it('conta dias inteiros, com sinal', () => {
    expect(diasEntre('2026-08-18', '2026-08-21')).toBe(3)
    expect(diasEntre('2026-08-18', '2026-08-18')).toBe(0)
    expect(diasEntre('2026-08-18', '2026-08-16')).toBe(-2)
  })

  it('atravessa mês e ano sem errar', () => {
    expect(diasEntre('2026-08-30', '2026-09-02')).toBe(3)
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('não é enganado por horário de verão', () => {
    // As datas são fixadas ao meio-dia justamente para uma virada de fuso não
    // transformar 3 dias em 2,96 e o arredondamento comer um dia.
    expect(diasEntre('2026-02-14', '2026-02-24')).toBe(10)
  })

  it('fala português em vez de despejar número', () => {
    expect(textoQuando(0)).toBe('hoje')
    expect(textoQuando(1)).toBe('amanhã')
    expect(textoQuando(-1)).toBe('ontem')
    expect(textoQuando(5)).toBe('em 5 dias')
    expect(textoQuando(-3)).toBe('há 3 dias')
  })
})

describe('lerPreferencias', () => {
  it('aceita o que veio do banco', () => {
    expect(lerPreferencias({ fatura_fechando: false, dias_antes: 7 })).toMatchObject({
      fatura_fechando: false,
      dias_antes: 7,
    })
  })

  it('valor inválido vira o padrão, não zero', () => {
    // Zero desligaria o aviso em silêncio, que é o oposto do que alguém quis ao
    // digitar errado.
    expect(lerPreferencias({ dias_antes: 999 }).dias_antes).toBe(3)
    expect(lerPreferencias({ dias_antes: -5 }).dias_antes).toBe(3)
    expect(lerPreferencias({ dias_antes: 'abc' }).dias_antes).toBe(3)
  })

  it('null e lixo devolvem o padrão inteiro', () => {
    expect(lerPreferencias(null)).toEqual(PREFERENCIAS_PADRAO)
    expect(lerPreferencias('nada disso')).toEqual(PREFERENCIAS_PADRAO)
  })
})

describe('fatura', () => {
  it('avisa que fecha quando está dentro da janela', () => {
    // Fecha dia 20, hoje é 18: faltam 2, e a janela padrão é 3.
    const r = chamar({ faturas: [fatura()] })
    const fecha = r.find((l) => l.tipo === 'fatura-fechando')
    expect(fecha?.quando).toBe('em 2 dias')
    expect(fecha?.valorCentavos).toBe(248790)
  })

  it('não avisa de fechamento fora da janela', () => {
    const r = chamar({ faturas: [fatura({ dia_fechamento: 28 })] })
    expect(r.find((l) => l.tipo === 'fatura-fechando')).toBeUndefined()
  })

  it('para de avisar do fechamento depois que ele passou', () => {
    // Depois de fechar, o que importa é o vencimento — dois avisos sobre a
    // mesma fatura viram ruído.
    const r = chamar({ faturas: [fatura({ dia_fechamento: 10 })] })
    expect(r.find((l) => l.tipo === 'fatura-fechando')).toBeUndefined()
  })

  it('fatura atrasada aparece mesmo fora da janela', () => {
    // Dívida vencida não é lembrete que caduca.
    const r = chamar({ faturas: [fatura({ dia_vencimento: 5 })] })
    const venceu = r.find((l) => l.tipo === 'fatura-vencendo')
    expect(venceu?.atrasado).toBe(true)
    expect(venceu?.quando).toBe('há 13 dias')
  })

  it('fatura paga não gera lembrete nenhum', () => {
    expect(chamar({ faturas: [fatura({ paga: true, dia_vencimento: 5 })] })).toEqual([])
  })

  it('o vencimento respeita o empurrão de fim de semana', () => {
    // 22/08/2026 é sábado -> segunda 24. De 18 para 24 são 6 dias, fora da
    // janela de 3; com dia 22 cru seriam 4, também fora. Com janela de 7 o
    // aviso tem que dizer 6, não 4.
    const r = chamar({
      faturas: [fatura({ dia_vencimento: 22 })],
      preferencias: { ...PREFERENCIAS_PADRAO, dias_antes: 7 },
    })
    expect(r.find((l) => l.tipo === 'fatura-vencendo')?.quando).toBe('em 6 dias')
  })
})

describe('gasto fixo', () => {
  it('avisa o fixo que vence dentro da janela', () => {
    const r = chamar({ fixos: [fixo()] })
    expect(r.find((l) => l.tipo === 'fixo-vencendo')?.quando).toBe('em 2 dias')
  })

  it('fixo já marcado como pago some da lista', () => {
    // Avisar sobre o que a pessoa acabou de resolver é o jeito mais rápido de
    // fazer alguém desligar todos os avisos.
    const r = chamar({ fixos: [fixo()], fixosPagos: new Set(['f1']) })
    expect(r).toEqual([])
  })

  it('fixo fora da vigência não avisa', () => {
    const r = chamar({ fixos: [fixo({ fim_ano: 2026, fim_mes: 5 })] })
    expect(r).toEqual([])
  })

  it('fixo sem dia de vencimento não tem o que avisar', () => {
    expect(chamar({ fixos: [fixo({ dia_vencimento: null })] })).toEqual([])
  })

  it('dia 31 num mês de 30 encosta no último dia', () => {
    const r = lembretesDoMes({
      periodo: { ano: 2026, mes: 9 },
      faturas: [],
      fixos: [fixo({ dia_vencimento: 31 })],
      fixosPagos: new Set(),
      preferencias: { ...PREFERENCIAS_PADRAO, dias_antes: 3 },
      hoje: new Date(2026, 8, 28),
    })
    expect(r[0]?.quando).toBe('em 2 dias')
  })
})

describe('preferências desligam cada tipo', () => {
  it.each([
    ['fatura_fechando', 'fatura-fechando'],
    ['fatura_vencendo', 'fatura-vencendo'],
    ['fixo_vencendo', 'fixo-vencendo'],
  ] as const)('desligar %s remove só esse tipo', (chave, tipo) => {
    const todos = chamar({ faturas: [fatura({ dia_vencimento: 19 })], fixos: [fixo()] })
    expect(todos.some((l) => l.tipo === tipo)).toBe(true)

    const semEle = chamar({
      faturas: [fatura({ dia_vencimento: 19 })],
      fixos: [fixo()],
      preferencias: { ...PREFERENCIAS_PADRAO, [chave]: false },
    })
    expect(semEle.some((l) => l.tipo === tipo)).toBe(false)
    // E os outros continuam lá: desligar um não pode silenciar os três.
    expect(semEle.length).toBe(todos.length - 1)
  })

  it('dias_antes zero deixa só o que vence hoje ou já venceu', () => {
    const r = chamar({
      fixos: [fixo(), fixo({ id: 'f2', nome: 'Luz', dia_vencimento: 18 })],
      preferencias: { ...PREFERENCIAS_PADRAO, dias_antes: 0 },
    })
    expect(r.map((l) => l.titulo)).toEqual(['Luz vence'])
  })
})

describe('escopo e ordem', () => {
  it('mês que não é o corrente não gera lembrete', () => {
    // Aviso sobre outubro enquanto a pessoa confere agosto é ruído.
    const r = lembretesDoMes({
      periodo: { ano: 2026, mes: 10 },
      faturas: [fatura()],
      fixos: [fixo()],
      fixosPagos: new Set(),
      preferencias: PREFERENCIAS_PADRAO,
      hoje: HOJE,
    })
    expect(r).toEqual([])
  })

  it('o atrasado vem primeiro, e o mais caro desempata no mesmo dia', () => {
    const r = chamar({
      faturas: [fatura({ dia_vencimento: 10 })],
      fixos: [
        fixo({ id: 'f1', nome: 'Barato', valor_centavos: 5000, dia_vencimento: 20 }),
        fixo({ id: 'f2', nome: 'Caro', valor_centavos: 500000, dia_vencimento: 20 }),
      ],
    })
    // Atrasado primeiro. Depois todos empatam em 2 dias, e o desempate é por
    // valor: se a pessoa só for resolver um, que seja o que pesa mais.
    expect(r.map((l) => l.titulo)).toEqual([
      'Fatura do Nubank venceu',
      'Caro vence',
      'Fatura do Nubank fecha',
      'Barato vence',
    ])
  })
})
