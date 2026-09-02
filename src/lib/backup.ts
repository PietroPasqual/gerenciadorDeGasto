import { impressoesDigitais } from './impressao-digital'

/**
 * Levar os dados embora inteiros, e trazê-los de volta.
 *
 * O app já exportava CSV por mês e por ano, e já sabia apagar tudo. Faltava a
 * saída completa — a que serve para trocar de conta, guardar uma cópia antes
 * de mexer em algo, ou simplesmente não ficar refém do app.
 *
 * A REGRA QUE DEFINE TUDO AQUI: RESTAURAR NUNCA APAGA NEM SOBRESCREVE.
 *
 * Só entra o que falta. Isso é o que permite explicar a operação numa frase
 * ("nada do que já está aqui muda") e o que torna seguro clicar duas vezes por
 * engano. Uma restauração que sobrescrevesse precisaria de uma tela de
 * conflito inteira para não perder edição — e isso é a fase 7, não esta.
 *
 * DUAS DEFESAS CONTRA DUPLICATA, PORQUE UMA SÓ NÃO BASTA
 *
 * 1. O `id` viaja no arquivo. Restaurar na MESMA conta esbarra na chave
 *    primária e não duplica nada, linha por linha.
 * 2. A impressão digital da 0008, calculada pelo CONTEÚDO dos dois lados.
 *    Necessária porque a linha pode existir aqui com outro id — foi digitada
 *    de novo, ou veio de um CSV reimportado depois do backup. Sem ela, esse
 *    caso duplicaria em silêncio, que é o pior defeito possível num arquivo
 *    de dinheiro.
 *
 * A digital é recalculada em vez de lida da coluna: a coluna só existe para o
 * que veio de CSV, e o lançamento digitado à mão tem `fingerprint` nulo.
 * Comparar colunas nulas não compara nada.
 */

/**
 * Versão do formato, não do app.
 *
 * Sobe quando um arquivo antigo deixar de poder ser lido como está. A leitura
 * recusa o que for MAIOR que esta versão — um arquivo do futuro pode conter
 * campos que esta versão ignoraria em silêncio, e ignorar dado em silêncio
 * numa restauração é perder dado.
 */
export const VERSAO_BACKUP = 1

/**
 * A ordem é a de INSERÇÃO, e ela importa: quem é apontado entra primeiro.
 *
 * `goal_contributions` aponta para `goals`, `transactions` aponta para
 * `categories` e `payment_methods`. Inserir na ordem errada é violação de
 * chave estrangeira no meio da restauração, com metade dos dados dentro.
 */
export const TABELAS_BACKUP = [
  'payment_methods',
  'categories',
  'goals',
  'recurring_incomes',
  'fixed_expenses',
  'wishlist_items',
  'goal_contributions',
  'incomes',
  'fixed_expense_payments',
  'transactions',
  'investments',
  'invoice_payments',
  'category_rules',
] as const

export type TabelaBackup = (typeof TABELAS_BACKUP)[number]

/** Nome de cada tabela em português, para a tela poder dizer o que vai entrar. */
export const ROTULO_TABELA: Record<TabelaBackup, string> = {
  payment_methods: 'Formas de pagamento',
  categories: 'Categorias',
  goals: 'Metas',
  recurring_incomes: 'Entradas recorrentes',
  fixed_expenses: 'Gastos fixos',
  wishlist_items: 'Lista de desejos',
  goal_contributions: 'Aportes em metas',
  incomes: 'Entradas avulsas',
  fixed_expense_payments: 'Marcações de pago',
  transactions: 'Lançamentos',
  investments: 'Investimentos',
  invoice_payments: 'Faturas pagas',
  category_rules: 'Regras de categoria',
}

export type Linha = Record<string, unknown> & { id?: unknown }

/**
 * As colunas que apontam para OUTRA linha do backup.
 *
 * Tirada do schema com uma consulta ao `pg_constraint`, não de memória — a
 * lista escrita à mão é a que esquece a chave nova da migration seguinte.
 * `user_id` não entra: ele nunca é remapeado, é sempre reescrito para quem
 * está logado.
 *
 * Existe por causa de um caso que o teste contra Postgres encontrou e a
 * cabeça não tinha previsto: restaurar numa SEGUNDA CONTA DO MESMO BANCO.
 * Os ids do arquivo já existem lá — são os da conta de origem —, e a RLS
 * esconde essas linhas. O insert então bate na chave primária, o
 * `on conflict do nothing` engole, e a restauração grava ZERO dizendo que
 * gravou tudo. Silêncio é o pior desfecho possível aqui.
 */
export const REFERENCIAS: Partial<Record<TabelaBackup, Array<[string, TabelaBackup]>>> = {
  fixed_expenses: [
    ['category_id', 'categories'],
    ['payment_method_id', 'payment_methods'],
  ],
  goal_contributions: [['goal_id', 'goals']],
  fixed_expense_payments: [['fixed_expense_id', 'fixed_expenses']],
  transactions: [
    ['category_id', 'categories'],
    ['payment_method_id', 'payment_methods'],
  ],
  investments: [['goal_id', 'goals']],
  invoice_payments: [['payment_method_id', 'payment_methods']],
  category_rules: [['category_id', 'categories']],
}

/**
 * As chaves ÚNICAS que não são a chave primária — as "já existe" de conteúdo.
 *
 * Também tiradas do schema, e também por causa de uma falha real: o plano só
 * comparava ids, e a restauração morria no meio com
 * `duplicate key value violates unique constraint "category_rules_user_id_termo_key"`.
 * O `on conflict (id) do nothing` protege a chave primária e mais nada; toda
 * outra unicidade estoura e aborta a restauração com metade dos dados dentro.
 *
 * Conhecendo-as, o plano decide ANTES: a linha aparece na prévia como "já está
 * aqui" em vez de ser prometida e recusada.
 *
 * `user_id` fica de fora das colunas porque os dois lados são o mesmo usuário.
 */
export const CHAVES_NATURAIS: Partial<Record<TabelaBackup, string[]>> = {
  // Garantidas pelo banco (índice único). Restaurar sem conhecê-las estoura.
  category_rules: ['termo'],
  fixed_expense_payments: ['fixed_expense_id', 'ano', 'mes'],
  goal_contributions: ['goal_id', 'ano', 'mes'],
  invoice_payments: ['payment_method_id', 'ano', 'mes'],
  transactions: ['fingerprint'],

  /**
   * De CONTEÚDO, não garantidas pelo banco — e necessárias mesmo assim.
   *
   * Quando o arquivo vem de outra conta do mesmo banco, os ids são renomeados
   * na gravação (ver REFERENCIAS), e a partir daí o id do arquivo não casa com
   * nada. Sem uma chave de conteúdo, restaurar o MESMO arquivo duas vezes
   * duplicaria a conta inteira — que é o defeito que este arquivo existe para
   * impedir.
   *
   * Só colunas estáveis: nada de `payment_method_id` aqui, porque ele é
   * justamente o que pode ter sido renomeado. O critério é o que uma pessoa
   * usaria para dizer "isso eu já tenho": o nome, e o valor quando o nome
   * sozinho se repete de propósito.
   */
  payment_methods: ['nome'],
  categories: ['nome'],
  goals: ['nome'],
  wishlist_items: ['nome', 'valor_centavos'],
  recurring_incomes: ['descricao', 'valor_centavos'],
  fixed_expenses: ['nome', 'valor_centavos'],
  incomes: ['ano', 'mes', 'descricao', 'valor_centavos'],
  investments: ['ano', 'mes', 'valor_centavos', 'descricao'],
}

/**
 * A chave de conteúdo de uma linha, ou `null` quando algum pedaço é nulo.
 *
 * Nulo devolve `null` de propósito: no Postgres, nulo num índice único não
 * conflita com nada — dois lançamentos com `fingerprint` nulo convivem. Tratar
 * nulo como valor faria o plano recusar linhas que o banco aceitaria.
 */
export function chaveNatural(linha: Linha, colunas: string[]): string | null {
  const partes: string[] = []
  for (const c of colunas) {
    const v = linha[c]
    if (v === null || v === undefined) return null
    partes.push(String(v))
  }
  return partes.join('\u0000')
}

/** Id antigo (do arquivo) → id novo, quando o antigo estava ocupado. */
export type Remapa = Map<string, string>

/**
 * Reescreve as referências de uma linha usando o que já foi remapeado.
 *
 * Funciona porque `TABELAS_BACKUP` está em ordem de dependência: quando uma
 * tabela é processada, os pais dela já passaram e o mapa já sabe os ids novos
 * deles.
 */
export function aplicarRemapa(linha: Linha, tabela: TabelaBackup, mapa: Remapa): Linha {
  const refs = REFERENCIAS[tabela]
  if (!refs || mapa.size === 0) return linha
  const saida = { ...linha }
  for (const [coluna] of refs) {
    const valor = saida[coluna]
    if (typeof valor === 'string') {
      const novo = mapa.get(valor)
      if (novo) saida[coluna] = novo
    }
  }
  return saida
}

/**
 * Os campos do perfil que o backup carrega e pode devolver.
 *
 * O perfil é o único lugar em que restaurar SUBSTITUI: só existe uma linha, e
 * "só entra o que falta" não quer dizer nada quando o que falta é um valor
 * dentro de uma linha que já existe. Por isso ele é uma escolha à parte na
 * tela, com a frase dizendo o que vai ser trocado — e não vem marcada.
 */
export const CAMPOS_DO_PERFIL = [
  'nome',
  'tema',
  'orcamento_centavos',
  'preferencias_lembrete',
  'assinaturas_ignoradas',
  // O painel montado pela pessoa (0023). Entra pelo mesmo critério do `tema`:
  // é PREFERÊNCIA, e refazer o arranjo a mão depois de restaurar um backup é
  // perder trabalho que o arquivo tinha como carregar.
  //
  // O que NÃO entra, e continua fora de propósito, é `onboarding_em` e
  // `onboarding_vistos`: aquilo é estado de "já passei por aqui", não gosto, e
  // restaurá-lo faria o guia reaparecer — ou sumir — por causa de um arquivo.
  'painel_ordem',
  'painel_ocultos',
  'painel_capa',
] as const

export interface Backup {
  formato: 'finz-backup'
  versao: number
  geradoEm: string
  /**
   * Só informativo. NÃO é usado para decidir nada na restauração: o dono do
   * arquivo é sempre quem está logado, nunca quem o arquivo diz que é.
   */
  origem?: { userId?: string; nome?: string }
  dados: Partial<Record<TabelaBackup, Linha[]>>
  /** Nome, tema, orçamento, preferências e painel. Restaurado só se a pessoa pedir. */
  perfil?: Linha
}

export function montarBackup(
  dados: Partial<Record<TabelaBackup, Linha[]>>,
  opcoes: { origem?: Backup['origem']; perfil?: Linha; agora?: Date } = {},
): Backup {
  return {
    formato: 'finz-backup',
    versao: VERSAO_BACKUP,
    geradoEm: (opcoes.agora ?? new Date()).toISOString(),
    origem: opcoes.origem,
    dados,
    perfil: opcoes.perfil,
  }
}

/**
 * Só os campos conhecidos do perfil, e só os que o arquivo realmente traz.
 *
 * Copiar o objeto inteiro do arquivo mandaria `id` e `created_at` junto — e um
 * update de perfil com o id de outra conta é exatamente o tipo de escrita que
 * a RLS recusa depois de a tela já ter dito "pronto".
 */
export function perfilParaRestaurar(perfil: Linha | undefined): Record<string, unknown> | null {
  if (!perfil) return null
  const saida: Record<string, unknown> = {}
  for (const campo of CAMPOS_DO_PERFIL) {
    if (perfil[campo] !== undefined) saida[campo] = perfil[campo]
  }
  return Object.keys(saida).length > 0 ? saida : null
}

/** Quantas linhas o arquivo tem ao todo. */
export function totalDeLinhas(dados: Backup['dados']): number {
  return TABELAS_BACKUP.reduce((soma, t) => soma + (dados[t]?.length ?? 0), 0)
}

export type LeituraBackup = { ok: true; backup: Backup } | { ok: false; erro: string }

/**
 * Lê e valida o arquivo.
 *
 * Recusa cedo e com frase inteira: quem escolheu o arquivo errado precisa
 * saber disso ANTES de qualquer escrita, e "erro inesperado" não ajuda
 * ninguém a escolher o arquivo certo.
 */
export function lerBackup(texto: string): LeituraBackup {
  let cru: unknown
  try {
    cru = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'Este arquivo não é um JSON válido.' }
  }
  if (typeof cru !== 'object' || cru === null || Array.isArray(cru)) {
    return { ok: false, erro: 'Este arquivo não parece um backup do finZ.' }
  }
  const obj = cru as Record<string, unknown>
  if (obj.formato !== 'finz-backup') {
    return { ok: false, erro: 'Este arquivo não é um backup do finZ. Procure um arquivo finz-backup-….json.' }
  }
  const versao = Number(obj.versao)
  if (!Number.isInteger(versao) || versao < 1) {
    return { ok: false, erro: 'O arquivo não diz de que versão é, então não dá para lê-lo com segurança.' }
  }
  if (versao > VERSAO_BACKUP) {
    return {
      ok: false,
      erro: `Este backup é da versão ${versao} e este app lê até a ${VERSAO_BACKUP}. Atualize o app antes de restaurar.`,
    }
  }
  if (typeof obj.dados !== 'object' || obj.dados === null || Array.isArray(obj.dados)) {
    return { ok: false, erro: 'O arquivo não tem a seção de dados.' }
  }

  const dados: Backup['dados'] = {}
  const bruto = obj.dados as Record<string, unknown>
  for (const tabela of TABELAS_BACKUP) {
    const lista = bruto[tabela]
    if (lista === undefined) continue
    if (!Array.isArray(lista)) {
      return { ok: false, erro: `A seção "${ROTULO_TABELA[tabela]}" do arquivo está corrompida.` }
    }
    // Linha que não é objeto é lixo e não entra — mas o arquivo inteiro não é
    // recusado por causa dela: perder o backup todo por uma linha estragada é
    // pior que restaurar o resto e dizer quantas foram descartadas.
    dados[tabela] = lista.filter((l): l is Linha => typeof l === 'object' && l !== null && !Array.isArray(l))
  }

  return {
    ok: true,
    backup: {
      formato: 'finz-backup',
      versao,
      geradoEm: typeof obj.geradoEm === 'string' ? obj.geradoEm : '',
      origem:
        typeof obj.origem === 'object' && obj.origem !== null ? (obj.origem as Backup['origem']) : undefined,
      dados,
      perfil:
        typeof obj.perfil === 'object' && obj.perfil !== null && !Array.isArray(obj.perfil)
          ? (obj.perfil as Linha)
          : undefined,
    },
  }
}

export interface ItemDoPlano {
  tabela: TabelaBackup
  rotulo: string
  /** Quantas linhas o arquivo traz. */
  noArquivo: number
  /** Quantas vão entrar de verdade. */
  entram: number
  /** Quantas o app já tem (por id ou por impressão digital). */
  jaExistem: number
  /** As linhas que vão entrar, já com o user_id de quem está logado. */
  linhas: Linha[]
}

export interface Plano {
  itens: ItemDoPlano[]
  totalEntram: number
  totalJaExistem: number
  /** Linhas descartadas por não ter id — sem id não dá para evitar duplicata. */
  descartadas: number
}

type ChaveDeConteudo = { data: string; descricao: string; valor_centavos: number; tipo: string }

function ehLancamento(l: Linha): l is Linha & ChaveDeConteudo {
  return (
    typeof l.data === 'string' &&
    typeof l.descricao === 'string' &&
    typeof l.valor_centavos === 'number' &&
    typeof l.tipo === 'string'
  )
}

/**
 * Digitais do CONTEÚDO de uma lista de lançamentos.
 *
 * A numeração de ocorrência do `impressoesDigitais` conta repetições dentro de
 * cada grupo idêntico, então o conjunto resultante não depende da ordem da
 * lista — dois cafés iguais recebem 1 e 2 venha qual vier primeiro. É isso que
 * permite comparar dois lados que nunca estiveram na mesma ordem.
 */
function digitaisDe(linhas: Linha[]): string[] {
  return impressoesDigitais(
    linhas.filter(ehLancamento).map((l) => ({
      data: String(l.data).slice(0, 10),
      descricao: l.descricao,
      valor_centavos: l.valor_centavos,
      tipo: l.tipo,
    })),
  )
}

/**
 * O que vai entrar, tabela por tabela — o que a tela mostra ANTES de gravar.
 *
 * `existentes` são as linhas que o app já tem hoje. Só os ids são usados para
 * todas as tabelas; para `transactions` entra também a digital, porque a mesma
 * compra pode estar aqui com outro id.
 */
export function prepararRestauracao(params: {
  backup: Backup
  existentes: Partial<Record<TabelaBackup, Linha[]>>
  userId: string
}): Plano {
  const { backup, existentes, userId } = params
  const itens: ItemDoPlano[] = []
  let descartadas = 0

  /**
   * Id do arquivo → id da linha equivalente que já existe aqui.
   *
   * É a peça que faltava, e a falta dela era um defeito sério: quando o plano
   * decidia que a META do arquivo já existia, o APORTE do arquivo continuava
   * apontando para a meta da conta de origem. A linha entrava referenciando
   * dado de outra conta — e, no teste contra Postgres, esbarrava no índice
   * único `(goal_id, ano, mes)` daquela outra conta.
   *
   * Funciona porque TABELAS_BACKUP está em ordem de dependência: quando o
   * aporte é examinado, a equivalência da meta já está aqui dentro.
   */
  const equivalencias: Remapa = new Map()

  for (const tabela of TABELAS_BACKUP) {
    const doArquivo = backup.dados[tabela] ?? []
    if (doArquivo.length === 0) continue

    const daCasa = existentes[tabela] ?? []
    const idsDaCasa = new Set(daCasa.map((l) => String(l.id)))
    const colunasNaturais = CHAVES_NATURAIS[tabela]

    /**
     * Listas, e não conjuntos: dois lançamentos idênticos aqui precisam
     * bloquear DOIS do arquivo, não o grupo inteiro nem apenas um. Cada
     * casamento consome um id local da fila.
     */
    const porNatural = new Map<string, string[]>()
    if (colunasNaturais) {
      for (const l of daCasa) {
        const k = chaveNatural(l, colunasNaturais)
        if (k === null) continue
        const fila = porNatural.get(k) ?? []
        fila.push(String(l.id))
        porNatural.set(k, fila)
      }
    }

    const porDigital = new Map<string, string[]>()
    if (tabela === 'transactions') {
      const locais = daCasa.filter(ehLancamento)
      digitaisDe(daCasa).forEach((d, i) => {
        const fila = porDigital.get(d) ?? []
        fila.push(String(locais[i]?.id))
        porDigital.set(d, fila)
      })
    }

    const candidatos = doArquivo.filter((l) => {
      if (typeof l.id !== 'string' || l.id === '') {
        descartadas += 1
        return false
      }
      return true
    })

    // As referências já apontam para o que existe AQUI antes de qualquer
    // comparação: a chave natural de um filho contém o id do pai.
    const remapeados = candidatos.map((l) => aplicarRemapa(l, tabela, equivalencias))
    const digitaisDoArquivo = tabela === 'transactions' ? digitaisDe(remapeados) : []

    const linhas: Linha[] = []
    let jaExistem = 0
    let indiceDigital = 0

    for (const l of remapeados) {
      const idDoArquivo = String(l.id)
      let local: string | null = null

      if (idsDaCasa.has(idDoArquivo)) {
        local = idDoArquivo
      } else if (colunasNaturais) {
        const k = chaveNatural(l, colunasNaturais)
        const fila = k === null ? undefined : porNatural.get(k)
        if (fila && fila.length > 0) local = fila.shift() as string
      }

      const ehLanc = tabela === 'transactions' && ehLancamento(l)
      if (local === null && ehLanc) {
        const fila = porDigital.get(digitaisDoArquivo[indiceDigital])
        if (fila && fila.length > 0) local = fila.shift() as string
      }
      if (ehLanc) indiceDigital += 1

      if (local !== null) {
        jaExistem += 1
        // Só quando o id muda: identidade no mapa não serve para nada e faria
        // o `aplicarRemapa` trabalhar à toa em cima de milhares de linhas.
        if (local !== idDoArquivo) equivalencias.set(idDoArquivo, local)
        continue
      }

      // O dono é sempre quem está logado. O user_id do arquivo é ignorado —
      // restaurar o backup de outra pessoa não pode gravar linha com o dono
      // errado, e a RLS recusaria de todo jeito.
      linhas.push({ ...l, user_id: userId })
    }

    itens.push({
      tabela,
      rotulo: ROTULO_TABELA[tabela],
      noArquivo: doArquivo.length,
      entram: linhas.length,
      jaExistem,
      linhas,
    })
  }

  return {
    itens,
    totalEntram: itens.reduce((s, i) => s + i.entram, 0),
    totalJaExistem: itens.reduce((s, i) => s + i.jaExistem, 0),
    descartadas,
  }
}

/** `finz-backup-2026-08-31.json` */
export function nomeDoArquivo(agora = new Date()): string {
  return `finz-backup-${agora.toISOString().slice(0, 10)}.json`
}

export function baixarJSON(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
