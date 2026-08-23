import { supabase } from '@/lib/supabase'
import { ErroServico } from './base'

/**
 * Pergunta sobre as finanças, respondida pelo Claude.
 *
 * O navegador NÃO fala com a Anthropic: fala com uma função do Supabase
 * (`supabase/functions/perguntar`), que guarda a chave da API. Chave de API é
 * segredo de cobrança — no bundle do site ela estaria visível para qualquer
 * visitante gastar.
 *
 * Só agregados são enviados, e quem monta esses agregados é a função, lendo o
 * banco com o SEU token. Nenhum lançamento individual — e portanto nenhum nome
 * de pessoa — sai do banco.
 */
export async function perguntar(pergunta: string, ano: number, mes: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ resposta?: string; erro?: string }>('perguntar', {
    body: { pergunta, ano, mes },
  })

  if (error) {
    // O caso mais comum não é bug: é a função ainda não publicada, ou publicada
    // sem a chave. Dizer isso poupa a pessoa de procurar defeito onde não tem.
    throw new ErroServico(
      'O assistente não respondeu. Se você acabou de publicar o app, confira se a função "perguntar" foi enviada e se a chave da Anthropic está configurada no Supabase.',
      error,
    )
  }
  if (data?.erro) throw new ErroServico(data.erro)
  if (!data?.resposta) throw new ErroServico('O assistente não devolveu resposta.')
  return data.resposta
}

/** Perguntas de partida — tirar a página em branco é metade do trabalho. */
export const PERGUNTAS_SUGERIDAS = [
  'Por que meu saldo ficou assim este mês?',
  'Onde eu mais gastei?',
  'Como este mês se compara com os outros?',
]
