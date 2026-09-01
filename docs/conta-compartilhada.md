# Nota: conta compartilhada (decisão pendente, nada implementado)

Casal com finanças conjuntas é o caso de uso mais comum de um app assim. Hoje
toda a RLS do finZ é `user_id = auth.uid()`. Migrar isso depois de ter usuários
reais é caro; decidir agora é barato. Esta nota compara os dois caminhos. **Nada
aqui está implementado.**

## Caminho A — manter `user_id`, compartilhar depois

**Custo hoje:** zero.

**Custo depois:** uma migration que toca todas as nove tabelas de dados, todas
as policies e todas as funções de agregado de uma vez, com backfill de dados de
produção. É exatamente o tipo de migration que não dá para ensaiar direito: o
ensaio roda num banco vazio, e o risco mora no banco cheio.

**O que quebra:** as funções `resumo_mensal`, `gastos_por_categoria`,
`saidas_por_forma_pagamento`, `comparativo_anual`, `investimentos_por_meta` e
`resumo_metas` fazem `where user_id = auth.uid()`. Todas mudam de predicado ao
mesmo tempo, e um erro em qualquer uma mostra número errado sem avisar — que é
a pior classe de bug deste app. `enforce_goal_limit` e o trigger de seed da
0004 também assumem "um usuário, um conjunto de dados".

## Caminho B — `household_id` desde já, com espaço de um membro só

**Custo hoje:** uma migration com o banco praticamente vazio. Cria `households`
e `household_members`, adiciona `household_id` a cada tabela, faz o backfill
trivial (um espaço por usuário existente), e as policies passam a
`household_id in (select household_id from household_members where user_id = auth.uid())`.
O trigger da 0004 passa a criar o espaço junto com o perfil.

**Custo depois:** compartilhar vira um `insert` em `household_members` e uma
tela de convite. Nenhuma migration de dados.

**O que fica pior desde já:** toda policy ganha um subselect no lugar de uma
comparação direta — mensurável, mas irrelevante na escala de um app pessoal
(o `in (select ...)` roda uma vez por consulta, não por linha). E há uma
pergunta de produto que passa a existir cedo: quando alguém sai do espaço, o
que acontece com os lançamentos que essa pessoa criou? A resposta muda o
schema (`created_by` separado de `household_id`), e é melhor descobrir isso
antes de ter dados do que depois.

## Recomendação

**Caminho B, se compartilhar estiver no horizonte de um ano.** O custo hoje é
uma tarde; o custo do caminho A cresce com cada linha acumulada, e o pior
momento para pagá-lo é justamente quando o app já vale a pena compartilhar.

Se compartilhar **não** estiver no horizonte, o caminho A é mais simples e a
dívida é real, mas honesta — e este arquivo existe para que ela não seja
esquecida.

Em qualquer um dos dois, a regra 8 continua valendo: a migration não pode mudar
sozinha nenhum número que o usuário já viu.

---

## Esboço de migration — caminho B (household_id)

**Nada abaixo é para rodar.** É o rascunho que qualquer decisão futura vai
precisar, escrito agora enquanto o banco está pequeno — é exatamente o
argumento da seção anterior: ensaiar isto com dados de produção é caro, e o
rascunho sozinho já mostra o tamanho da mudança.

### O que a migration criaria

```sql
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null default 'Minha casa',
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  papel         text not null default 'membro' check (papel in ('dono', 'membro')),
  entrou_em     timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);
```

### O backfill

Um espaço por usuário existente, com o próprio usuário como dono — é o que
mantém "quero continuar sozinho" idêntico ao de hoje:

```sql
insert into public.households (id, nome)
  select gen_random_uuid(), 'Minha casa' from auth.users;

insert into public.household_members (household_id, user_id, papel)
  select h.id, u.id, 'dono'
    from auth.users u
    join public.households h on true -- casamento 1:1 feito na CTE real, não aqui
   where /* h é o household recém-criado para este u */ false;
```

(O segundo `insert` acima está deliberadamente incompleto — precisa de uma
CTE que amarre cada `household` recém-criado ao `user_id` que o gerou, e essa
amarração é o tipo de detalhe que só se acerta escrevendo contra uma cópia
real do schema, não num rascunho.)

### O que muda em CADA uma das treze tabelas de dado do usuário

`payment_methods`, `categories`, `goals`, `goal_contributions`,
`wishlist_items`, `incomes`, `fixed_expenses`, `fixed_expense_payments`,
`transactions`, `investments`, `invoice_payments`, `recurring_incomes`,
`category_rules` — a mesma lista que `TABELAS_DO_USUARIO` em
`src/test/rls/cliente.ts` já varre hoje para provar isolamento por
`user_id`.

Cada uma ganha:

```sql
alter table public.<tabela> add column household_id uuid references public.households (id);
update public.<tabela> t set household_id = (
  select hm.household_id from public.household_members hm where hm.user_id = t.user_id
);
alter table public.<tabela> alter column household_id set not null;
```

E cada policy troca de forma:

```sql
-- de:
using (user_id = (select auth.uid()))
-- para:
using (household_id in (
  select household_id from public.household_members where user_id = (select auth.uid())
))
```

`user_id` PERMANECE em cada linha — é quem criou aquele lançamento, e a
pergunta "o que acontece com o que essa pessoa lançou quando ela sai do
espaço" (levantada na seção anterior) depende de conseguir apontar para um
autor mesmo depois de a linha passar a pertencer ao espaço, não à pessoa.

### O que muda nas funções de agregado

`resumo_mensal`, `gastos_por_categoria`, `saidas_por_forma_pagamento`,
`comparativo_anual`, `investimentos_por_meta`, `resumo_metas` e
`carregar_mes` — todas fazem `where t.user_id = uid.id` hoje. Cada uma passa
a resolver primeiro o `household_id` do usuário logado, depois filtra por
ele:

```sql
with household as (
  select household_id from public.household_members where user_id = (select auth.uid()) limit 1
)
select ... from public.transactions t, household h where t.household_id = h.household_id
```

`limit 1` é um placeholder para "um usuário, um espaço por vez" — o modelo
mais simples. Se um usuário puder pertencer a mais de um espaço (ex.: casa e
uma rachinha com amigos), esta parte muda de forma, e é uma decisão de
produto, não só de schema.

### O teste que provaria isolamento entre espaços

O mesmo formato dos 69 testes de RLS que já existem, com um terceiro ator:
não só "A não vê B", mas "membro de A não vê household de C mesmo que C
também exista no banco" — o caso que os testes de hoje não cobrem porque só
existe um nível de posse (`user_id`), e passaria a existir dois
(`user_id` dentro de `household_id`).

### Por que isto fica de fora do prompt de redesign visual

O prompt de evolução visual e funcional trata "conta compartilhada" como
decisão arquitetural de alto risco (fase 8 dele também), que exige ADR e
aprovação antes de qualquer código — a mesma régua que este arquivo já
seguia. Nada muda aqui: o esboço acima é insumo para aquela decisão futura,
não uma instrução para começar a implementar.
