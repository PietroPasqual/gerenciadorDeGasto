import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Erro de domínio com mensagem já em português, pronta para o toast. */
export class ErroServico extends Error {
  constructor(
    mensagem: string,
    public original?: unknown,
  ) {
    super(mensagem)
    this.name = 'ErroServico'
  }
}

const MENSAGENS: Record<string, string> = {
  '23505': 'Este registro já existe.',
  '23503': 'Não foi possível salvar: registro relacionado não encontrado.',
  '23514': 'Valor inválido para este campo.',
  '42501': 'Você não tem permissão para esta operação.',
  PGRST301: 'Sessão expirada. Entre novamente.',
}

export function traduzErro(
  erro: PostgrestError | null,
  fallback = 'Não foi possível concluir a operação.',
): ErroServico {
  if (!erro) return new ErroServico(fallback)
  if (erro.message?.includes('Limite de 10 metas')) {
    return new ErroServico('Você já tem 10 metas. Exclua uma antes de criar outra.', erro)
  }
  return new ErroServico(MENSAGENS[erro.code] ?? erro.message ?? fallback, erro)
}

/** Desembrulha uma resposta do supabase-js, lançando ErroServico em caso de falha. */
export function unwrap<T>(resposta: { data: T | null; error: PostgrestError | null }, contexto?: string): T {
  if (resposta.error) throw traduzErro(resposta.error, contexto)
  return resposta.data as T
}

/** id do usuário logado (obrigatório em todo insert por causa da RLS). */
export async function userIdAtual(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new ErroServico('Sessão expirada. Entre novamente.', error)
  return data.user.id
}
