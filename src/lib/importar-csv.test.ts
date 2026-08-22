import { describe, expect, it } from 'vitest'
import {
  adivinharColunas,
  decodificarTexto,
  detectarOrdemData,
  interpretarData,
  lerCSV,
  normalizar,
  prepararImportacao,
  type ArquivoCSV,
} from './importar-csv'

describe('lerCSV', () => {
  it('separa por ponto e vírgula e tira o BOM do Excel', () => {
    const r = lerCSV('﻿Data;Descrição;Valor\r\n15/08/2026;Mercado;-120,50\r\n')
    expect(r.separador).toBe(';')
    expect(r.cabecalho).toEqual(['Data', 'Descrição', 'Valor'])
    expect(r.linhas).toEqual([['15/08/2026', 'Mercado', '-120,50']])
  })

  it('separa por vírgula quando é esse o separador', () => {
    const r = lerCSV('date,description,amount\n2026-08-15,Coffee,-4.50\n')
    expect(r.separador).toBe(',')
    expect(r.linhas[0]).toEqual(['2026-08-15', 'Coffee', '-4.50'])
  })

  it('não deixa a vírgula de dentro das aspas escolher o separador', () => {
    const r = lerCSV('Data;Descrição;Valor\n15/08/2026;"Mercado, feira e açougue";-120,50\n')
    expect(r.separador).toBe(';')
    expect(r.linhas[0][1]).toBe('Mercado, feira e açougue')
  })

  it('entende aspas dobradas e quebra de linha dentro do campo', () => {
    const r = lerCSV('a;b\n"diz ""oi""";"linha 1\nlinha 2"\n')
    expect(r.linhas).toEqual([['diz "oi"', 'linha 1\nlinha 2']])
  })

  it('ignora linhas em branco no fim do arquivo', () => {
    const r = lerCSV('a;b\n1;2\n\n\n')
    expect(r.linhas).toEqual([['1', '2']])
  })

  it('devolve vazio sem estourar quando o arquivo não tem nada', () => {
    expect(lerCSV('').linhas).toEqual([])
    expect(lerCSV('   \n\n').cabecalho).toEqual([])
  })
})

describe('interpretarData', () => {
  it('aceita ISO', () => {
    expect(interpretarData('2026-08-15')).toBe('2026-08-15')
    expect(interpretarData('2026-8-5')).toBe('2026-08-05')
  })

  it('aceita dd/mm/aaaa e as variações de separador', () => {
    expect(interpretarData('15/08/2026')).toBe('2026-08-15')
    expect(interpretarData('15-08-2026')).toBe('2026-08-15')
    expect(interpretarData('15.08.2026')).toBe('2026-08-15')
  })

  it('completa o ano de dois dígitos para 20xx', () => {
    expect(interpretarData('15/08/26')).toBe('2026-08-15')
  })

  it('respeita a ordem mes-dia quando mandada', () => {
    expect(interpretarData('03/04/2026', 'mes-dia')).toBe('2026-03-04')
    expect(interpretarData('03/04/2026', 'dia-mes')).toBe('2026-04-03')
  })

  it('recusa dia que não existe em vez de rolar para o mês seguinte', () => {
    expect(interpretarData('31/02/2026')).toBeNull()
    expect(interpretarData('32/01/2026')).toBeNull()
    expect(interpretarData('15/13/2026')).toBeNull()
    expect(interpretarData('29/02/2025')).toBeNull() // 2025 não é bissexto
    expect(interpretarData('29/02/2024')).toBe('2024-02-29')
  })

  it('devolve null para lixo', () => {
    expect(interpretarData('')).toBeNull()
    expect(interpretarData('ontem')).toBeNull()
  })
})

describe('detectarOrdemData', () => {
  it('usa o dia acima de 12 como prova de dd/mm', () => {
    expect(detectarOrdemData(['03/04/2026', '25/04/2026'])).toBe('dia-mes')
  })

  it('usa o segundo campo acima de 12 como prova de mm/dd', () => {
    expect(detectarOrdemData(['03/04/2026', '04/25/2026'])).toBe('mes-dia')
  })

  it('cai no padrão brasileiro quando a coluna inteira é ambígua', () => {
    expect(detectarOrdemData(['03/04/2026', '05/06/2026'])).toBe('dia-mes')
  })
})

describe('adivinharColunas', () => {
  it('acha as colunas do CSV que o próprio app exporta', () => {
    const m = adivinharColunas([
      'Tipo',
      'Data',
      'Descrição',
      'Forma de pagamento',
      'Categoria',
      'Valor (R$)',
      'Pago?',
    ])
    expect(m.data).toBe(1)
    expect(m.descricao).toBe(2)
    expect(m.forma).toBe(3)
    expect(m.categoria).toBe(4)
    expect(m.valor).toBe(5)
  })

  it('acha colunas em inglês', () => {
    const m = adivinharColunas(['date', 'description', 'amount'])
    expect(m).toMatchObject({ data: 0, descricao: 1, valor: 2 })
  })

  it('não usa a mesma coluna para dois campos', () => {
    const m = adivinharColunas(['data', 'data do lançamento', 'valor'])
    expect(m.data).not.toBe(-1)
    expect(new Set([m.data, m.valor]).size).toBe(2)
  })

  it('devolve -1 no campo que não achou', () => {
    expect(adivinharColunas(['col1', 'col2']).valor).toBe(-1)
  })
})

// ---------------------------------------------------------------------------

const CATEGORIAS = [
  { id: 'cat-mercado', nome: 'Mercado' },
  { id: 'cat-transporte', nome: 'Transporte' },
]
const FORMAS = [{ id: 'forma-pix', nome: 'Pix' }]

function arquivo(csv: string): ArquivoCSV {
  return lerCSV(csv)
}

const base = {
  regraSinal: 'pelo-sinal' as const,
  categorias: CATEGORIAS,
  formas: FORMAS,
  existentes: [],
}

describe('prepararImportacao', () => {
  it('transforma as linhas em lançamentos com o tipo vindo do sinal', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n20/08/2026;Salário;3500,00\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })

    expect(r.problemas).toEqual([])
    expect(r.prontos).toHaveLength(2)
    expect(r.prontos[0]).toMatchObject({ data: '2026-08-15', valor_centavos: 12050, tipo: 'gasto' })
    expect(r.prontos[1]).toMatchObject({ data: '2026-08-20', valor_centavos: 350000, tipo: 'entrada' })
  })

  it('guarda o valor sempre positivo — quem diz a direção é o tipo', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos[0].valor_centavos).toBeGreaterThan(0)
  })

  it('força o tipo quando a regra manda', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;120,50\n')
    const forcado = prepararImportacao({
      ...base,
      arquivo: a,
      mapa: adivinharColunas(a.cabecalho),
      regraSinal: 'tudo-gasto',
    })
    expect(forcado.prontos[0].tipo).toBe('gasto')
  })

  it('liga categoria e forma pelo nome, sem ligar para acento ou caixa', () => {
    const a = arquivo(
      'Data;Descrição;Valor;Categoria;Forma de pagamento\n15/08/2026;X;-10,00;TRANSPORTE;pix\n',
    )
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos[0]).toMatchObject({ category_id: 'cat-transporte', payment_method_id: 'forma-pix' })
  })

  it('deixa em branco a categoria que não existe, em vez de inventar', () => {
    const a = arquivo('Data;Descrição;Valor;Categoria\n15/08/2026;X;-10,00;Viagem\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos[0].category_id).toBeNull()
  })

  it('separa as linhas ruins em problemas, com o número da linha da planilha', () => {
    const a = arquivo('Data;Descrição;Valor\nontem;X;-10,00\n15/08/2026;Y;abc\n15/08/2026;Z;0,00\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })

    expect(r.prontos).toEqual([])
    expect(r.problemas.map((p) => [p.linha, p.motivo])).toEqual([
      [2, 'data não reconhecida'],
      [3, 'valor não reconhecido'],
      [4, 'valor zerado'],
    ])
  })

  it('marca como duplicado o que já está no banco', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n16/08/2026;Padaria;-8,00\n')
    const r = prepararImportacao({
      ...base,
      arquivo: a,
      mapa: adivinharColunas(a.cabecalho),
      existentes: [{ data: '2026-08-15', descricao: 'mercado', valor_centavos: 12050, tipo: 'gasto' }],
    })
    expect(r.prontos[0].duplicado).toBe(true)
    expect(r.prontos[1].duplicado).toBe(false)
  })

  it('marca também a linha repetida dentro do próprio arquivo', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n15/08/2026;Mercado;-120,50\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos.map((p) => p.duplicado)).toEqual([false, true])
  })

  it('não confunde mesmo valor em dia diferente com duplicata', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n16/08/2026;Mercado;-120,50\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos.map((p) => p.duplicado)).toEqual([false, false])
  })

  it('põe um texto no lugar da descrição vazia, para não gravar nada em branco', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;;-10,00\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos[0].descricao).toBe('Sem descrição')
  })

  it('lê o extrato de banco em inglês, com ponto decimal', () => {
    const a = arquivo('date,description,amount\n2026-08-15,Coffee shop,-4.50\n2026-08-16,Refund,12.00\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos[0]).toMatchObject({ valor_centavos: 450, tipo: 'gasto' })
    expect(r.prontos[1]).toMatchObject({ valor_centavos: 1200, tipo: 'entrada' })
  })

  it('devolve a ordem de data que usou, para a tela poder mostrar', () => {
    const a = arquivo('Data;Descrição;Valor\n25/04/2026;X;-1,00\n03/04/2026;Y;-2,00\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.ordemData).toBe('dia-mes')
    expect(r.prontos[1].data).toBe('2026-04-03')
  })
})

describe('normalizar', () => {
  it('tira acento, caixa e espaço das pontas', () => {
    expect(normalizar('  Alimentação  ')).toBe('alimentacao')
    expect(normalizar('CARTÃO')).toBe('cartao')
  })
})

describe('decodificarTexto', () => {
  it('lê UTF-8 normalmente', () => {
    const bytes = new TextEncoder().encode('Alimentação;12,50')
    expect(decodificarTexto(bytes.buffer as ArrayBuffer)).toBe('Alimentação;12,50')
  })

  it('cai para windows-1252 quando o arquivo não é UTF-8 válido', () => {
    // "Alimentação" em windows-1252: ç = 0xE7, ã = 0xE3 (bytes soltos, que o
    // UTF-8 recusa). É assim que o Excel pt-BR grava.
    const bytes = Uint8Array.from([
      0x41, 0x6c, 0x69, 0x6d, 0x65, 0x6e, 0x74, 0x61, 0xe7, 0xe3, 0x6f, 0x3b, 0x31, 0x32, 0x2c, 0x35, 0x30,
    ])
    expect(decodificarTexto(bytes.buffer as ArrayBuffer)).toBe('Alimentação;12,50')
  })
})
