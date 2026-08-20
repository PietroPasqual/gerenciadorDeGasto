import type { Goal, GoalContribution, ResumoMeta, WishlistItem } from '@/lib/database.types'
import { useRecurso } from '@/lib/hooks'
import { executarOtimista } from '@/lib/otimista'
import { tempId } from '@/lib/utils'
import * as metasSvc from '@/services/goals'
import * as wishlistSvc from '@/services/wishlist'
import { obterResumoMetas } from '@/services/reports'

interface DadosMetas {
  metas: Goal[]
  aportes: GoalContribution[]
  resumo: ResumoMeta[]
  wishlist: WishlistItem[]
}

export function useMetas(ano: number) {
  const recurso = useRecurso<DadosMetas>(async () => {
    const [metas, aportes, resumo, wishlist] = await Promise.all([
      metasSvc.listarMetas(),
      metasSvc.listarAportesDoAno(ano),
      obterResumoMetas(ano), // agregado vindo da função SQL resumo_metas
      wishlistSvc.listarWishlist(),
    ])
    return { metas, aportes, resumo, wishlist }
  }, [ano])

  const { dados, definirDados } = recurso
  const mutar = (transformar: (atual: DadosMetas) => DadosMetas) =>
    definirDados((atual) => (atual ? transformar(atual) : atual))
  const snapshot = () => dados as DadosMetas

  const salvarAporte = (goal_id: string, mes: number, valor_centavos: number) => {
    const existente = dados?.aportes.find((a) => a.goal_id === goal_id && a.mes === mes)
    const provisorio: GoalContribution = existente
      ? { ...existente, valor_centavos }
      : {
          id: tempId(),
          user_id: '',
          goal_id,
          ano,
          mes,
          valor_centavos,
          created_at: new Date().toISOString(),
        }

    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          aportes: existente
            ? d.aportes.map((a) => (a.id === existente.id ? provisorio : a))
            : [...d.aportes, provisorio],
        })),
      restaurar: definirDados,
      acao: () => metasSvc.salvarAporte({ goal_id, ano, mes, valor_centavos }),
      confirmar: (salvo) =>
        mutar((d) => ({
          ...d,
          aportes: d.aportes.map((a) => (a.goal_id === goal_id && a.mes === mes ? salvo : a)),
        })),
      mensagemErro: 'Não foi possível salvar o aporte',
    })
  }

  // ---------------------------- Wishlist ----------------------------
  const adicionarItem = (nome: string, valor_centavos: number, prioridade: number) => {
    const provisorio: WishlistItem = {
      id: tempId(),
      user_id: '',
      nome,
      valor_centavos,
      prioridade,
      concluido: false,
      concluido_em: null,
      created_at: new Date().toISOString(),
    }
    return executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, wishlist: [...d.wishlist, provisorio] })),
      restaurar: definirDados,
      acao: () => wishlistSvc.criarItemWishlist({ nome, valor_centavos, prioridade }),
      confirmar: (salvo) =>
        mutar((d) => ({ ...d, wishlist: d.wishlist.map((i) => (i.id === provisorio.id ? salvo : i)) })),
      mensagemErro: 'Não foi possível adicionar o item',
    })
  }

  const editarItem = (id: string, mudancas: Partial<WishlistItem>) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () =>
        mutar((d) => ({
          ...d,
          wishlist: d.wishlist.map((i) =>
            i.id === id
              ? {
                  ...i,
                  ...mudancas,
                  concluido_em:
                    mudancas.concluido === undefined
                      ? i.concluido_em
                      : mudancas.concluido
                        ? new Date().toISOString()
                        : null,
                }
              : i,
          ),
        })),
      restaurar: definirDados,
      acao: () => wishlistSvc.atualizarItemWishlist(id, mudancas),
      mensagemErro: 'Não foi possível salvar o item',
    })

  const removerItem = (id: string) =>
    executarOtimista({
      snapshot: snapshot(),
      aplicar: () => mutar((d) => ({ ...d, wishlist: d.wishlist.filter((i) => i.id !== id) })),
      restaurar: definirDados,
      acao: () => wishlistSvc.excluirItemWishlist(id),
      mensagemErro: 'Não foi possível excluir o item',
    })

  return { ...recurso, acoes: { salvarAporte, adicionarItem, editarItem, removerItem } }
}
