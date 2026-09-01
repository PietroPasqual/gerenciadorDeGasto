# Nota: contas com saldo e reconciliação (decisão pendente, nada implementado)

## O problema que este arquivo existe para não deixar acontecer por acidente

O finZ tem `payment_methods` — Pix, Débito, Crédito 1, Dinheiro. Isso **não**
é a mesma coisa que uma conta bancária com saldo. Uma forma de pagamento é um
rótulo em cima de um lançamento; uma conta é um patrimônio que sobe e desce, e
tem um número que precisa bater com o extrato real do banco.

Hoje o app mostra "Saldo do mês" (entradas menos saídas do mês), não "saldo em
conta". A regra 5 do prompt de redesign é explícita sobre isto — "não use
`saldo em contas` enquanto o produto ainda não possuir contas com saldo e
reconciliação" — e vale registrar por quê essa regra existe: **os dois números
respondem perguntas diferentes**, e chamar o errado pelo nome certo é o tipo
de erro que corrói confiança rápido num app de dinheiro.

- **Saldo do mês** = quanto entrou menos quanto saiu, NESTE MÊS. Reseta a cada
  período. Não sabe quanto você tinha guardado antes.
- **Saldo em conta** = quanto EXISTE, agora, num lugar. Acumula para sempre.
  Só está certo se toda entrada e toda saída daquele lugar, desde o começo,
  estiver lançada — inclusive o que aconteceu antes de você usar o finZ.

O segundo número é muito mais fácil de errar, e um saldo errado é pior que
nenhum saldo: a pessoa para de confiar e para de olhar.

## O que faltaria para o segundo número existir de verdade

**1. Saldo inicial.** No dia em que a conta "nasce" no finZ, ela já tem
algum valor no banco de verdade. Sem capturar isso, todo saldo calculado
fica errado pelo mesmo tanto, para sempre — um deslocamento constante que
ninguém nota até comparar com o extrato.

**2. Toda movimentação daquele lugar precisa estar lançada.** Hoje o app não
exige isso — dá para usar só para acompanhar categorias, sem lançar
absolutamente tudo. Virar "saldo real" muda o contrato de uso: de "registre o
que quiser" para "registre tudo, ou o número mente".

**3. Transferência entre contas não pode contar como entrada nem saída.**
Mover R$ 500 do Pix para a poupança não é R$ 500 de gasto nem R$ 500 de
receita — é o mesmo dinheiro mudando de lugar. Sem um tipo de lançamento
próprio para isso, toda transferência infla entradas e saídas ao mesmo tempo,
e os relatórios de "quanto gastei" ficam errados exatamente na proporção de
quanto a pessoa transfere.

**4. Reconciliação.** Cedo ou tarde o saldo calculado diverge do saldo real —
uma tarifa que não foi lançada, um lançamento duplicado, um rendimento
automático. Precisa existir um jeito de a pessoa dizer "o banco diz que tem
R$ 1.842,10 aqui" e o app ou aceitar a diferença como um ajuste visível, ou
ajudar a achar o lançamento que falta. Sem isso, a primeira divergência que
aparecer destrói a confiança no número para sempre — é pior que não ter saldo
nenhum.

**5. Conta arquivada não pode sumir do histórico.** Fechou a conta no banco?
Os lançamentos antigos continuam precisando aparecer nos relatórios daquele
período. Arquivar tem que significar "não aceita lançamento novo", não
"apagou".

## O que muda no schema, em rascunho

```sql
create table public.accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  nome              text not null,
  saldo_inicial_centavos  bigint not null default 0,
  saldo_inicial_em       date,
  arquivada         boolean not null default false,
  ordem             integer not null default 0,
  created_at        timestamptz not null default now()
);
```

`transactions` ganharia `account_id` (de qual conta o dinheiro saiu/entrou) —
anulável, porque nem todo lançamento hoje precisa amarrar numa conta, e
tornar obrigatório quebraria todo lançamento existente (regra 8: migration
não pode mudar sozinha o que já foi visto).

Transferência exigiria um `tipo` novo em `transactions` (`'transferencia'`,
ao lado de `'gasto'` e `'entrada'`), com `account_id` de origem e um campo
para a conta de destino — e todo agregado que hoje soma `tipo = 'entrada'`
ou `tipo = 'gasto'` precisaria ser revisto para não somar `'transferencia'`
junto. Isso toca as mesmas seis funções SQL que a nota de conta compartilhada
lista, pelo mesmo motivo: qualquer coisa que muda o que "entrada" ou "gasto"
significa tem que passar pelas contas do mês inteiras, não só pela tabela
nova.

## Reconciliação, em rascunho

```sql
create table public.account_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  account_id        uuid not null references public.accounts (id) on delete cascade,
  saldo_informado_centavos  bigint not null,
  saldo_calculado_centavos  bigint not null,  -- o que o finZ tinha na hora
  diferenca_centavos        bigint generated always as
    (saldo_informado_centavos - saldo_calculado_centavos) stored,
  data              date not null,
  created_at        timestamptz not null default now()
);
```

Cada reconciliação é um REGISTRO, não uma correção silenciosa: a diferença
fica visível, com data, para a pessoa decidir o que fazer com ela — lançar o
que faltava, ou aceitar que existe uma diferença sem explicação (tarifa
pequena, arredondamento do banco). O app nunca ajusta o saldo sozinho.

## Recomendação

Não começar sem responder antes: **quantas pessoas realmente precisam do
número "quanto tenho no banco agora", contra "quanto entrou e saiu este
mês"?** O segundo já existe, é confiável, e é o que a maioria de um app de
planilha pessoal usa no dia a dia. O primeiro é valioso, mas caro em exatidão
— ele só vale a pena se a pessoa aceitar lançar tudo, e "lançar tudo" é uma
mudança de hábito que o produto hoje não pede.

Se a resposta for "sim, muita gente precisa", o caminho é: contas com saldo
inicial → transferências → reconciliação, nessa ordem, cada etapa útil
sozinha e testável sozinha — nunca as três de uma vez.

Enquanto isso não estiver decidido, nenhuma tela pode chamar nenhum número de
"saldo bancário", "saldo em contas" ou "patrimônio". O que existe hoje —
"Saldo do mês", "Entrou", "Gastei", "Sai da conta" — continua sendo a
descrição honesta do que o app sabe.
