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
