import { describe, expect, it } from 'vitest'
import { estadoDoDesejo, montarDesejos, resumirWishlist, type MetaLigada } from './wishlist'
import type { WishlistItem } from './database.types'

function desejo(mudancas: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: mudancas.nome ?? 'w1',
    user_id: 'u',
    nome: 'Notebook',
    valor_centavos: 400000,
    prioridade: 3,
    concluido: false,
    concluido_em: null,
    created_at: '',
    goal_id: null,
    ...mudancas,
  }
}

const RESERVA: MetaLigada = { goal_id: 'g1', nome: 'Reserva', guardado_total: 100000 }
const VIAGEM: MetaLigada = { goal_id: 'g2', nome: 'Viagem', guardado_total: 50000 }

describe('estadoDoDesejo', () => {
  it('sem meta é só vontade', () => {
    expect(estadoDoDesejo({ concluido: false, goal_id: null })).toBe('quero')
  })

  it('com meta é "estou juntando"', () => {
    expect(estadoDoDesejo({ concluido: false, goal_id: 'g1' })).toBe('juntando')
  })

  it('conquistado ganha de tudo — inclusive de uma meta ainda ligada', () => {
    expect(estadoDoDesejo({ concluido: true, goal_id: 'g1' })).toBe('conquistado')
  })
})

describe('montarDesejos', () => {
  it('traz o nome da meta e o quanto ela tem', () => {
    const [d] = montarDesejos([desejo({ goal_id: 'g1' })], [RESERVA])
    expect(d.estado).toBe('juntando')
    expect(d.metaNome).toBe('Reserva')
    expect(d.guardadoNaMeta).toBe(100000)
    // R$ 1.000,00 de um desejo de R$ 4.000,00.
    expect(d.percentual).toBe(25)
  })

  it('desejo sem meta não inventa progresso', () => {
    const [d] = montarDesejos([desejo()], [RESERVA])
    expect(d.metaNome).toBeNull()
    expect(d.guardadoNaMeta).toBeNull()
    expect(d.percentual).toBeNull()
  })

  it('meta que não veio na lista deixa o número em branco, e não em zero', () => {
    // Zero diria "você não guardou nada"; branco diz "não sei", que é a verdade
    // enquanto a meta não chega (ou depois de ela ter sido apagada em outra aba).
    const [d] = montarDesejos([desejo({ goal_id: 'sumida' })], [RESERVA])
    expect(d.estado).toBe('juntando')
    expect(d.guardadoNaMeta).toBeNull()
    expect(d.percentual).toBeNull()
  })

  it('desejo sem valor não vira porcentagem de nada', () => {
    const [d] = montarDesejos([desejo({ goal_id: 'g1', valor_centavos: 0 })], [RESERVA])
    expect(d.percentual).toBeNull()
  })

  it('a meta que já cobre o desejo trava em 100%', () => {
    const [d] = montarDesejos([desejo({ goal_id: 'g1', valor_centavos: 50000 })], [RESERVA])
    expect(d.percentual).toBe(100)
  })

  it('avisa quando a MESMA meta banca mais de um desejo', () => {
    const desejos = montarDesejos(
      [desejo({ nome: 'a', goal_id: 'g1' }), desejo({ nome: 'b', goal_id: 'g1' })],
      [RESERVA],
    )
    expect(desejos.every((d) => d.metaCompartilhada)).toBe(true)
  })

  it('metas diferentes não se contaminam', () => {
    const desejos = montarDesejos(
      [desejo({ nome: 'a', goal_id: 'g1' }), desejo({ nome: 'b', goal_id: 'g2' })],
      [RESERVA, VIAGEM],
    )
    expect(desejos.every((d) => d.metaCompartilhada)).toBe(false)
  })

  it('o conquistado não conta para "meta compartilhada" — ele saiu do jogo', () => {
    const desejos = montarDesejos(
      [desejo({ nome: 'a', goal_id: 'g1' }), desejo({ nome: 'b', goal_id: 'g1', concluido: true })],
      [RESERVA],
    )
    expect(desejos[0].metaCompartilhada).toBe(false)
  })
})

describe('resumirWishlist', () => {
  it('conta os três estados separados', () => {
    const r = resumirWishlist(
      montarDesejos(
        [
          desejo({ nome: 'a' }),
          desejo({ nome: 'b' }),
          desejo({ nome: 'c', goal_id: 'g1' }),
          desejo({ nome: 'd', concluido: true }),
        ],
        [RESERVA],
      ),
    )
    expect(r).toMatchObject({ quero: 2, juntando: 1, conquistados: 1 })
  })

  it('"total desejado" é só o que NÃO tem meta — é vontade, não compromisso', () => {
    const r = resumirWishlist(
      montarDesejos(
        [desejo({ nome: 'a', valor_centavos: 300000 }), desejo({ nome: 'b', goal_id: 'g1' })],
        [RESERVA],
      ),
    )
    expect(r.totalDesejado).toBe(300000)
  })

  it('a mesma meta bancando dois desejos é contada UMA vez', () => {
    const r = resumirWishlist(
      montarDesejos([desejo({ nome: 'a', goal_id: 'g1' }), desejo({ nome: 'b', goal_id: 'g1' })], [RESERVA]),
    )
    // R$ 1.000,00, e não R$ 2.000,00 — o dinheiro é um só.
    expect(r.guardadoNasMetas).toBe(100000)
    expect(r.juntando).toBe(2)
  })

  it('metas diferentes somam', () => {
    const r = resumirWishlist(
      montarDesejos(
        [desejo({ nome: 'a', goal_id: 'g1' }), desejo({ nome: 'b', goal_id: 'g2' })],
        [RESERVA, VIAGEM],
      ),
    )
    expect(r.guardadoNasMetas).toBe(150000)
  })

  it('conquistado não entra em nenhuma soma', () => {
    const r = resumirWishlist(
      montarDesejos([desejo({ concluido: true, valor_centavos: 999999, goal_id: 'g1' })], [RESERVA]),
    )
    expect(r.totalDesejado).toBe(0)
    expect(r.guardadoNasMetas).toBe(0)
  })

  it('lista vazia é tudo zero', () => {
    expect(resumirWishlist([])).toEqual({
      quero: 0,
      juntando: 0,
      conquistados: 0,
      totalDesejado: 0,
      guardadoNasMetas: 0,
    })
  })
})
