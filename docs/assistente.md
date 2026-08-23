# Assistente de perguntas — o que falta para funcionar

O card **"Perguntar sobre o mês"** já está no Painel, mas ele depende de duas
coisas que só você pode fazer, porque envolvem a sua conta e o seu dinheiro.

Enquanto não estiverem feitas, o card aparece e, ao perguntar, mostra um recado
explicando exatamente isso — não quebra a tela nem some.

## 1. Uma chave da API da Anthropic

Crie em <https://console.anthropic.com> → API Keys.

**Isto é pago, por uso.** O modelo usado é o `claude-opus-5`. Cada pergunta
manda os seus totais (poucos milhares de tokens) e recebe uma resposta curta —
alguns centavos por pergunta, na ordem de grandeza. Quem paga é o dono da chave,
ou seja, você; e como o app é público, qualquer pessoa logada nele gasta da sua
chave. Se isso for um problema, dá para limitar por usuário — me peça.

## 2. Publicar a função e guardar a chave nela

A chave **não pode** ir para o app. O front-end é servido para o navegador; uma
chave ali estaria visível no DevTools de qualquer visitante. Por isso ela vive
numa função de servidor.

```bash
# uma vez, se ainda não tiver o CLI
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF   # está na URL do painel do Supabase

# guarda a chave como segredo do projeto (nunca no repositório)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# publica a função
supabase functions deploy perguntar
```

Pronto. O card passa a responder.

## O que é enviado para a Anthropic

**Só agregados**, montados pela própria função:

- totais do mês (entrou, saiu, saldo, investido)
- soma por categoria e por forma de pagamento
- os 12 meses do ano, com entrada e saída de cada um

**Nenhum lançamento individual sai do banco.** Isso é decisão de projeto, não
economia de token: extrato brasileiro é cheio de "Pix enviado para <nome de
alguém>", e essas pessoas não escolheram ter o nome delas enviado para lugar
nenhum. O agregado também responde bem a quase toda pergunta e custa menos.

A tela diz isso ao usuário, em vez de deixar escondido aqui.

## Como a função se protege

- O cliente Supabase dentro dela é criado com o **JWT de quem perguntou**, então
  a RLS vale lá dentro: a função só lê os dados daquele usuário, mesmo que
  alguém forje o corpo da requisição.
- Sem `Authorization`, responde 401.
- Pergunta acima de 500 caracteres é recusada, para o endpoint não virar um
  Claude de graça para terceiros.
- O prompt manda responder só com os dados recebidos e nunca estimar número que
  não esteja lá.

## Se quiser desligar

Apague a função (`supabase functions delete perguntar`) e remova o
`<PerguntarIA />` de `src/features/dashboard/dashboard-page.tsx`. O resto do app
não depende dele.
