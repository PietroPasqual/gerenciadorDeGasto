import { supabase } from '@/lib/supabase'
import { unwrap, userIdAtual } from './base'
import { podeVirarRegra, termoDaDescricao, type RegraAprendida } from '@/lib/regras-aprendidas'

/** As regras que o usuário ensinou, prontas para o motor de sugestão. */
export async function listarRegrasAprendidas(): Promise<RegraAprendida[]> {
  const linhas =
    unwrap(await supabase.from('category_rules').select('termo, category_id').order('termo')) ?? []
  return linhas as RegraAprendida[]
}

/**
 * Guarda (ou reescreve) a regra que nasce de uma correção.
 *
 * Devolve `false` sem gravar quando a descrição não pode virar regra — chave
 * curta ou genérica demais, que casaria com meio extrato. A tela usa isso para
 * não oferecer o "lembrar disso" onde ele seria perigoso, mas a checagem fica
 * aqui também: um caminho novo que esqueça de perguntar não pode furar a trava.
 *
 * Upsert pelo termo: corrigir a mesma loja de novo REESCREVE a regra anterior.
 * Duas regras para o mesmo termo competiriam, e qual venceria dependeria da
 * ordem de leitura.
 */
export async function aprenderRegra(descricao: string, category_id: string): Promise<boolean> {
  if (!podeVirarRegra(descricao)) return false
  const termo = termoDaDescricao(descricao)
  const user_id = await userIdAtual()
  unwrap(
    await supabase
      .from('category_rules')
      .upsert({ user_id, termo, category_id, exemplo: descricao }, { onConflict: 'user_id,termo' }),
    'Não foi possível guardar a regra.',
  )
  return true
}

export async function esquecerRegra(termo: string): Promise<void> {
  const { error } = await supabase.from('category_rules').delete().eq('termo', termo)
  if (error) throw error
}
