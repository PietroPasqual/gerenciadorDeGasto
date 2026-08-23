import { supabase } from '@/lib/supabase'
import { ErroServico } from './base'

/** O que a função devolve quando dá certo. */
export type Resposta = {
  texto: string
  /**
   * Valores em reais citados na resposta que NÃO se explicam pelos dados
   * enviados. Vazio quase sempre; quando não, a tela avisa em vez de esconder.
   */
  valoresNaoConferidos: string[]
}

/**
 * Pergunta sobre as finanças, respondida pelo Gemini.
 *
 * O navegador NÃO fala com o Google: fala com uma função do Supabase
 * (`supabase/functions/perguntar`), que guarda a chave. Chave de API é segredo
 * de cota e de cobrança — no bundle do site ela ficaria visível para qualquer
 * visitante consumir.
 *
 * Só agregados são enviados, e quem os monta é a função, lendo o banco com o
 * SEU token. Nenhum lançamento individual — e portanto nenhum nome de pessoa —
 * sai do banco.
 *
 * A função ainda confere todo "R$ X" da resposta contra os valores que mandou.
 * Modelo de linguagem inventa número com cara de certo, e num app de dinheiro
 * esse é o pior defeito: soa confiante e ninguém tem como saber.
 */
export async function perguntar(pergunta: string, ano: number, mes: number): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke<{
    resposta?: string
    erro?: string
    valoresNaoConferidos?: string[]
  }>('perguntar', { body: { pergunta, ano, mes } })

  if (error) {
    // O caso mais comum não é bug: é a função ainda não publicada, ou publicada
    // sem a chave. Dizer isso poupa a pessoa de procurar defeito onde não tem.
    throw new ErroServico(
      'O assistente não respondeu. Se você acabou de publicar o app, confira se a função "perguntar" foi enviada e se a chave do Gemini está configurada no Supabase.',
      error,
    )
  }
  if (data?.erro) throw new ErroServico(data.erro)
  if (!data?.resposta) throw new ErroServico('O assistente não devolveu resposta.')
  return { texto: data.resposta, valoresNaoConferidos: data.valoresNaoConferidos ?? [] }
}

/** Perguntas de partida — tirar a página em branco é metade do trabalho. */
export const PERGUNTAS_SUGERIDAS = [
  'Por que meu saldo ficou assim este mês?',
  'Onde eu mais gastei?',
  'Como este mês se compara com os outros?',
]
