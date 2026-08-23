/**
 * Responder perguntas sobre as finanças do usuário, com o Gemini (camada
 * gratuita do Google AI Studio).
 *
 * POR QUE ISTO É UMA FUNÇÃO DE SERVIDOR
 *
 * A chave da API é um segredo de cobrança e de cota: quem a tem consome o seu
 * limite. No navegador ela estaria no bundle, visível no DevTools de qualquer
 * visitante. Por isso a chave vive só aqui, como segredo do Supabase, e o
 * navegador fala com esta função — nunca com o Google.
 *
 * POR QUE `fetch` E NÃO UM SDK
 *
 * A API é um POST com JSON. Um SDK aqui seria uma dependência a mais para
 * publicar, versionar e quebrar, sem nada em troca. O formato do corpo veio do
 * documento de descoberta da própria API, não de memória.
 *
 * O QUE É ENVIADO — E O QUE NÃO É
 *
 * Só AGREGADOS: totais do mês, soma por categoria e por forma, os 12 meses do
 * ano. Nenhuma linha de lançamento sai daqui, o que quer dizer que nenhum nome
 * de pessoa vai junto. Um extrato brasileiro é cheio de "Pix enviado para
 * <nome de alguém>", e essas pessoas não escolheram nada.
 *
 * A RESPOSTA É CONFERIDA ANTES DE SAIR
 *
 * Modelo de linguagem inventa número com cara de certo — e num app de dinheiro
 * esse é o pior defeito possível, porque soa confiante e ninguém tem como
 * saber. Todo "R$ X" da resposta é conferido contra os valores realmente
 * enviados (ver conferir-numeros.ts). O que não bate volta marcado, e a tela
 * avisa.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { conferirValores } from './conferir-numeros.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Teto de tamanho da pergunta: evita alguém usar isto como um chatbot grátis. */
const MAX_PERGUNTA = 500

/**
 * Trocável por segredo, porque os nomes de modelo do Google mudam e a sua
 * chave pode ter acesso a um conjunto diferente. Para ver os seus:
 * curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE"
 */
const MODELO_PADRAO = 'gemini-flash-latest'

const SISTEMA = `Você é o assistente do finZ, um app brasileiro de controle financeiro pessoal.

Responde perguntas sobre os números que a pessoa lançou no app, em português do Brasil.

REGRAS, em ordem de importância:

1. NUNCA invente um número. Use somente os valores do JSON recebido, ou contas
   simples entre eles. Se a resposta não estiver nos dados, diga isso e diga
   qual informação falta.
2. Escreva os valores como R$ 1.234,56.
3. Seja curto: duas ou três frases. Nada de "ótima pergunta" nem repetir a
   pergunta antes de responder.
4. Você vê AGREGADOS, não lançamentos individuais. Se pedirem o detalhe de uma
   compra específica, diga que só enxerga totais e que o detalhe está na tela
   do mês.
5. Não dê conselho de investimento nem recomende produtos financeiros.
   Constatar o que os números mostram é o seu papel; decidir sobre o dinheiro é
   de quem perguntou.
6. Se houver muito valor sem categoria, avise que a conta pode estar incompleta
   por causa disso.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const chave = Deno.env.get('GEMINI_API_KEY')
    if (!chave) {
      return json(
        { erro: 'A chave do Gemini ainda não foi configurada neste projeto. Veja docs/assistente.md.' },
        500,
      )
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

    // O JWT de quem perguntou vai adiante: a RLS decide o que esta função lê,
    // mesmo que alguém forje o corpo da requisição.
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

    // Guardados em centavos para a conferência, e mostrados em reais no prompt.
    const emCentavos: number[] = []
    const reais = (v: number | null | undefined) => {
      const c = v ?? 0
      emCentavos.push(c)
      return c / 100
    }

    const linha = resumo.data?.[0]
    const dados = {
      mes_consultado: `${String(mes).padStart(2, '0')}/${ano}`,
      observacao: 'Todos os valores estão em reais.',
      resumo_do_mes: linha
        ? {
            entrou: reais(linha.total_entradas),
            saiu: reais(linha.total_saidas),
            saldo: reais(linha.saldo),
            investido: reais(linha.total_investido),
          }
        : null,
      gastos_por_categoria: (categorias.data ?? [])
        .filter((c: { gasto_centavos: number }) => c.gasto_centavos > 0)
        .map((c: { nome: string; gasto_centavos: number; limite_centavos: number | null }) => ({
          categoria: c.nome,
          gasto: reais(c.gasto_centavos),
          limite: c.limite_centavos ? reais(c.limite_centavos) : null,
        })),
      saidas_por_forma_de_pagamento: (formas.data ?? [])
        .filter((f: { gasto_centavos: number }) => f.gasto_centavos > 0)
        .map((f: { nome: string; gasto_centavos: number }) => ({
          forma: f.nome,
          gasto: reais(f.gasto_centavos),
        })),
      ano_mes_a_mes: (anual.data ?? [])
        .filter((m: { entradas: number; saidas: number }) => m.entradas > 0 || m.saidas > 0)
        .map((m: { mes: number; entradas: number; saidas: number }) => ({
          mes: m.mes,
          entrou: reais(m.entradas),
          saiu: reais(m.saidas),
        })),
    }

    const modelo = Deno.env.get('GEMINI_MODEL') ?? MODELO_PADRAO
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`

    const chamada = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Dados do usuário (agregados):\n\n${JSON.stringify(dados, null, 2)}\n\nPergunta: ${pergunta.trim()}`,
              },
            ],
          },
        ],
        generationConfig: {
          // Temperatura baixa: aqui não se quer criatividade, se quer o número
          // certo. E teto curto porque a resposta é curta por instrução.
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      }),
    })

    if (!chamada.ok) {
      const corpo = await chamada.text()
      console.error('Gemini respondeu', chamada.status, corpo)
      if (chamada.status === 404) {
        return json(
          {
            erro: `O modelo "${modelo}" não existe para esta chave. Veja os disponíveis com: curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE" e ajuste o segredo GEMINI_MODEL.`,
          },
          500,
        )
      }
      if (chamada.status === 429) {
        return json({ erro: 'Limite gratuito do Gemini atingido por agora. Tente daqui a pouco.' }, 429)
      }
      return json({ erro: 'O assistente não conseguiu responder agora. Tente de novo em instantes.' }, 502)
    }

    const corpo = await chamada.json()
    const candidato = corpo?.candidates?.[0]
    const texto: string = (candidato?.content?.parts ?? [])
      .map((p: { text?: string }) => p?.text ?? '')
      .join('')
      .trim()

    if (!texto) {
      // Sem texto costuma ser filtro de conteúdo ou corte por limite — nos dois
      // casos o usuário precisa saber que não é resposta vazia por acaso.
      const motivo = candidato?.finishReason ?? 'desconhecido'
      return json({ erro: `O assistente não devolveu resposta (motivo: ${motivo}).` })
    }

    return json({
      resposta: texto,
      // Vazio = todo valor citado se explica pelos dados enviados.
      valoresNaoConferidos: conferirValores(texto, emCentavos),
    })
  } catch (erro) {
    console.error('Falha ao responder:', erro)
    return json({ erro: 'Não foi possível responder agora. Tente de novo em instantes.' }, 500)
  }
})
