import { describe, expect, it } from 'vitest'
import { impressaoDigital, impressoesDigitais } from './impressao-digital'

const cafe = { data: '2025-08-12', descricao: 'Cafeteria Central', valor_centavos: 800, tipo: 'gasto' }

describe('impressaoDigital', () => {
  it('é estável: o mesmo lançamento dá sempre o mesmo valor', () => {
    expect(impressaoDigital({ ...cafe, ocorrencia: 1 })).toBe(impressaoDigital({ ...cafe, ocorrencia: 1 }))
  })

  it('ignora acento e caixa da descrição, porque o extrato varia neles', () => {
    expect(impressaoDigital({ ...cafe, descricao: 'CAFETERIA CENTRAL', ocorrencia: 1 })).toBe(
      impressaoDigital({ ...cafe, ocorrencia: 1 }),
    )
    expect(impressaoDigital({ ...cafe, descricao: 'Padaria São João', ocorrencia: 1 })).toBe(
      impressaoDigital({ ...cafe, descricao: 'PADARIA SAO JOAO', ocorrencia: 1 }),
    )
  })

  it('muda quando qualquer parte da chave muda', () => {
    const base = impressaoDigital({ ...cafe, ocorrencia: 1 })
    expect(impressaoDigital({ ...cafe, ocorrencia: 2 })).not.toBe(base)
    expect(impressaoDigital({ ...cafe, valor_centavos: 801, ocorrencia: 1 })).not.toBe(base)
    expect(impressaoDigital({ ...cafe, data: '2025-08-13', ocorrencia: 1 })).not.toBe(base)
    expect(impressaoDigital({ ...cafe, tipo: 'entrada', ocorrencia: 1 })).not.toBe(base)
  })

  it('tem sempre 16 caracteres hexadecimais', () => {
    for (const valor of [0, 1, 999999999, -5]) {
      expect(impressaoDigital({ ...cafe, valor_centavos: valor, ocorrencia: 1 })).toMatch(/^[0-9a-f]{16}$/)
    }
  })
})

describe('impressoesDigitais — dois cafés x reimportação', () => {
  it('dá impressões diferentes para dois gastos iguais no mesmo dia', () => {
    const [primeiro, segundo] = impressoesDigitais([cafe, cafe])
    expect(primeiro).not.toBe(segundo)
  })

  it('reimportar o mesmo arquivo recalcula exatamente as mesmas impressões', () => {
    const arquivo = [cafe, { ...cafe, descricao: 'Mercado' }, cafe]
    expect(impressoesDigitais(arquivo)).toEqual(impressoesDigitais(arquivo))
  })

  it('a numeração é por chave, não pela posição na lista', () => {
    // Linhas de outro lançamento no meio não podem empurrar a contagem do café.
    const comIntruso = impressoesDigitais([cafe, { ...cafe, descricao: 'Mercado' }, cafe])
    const semIntruso = impressoesDigitais([cafe, cafe])
    expect(comIntruso[0]).toBe(semIntruso[0])
    expect(comIntruso[2]).toBe(semIntruso[1])
  })

  it('não colide entre lançamentos diferentes de um extrato inteiro', () => {
    const lista = Array.from({ length: 2000 }, (_, i) => ({
      data: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      descricao: `Lançamento ${i}`,
      valor_centavos: 100 + i,
      tipo: i % 2 === 0 ? 'gasto' : 'entrada',
    }))
    expect(new Set(impressoesDigitais(lista)).size).toBe(lista.length)
  })
})

describe('idempotência de uma importação inteira', () => {
  /** Imita o índice único `(user_id, fingerprint)` da 0008. */
  function banco() {
    const guardadas = new Set<string>()
    return {
      gravar(impressoes: string[]) {
        let novos = 0
        for (const f of impressoes) {
          if (guardadas.has(f)) continue
          guardadas.add(f)
          novos++
        }
        return { novos, jaExistiam: impressoes.length - novos }
      },
      total: () => guardadas.size,
    }
  }

  const extrato = [
    { data: '2025-08-01', descricao: 'Padaria', valor_centavos: 1250, tipo: 'gasto' },
    { data: '2025-08-01', descricao: 'Cafeteria', valor_centavos: 800, tipo: 'gasto' },
    { data: '2025-08-01', descricao: 'Cafeteria', valor_centavos: 800, tipo: 'gasto' },
    { data: '2025-08-02', descricao: 'Salário', valor_centavos: 500000, tipo: 'entrada' },
  ]

  it('a segunda importação do mesmo arquivo não grava nada', () => {
    const db = banco()
    expect(db.gravar(impressoesDigitais(extrato))).toEqual({ novos: 4, jaExistiam: 0 })
    expect(db.gravar(impressoesDigitais(extrato))).toEqual({ novos: 0, jaExistiam: 4 })
    expect(db.total()).toBe(4)
  })

  it('retomar uma importação que morreu no meio completa o que faltou', () => {
    const db = banco()
    // O primeiro bloco entrou e o segundo falhou.
    const impressoes = impressoesDigitais(extrato)
    db.gravar(impressoes.slice(0, 2))
    // O usuário manda o arquivo inteiro de novo.
    expect(db.gravar(impressoes)).toEqual({ novos: 2, jaExistiam: 2 })
    expect(db.total()).toBe(4)
  })

  it('os dois cafés do dia sobrevivem às duas importações', () => {
    const db = banco()
    db.gravar(impressoesDigitais(extrato))
    db.gravar(impressoesDigitais(extrato))
    // 4 linhas, e nenhuma delas é o café perdido: as duas cópias ficaram.
    expect(db.total()).toBe(4)
  })
})
