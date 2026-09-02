/**
 * O primeiro acesso guiado.
 *
 * A regra que organiza este arquivo: o estado de cada passo é DERIVADO do dado
 * real, não guardado. Um ponteiro de "em que passo você está" viraria uma
 * segunda verdade — diria "passo 2" enquanto o orçamento do passo 2 já existe
 * — e a tela pediria de novo algo já feito. Aqui, se a pessoa configurou o
 * orçamento pelas Configurações, o passo aparece pronto sem ninguém avisar.
 *
 * É isso que torna cada etapa idempotente de graça: salvar duas vezes escreve o
 * mesmo dado no mesmo lugar, porque o guia usa os mesmos serviços que as
 * Configurações usam. Ele não é um caminho de escrita novo, é uma ordem
 * sugerida por cima do que já existe.
 *
 * Dois passos não dão para derivar, porque a resposta certa pode ser "está bom
 * como está": revisar as categorias que a 0004 semeou e confirmar os lembretes
 * que a 0017 já deixou ligados. Para esses existe a lista de `vistos`, que só
 * acrescenta e por isso nunca contradiz o dado.
 */

export type IdEtapa =
  | 'nome'
  | 'orcamento'
  | 'entrada'
  | 'categorias'
  | 'limites'
  | 'lembretes'
  | 'primeiro-gasto'

/** O que o guia precisa saber da conta para decidir o que já está feito. */
export interface DadosDoGuia {
  nome: string
  orcamentoCentavos: number
  temEntradaRecorrente: boolean
  /** Alguma categoria com limite mensal definido. */
  temLimite: boolean
  temLancamento: boolean
  /** Os passos que a pessoa marcou como resolvidos sem mudar nada. */
  vistos: string[]
}

export interface EtapaDoGuia {
  id: IdEtapa
  titulo: string
  /** Uma linha dizendo o que aquele passo resolve. */
  descricao: string
  feita: boolean
  /**
   * Passo que dá para deixar pendente e ainda assim concluir o guia.
   *
   * Todos são: a fase 7 exige "permitir pular". A marca existe para a tela
   * poder dizer isso em vez de a pessoa descobrir tentando.
   */
  opcional: true
}

export interface EstadoDoGuia {
  etapas: EtapaDoGuia[]
  feitas: number
  total: number
  /** 0–100, para a barra de progresso. */
  percentual: number
  /** A primeira pendente — é por ela que o guia abre. `null` = tudo feito. */
  proxima: IdEtapa | null
  concluido: boolean
}

const TEXTOS: Record<IdEtapa, { titulo: string; descricao: string }> = {
  nome: {
    titulo: 'Como te chamar',
    descricao: 'O nome aparece no topo do app. Só isso — ele não vai para lugar nenhum.',
  },
  orcamento: {
    titulo: 'Quanto você quer gastar por mês',
    descricao: 'Vira a barra de orçamento do mês. Dá para mudar quando quiser, ou deixar para depois.',
  },
  entrada: {
    titulo: 'Sua entrada que se repete',
    descricao: 'Salário, aposentadoria, mesada. Cadastrada uma vez, ela conta em todo mês daqui em diante.',
  },
  categorias: {
    titulo: 'As categorias que você usa',
    descricao: 'Já criamos um conjunto comum. Apague o que não serve e renomeie o que faltar.',
  },
  limites: {
    titulo: 'Um limite por categoria',
    descricao: 'Opcional. A barra da categoria avisa em 80% e fica vermelha quando estoura.',
  },
  lembretes: {
    titulo: 'Avisos de vencimento',
    descricao: 'Já vêm ligados, avisando 3 dias antes. Confirme ou ajuste do seu jeito.',
  },
  'primeiro-gasto': {
    titulo: 'Seu primeiro gasto',
    descricao: 'O jeito mais rápido de ver o app funcionando é lançar algo que você gastou hoje.',
  },
}

/** A ordem é a da fase 7, e vai do que é seu para o que você faz com o app. */
export const ORDEM: IdEtapa[] = [
  'nome',
  'orcamento',
  'entrada',
  'categorias',
  'limites',
  'lembretes',
  'primeiro-gasto',
]

function etapaFeita(id: IdEtapa, dados: DadosDoGuia): boolean {
  // "Eu olhei isto" vale para qualquer passo: quem resolveu conferir e seguir
  // em frente resolveu o passo, mesmo sem mudar dado.
  if (dados.vistos.includes(id)) return true

  switch (id) {
    case 'nome':
      return dados.nome.trim() !== ''
    case 'orcamento':
      return dados.orcamentoCentavos > 0
    case 'entrada':
      return dados.temEntradaRecorrente
    case 'limites':
      return dados.temLimite
    case 'primeiro-gasto':
      return dados.temLancamento
    // Categorias e lembretes já nascem preenchidos pela 0004 e pela 0017, e
    // "está bom assim" é uma resposta legítima. Não há o que derivar: só a
    // lista de vistos, tratada lá em cima.
    case 'categorias':
    case 'lembretes':
      return false
  }
}

export function estadoDoGuia(dados: DadosDoGuia): EstadoDoGuia {
  const etapas: EtapaDoGuia[] = ORDEM.map((id) => ({
    id,
    ...TEXTOS[id],
    feita: etapaFeita(id, dados),
    opcional: true,
  }))

  const feitas = etapas.filter((e) => e.feita).length
  return {
    etapas,
    feitas,
    total: etapas.length,
    percentual: Math.round((feitas / etapas.length) * 100),
    proxima: etapas.find((e) => !e.feita)?.id ?? null,
    concluido: feitas === etapas.length,
  }
}

/**
 * Acrescenta um passo à lista de vistos, sem duplicar.
 *
 * Devolve a MESMA lista quando o passo já estava lá — é o que evita uma
 * gravação à toa a cada vez que alguém volta num passo já resolvido.
 */
export function marcarVisto(vistos: string[], id: IdEtapa): string[] {
  return vistos.includes(id) ? vistos : [...vistos, id]
}

/** O guia aparece uma vez por conta; depois, só se a pessoa pedir. */
export function deveAparecer(onboardingEm: string | null | undefined): boolean {
  return onboardingEm == null
}
