# Assistente de perguntas — o que falta para funcionar

O card **"Perguntar sobre o mês"** já está no Painel. Ele usa a **camada
gratuita do Gemini** (Google AI Studio) e depende de dois passos seus.

Enquanto não estiverem feitos, o card aparece e, ao perguntar, mostra um recado
explicando exatamente o que falta — não quebra a tela nem some.

## 1. A chave (grátis)

Crie em <https://aistudio.google.com/apikey>. **Não pede cartão.**

A camada gratuita tem limite por minuto e por dia. Se estourar, a tela diz
"limite gratuito atingido, tente daqui a pouco" — não é erro do app.

Como o site é público, qualquer pessoa logada nele consome a sua cota. Se isso
virar problema, dá para limitar perguntas por usuário — é só pedir.

## 2. Publicar a função com a chave

A chave **não pode** ir para o app: o front-end é servido para o navegador e
ela ficaria visível no DevTools de qualquer visitante. Por isso vive numa função
de servidor.

```bash
# uma vez, se ainda não tiver o CLI
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF   # está na URL do painel do Supabase

# guarda a chave como segredo do projeto (nunca no repositório)
supabase secrets set GEMINI_API_KEY=AIza...

# publica a função
supabase functions deploy perguntar
```

Pronto. O card passa a responder.

### Se der erro de modelo não encontrado

Os nomes de modelo do Google mudam. A função usa `gemini-flash-latest` por
padrão e, se a sua chave não tiver esse, devolve um recado com o comando para
listar os seus:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE"
supabase secrets set GEMINI_MODEL=nome-que-apareceu-na-lista
```

## O que é enviado ao Google

**Só agregados**, montados pela própria função:

- totais do mês (entrou, saiu, saldo, investido)
- soma por categoria e por forma de pagamento
- os 12 meses do ano, com entrada e saída de cada um

**Nenhum lançamento individual sai do banco.** Isso é decisão de projeto, não
economia de token: extrato brasileiro é cheio de "Pix enviado para <nome de
alguém>", e essas pessoas não escolheram ter o nome delas enviado para lugar
nenhum. A tela diz isso ao usuário, em vez de deixar escondido aqui.

## A resposta é conferida antes de aparecer

Modelo de linguagem inventa número com cara de certo. Num app de dinheiro esse
é o pior defeito possível: soa confiante, e o usuário não tem como saber.

Por isso todo `R$ X` da resposta é conferido contra os valores que a função
realmente enviou (`conferir-numeros.ts`). Contas de dois valores passam — o
modelo legitimamente soma duas categorias ou tira a diferença entre entrada e
saída. O que não se explica volta marcado, e a tela mostra:

> ⚠ Não confira por esta resposta: **R$ 9.999,99** não confere com os seus
> números. Use os cards acima.

Isso é testado (`src/lib/conferir-numeros.test.ts`), inclusive o caso de não
dar alarme falso em percentual, contagem de meses e ano.

## Como a função se protege

- O cliente Supabase dentro dela é criado com o **JWT de quem perguntou**, então
  a RLS vale lá dentro: ela só lê os dados daquele usuário, mesmo que alguém
  forje o corpo da requisição.
- Sem `Authorization`, responde 401.
- Pergunta acima de 500 caracteres é recusada, para o endpoint não virar um
  chatbot de graça para terceiros.
- `temperature: 0.2` — aqui não se quer criatividade, se quer o número certo.

## Trocar de provedor

O corpo da chamada está num `fetch` só, no fim de
`supabase/functions/perguntar/index.ts`. Trocar por outro provedor (ou voltar
para a Anthropic, se um dia quiser pagar por respostas melhores) é mexer nesse
trecho e no nome do segredo — o resto, incluindo a conferência de números,
continua igual.

## Se quiser desligar

Apague a função (`supabase functions delete perguntar`) e remova o
`<PerguntarIA />` de `src/features/dashboard/dashboard-page.tsx`. O resto do app
não depende dele.
