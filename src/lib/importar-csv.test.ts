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

  it('marca como já-no-banco o que já foi lançado no app', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n16/08/2026;Padaria;-8,00\n')
    const r = prepararImportacao({
      ...base,
      arquivo: a,
      mapa: adivinharColunas(a.cabecalho),
      existentes: [{ data: '2026-08-15', descricao: 'mercado', valor_centavos: 12050, tipo: 'gasto' }],
    })
    expect(r.prontos[0]).toMatchObject({ jaNoBanco: true, repetidoNoArquivo: false })
    expect(r.prontos[1]).toMatchObject({ jaNoBanco: false, repetidoNoArquivo: false })
  })

  it('separa "repetida no arquivo" de "já no banco" — são casos diferentes', () => {
    // Extrato repete de verdade: duas assinaturas iguais no mesmo dia, dois
    // débitos de cartão do mesmo valor. O saldo do banco conta as duas, então
    // a segunda NÃO pode ser descartada como se fosse reimportação.
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n15/08/2026;Mercado;-120,50\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos.map((p) => p.repetidoNoArquivo)).toEqual([false, true])
    expect(r.prontos.map((p) => p.jaNoBanco)).toEqual([false, false])
  })

  it('não confunde mesmo valor em dia diferente com repetição', () => {
    const a = arquivo('Data;Descrição;Valor\n15/08/2026;Mercado;-120,50\n16/08/2026;Mercado;-120,50\n')
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.prontos.map((p) => p.repetidoNoArquivo)).toEqual([false, false])
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

describe('formatos que os bancos brasileiros usam de verdade', () => {
  function rodar(csv: string) {
    const a = lerCSV(csv)
    const mapa = adivinharColunas(a.cabecalho)
    return { mapa, ...prepararImportacao({ ...base, arquivo: a, mapa }) }
  }

  it('Nubank: vírgula separando colunas e PONTO decimal, com dd/mm/aaaa', () => {
    const r = rodar(
      'Data,Valor,Identificador,Descrição\n' +
        '01/08/2026,-50.00,63d9a1,Transferência enviada pelo Pix\n' +
        '02/08/2026,1200.00,63d9a2,Transferência recebida pelo Pix\n' +
        '03/08/2026,-1234.56,63d9a3,Compra no débito\n',
    )
    expect(r.problemas).toEqual([])
    expect(r.prontos[0]).toMatchObject({ data: '2026-08-01', tipo: 'gasto', valor_centavos: 5000 })
    expect(r.prontos[1]).toMatchObject({ tipo: 'entrada', valor_centavos: 120000 })
    expect(r.prontos[2]).toMatchObject({ tipo: 'gasto', valor_centavos: 123456 })
  })

  it('extrato com coluna Saldo não confunde saldo com valor', () => {
    const r = rodar('Data;Lançamento;Valor;Saldo\n01/08/2026;PIX ENVIADO;-50,00;1.200,00\n')
    expect(r.mapa.valor).toBe(2)
    expect(r.prontos[0]).toMatchObject({ tipo: 'gasto', valor_centavos: 5000 })
  })

  it('Bradesco/Santander/Caixa: débito e crédito em COLUNAS SEPARADAS, sem sinal', () => {
    const r = rodar(
      'Data;Histórico;Débito;Crédito\n' +
        '01/08/2026;COMPRA SUPERMERCADO;50,00;\n' +
        '02/08/2026;DEPOSITO;;3.500,00\n' +
        '03/08/2026;TARIFA;12,90;0,00\n' +
        '04/08/2026;SEM VALOR NENHUM;;\n',
    )
    // A direção vem da coluna preenchida, não do sinal: sem isto a compra
    // entrava como ENTRADA e o depósito era descartado.
    expect(r.mapa).toMatchObject({ valor: -1, valorSaida: 2, valorEntrada: 3 })
    expect(r.prontos[0]).toMatchObject({ tipo: 'gasto', valor_centavos: 5000 })
    expect(r.prontos[1]).toMatchObject({ tipo: 'entrada', valor_centavos: 350000 })
    // "0,00" na coluna não usada é preenchimento, não um crédito de zero.
    expect(r.prontos[2]).toMatchObject({ tipo: 'gasto', valor_centavos: 1290 })
    expect(r.problemas).toEqual([
      { linha: 5, motivo: 'sem valor em débito nem em crédito', conteudo: expect.any(String) },
    ])
  })

  it('categoria e forma nunca são obrigatórias — extrato de banco não traz isso', () => {
    const r = rodar('Data;Descrição;Valor\n01/08/2026;Qualquer coisa;-10,00\n')
    expect(r.prontos[0]).toMatchObject({ category_id: null, payment_method_id: null })
    expect(r.problemas).toEqual([])
  })
})

describe('preâmbulo antes do cabeçalho', () => {
  // Formato do C6 Bank: oito linhas de nome do banco, agência, conta e período
  // antes da tabela. Assumir que a linha 1 é o cabeçalho fazia o arquivo
  // INTEIRO virar problema — 673 linhas descartadas, nenhuma importada.
  const C6 =
    'EXTRATO DE CONTA CORRENTE C6 BANK\n' +
    '\n' +
    'Agência: 1 / Conta: 123456\n' +
    'Extrato gerado em 22/08/2026 - as 21:27:22\n' +
    '\n' +
    'Extrato de 22/08/2025 a 22/08/2026\n' +
    '\n' +
    '\n' +
    'Data Lançamento,Data Contábil,Título,Descrição,Entrada(R$),Saída(R$),Saldo do Dia(R$)\n' +
    '22/08/2025,22/08/2025,Pix enviado para Fulano,TRANSF ENVIADA PIX,0.00,44.90,1216.52\n' +
    '25/08/2025,25/08/2025,Pix recebido de Beltrano,TRANSF RECEBIDA PIX,100.00,0.00,1316.52\n'

  it('acha o cabeçalho de verdade e diz quantas linhas pulou', () => {
    const a = lerCSV(C6)
    expect(a.separador).toBe(',')
    expect(a.cabecalho[0]).toBe('Data Lançamento')
    expect(a.linhas).toHaveLength(2)
    expect(a.puloPreambulo).toBeGreaterThan(0)
  })

  it('o separador sai do CABEÇALHO, não da primeira linha do arquivo', () => {
    // A linha 1 não tem vírgula nenhuma. Contando só nela, o palpite caía em
    // ';' e cada linha virava um campo só.
    expect(lerCSV(C6).separador).toBe(',')
  })

  it('mapeia Entrada/Saída como as duas colunas de valor, e não Data Contábil como forma', () => {
    const a = lerCSV(C6)
    const m = adivinharColunas(a.cabecalho)
    expect(m).toMatchObject({ data: 0, descricao: 2, valor: -1, valorEntrada: 4, valorSaida: 5 })
    // 'conta' casava por dentro de "Data Contábil" e apontava a forma de
    // pagamento para uma coluna de data.
    expect(m.forma).toBe(-1)
  })

  it('importa o extrato inteiro, com a direção certa', () => {
    const a = lerCSV(C6)
    const r = prepararImportacao({ ...base, arquivo: a, mapa: adivinharColunas(a.cabecalho) })
    expect(r.problemas).toEqual([])
    expect(r.prontos[0]).toMatchObject({ data: '2025-08-22', tipo: 'gasto', valor_centavos: 4490 })
    expect(r.prontos[1]).toMatchObject({ data: '2025-08-25', tipo: 'entrada', valor_centavos: 10000 })
  })

  it('arquivo que já começa no cabeçalho não pula nada', () => {
    const a = lerCSV('Data;Descrição;Valor\n15/08/2026;X;-10,00\n')
    expect(a.puloPreambulo).toBe(0)
    expect(a.cabecalho).toEqual(['Data', 'Descrição', 'Valor'])
  })
})
