import type { Category, Goal, PaymentMethod, TipoPagamento } from '@/lib/database.types'
import { useRecurso } from '@/lib/hooks'
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
  const recurso = useRecurso<DadosConfig>(async () => {
    const [formasPagamento, categorias, metas] = await Promise.all([
      formasSvc.listarFormasPagamento(true),
      categoriasSvc.listarCategorias(),
      metasSvc.listarMetas(),
    ])
    return { formasPagamento, categorias, metas }
  }, [])

  const { dados, definirDados } = recurso
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
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({ ...d, categorias: d.categorias.map((c) => (c.id === id ? { ...c, ...mudancas } : c)) })),
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
      confirmar: (salvo) => mutar((d) => ({ ...d, metas: d.metas.map((m) => (m.id === provisorio.id ? salvo : m)) })),
      mensagemErro: 'Não foi possível criar a meta',
    })
  }

  const editarMeta = (id: string, mudancas: Partial<Goal>) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, metas: d.metas.map((m) => (m.id === id ? { ...m, ...mudancas } : m)) })),
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
    },
  }
}
