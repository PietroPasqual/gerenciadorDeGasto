import { describe, expect, it } from 'vitest'
import { MIN_DIAS_DECORRIDOS, observacoesDoMes, projecaoFimDoMes, type Observacao } from './observacoes'
import { formatCentavos } from './money'

/**
 * Compara usando o mesmo formatador da aplicação. Escrever "R$ 18,94" à mão
 * no teste falha: o separador que o Intl produz é um espaço NÃO-QUEBRÁVEL, e
 * a string parece idêntica mas não é.
 */
const brl = (centavos: number) => formatCentavos(centavos)

const RESUMO_ZERO = { total_entradas: 0, total_saidas: 0, saldo: 0, total_investido: 0 }

function rodar(p: Partial<Parameters<typeof observacoesDoMes>[0]>): Observacao[] {
  return observacoesDoMes({
    resumo: RESUMO_ZERO,
    categorias: [],
    meses: [],
    mes: 8,
    ano: 2026,
    ...p,
  })
}
const ids = (o: Observacao[]) => o.map((x) => x.id)
/**
 * O que a pessoa lê de fato: destaque e frase são partes do mesmo enunciado,
 * separadas só para a tela poder dar peso ao número.
 */
const texto = (o: Observacao[], id: string) => {
  const x = o.find((y) => y.id === id)
  return x ? `${x.destaque} ${x.texto}` : ''
}

describe('quando NÃO falar', () => {
  it('mês sem nada lançado não gera observação', () => {
    expect(rodar({})).toEqual([])
  })

  it('não compara com a média tendo só um outro mês', () => {
    // Com dois meses, "acima da média" é só "maior que o outro".
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 90000, saldo: 10000, total_investido: 0 },
      meses: [{ mes: 7, entradas: 100000, saidas: 10000 }],
    })
    expect(ids(o)).not.toContain('contra-media')
  })

  it('diferença pequena contra a média não vira notícia', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 105000, saldo: -5000, total_investido: 0 },
      // média dos outros = 100000, diferença de 5% → silêncio
      meses: [
        { mes: 6, entradas: 100000, saidas: 100000 },
        { mes: 7, entradas: 100000, saidas: 100000 },
      ],
    })
    expect(ids(o)).not.toContain('contra-media')
  })

  it('pouco sem categoria não ocupa espaço', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 100000, saldo: 0, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 5000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 95000, limite_centavos: null },
      ],
    })
    expect(ids(o)).not.toContain('sem-categoria')
  })

  it('nunca passa de quatro — é um relance, não um relatório', () => {
    const o = rodar({
      resumo: { total_entradas: 500000, total_saidas: 900000, saldo: -400000, total_investido: 50000 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 500000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 400000, limite_centavos: 100000 },
      ],
      meses: [
        { mes: 5, entradas: 100000, saidas: 300000 },
        { mes: 6, entradas: 100000, saidas: 300000 },
        { mes: 7, entradas: 100000, saidas: 100000 },
      ],
    })
    expect(o.length).toBeLessThanOrEqual(4)
  })
})

describe('os fatos', () => {
  it('saldo negativo diz quanto saiu a mais', () => {
    const o = rodar({
      resumo: { total_entradas: 368074, total_saidas: 369968, saldo: -1894, total_investido: 0 },
    })
    expect(texto(o, 'saldo-negativo')).toContain(brl(1894))
    expect(o.find((x) => x.id === 'saldo-negativo')?.tom).toBe('atencao')
  })

  it('saldo positivo diz quanto sobrou e a fração', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 300000, saldo: 100000, total_investido: 0 },
    })
    expect(texto(o, 'saldo-positivo')).toContain(brl(100000))
    expect(texto(o, 'saldo-positivo')).toContain('25%')
  })

  it('sem categoria alto vira aviso com o valor', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 369968, saldo: 30032, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 369968, limite_centavos: null },
      ],
    })
    expect(texto(o, 'sem-categoria')).toContain('100%')
    expect(texto(o, 'sem-categoria')).toContain(brl(369968))
  })

  it('limite estourado usa o SEU limite, não uma regra de fora', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 150000, saldo: 250000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'Mercado', gasto_centavos: 150000, limite_centavos: 100000 }],
    })
    expect(texto(o, 'limite-estourado')).toContain('Mercado')
    expect(texto(o, 'limite-estourado')).toContain(brl(150000))
    expect(texto(o, 'limite-estourado')).toContain(brl(100000))
  })

  it('a maior categoria não conta o "sem categoria" como campeã', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 0 },
      categorias: [
        { category_id: null, nome: 'Sem categoria', gasto_centavos: 90000, limite_centavos: null },
        { category_id: 'c1', nome: 'Mercado', gasto_centavos: 10000, limite_centavos: null },
      ],
    })
    expect(texto(o, 'maior-categoria')).toContain('Mercado')
  })

  it('compara com a média dos OUTROS meses, sem incluir o atual', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 200000, saldo: 200000, total_investido: 0 },
      meses: [
        { mes: 6, entradas: 400000, saidas: 100000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
        { mes: 8, entradas: 400000, saidas: 200000 }, // o mês atual, ignorado
      ],
    })
    // média dos outros dois = 100000; o mês foi 100% acima
    expect(texto(o, 'contra-media')).toContain('100%')
    expect(texto(o, 'contra-media')).toContain('a mais')
    expect(texto(o, 'contra-media')).toContain('2 meses')
  })

  it('gastar abaixo da média é tom bom', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 50000, saldo: 350000, total_investido: 0 },
      meses: [
        { mes: 6, entradas: 400000, saidas: 100000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
      ],
    })
    expect(o.find((x) => x.id === 'contra-media')?.tom).toBe('bom')
    expect(texto(o, 'contra-media')).toContain('a menos')
  })

  it('conta os meses fechados no negativo', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 300000, saldo: 100000, total_investido: 0 },
      meses: [
        { mes: 5, entradas: 100000, saidas: 200000 },
        { mes: 6, entradas: 100000, saidas: 200000 },
        { mes: 7, entradas: 400000, saidas: 100000 },
      ],
    })
    expect(texto(o, 'meses-negativos')).toContain('2 de 3')
  })

  it('o que foi guardado aparece como fração do que entrou', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 80000 },
    })
    expect(texto(o, 'investido')).toContain(brl(80000))
    expect(texto(o, 'investido')).toContain('20%')
  })
})

describe('ordem e segurança', () => {
  it('o que pede decisão vem antes do que é elogio', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 500000, saldo: -100000, total_investido: 40000 },
    })
    expect(o[0].id).toBe('saldo-negativo')
    expect(ids(o).indexOf('saldo-negativo')).toBeLessThan(ids(o).indexOf('investido'))
  })

  it('não divide por zero em lugar nenhum', () => {
    const o = rodar({
      resumo: { total_entradas: 0, total_saidas: 100000, saldo: -100000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'X', gasto_centavos: 100000, limite_centavos: 0 }],
      meses: [
        { mes: 6, entradas: 0, saidas: 0 },
        { mes: 7, entradas: 0, saidas: 0 },
      ],
    })
    expect(o.every((x) => !x.texto.includes('NaN') && !x.texto.includes('Infinity'))).toBe(true)
  })

  it('limite zero não conta como limite estourado', () => {
    const o = rodar({
      resumo: { total_entradas: 400000, total_saidas: 100000, saldo: 300000, total_investido: 0 },
      categorias: [{ category_id: 'c1', nome: 'X', gasto_centavos: 100000, limite_centavos: 0 }],
    })
    expect(ids(o)).not.toContain('limite-estourado')
  })
})

describe('a comparação com a média usa a mesma medida dos dois lados', () => {
  /**
   * O `total_saidas` do resumo vem de `resumo_mensal` (caixa) e a média vem de
   * `comparativo_anual`. Enquanto o comparativo estava em competência, a frase
   * "23% a menos que a sua média" comparava duas medidas diferentes — parecia
   * informação e era ruído. A 0016 pôs os dois em caixa.
   *
   * Este teste não consegue checar o SQL, mas trava o contrato: com o mês igual
   * à média dos outros, nenhuma observação de comparação pode aparecer.
   */
  const base = {
    categorias: [],
    mes: 8,
    ano: 2025,
  }

  it('mês igual à média não gera observação de comparação', () => {
    const obs = observacoesDoMes({
      ...base,
      resumo: {
        total_entradas: 500_000,
        total_saidas: 200_000,
        saldo: 300_000,
        total_investido: 0,
      },
      meses: [
        { mes: 6, entradas: 500_000, saidas: 200_000 },
        { mes: 7, entradas: 500_000, saidas: 200_000 },
        { mes: 8, entradas: 500_000, saidas: 200_000 },
      ],
    })
    expect(obs.find((o) => o.id === 'contra-media')).toBeUndefined()
  })

  it('diferença real de 50% aparece, e no tom certo', () => {
    const obs = observacoesDoMes({
      ...base,
      resumo: {
        total_entradas: 500_000,
        total_saidas: 300_000,
        saldo: 200_000,
        total_investido: 0,
      },
      meses: [
        { mes: 6, entradas: 500_000, saidas: 200_000 },
        { mes: 7, entradas: 500_000, saidas: 200_000 },
      ],
    })
    const media = obs.find((o) => o.id === 'contra-media')
    expect(media).toBeDefined()
    expect(media?.tom).toBe('atencao')
    expect(media?.destaque).toBe('50% a mais')
  })
})

describe('a projeção de fim de mês', () => {
  /** 18 de agosto de 2026 — agosto tem 31 dias, restam 13. */
  const HOJE = new Date('2026-08-18T12:00:00')

  const gasto = (dia: number, valor: number) => ({
    data: `2026-08-${String(dia).padStart(2, '0')}`,
    valor_centavos: valor,
  })

  const projetar = (p: Partial<Parameters<typeof projecaoFimDoMes>[0]> = {}) =>
    projecaoFimDoMes({
      ano: 2026,
      mes: 8,
      totalEntradas: 500000,
      fixosCentavos: 0,
      faturasCentavos: 0,
      gastosDoDia: Array.from({ length: 18 }, (_, i) => gasto(i + 1, 10000)),
      hoje: HOJE,
      ...p,
    })

  it('extrapola o gasto do dia a dia pela média diária', () => {
    // R$ 100 por dia em 18 dias; restam 13, então mais R$ 1.300.
    const p = projetar()
    expect(p?.mediaDiaria).toBe(10000)
    expect(p?.diasRestantes).toBe(13)
    expect(p?.saidasProjetadas).toBe(310000)
    expect(p?.saldoProjetado).toBe(190000)
  })

  it('NÃO extrapola gasto fixo — é a armadilha inteira desta conta', () => {
    // Aluguel de R$ 1.800 é valor cheio conhecido desde o dia 1. Se entrasse
    // na régua de três junto com o resto, viraria R$ 3.100 de projeção.
    const p = projetar({ fixosCentavos: 180000 })
    expect(p?.saidasProjetadas).toBe(310000 + 180000)
  })

  it('NÃO extrapola fatura que vence no mês', () => {
    const p = projetar({ faturasCentavos: 240000 })
    expect(p?.saidasProjetadas).toBe(310000 + 240000)
  })

  it('parcela já lançada para um dia futuro entra inteira, não pela média', () => {
    // Fato agendado, não previsão: soma uma vez, sem multiplicador.
    const p = projetar({
      gastosDoDia: [...Array.from({ length: 18 }, (_, i) => gasto(i + 1, 10000)), gasto(25, 50000)],
    })
    expect(p?.mediaDiaria).toBe(10000)
    expect(p?.saidasProjetadas).toBe(310000 + 50000)
  })

  it('entrada nunca é projetada', () => {
    // Dobrar os dias decorridos não pode mexer no lado das entradas.
    const a = projetar()!
    const b = projetar({ totalEntradas: 500000, hoje: new Date('2026-08-20T12:00:00') })!
    expect(a.saldoProjetado).toBe(500000 - a.saidasProjetadas)
    expect(b.saldoProjetado).toBe(500000 - b.saidasProjetadas)
    // Dois dias a mais mudam a saída projetada, nunca a entrada.
    expect(a.saidasProjetadas).not.toBe(b.saidasProjetadas)
  })

  it('cala antes do dia 10 — "dia 3 não tem média"', () => {
    expect(MIN_DIAS_DECORRIDOS).toBe(10)
    expect(
      projetar({ hoje: new Date('2026-08-03T12:00:00'), gastosDoDia: [gasto(1, 10000), gasto(2, 10000)] }),
    ).toBeNull()
  })

  it('cala no fim do mês, quando a projeção já é quase o fato', () => {
    expect(projetar({ hoje: new Date('2026-08-30T12:00:00') })).toBeNull()
  })

  it('cala sem gasto do dia a dia: sem variável não há ritmo', () => {
    expect(projetar({ gastosDoDia: [], fixosCentavos: 180000 })).toBeNull()
    // Só o que ainda vai acontecer também não faz ritmo.
    expect(projetar({ gastosDoDia: [gasto(25, 50000)] })).toBeNull()
  })

  it('cala fora do mês corrente: projetar o passado é absurdo', () => {
    expect(projetar({ mes: 7 })).toBeNull()
    expect(projetar({ ano: 2027 })).toBeNull()
  })

  it('a frase se identifica como projeção, e não manda ninguém fazer nada', () => {
    const p = projetar({ totalEntradas: 100000 })
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 180000, saldo: -80000, total_investido: 0 },
      projecao: p,
    })
    const frase = texto(o, 'projecao-fechamento')
    expect(frase).toContain(brl(Math.abs(p!.saldoProjetado)))
    expect(frase).toContain('É projeção, não fato')
    expect(frase).toMatch(/faltam 13 dias/)
    expect(frase).not.toMatch(/deveria|precisa|corte|gaste menos|cuidado/i)
  })

  it('quando sobra, a frase diz que sobra — e continua se dizendo projeção', () => {
    const o = rodar({
      resumo: { total_entradas: 500000, total_saidas: 180000, saldo: 320000, total_investido: 0 },
      projecao: projetar(),
    })
    const frase = texto(o, 'projecao-fechamento')
    expect(frase).toContain('deve sobrar no fim do mês')
    expect(frase).toContain('É projeção, não fato')
  })

  it('sem projeção, o painel fica exatamente como era', () => {
    const base = {
      resumo: { total_entradas: 500000, total_saidas: 180000, saldo: 320000, total_investido: 0 },
    }
    expect(ids(rodar(base))).toEqual(ids(rodar({ ...base, projecao: null })))
  })

  it('o mês que já está no vermelho mostra o fato antes da projeção', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 180000, saldo: -80000, total_investido: 0 },
      projecao: projetar({ totalEntradas: 100000 }),
    })
    expect(ids(o).indexOf('saldo-negativo')).toBeLessThan(ids(o).indexOf('projecao-fechamento'))
  })
})

describe('a compra fora do padrão', () => {
  const RESUMO_COM_MOVIMENTO = {
    total_entradas: 500000,
    total_saidas: 180000,
    saldo: 320000,
    total_investido: 0,
  }
  const CATEGORIAS = [{ category_id: 'c1', nome: 'Mercado', gasto_centavos: 40000, limite_centavos: null }]

  const gasto = { id: 't1', categoriaId: 'c1', valorCentavos: 40000, mediaCentavos: 10000, multiplicador: 4 }

  it('aparece com o valor e a frase do gasto-atipico.ts', () => {
    const o = rodar({ resumo: RESUMO_COM_MOVIMENTO, categorias: CATEGORIAS, gastoAtipico: gasto })
    expect(texto(o, 'gasto-atipico')).toBe(
      `${brl(40000)} é 4× a sua média em Mercado (normalmente ${brl(10000)}).`,
    )
  })

  it('sem gastoAtipico, o painel fica exatamente como era', () => {
    const base = { resumo: RESUMO_COM_MOVIMENTO, categorias: CATEGORIAS }
    expect(ids(rodar(base))).toEqual(ids(rodar({ ...base, gastoAtipico: null })))
  })

  it('categoria que sumiu entre a compra e a tela não vira frase quebrada', () => {
    const o = rodar({ resumo: RESUMO_COM_MOVIMENTO, categorias: [], gastoAtipico: gasto })
    expect(ids(o)).not.toContain('gasto-atipico')
  })

  it('não diz o que fazer — mesma régua do resto do arquivo', () => {
    const o = rodar({ resumo: RESUMO_COM_MOVIMENTO, categorias: CATEGORIAS, gastoAtipico: gasto })
    const frase = texto(o, 'gasto-atipico')
    expect(frase).not.toMatch(/deveria|precisa|corte|evite|cuidado|gaste menos/i)
  })

  it('o saldo negativo continua vindo antes: é o que ainda dá para decidir agora', () => {
    const o = rodar({
      resumo: { total_entradas: 100000, total_saidas: 180000, saldo: -80000, total_investido: 0 },
      categorias: CATEGORIAS,
      gastoAtipico: gasto,
    })
    expect(ids(o).indexOf('saldo-negativo')).toBeLessThan(ids(o).indexOf('gasto-atipico'))
  })
})
