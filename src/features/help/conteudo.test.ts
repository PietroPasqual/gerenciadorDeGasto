import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRUPOS, TOPICOS, topicoPorId } from './conteudo'

describe('o manual', () => {
  it('não tem id repetido — dois blocos com a mesma âncora fariam o link cair no errado', () => {
    const ids = TOPICOS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo tópico pertence a um grupo que existe, senão ele não é desenhado', () => {
    const grupos = new Set(GRUPOS.map((g) => g.id))
    for (const t of TOPICOS) expect(grupos.has(t.grupo), `${t.id}`).toBe(true)
  })

  it('nenhum tópico é uma casca vazia', () => {
    for (const t of TOPICOS) {
      expect(t.titulo.trim().length, t.id).toBeGreaterThan(0)
      expect(t.resumo.trim().length, t.id).toBeGreaterThan(0)
      expect(t.corpo.length, t.id).toBeGreaterThan(0)
    }
  })

  it('cobre os seis assuntos que a fase 6 exige por escrito', () => {
    for (const id of ['competencia-e-caixa', 'fatura', 'parcelamento', 'backup', 'offline', 'importar']) {
      expect(topicoPorId(id), id).toBeDefined()
    }
  })
})

/**
 * Todo `<LinkAjuda topico="x">` do app aponta para um tópico que existe.
 *
 * Um link de ajuda quebrado é pior do que link nenhum: a página abre, rola para
 * lugar nenhum, e a pessoa conclui que a explicação não existe. Como o destino
 * é uma string solta, o TypeScript não pega — quem pega é isto, varrendo a
 * árvore atrás das chamadas reais.
 */
describe('os links contextuais', () => {
  const raiz = path.resolve(__dirname, '../..')

  function arquivos(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const caminho = path.join(dir, e.name)
      if (e.isDirectory()) return arquivos(caminho)
      // Os próprios testes ficam de fora: este arquivo cita a chamada num
      // comentário, e sem o corte ele se acha e reprova a si mesmo.
      if (/\.test\.tsx?$/.test(e.name)) return []
      return /\.tsx?$/.test(e.name) ? [caminho] : []
    })
  }

  const usos = arquivos(raiz).flatMap((caminho) => {
    const fonte = readFileSync(caminho, 'utf8')
    return [...fonte.matchAll(/<LinkAjuda[^>]*\stopico="([^"]+)"/g)].map((m) => ({
      id: m[1],
      arquivo: path.relative(raiz, caminho),
    }))
  })

  it('existem — se este número cair a zero, os links sumiram do app', () => {
    expect(usos.length).toBeGreaterThan(0)
  })

  it('apontam para tópicos que existem', () => {
    for (const uso of usos) {
      expect(topicoPorId(uso.id), `${uso.arquivo} aponta para "${uso.id}"`).toBeDefined()
    }
  })
})
