import type { Goal, GoalContribution, ResumoMeta, WishlistItem } from '@/lib/database.types'
import { toast } from 'sonner'
import { useConsulta } from '@/lib/cache'
import { periodoAtual } from '@/lib/dates'
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
  const recurso = useConsulta<DadosMetas>(['metas', ano], async () => {
    const [metas, aportes, resumo, wishlist] = await Promise.all([
      metasSvc.listarMetas(),
      metasSvc.listarAportesDoAno(ano),
      obterResumoMetas(ano), // agregado vindo da função SQL resumo_metas
      wishlistSvc.listarWishlist(),
    ])
    return { metas, aportes, resumo, wishlist }
  })

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
      chave: `aporte:${goal_id}:${mes}`,
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
      // Todo desejo nasce como "quero comprar": ligar a uma meta é uma
      // decisão à parte, e é ela que faz o item passar a ter dinheiro atrás.
      goal_id: null,
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
      chave: `wishlist:${id}`,
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

  /**
   * Resgatar e transferir NÃO são otimistas, e a razão é a mesma do controle
   * mensal: o trigger da 0013 recusa resgate maior que o saldo, e a mensagem
   * dele é a que interessa. Mostrar o saldo caindo para depois voltar seria
   * inventar um sucesso que o banco nunca deu.
   *
   * O mês do movimento é o mês CORRENTE, e não o ano aberto no seletor: tirar
   * dinheiro é um fato de hoje, e registrá-lo num ano que a pessoa só está
   * consultando reescreveria o histórico dela.
   */
  const movimentar = async (
    executar: () => Promise<unknown>,
    sucesso: string,
    falha: string,
  ): Promise<void> => {
    try {
      await executar()
      await recurso.recarregar()
      toast.success(sucesso)
    } catch (erro) {
      toast.error(falha, { description: erro instanceof Error ? erro.message : undefined })
    }
  }

  const resgatar = (goalId: string, centavos: number) => {
    const agora = periodoAtual()
    return movimentar(
      () => metasSvc.resgatarDaMeta(goalId, agora.ano, agora.mes, centavos),
      'Resgate registrado',
      'Não foi possível resgatar',
    )
  }

  const transferir = (origem: string, destino: string, centavos: number) => {
    const agora = periodoAtual()
    return movimentar(
      () => metasSvc.transferirEntreMetas(origem, destino, agora.ano, agora.mes, centavos),
      'Transferência feita',
      'Não foi possível transferir',
    )
  }

  return {
    ...recurso,
    acoes: { salvarAporte, adicionarItem, editarItem, removerItem, resgatar, transferir },
  }
}
