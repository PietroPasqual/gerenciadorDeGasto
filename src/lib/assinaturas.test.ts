import { describe, expect, it } from 'vitest'
import {
  MESES_MINIMOS,
  detectarAssinaturas,
  textoDaAssinatura,
  toleranciaDe,
  type GastoDaJanela,
} from './assinaturas'

const HOJE = new Date('2025-08-15T12:00:00')

let contador = 0
function lanc(
  data: string,
  descricao: string,
  valor: number,
  extra: Partial<GastoDaJanela> = {},
): GastoDaJanela {
  contador += 1
  return {
    id: `t${contador}`,
    data,
    descricao,
    valor_centavos: valor,
    tipo: 'gasto',
    category_id: null,
    payment_method_id: null,
    parcelamento_id: null,
    ...extra,
  }
}

/** Uma cobrança por mês, do mês `de` até o mês `ate` de 2025. */
function serie(
  descricao: string,
  valor: number | number[],
  de: number,
  ate: number,
  dia = 10,
  extra: Partial<GastoDaJanela> = {},
) {
  const saida: GastoDaJanela[] = []
  for (let m = de; m <= ate; m += 1) {
    const v = Array.isArray(valor) ? valor[m - de] : valor
    saida.push(
      lanc(`2025-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, descricao, v, extra),
    )
  }
  return saida
}

const detectar = (lancamentos: GastoDaJanela[], gastosFixos: Array<{ nome: string }> = []) =>
  detectarAssinaturas({ lancamentos, gastosFixos, hoje: HOJE })

describe('detectarAssinaturas', () => {
  it('acha o que sai todo mês pelo mesmo valor', () => {
    const achadas = detectar(serie('NETFLIX.COM', 3990, 6, 8))
    expect(achadas).toHaveLength(1)
    expect(achadas[0].rotulo).toBe('NETFLIX.COM')
    expect(achadas[0].mesesSeguidos).toBe(3)
    expect(achadas[0].valorSugerido).toBe(3990)
    expect(achadas[0].diaSugerido).toBe(10)
  })

  it('a vigência começa no primeiro mês em que apareceu, não hoje', () => {
    const [a] = detectar(serie('SPOTIFY', 2190, 3, 8))
    expect(a.inicioAno).toBe(2025)
    expect(a.inicioMes).toBe(3)
    expect(a.mesesSeguidos).toBe(6)
  })

  it('dois meses não bastam', () => {
    expect(MESES_MINIMOS).toBe(3)
    expect(detectar(serie('NETFLIX', 3990, 7, 8))).toEqual([])
  })

  it('mês faltando quebra a sequência, e só a parte final conta', () => {
    const salteado = [...serie('NETFLIX', 3990, 1, 3), ...serie('NETFLIX', 3990, 7, 8)]
    // Junho não teve cobrança: a sequência viva tem 2 meses, abaixo do mínimo.
    expect(detectar(salteado)).toEqual([])
  })

  it('sequência antiga não conta, mesmo sendo longa', () => {
    // Cancelada em abril: seis meses seguidos, e nenhum deles recente.
    expect(detectar(serie('ACADEMIA', 9900, 1, 4))).toEqual([])
  })

  it('a cobrança do mês passado ainda conta como viva', () => {
    // O mês corrente pode simplesmente não ter chegado no dia da cobrança.
    const [a] = detectar(serie('ICLOUD', 990, 5, 7))
    expect(a.mesesSeguidos).toBe(3)
  })

  it('valor parecido passa; valor que dispara, não', () => {
    // 10% de 39,90 são 3,99, mas o piso de R$ 2,00 não se aplica aqui.
    expect(detectar(serie('NETFLIX', [3990, 4090, 4190], 6, 8))).toHaveLength(1)
    expect(detectar(serie('MERCADO', [12000, 21000, 8000], 6, 8))).toEqual([])
  })

  it('o piso de R$ 2,00 protege a assinatura barata', () => {
    // 10% de R$ 0,99 seriam 10 centavos: uma variação de câmbio derrubaria.
    expect(toleranciaDe(990)).toBe(200)
    expect(detectar(serie('APPLE.COM/BILL', [990, 1050, 1090], 6, 8))).toHaveLength(1)
  })

  it('parcelamento marcado nunca vira assinatura', () => {
    const parcelas = serie('LOJA X', 15000, 6, 8, 10, { parcelamento_id: 'pa1' })
    expect(detectar(parcelas)).toEqual([])
  })

  it('parcela importada sem marca é pega pela descrição', () => {
    // O mesmo grupo, porque `chaveDoDestinatario` apaga os números — é
    // exatamente por isso que a pegada precisa ser testada no texto cru.
    const parcelas = [
      lanc('2025-06-10', 'LOJA X 1/3', 15000),
      lanc('2025-07-10', 'LOJA X 2/3', 15000),
      lanc('2025-08-10', 'LOJA X 3/3', 15000),
    ]
    expect(detectar(parcelas)).toEqual([])
  })

  it('duas cobranças no mesmo mês descartam o grupo inteiro', () => {
    const mercado = [
      ...serie('SUPERMERCADO SAO JOAO', 20000, 6, 8),
      lanc('2025-08-22', 'SUPERMERCADO SAO JOAO', 20000),
    ]
    expect(detectar(mercado)).toEqual([])
  })

  it('entrada recorrente não é assinatura', () => {
    const salario = serie('SALARIO', 500000, 6, 8, 5, { tipo: 'entrada' })
    expect(detectar(salario)).toEqual([])
  })

  it('o que já é gasto fixo não é sugerido de novo', () => {
    const netflix = serie('NETFLIX.COM', 3990, 6, 8)
    expect(detectar(netflix, [{ nome: 'Netflix.com' }])).toEqual([])
    // Nome diferente continua sendo sugestão: não é o mesmo gasto.
    expect(detectar(netflix, [{ nome: 'Aluguel' }])).toHaveLength(1)
  })

  it('herda a categoria e a forma mais usadas do grupo', () => {
    const com = [
      lanc('2025-06-10', 'SPOTIFY', 2190, { category_id: 'lazer', payment_method_id: 'cred' }),
      lanc('2025-07-10', 'SPOTIFY', 2190, { category_id: 'lazer', payment_method_id: 'cred' }),
      lanc('2025-08-10', 'SPOTIFY', 2190, { category_id: null, payment_method_id: 'cred' }),
    ]
    const [a] = detectar(com)
    expect(a.categoriaSugerida).toBe('lazer')
    expect(a.formaSugerida).toBe('cred')
    expect(a.nuncaClassificado).toBe(false)
  })

  it('marca a assinatura esquecida, que é metade do valor da ideia', () => {
    const [a] = detectar(serie('DOMINIO ANUAL', 4500, 1, 8))
    expect(a.nuncaClassificado).toBe(true)
    expect(a.mesesSeguidos).toBe(8)
    expect(textoDaAssinatura(a)).toBe('Sai da conta há 8 meses seguidos, sem categoria nenhuma.')
  })

  it('a mais longa vem primeiro, e o desempate é pelo valor', () => {
    const tudo = [
      ...serie('CURTA', 1000, 6, 8),
      ...serie('LONGA', 2000, 1, 8),
      ...serie('CURTA CARA', 9000, 6, 8, 12),
    ]
    expect(detectar(tudo).map((a) => a.rotulo)).toEqual(['LONGA', 'CURTA CARA', 'CURTA'])
  })

  it('o valor sugerido é o da cobrança mais recente, não a média', () => {
    // É ele que vai chegar no mês que vem; a média descreve o passado.
    const [a] = detectar(serie('NETFLIX', [3990, 4090, 4190], 6, 8))
    expect(a.valorSugerido).toBe(4190)
    expect(a.menorValor).toBe(3990)
    expect(a.maiorValor).toBe(4190)
  })

  it('lista vazia não inventa sugestão', () => {
    expect(detectar([])).toEqual([])
  })
})
