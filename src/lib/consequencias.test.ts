import { describe, expect, it } from 'vitest'
import { formatCentavos } from './money'
import {
  consequenciasDoRascunho,
  faturaDoLancamento,
  type Consequencia,
  type FormaDoRascunho,
  type Rascunho,
} from './consequencias'

/** Cartão que fecha no dia 25 e vence no dia 5, valendo desde janeiro de 2020. */
const CARTAO: FormaDoRascunho = {
  id: 'cartao',
  nome: 'Nubank',
  tipo: 'credito',
  dia_fechamento: 25,
  dia_vencimento: 5,
  fatura_inicio_ano: 2020,
  fatura_inicio_mes: 1,
}

/** Débito: nada de fatura, o dinheiro sai na hora. */
const DEBITO: FormaDoRascunho = {
  id: 'debito',
  nome: 'Conta corrente',
  tipo: 'debito',
  dia_fechamento: null,
  dia_vencimento: null,
  fatura_inicio_ano: null,
  fatura_inicio_mes: null,
}

/** Um cartão de crédito que ninguém terminou de configurar. */
const CARTAO_CRU: FormaDoRascunho = {
  ...CARTAO,
  id: 'cartao-cru',
  nome: 'Cartão da loja',
  dia_fechamento: null,
  dia_vencimento: null,
  fatura_inicio_ano: null,
  fatura_inicio_mes: null,
}

const FORMAS = [CARTAO, DEBITO, CARTAO_CRU]

const rascunho = (mudancas: Partial<Rascunho> = {}): Rascunho => ({
  tipo: 'gasto',
  data: '2026-09-10',
  valorCentavos: 10000,
  parcelas: 1,
  formaId: null,
  ...mudancas,
})

const calcular = (mudancas: Partial<Rascunho> = {}, aberto = { ano: 2026, mes: 9 }) =>
  consequenciasDoRascunho(rascunho(mudancas), FORMAS, aberto)

const ids = (lista: Consequencia[]) => lista.map((c) => c.id)
const pegar = (lista: Consequencia[], id: Consequencia['id']) => lista.find((c) => c.id === id)

describe('o caso comum não diz nada', () => {
  it('gasto à vista, no débito, no mês aberto', () => {
    expect(calcular({ formaId: 'debito' })).toEqual([])
  })

  it('gasto sem forma de pagamento também', () => {
    expect(calcular()).toEqual([])
  })

  it('data em branco não inventa consequência', () => {
    expect(calcular({ data: '' })).toEqual([])
  })
})

describe('fora do mês aberto', () => {
  it('avisa que o lançamento vai sumir da lista', () => {
    const lista = calcular({ data: '2026-10-03', formaId: 'debito' })
    expect(ids(lista)).toEqual(['fora-do-mes'])
    expect(lista[0].tom).toBe('atencao')
    expect(lista[0].titulo).toBe('Este lançamento é de Outubro de 2026')
    expect(lista[0].detalhe).toContain('Setembro de 2026')
  })

  it('mesmo mês em outro ano não é o mesmo mês', () => {
    expect(ids(calcular({ data: '2025-09-10' }))).toEqual(['fora-do-mes'])
  })

  it('vem antes de tudo — é o único que faz alguém desistir de salvar', () => {
    const lista = calcular({ data: '2026-10-03', formaId: 'cartao', parcelas: 3 })
    expect(lista[0].id).toBe('fora-do-mes')
  })
})

describe('fatura', () => {
  it('compra antes do fechamento vence no mês seguinte', () => {
    const lista = calcular({ data: '2026-09-10', formaId: 'cartao' })
    expect(ids(lista)).toEqual(['fatura', 'competencia'])
    expect(pegar(lista, 'fatura')?.titulo).toBe('Entra na fatura de Outubro')
    expect(pegar(lista, 'fatura')?.detalhe).toContain('05/10/2026')
  })

  it('compra depois do fechamento pula um ciclo', () => {
    const lista = calcular({ data: '2026-09-26', formaId: 'cartao' })
    expect(pegar(lista, 'fatura')?.titulo).toBe('Entra na fatura de Novembro')
  })

  it('o dia do fechamento ainda pertence à fatura que fecha', () => {
    const lista = calcular({ data: '2026-09-25', formaId: 'cartao' })
    expect(pegar(lista, 'fatura')?.titulo).toBe('Entra na fatura de Outubro')
  })

  it('diz que a competência e o caixa são meses diferentes', () => {
    const lista = calcular({ data: '2026-09-10', formaId: 'cartao' })
    expect(pegar(lista, 'competencia')?.titulo).toBe('Gasto de Setembro, sai da conta em Outubro')
  })

  it('avisa quando o vencimento foi empurrado do fim de semana', () => {
    // A fatura de dezembro de 2026 vence dia 5, um sábado -> segunda, dia 7.
    const lista = calcular({ data: '2026-11-10', formaId: 'cartao' }, { ano: 2026, mes: 11 })
    expect(pegar(lista, 'fatura')?.detalhe).toContain('07/12/2026')
    expect(pegar(lista, 'fatura')?.detalhe).toContain('fim de semana')
  })

  it('sem dia de vencimento, diz o que sabe e admite o que falta', () => {
    const semVencimento = [{ ...CARTAO, dia_vencimento: null }]
    const lista = consequenciasDoRascunho(rascunho({ formaId: 'cartao' }), semVencimento, {
      ano: 2026,
      mes: 9,
    })
    expect(pegar(lista, 'fatura')?.detalhe).toContain('ainda não está configurado')
  })

  it('regra de fatura fora da vigência não vale — o gasto pesa no próprio mês', () => {
    const futuro = [{ ...CARTAO, fatura_inicio_ano: 2027, fatura_inicio_mes: 1 }]
    expect(consequenciasDoRascunho(rascunho({ formaId: 'cartao' }), futuro, { ano: 2026, mes: 9 })).toEqual(
      [],
    )
  })

  it('vigência ausente é "nunca", como manda a 0005', () => {
    const semVigencia = [{ ...CARTAO, fatura_inicio_ano: null, fatura_inicio_mes: null }]
    expect(
      consequenciasDoRascunho(rascunho({ formaId: 'cartao' }), semVigencia, { ano: 2026, mes: 9 }),
    ).toEqual([])
  })

  it('cartão de crédito sem fechamento se anuncia — ele se comporta como dinheiro', () => {
    const lista = calcular({ formaId: 'cartao-cru' })
    expect(ids(lista)).toEqual(['sem-fechamento'])
    expect(lista[0].tom).toBe('atencao')
    expect(lista[0].detalhe).toContain('Setembro')
  })

  it('débito sem fechamento não se anuncia — ele nunca teve fatura', () => {
    expect(calcular({ formaId: 'debito' })).toEqual([])
  })
})

describe('parcelas', () => {
  it('divisão exata', () => {
    const lista = calcular({ formaId: 'debito', parcelas: 4, valorCentavos: 10000 })
    // `formatCentavos` usa o Intl, que separa "R$" do número com um espaço
    // duro (U+00A0). Escrever o esperado à mão compara contra o espaço comum
    // e falha por um caractere invisível.
    expect(pegar(lista, 'parcelas')?.titulo).toBe(`4x de ${formatCentavos(2500)}`)
    expect(pegar(lista, 'parcelas')?.detalhe).toContain(formatCentavos(10000))
  })

  it('a sobra de centavos vai na primeira, e a prévia diz isso', () => {
    const lista = calcular({ formaId: 'debito', parcelas: 3, valorCentavos: 10000 })
    expect(pegar(lista, 'parcelas')?.titulo).toBe(
      `1x de ${formatCentavos(3334)} e 2x de ${formatCentavos(3333)}`,
    )
    expect(pegar(lista, 'parcelas')?.detalhe).toContain('primeira')
  })

  it('sem valor ainda diz em quantas vezes, e pede o valor', () => {
    const lista = calcular({ formaId: 'debito', parcelas: 6, valorCentavos: 0 })
    expect(pegar(lista, 'parcelas')?.titulo).toBe('6x')
    expect(pegar(lista, 'parcelas')?.detalhe).toContain('valor total')
  })

  it('conta até onde a série vai', () => {
    const lista = calcular({ formaId: 'debito', parcelas: 6, valorCentavos: 60000 })
    expect(pegar(lista, 'repeticao')?.titulo).toBe('As outras 5 parcelas entram nos meses seguintes')
    expect(pegar(lista, 'repeticao')?.detalhe).toContain('Fevereiro de 2027')
  })

  it('duas vezes fala no singular', () => {
    const lista = calcular({ formaId: 'debito', parcelas: 2, valorCentavos: 5000 })
    expect(pegar(lista, 'repeticao')?.titulo).toBe('As outras 1 parcela entra nos meses seguintes')
  })

  it('parceladas no cartão: a fatura mostrada é a da primeira', () => {
    const lista = calcular({ formaId: 'cartao', parcelas: 3, valorCentavos: 30000 })
    expect(ids(lista)).toEqual(['fatura', 'competencia', 'parcelas', 'repeticao'])
    expect(pegar(lista, 'fatura')?.titulo).toBe('A 1ª parcela entra na fatura de Outubro')
  })

  it('uma parcela é à vista, e à vista não tem o que explicar', () => {
    expect(calcular({ formaId: 'debito', parcelas: 1 })).toEqual([])
  })
})

describe('entrada', () => {
  it('não tem fatura nem parcela, mesmo com forma de crédito escolhida', () => {
    expect(calcular({ tipo: 'entrada', formaId: 'cartao', parcelas: 3 })).toEqual([])
  })

  it('mas o aviso de mês continua valendo', () => {
    expect(ids(calcular({ tipo: 'entrada', data: '2026-08-01' }))).toEqual(['fora-do-mes'])
  })
})

describe('as frases não escapam do formato', () => {
  it('todo item tem título e tom, e nenhum título fica vazio', () => {
    const lista = calcular({ data: '2026-10-26', formaId: 'cartao', parcelas: 12, valorCentavos: 120001 })
    expect(lista.length).toBe(5)
    for (const c of lista) {
      expect(c.titulo.trim().length).toBeGreaterThan(0)
      expect(['neutro', 'atencao']).toContain(c.tom)
    }
  })
})

describe('faturaDoLancamento', () => {
  const gasto = (data: string, payment_method_id: string | null) => ({
    data,
    valor_centavos: 1000,
    payment_method_id,
  })

  it('devolve a fatura do cartão', () => {
    expect(faturaDoLancamento(gasto('2026-09-10', 'cartao'), FORMAS)).toEqual({ ano: 2026, mes: 10 })
  })

  it('vira o ano quando precisa', () => {
    expect(faturaDoLancamento(gasto('2026-11-26', 'cartao'), FORMAS)).toEqual({ ano: 2027, mes: 1 })
  })

  it('sem fatura devolve null — o gasto pesa no próprio mês', () => {
    expect(faturaDoLancamento(gasto('2026-09-10', 'debito'), FORMAS)).toBeNull()
    expect(faturaDoLancamento(gasto('2026-09-10', null), FORMAS)).toBeNull()
    expect(faturaDoLancamento(gasto('2026-09-10', 'cartao-cru'), FORMAS)).toBeNull()
  })

  it('concorda com o que a folha prometeu antes de salvar', () => {
    // O mesmo lançamento pelos dois caminhos: se um dia divergirem, é aqui que
    // aparece — e divergir é o pior defeito possível numa tela que promete o
    // futuro e depois mostra o presente.
    const lista = calcular({ data: '2026-09-26', formaId: 'cartao' }, { ano: 2026, mes: 9 })
    expect(pegar(lista, 'fatura')?.titulo).toContain('Novembro')
    expect(faturaDoLancamento(gasto('2026-09-26', 'cartao'), FORMAS)).toEqual({ ano: 2026, mes: 11 })
  })
})
