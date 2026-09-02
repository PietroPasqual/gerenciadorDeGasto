import { describe, expect, it } from 'vitest'
import {
  CAMPOS_DO_PERFIL,
  TABELAS_BACKUP,
  VERSAO_BACKUP,
  lerBackup,
  montarBackup,
  nomeDoArquivo,
  perfilParaRestaurar,
  prepararRestauracao,
  totalDeLinhas,
  type Backup,
  type Linha,
} from './backup'

const USUARIO = 'u-atual'

const lanc = (id: string, data: string, descricao: string, valor: number, extra: Linha = {}): Linha => ({
  id,
  user_id: 'u-antigo',
  data,
  descricao,
  valor_centavos: valor,
  tipo: 'gasto',
  ...extra,
})

function arquivo(dados: Backup['dados'], perfil?: Linha): Backup {
  return montarBackup(dados, { perfil, agora: new Date('2026-08-31T12:00:00Z') })
}

const planejar = (backup: Backup, existentes: Backup['dados'] = {}) =>
  prepararRestauracao({ backup, existentes, userId: USUARIO })

describe('a ordem das tabelas protege as chaves estrangeiras', () => {
  it('quem é apontado entra antes de quem aponta', () => {
    const pos = (t: string) => TABELAS_BACKUP.indexOf(t as never)
    expect(pos('goals')).toBeLessThan(pos('goal_contributions'))
    expect(pos('categories')).toBeLessThan(pos('transactions'))
    expect(pos('payment_methods')).toBeLessThan(pos('transactions'))
    expect(pos('fixed_expenses')).toBeLessThan(pos('fixed_expense_payments'))
    expect(pos('payment_methods')).toBeLessThan(pos('invoice_payments'))
  })
})

describe('lerBackup', () => {
  it('aceita o que o próprio app gera', () => {
    const gerado = arquivo({ categories: [{ id: 'c1', nome: 'Mercado' }] })
    const lido = lerBackup(JSON.stringify(gerado))
    expect(lido.ok).toBe(true)
    if (lido.ok) expect(lido.backup.dados.categories).toHaveLength(1)
  })

  it('recusa texto que não é JSON', () => {
    const r = lerBackup('isto não é json')
    expect(r).toEqual({ ok: false, erro: 'Este arquivo não é um JSON válido.' })
  })

  it('recusa um JSON qualquer que não seja backup do finZ', () => {
    const r = lerBackup('{"alguma":"coisa"}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/não é um backup do finZ/)
  })

  it('recusa arquivo de versão futura em vez de ignorar campos em silêncio', () => {
    const r = lerBackup(JSON.stringify({ formato: 'finz-backup', versao: VERSAO_BACKUP + 1, dados: {} }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/Atualize o app/)
  })

  it('recusa seção corrompida em vez de restaurar pela metade', () => {
    const r = lerBackup(
      JSON.stringify({ formato: 'finz-backup', versao: 1, dados: { transactions: 'nada disso' } }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/Lançamentos/)
  })

  it('descarta a linha estragada e salva o resto do arquivo', () => {
    const r = lerBackup(
      JSON.stringify({ formato: 'finz-backup', versao: 1, dados: { categories: [{ id: 'c1' }, 42, null] } }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.dados.categories).toHaveLength(1)
  })

  it('ignora tabela desconhecida do arquivo', () => {
    const r = lerBackup(
      JSON.stringify({ formato: 'finz-backup', versao: 1, dados: { tabela_inventada: [{ id: 'x' }] } }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(totalDeLinhas(r.backup.dados)).toBe(0)
  })
})

describe('prepararRestauracao', () => {
  it('conta o que entra e o que já existe, tabela por tabela', () => {
    const plano = planejar(
      arquivo({
        categories: [
          { id: 'c1', nome: 'Mercado' },
          { id: 'c2', nome: 'Casa' },
        ],
      }),
      { categories: [{ id: 'c1', nome: 'Mercado' }] },
    )
    const cat = plano.itens.find((i) => i.tabela === 'categories')!
    expect(cat.rotulo).toBe('Categorias')
    expect(cat.noArquivo).toBe(2)
    expect(cat.entram).toBe(1)
    expect(cat.jaExistem).toBe(1)
    expect(plano.totalEntram).toBe(1)
  })

  it('o dono é sempre quem está logado, nunca o que o arquivo diz', () => {
    const plano = planejar(arquivo({ categories: [{ id: 'c1', user_id: 'outra-pessoa' }] }))
    expect(plano.itens[0].linhas[0].user_id).toBe(USUARIO)
  })

  it('restaurar o mesmo arquivo duas vezes não duplica nada', () => {
    const f = arquivo({ transactions: [lanc('t1', '2026-08-05', 'Mercado', 30000)] })
    const primeira = planejar(f)
    expect(primeira.totalEntram).toBe(1)
    // Depois de gravar, as linhas viram "existentes".
    const segunda = planejar(f, { transactions: primeira.itens[0].linhas })
    expect(segunda.totalEntram).toBe(0)
    expect(segunda.totalJaExistem).toBe(1)
  })

  it('a impressão digital pega a linha que já existe com OUTRO id', () => {
    // O caso real: você reimportou o CSV depois do backup, e o lançamento
    // voltou com id novo. Só o id não veria isso, e duplicaria em silêncio.
    const plano = planejar(arquivo({ transactions: [lanc('t1', '2026-08-05', 'Mercado', 30000)] }), {
      transactions: [lanc('OUTRO-ID', '2026-08-05', 'Mercado', 30000)],
    })
    expect(plano.totalEntram).toBe(0)
    expect(plano.totalJaExistem).toBe(1)
  })

  it('a digital não confunde dois cafés de verdade com uma repetição', () => {
    // Dois iguais no arquivo, um só aqui: entra exatamente um.
    const plano = planejar(
      arquivo({
        transactions: [lanc('t1', '2026-08-05', 'Café', 800), lanc('t2', '2026-08-05', 'Café', 800)],
      }),
      { transactions: [lanc('x1', '2026-08-05', 'Café', 800)] },
    )
    expect(plano.totalEntram).toBe(1)
    expect(plano.totalJaExistem).toBe(1)
  })

  it('a digital olha o conteúdo, não a coluna — o que foi digitado à mão tem fingerprint nulo', () => {
    const plano = planejar(
      arquivo({ transactions: [lanc('t1', '2026-08-05', 'Mercado', 30000, { fingerprint: 'abc' })] }),
      { transactions: [lanc('x1', '2026-08-05', 'Mercado', 30000, { fingerprint: null })] },
    )
    expect(plano.totalEntram).toBe(0)
  })

  it('valor diferente é outro lançamento, e entra', () => {
    const plano = planejar(arquivo({ transactions: [lanc('t1', '2026-08-05', 'Mercado', 30000)] }), {
      transactions: [lanc('x1', '2026-08-05', 'Mercado', 30001)],
    })
    expect(plano.totalEntram).toBe(1)
  })

  it('categoria com o mesmo nome já é a mesma categoria', () => {
    // Não é uma escolha de estilo: quando o arquivo vem de outra conta, o id é
    // renomeado na gravação e deixa de servir de referência. Sem a chave de
    // nome, restaurar o mesmo arquivo duas vezes duplicaria a conta inteira.
    const plano = planejar(arquivo({ categories: [{ id: 'c1', nome: 'Mercado' }] }), {
      categories: [{ id: 'c9', nome: 'Mercado' }],
    })
    expect(plano.totalEntram).toBe(0)
    expect(plano.totalJaExistem).toBe(1)
  })

  it('nome diferente continua entrando', () => {
    const plano = planejar(arquivo({ categories: [{ id: 'c1', nome: 'Farmácia' }] }), {
      categories: [{ id: 'c9', nome: 'Mercado' }],
    })
    expect(plano.totalEntram).toBe(1)
  })

  it('a chave de conteúdo ignora colunas nulas, como o índice único do Postgres', () => {
    // Dois lançamentos com fingerprint nulo convivem no banco; o plano não
    // pode recusá-los como se fossem o mesmo.
    const plano = planejar(
      arquivo({ transactions: [lanc('t1', '2026-08-05', 'A', 100, { fingerprint: null })] }),
      { transactions: [lanc('x1', '2026-08-06', 'B', 200, { fingerprint: null })] },
    )
    expect(plano.totalEntram).toBe(1)
  })

  it('linha sem id é descartada: sem id não dá para evitar duplicata', () => {
    const plano = planejar(arquivo({ categories: [{ nome: 'Sem id' }, { id: 'c1', nome: 'Ok' }] }))
    expect(plano.descartadas).toBe(1)
    expect(plano.totalEntram).toBe(1)
  })

  it('arquivo vazio não gera plano nenhum', () => {
    const plano = planejar(arquivo({}))
    expect(plano.itens).toEqual([])
    expect(plano.totalEntram).toBe(0)
  })

  it('a ordem do plano é a ordem de inserção', () => {
    const plano = planejar(
      arquivo({ transactions: [lanc('t1', '2026-08-05', 'X', 1)], categories: [{ id: 'c1' }] }),
    )
    expect(plano.itens.map((i) => i.tabela)).toEqual(['categories', 'transactions'])
  })
})

describe('o arquivo', () => {
  it('carrega formato e versão, para poder ser recusado depois', () => {
    const f = arquivo({ categories: [{ id: 'c1' }] })
    expect(f.formato).toBe('finz-backup')
    expect(f.versao).toBe(VERSAO_BACKUP)
    expect(f.geradoEm).toBe('2026-08-31T12:00:00.000Z')
  })

  it('o nome do arquivo diz o dia', () => {
    expect(nomeDoArquivo(new Date('2026-08-31T12:00:00Z'))).toBe('finz-backup-2026-08-31.json')
  })

  it('sobrevive à ida e volta por JSON', () => {
    const original = arquivo({ transactions: [lanc('t1', '2026-08-05', 'Mercado', 30000)] })
    const lido = lerBackup(JSON.stringify(original))
    expect(lido.ok).toBe(true)
    if (lido.ok) expect(lido.backup.dados).toEqual(original.dados)
  })
})

describe('o perfil é o único lugar em que restaurar substitui', () => {
  it('leva só os campos conhecidos, nunca o id nem o created_at', () => {
    const p = perfilParaRestaurar({
      id: 'de-outra-conta',
      created_at: '2020-01-01',
      nome: 'Pietro',
      tema: 'azul',
      orcamento_centavos: 500000,
      preferencias_lembrete: { dias_antes: 5 },
      assinaturas_ignoradas: ['netflix com'],
      painel_ordem: ['saldo', 'categorias'],
      painel_ocultos: ['atalhos'],
      painel_capa: 'mata',
      // Estado, e não preferência: o guia de primeiro acesso não pode
      // reaparecer nem sumir por causa de um arquivo restaurado. Está aqui
      // para o teste provar que a extração o DEIXA de fora.
      onboarding_em: '2025-01-01T00:00:00Z',
      onboarding_vistos: ['categorias'],
    })
    expect(Object.keys(p!).sort()).toEqual([...CAMPOS_DO_PERFIL].sort())
    expect(p).not.toHaveProperty('onboarding_em')
    expect(p).not.toHaveProperty('onboarding_vistos')
    expect(p).not.toHaveProperty('id')
    expect(p).not.toHaveProperty('created_at')
  })

  it('arquivo sem perfil não devolve nada para gravar', () => {
    expect(perfilParaRestaurar(undefined)).toBeNull()
    expect(perfilParaRestaurar({ id: 'x' })).toBeNull()
  })

  it('o perfil sobrevive à ida e volta por JSON', () => {
    const f = arquivo({}, { nome: 'Pietro', tema: 'verde' })
    const lido = lerBackup(JSON.stringify(f))
    expect(lido.ok).toBe(true)
    if (lido.ok) expect(lido.backup.perfil).toEqual({ nome: 'Pietro', tema: 'verde' })
  })
})
