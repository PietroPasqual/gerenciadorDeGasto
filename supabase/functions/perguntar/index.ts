/**
 * Responder perguntas sobre as finanças do usuário, com o Claude.
 *
 * POR QUE ISTO É UMA FUNÇÃO DE SERVIDOR, E NÃO CÓDIGO DO NAVEGADOR
 *
 * A chave da API da Anthropic é um segredo de cobrança: quem a tem gasta o seu
 * dinheiro. No navegador ela estaria no bundle, visível no DevTools de qualquer
 * visitante. Por isso a chave vive só aqui, como segredo do Supabase, e o
 * navegador fala com esta função — nunca com a Anthropic.
 *
 * O QUE É ENVIADO PARA A ANTHROPIC — E O QUE NÃO É
 *
 * Só AGREGADOS: totais do mês, soma por categoria, os 12 meses do ano. Nenhuma
 * linha de lançamento sai daqui, o que quer dizer que nenhum nome de pessoa vai
 * junto. Um extrato brasileiro é cheio de "Pix enviado para <nome de alguém>",
 * e essas pessoas não escolheram ter o nome delas mandado para lugar nenhum.
 * O agregado também responde bem a quase toda pergunta ("quanto gastei com
 * mercado?", "por que fechei no negativo?") e custa uma fração dos tokens.
 *
 * QUEM VÊ O QUÊ
 *
 * O cliente Supabase é criado com o JWT de quem perguntou, então a RLS vale
 * aqui dentro do mesmo jeito: esta função só consegue ler os dados do próprio
 * usuário, mesmo que alguém forje o corpo da requisição.
 */

import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Teto de tamanho da pergunta: evita alguém usar isto como um Claude grátis. */
const MAX_PERGUNTA = 500

const SISTEMA = `Você é o assistente do finZ, um app de controle financeiro pessoal brasileiro.

Responde perguntas sobre os números que a pessoa lançou no app, em português do Brasil.

REGRAS

1. Responda SOMENTE com base nos dados fornecidos. Se a resposta não estiver
   neles, diga isso e diga qual informação falta — nunca estime, complete ou
   invente um número.
2. Cite os valores exatos que recebeu, formatados como R$ 1.234,56.
3. Seja curto: duas ou três frases na maioria das perguntas. Sem introdução do
   tipo "ótima pergunta".
4. Você vê AGREGADOS, não lançamentos individuais. Se pedirem detalhe de uma
   compra específica, explique que só enxerga os totais e que o detalhe está na
   tela do mês.
5. Não dê conselho de investimento nem recomende produtos financeiros. Você
   pode constatar o que os números mostram ("os fixos são 40% do que entrou") e
   explicar contas. Decisão sobre o dinheiro é de quem perguntou.
6. Se um valor grande estiver sem categoria, mencione que a conta pode estar
   incompleta por isso.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const chaveAnthropic = Deno.env.get('ANTHROPIC_API_KEY')
    if (!chaveAnthropic) {
      return json({ erro: 'A chave da Anthropic não está configurada neste projeto.' }, 500)
    }

    const autorizacao = req.headers.get('Authorization')
    if (!autorizacao) return json({ erro: 'Faça login para usar o assistente.' }, 401)

    const { pergunta, ano, mes } = await req.json()
    if (typeof pergunta !== 'string' || pergunta.trim() === '') {
      return json({ erro: 'Escreva uma pergunta.' }, 400)
    }
    if (pergunta.length > MAX_PERGUNTA) {
      return json({ erro: `A pergunta precisa ter no máximo ${MAX_PERGUNTA} caracteres.` }, 400)
    }

    // O JWT de quem perguntou vai adiante: a RLS decide o que esta função lê.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: autorizacao } } },
    )

    const { data: usuario } = await supabase.auth.getUser()
    if (!usuario?.user) return json({ erro: 'Sessão expirada. Entre novamente.' }, 401)

    const [resumo, categorias, formas, anual] = await Promise.all([
      supabase.rpc('resumo_mensal', { p_ano: ano, p_mes: mes }),
      supabase.rpc('gastos_por_categoria', { p_ano: ano, p_mes: mes }),
      supabase.rpc('saidas_por_forma_pagamento', { p_ano: ano, p_mes: mes }),
      supabase.rpc('comparativo_anual', { p_ano: ano }),
    ])

    const centavos = (v: number | null | undefined) => (v ?? 0) / 100
    const dados = {
      mes_consultado: `${String(mes).padStart(2, '0')}/${ano}`,
      moeda: 'BRL (valores já em reais)',
      resumo_do_mes: resumo.data?.[0]
        ? {
            entrou: centavos(resumo.data[0].total_entradas),
            saiu: centavos(resumo.data[0].total_saidas),
            saldo: centavos(resumo.data[0].saldo),
            investido: centavos(resumo.data[0].total_investido),
          }
        : null,
      gastos_por_categoria: (categorias.data ?? [])
        .filter((c: { gasto_centavos: number }) => c.gasto_centavos > 0)
        .map((c: { nome: string; gasto_centavos: number; limite_centavos: number | null }) => ({
          categoria: c.nome,
          gasto: centavos(c.gasto_centavos),
          limite: c.limite_centavos ? centavos(c.limite_centavos) : null,
        })),
      saidas_por_forma_de_pagamento: (formas.data ?? [])
        .filter((f: { gasto_centavos: number }) => f.gasto_centavos > 0)
        .map((f: { nome: string; gasto_centavos: number }) => ({
          forma: f.nome,
          gasto: centavos(f.gasto_centavos),
        })),
      ano_mes_a_mes: (anual.data ?? [])
        .filter((m: { entradas: number; saidas: number }) => m.entradas > 0 || m.saidas > 0)
        .map((m: { mes: number; entradas: number; saidas: number }) => ({
          mes: m.mes,
          entrou: centavos(m.entradas),
          saiu: centavos(m.saidas),
        })),
    }

    const anthropic = new Anthropic({ apiKey: chaveAnthropic })

    const stream = anthropic.messages.stream({
      model: 'claude-opus-5',
      // Teto modesto porque a resposta é curta por instrução — e cada pergunta
      // custa dinheiro real de quem publicou o app.
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      // Os dados cabem em poucos milhares de tokens e as perguntas são diretas;
      // "medium" dá conta e não cobra o preço de raciocínio profundo à toa.
      output_config: { effort: 'medium' },
      system: SISTEMA,
      messages: [
        {
          role: 'user',
          content: `Dados do usuário (agregados):\n\n${JSON.stringify(dados, null, 2)}\n\nPergunta: ${pergunta.trim()}`,
        },
      ],
    })

    const resposta = await stream.finalMessage()

    if (resposta.stop_reason === 'refusal') {
      return json({ erro: 'Não consigo responder essa pergunta. Tente perguntar sobre os seus números.' }, 200)
    }

    const texto = resposta.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    return json({ resposta: texto || 'Não consegui montar uma resposta com esses dados.' })
  } catch (erro) {
    console.error('Falha ao responder:', erro)
    return json({ erro: 'Não foi possível responder agora. Tente de novo em instantes.' }, 500)
  }
})
