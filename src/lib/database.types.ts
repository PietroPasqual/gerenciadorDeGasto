/**
 * Tipos do banco. Em producao este arquivo e GERADO:
 *   npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public
 *   (ou `npm run types:gen`)
 *
 * A versao versionada aqui espelha exatamente as migrations em supabase/migrations
 * para que o projeto compile antes de qualquer conexao com o Supabase.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TemaCor = 'rosa' | 'azul' | 'verde' | 'roxo'
export type TipoPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto'
export type TipoLancamento = 'gasto' | 'entrada'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string; tema: TemaCor; created_at: string }
        Insert: { id: string; nome?: string; tema?: TemaCor; created_at?: string }
        Update: { id?: string; nome?: string; tema?: TemaCor; created_at?: string }
        Relationships: []
      }
      payment_methods: {
        Row: {
          id: string
          user_id: string
          nome: string
          tipo: TipoPagamento
          ativo: boolean
          ordem: number
          created_at: string
          /** Dia em que o ciclo fecha. NULL = cartão sem fatura (ver 0009). */
          dia_fechamento: number | null
          dia_vencimento: number | null
          /** Vigência da regra de fatura, modelo da 0005. NULL = nunca. */
          fatura_inicio_ano: number | null
          fatura_inicio_mes: number | null
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          tipo?: TipoPagamento
          ativo?: boolean
          ordem?: number
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          fatura_inicio_ano?: number | null
          fatura_inicio_mes?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          tipo?: TipoPagamento
          ativo?: boolean
          ordem?: number
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          fatura_inicio_ano?: number | null
          fatura_inicio_mes?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          nome: string
          limite_centavos: number | null
          cor: string
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          limite_centavos?: number | null
          cor?: string
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          limite_centavos?: number | null
          cor?: string
          ordem?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          nome: string
          valor_meta_centavos: number
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          valor_meta_centavos?: number
          ordem?: number
          created_at?: string
        }
        Update: { id?: string; user_id?: string; nome?: string; valor_meta_centavos?: number; ordem?: number }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          ano: number
          mes: number
          valor_centavos: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id: string
          ano: number
          mes: number
          valor_centavos?: number
          created_at?: string
        }
        Update: { valor_centavos?: number }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          id: string
          user_id: string
          nome: string
          valor_centavos: number
          prioridade: number
          concluido: boolean
          concluido_em: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          valor_centavos?: number
          prioridade?: number
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
        }
        Update: {
          nome?: string
          valor_centavos?: number
          prioridade?: number
          concluido?: boolean
          concluido_em?: string | null
        }
        Relationships: []
      }
      incomes: {
        Row: {
          id: string
          user_id: string
          ano: number
          mes: number
          descricao: string
          valor_centavos: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ano: number
          mes: number
          descricao?: string
          valor_centavos?: number
          created_at?: string
        }
        Update: { descricao?: string; valor_centavos?: number }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          id: string
          user_id: string
          nome: string
          payment_method_id: string | null
          category_id: string | null
          valor_centavos: number
          dia_vencimento: number | null
          ativo: boolean
          ordem: number
          created_at: string
          // Vigência (migration 0005): null de um lado = sem limite daquele
          // lado. ano e mes andam sempre em par (check no banco).
          inicio_ano: number | null
          inicio_mes: number | null
          fim_ano: number | null
          fim_mes: number | null
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          payment_method_id?: string | null
          category_id?: string | null
          valor_centavos?: number
          dia_vencimento?: number | null
          ativo?: boolean
          ordem?: number
          created_at?: string
          inicio_ano?: number | null
          inicio_mes?: number | null
          fim_ano?: number | null
          fim_mes?: number | null
        }
        Update: {
          nome?: string
          payment_method_id?: string | null
          category_id?: string | null
          valor_centavos?: number
          dia_vencimento?: number | null
          ativo?: boolean
          ordem?: number
          inicio_ano?: number | null
          inicio_mes?: number | null
          fim_ano?: number | null
          fim_mes?: number | null
        }
        Relationships: []
      }
      fixed_expense_payments: {
        Row: {
          id: string
          user_id: string
          fixed_expense_id: string
          ano: number
          mes: number
          pago: boolean
          pago_em: string | null
        }
        Insert: {
          id?: string
          user_id: string
          fixed_expense_id: string
          ano: number
          mes: number
          pago?: boolean
          pago_em?: string | null
        }
        Update: { pago?: boolean; pago_em?: string | null }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          id: string
          user_id: string
          payment_method_id: string
          ano: number
          mes: number
          pago: boolean
          pago_em: string | null
        }
        Insert: {
          id?: string
          user_id: string
          payment_method_id: string
          ano: number
          mes: number
          pago?: boolean
          pago_em?: string | null
        }
        Update: { pago?: boolean; pago_em?: string | null }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          data: string
          descricao: string
          payment_method_id: string | null
          category_id: string | null
          valor_centavos: number
          tipo: TipoLancamento
          created_at: string
          /** Só quem veio de importação tem; lançamento à mão fica NULL (ver 0008). */
          fingerprint: string | null
          /** Amarra as parcelas de uma mesma compra. NULL em lançamento avulso (ver 0010). */
          parcelamento_id: string | null
          /** O "3" de "3/12". */
          parcela: number | null
          parcelas_total: number | null
        }
        Insert: {
          id?: string
          user_id: string
          /** A 0007 tirou o default: quem insere é obrigado a dizer o dia. */
          data: string
          descricao?: string
          payment_method_id?: string | null
          category_id?: string | null
          valor_centavos?: number
          tipo?: TipoLancamento
          created_at?: string
          fingerprint?: string | null
          parcelamento_id?: string | null
          parcela?: number | null
          parcelas_total?: number | null
        }
        Update: {
          data?: string
          descricao?: string
          payment_method_id?: string | null
          category_id?: string | null
          valor_centavos?: number
          tipo?: TipoLancamento
        }
        Relationships: []
      }
      investments: {
        Row: {
          id: string
          user_id: string
          ano: number
          mes: number
          goal_id: string | null
          valor_centavos: number
          descricao: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ano: number
          mes: number
          goal_id?: string | null
          valor_centavos?: number
          descricao?: string
          created_at?: string
        }
        Update: { goal_id?: string | null; valor_centavos?: number; descricao?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      resumo_mensal: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          total_entradas: number
          total_saidas: number
          saldo: number
          total_investido: number
          percentual_investido: number
        }[]
      }
      gastos_por_categoria: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          /** NULL na linha "Sem categoria" (ver migration 0006). */
          category_id: string | null
          nome: string
          cor: string
          limite_centavos: number | null
          gasto_centavos: number
          percentual_limite: number
        }[]
      }
      saidas_por_forma_pagamento: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          /** NULL na linha "Sem forma de pagamento" (ver migration 0006). */
          payment_method_id: string | null
          nome: string
          tipo: TipoPagamento
          gasto_centavos: number
        }[]
      }
      carregar_mes: {
        Args: { p_ano: number; p_mes: number }
        /** JSON com as dez listas da tela do mês — ver src/services/mes.ts. */
        Returns: Json
      }
      faturas_do_mes: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          payment_method_id: string
          nome: string
          dia_fechamento: number
          dia_vencimento: number | null
          total_centavos: number
          paga: boolean
          pago_em: string | null
          primeira_compra: string
          ultima_compra: string
        }[]
      }
      investimentos_por_meta: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          goal_id: string | null
          nome: string
          valor_meta_centavos: number
          valor_centavos: number
        }[]
      }
      comparativo_anual: {
        Args: { p_ano: number }
        Returns: { mes: number; entradas: number; saidas: number; diferenca: number }[]
      }
      resumo_metas: {
        Args: { p_ano: number }
        Returns: {
          goal_id: string
          nome: string
          valor_meta_centavos: number
          guardado_ano: number
          guardado_total: number
          percentual: number
        }[]
      }
      seed_defaults_if_empty: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: {
      tema_cor: TemaCor
      tipo_pagamento: TipoPagamento
      tipo_lancamento: TipoLancamento
    }
    CompositeTypes: Record<string, never>
  }
}

// ------------------------------------------------------------------
// Atalhos usados pelo app
// ------------------------------------------------------------------
type PublicSchema = Database['public']
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Fn<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns']

export type Profile = Tables<'profiles'>
export type PaymentMethod = Tables<'payment_methods'>
export type Category = Tables<'categories'>
export type Goal = Tables<'goals'>
export type GoalContribution = Tables<'goal_contributions'>
export type WishlistItem = Tables<'wishlist_items'>
export type Income = Tables<'incomes'>
export type FixedExpense = Tables<'fixed_expenses'>
export type FixedExpensePayment = Tables<'fixed_expense_payments'>
export type Transaction = Tables<'transactions'>
export type Investment = Tables<'investments'>

export type ResumoMensal = Fn<'resumo_mensal'>[number]
export type GastoCategoria = Fn<'gastos_por_categoria'>[number]
export type SaidaFormaPagamento = Fn<'saidas_por_forma_pagamento'>[number]
export type InvestimentoMeta = Fn<'investimentos_por_meta'>[number]
export type ComparativoAnualMes = Fn<'comparativo_anual'>[number]
export type ResumoMeta = Fn<'resumo_metas'>[number]
