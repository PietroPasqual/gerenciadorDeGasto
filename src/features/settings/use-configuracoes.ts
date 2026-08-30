import type { Category, Goal, PaymentMethod, TipoPagamento } from '@/lib/database.types'
import { useConsulta } from '@/lib/cache'
import { executarOtimista } from '@/lib/otimista'
import { tempId } from '@/lib/utils'
import * as formasSvc from '@/services/payment-methods'
import * as categoriasSvc from '@/services/categories'
import * as metasSvc from '@/services/goals'

interface DadosConfig {
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  metas: Goal[]
}

/** Catálogos editáveis da tela de Configurações, com update otimista. */
export function useConfiguracoes() {
  const recurso = useConsulta<DadosConfig>(['configuracoes'], async () => {
    const [formasPagamento, categorias, metas] = await Promise.all([
      formasSvc.listarFormasPagamento(true),
      categoriasSvc.listarCategorias(),
      metasSvc.listarMetas(),
    ])
    return { formasPagamento, categorias, metas }
  })

  const { dados, definirDados } = recurso

  /**
   * Reordenação (M11).
   *
   * Os serviços já listam por `ordem`, então mover é só reescrever esse campo.
   * Renumeramos a lista inteira de 1 a n em vez de trocar dois valores entre si
   * porque `ordem` pode estar repetido ou nulo nas linhas antigas (o valor só
   * passou a ser preenchido quando a criação começou a mandar
   * `lista.length + 1`), e aí a troca não mudaria nada. Persistimos só as
   * linhas cujo número mudou de fato — a lista tem no máximo dez itens.
   */
  const trocarVizinho = <T extends { id: string }>(lista: T[], id: string, direcao: -1 | 1) => {
    const i = lista.findIndex((x) => x.id === id)
    const j = i + direcao
    if (i < 0 || j < 0 || j >= lista.length) return null
    const nova = [...lista]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    return nova
  }

  const mover = <T extends { id: string; ordem: number | null }>(opcoes: {
    lista: T[]
    id: string
    direcao: -1 | 1
    aplicar: (nova: T[]) => void
    salvar: (id: string, ordem: number) => Promise<unknown>
    mensagemErro: string
  }) => {
    const trocada = trocarVizinho(opcoes.lista, opcoes.id, opcoes.direcao)
    if (!trocada) return
    const numerada = trocada.map((item, indice) => ({ ...item, ordem: indice + 1 }))
    const mudaram = numerada.filter(
      (item) => opcoes.lista.find((o) => o.id === item.id)?.ordem !== item.ordem,
    )

    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () => opcoes.aplicar(numerada),
      restaurar: definirDados,
      acao: () => Promise.all(mudaram.map((item) => opcoes.salvar(item.id, item.ordem as number))),
      mensagemErro: opcoes.mensagemErro,
    })
  }
  const mutar = (transformar: (atual: DadosConfig) => DadosConfig) =>
    definirDados((atual) => (atual ? transformar(atual) : atual))
  const snapshot = () => dados as DadosConfig

  // ---------------- Formas de pagamento ----------------
  const criarForma = (nome: string, tipo: TipoPagamento) => {
    const provisorio: PaymentMethod = {
      id: tempId(),
      user_id: '',
      nome,
      tipo,
      ativo: true,
      ordem: (dados?.formasPagamento.length ?? 0) + 1,
      created_at: new Date().toISOString(),
      // Cartão nasce sem fatura: quem liga é o usuário, e é isso que faz a
      // 0009 não mexer em nenhum número antigo (regra 8).
      dia_fechamento: null,
      dia_vencimento: null,
      fatura_inicio_ano: null,
      fatura_inicio_mes: null,
    }
    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, formasPagamento: [...d.formasPagamento, provisorio] })),
      restaurar: definirDados,
      acao: () => formasSvc.criarFormaPagamento({ nome, tipo, ordem: provisorio.ordem }),
      confirmar: (salvo) =>
        mutar((d) => ({
          ...d,
          formasPagamento: d.formasPagamento.map((f) => (f.id === provisorio.id ? salvo : f)),
        })),
    })
  }

  const editarForma = (id: string, mudancas: Partial<PaymentMethod>) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          formasPagamento: d.formasPagamento.map((f) => (f.id === id ? { ...f, ...mudancas } : f)),
        })),
      restaurar: definirDados,
      acao: () => formasSvc.atualizarFormaPagamento(id, mudancas),
    })

  const excluirForma = (id: string) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, formasPagamento: d.formasPagamento.filter((f) => f.id !== id) })),
      restaurar: definirDados,
      acao: () => formasSvc.excluirFormaPagamento(id),
      mensagemErro: 'Não foi possível excluir a forma de pagamento',
    })

  // ---------------- Categorias ----------------
  const criarCategoria = (nome: string, limite: number | null, cor: string) => {
    const provisorio: Category = {
      id: tempId(),
      user_id: '',
      nome,
      limite_centavos: limite,
      cor,
      ordem: (dados?.categorias.length ?? 0) + 1,
      created_at: new Date().toISOString(),
    }
    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, categorias: [...d.categorias, provisorio] })),
      restaurar: definirDados,
      acao: () =>
        categoriasSvc.criarCategoria({ nome, limite_centavos: limite, cor, ordem: provisorio.ordem }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, categorias: d.categorias.map((c) => (c.id === provisorio.id ? salvo : c)) })),
    })
  }

  const editarCategoria = (id: string, mudancas: Partial<Category>) =>
    executarOtimista({
      chave: `categoria:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          categorias: d.categorias.map((c) => (c.id === id ? { ...c, ...mudancas } : c)),
        })),
      restaurar: definirDados,
      acao: () => categoriasSvc.atualizarCategoria(id, mudancas),
    })

  const excluirCategoria = (id: string) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, categorias: d.categorias.filter((c) => c.id !== id) })),
      restaurar: definirDados,
      acao: () => categoriasSvc.excluirCategoria(id),
      mensagemErro: 'Não foi possível excluir a categoria',
    })

  // ---------------- Metas ----------------
  const criarMeta = (nome: string, valorMeta: number) => {
    const provisorio: Goal = {
      id: tempId(),
      user_id: '',
      nome,
      valor_meta_centavos: valorMeta,
      ordem: (dados?.metas.length ?? 0) + 1,
      created_at: new Date().toISOString(),
    }
    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, metas: [...d.metas, provisorio] })),
      restaurar: definirDados,
      acao: () => metasSvc.criarMeta({ nome, valor_meta_centavos: valorMeta, ordem: provisorio.ordem }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, metas: d.metas.map((m) => (m.id === provisorio.id ? salvo : m)) })),
      mensagemErro: 'Não foi possível criar a meta',
    })
  }

  const editarMeta = (id: string, mudancas: Partial<Goal>) =>
    executarOtimista({
      chave: `meta:${id}`,
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({ ...d, metas: d.metas.map((m) => (m.id === id ? { ...m, ...mudancas } : m)) })),
      restaurar: definirDados,
      acao: () => metasSvc.atualizarMeta(id, mudancas),
    })

  const excluirMeta = (id: string) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, metas: d.metas.filter((m) => m.id !== id) })),
      restaurar: definirDados,
      acao: () => metasSvc.excluirMeta(id),
      mensagemErro: 'Não foi possível excluir a meta',
    })

  const moverForma = (id: string, direcao: -1 | 1) =>
    mover({
      lista: snapshot().formasPagamento,
      id,
      direcao,
      aplicar: (formasPagamento) => mutar((d) => ({ ...d, formasPagamento })),
      salvar: (idItem, ordem) => formasSvc.atualizarFormaPagamento(idItem, { ordem }),
      mensagemErro: 'Não foi possível reordenar as formas de pagamento',
    })

  const moverCategoria = (id: string, direcao: -1 | 1) =>
    mover({
      lista: snapshot().categorias,
      id,
      direcao,
      aplicar: (categorias) => mutar((d) => ({ ...d, categorias })),
      salvar: (idItem, ordem) => categoriasSvc.atualizarCategoria(idItem, { ordem }),
      mensagemErro: 'Não foi possível reordenar as categorias',
    })

  const moverMeta = (id: string, direcao: -1 | 1) =>
    mover({
      lista: snapshot().metas,
      id,
      direcao,
      aplicar: (metas) => mutar((d) => ({ ...d, metas })),
      salvar: (idItem, ordem) => metasSvc.atualizarMeta(idItem, { ordem }),
      mensagemErro: 'Não foi possível reordenar as metas',
    })

  return {
    ...recurso,
    acoes: {
      criarForma,
      editarForma,
      excluirForma,
      criarCategoria,
      editarCategoria,
      excluirCategoria,
      criarMeta,
      editarMeta,
      excluirMeta,
      moverForma,
      moverCategoria,
      moverMeta,
    },
  }
}
