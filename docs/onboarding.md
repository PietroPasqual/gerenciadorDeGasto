# Proposta: primeiro acesso guiado (nada implementado)

## O problema

Hoje, quem cria conta cai direto no painel de um mês vazio. A `0004` semeia
categorias e formas de pagamento padrão — então a tela não está literalmente
em branco —, mas ninguém disse à pessoa o que aquilo significa, e nada nela
ainda é dela: nome genérico de categoria, nenhum orçamento, nenhuma entrada
recorrente cadastrada, lembretes com os padrões da `0017` que ninguém
confirmou.

O primeiro minuto de uso decide se a pessoa volta amanhã. Um onboarding curto
transforma "tela vazia, e agora?" em "já configurei o básico, hora de lançar
o primeiro gasto".

## O que ele pediria, em ordem

1. **Nome** — já existe em `profiles.nome`; só falta perguntar cedo.
2. **Orçamento do mês** — `profiles.orcamento_centavos` (`0015`). Opcional:
   quem não sabe o número ainda pode pular e configurar depois em
   Configurações.
3. **Principal entrada recorrente** — um atalho para criar UMA
   `recurring_incomes` (salário, o caso mais comum), não uma tela de
   cadastro completa.
4. **Categorias que quer usar** — a `0004` já cria um conjunto padrão; aqui a
   pessoa só marca quais quer manter e pode renomear/remover na hora, em vez
   de abrir Configurações depois para faxinar o que não usa.
5. **Limites** — opcional, só nas categorias marcadas no passo anterior.
6. **Preferências de lembrete** — os três interruptores e a antecedência da
   `0017`, mostrados com os valores padrão já marcados: a pessoa confirma ou
   ajusta, não parte do zero.
7. **Primeiro gasto** — termina com uma ação real, não com "pronto!". A tela
   seguinte já é o mês com um lançamento nela.

## Regras que fariam esta proposta funcionar

**Pulável, e sem culpa.** Cada etapa tem "Pular" visível — e "pular tudo"
manda direto pro painel. Ninguém pode ficar preso.

**Retomável.** Fechar o app no passo 3 e voltar amanhã continua no passo 3,
não recomeça do 1. Isso implica guardar em algum lugar "até onde a pessoa
chegou" — um campo simples em `profiles` (`onboarding_etapa` ou
`onboarding_concluido_em`) resolve, e é aditivo: uma coluna nova, default
que não muda comportamento de ninguém que já tem conta.

**Idempotente em cada etapa.** Salvar o nome duas vezes não pode criar duas
entradas recorrentes nem duplicar categoria. Isso é automático se cada etapa
usa os mesmos `criarX`/`atualizarX` que Configurações já usa — o onboarding
não é um caminho de escrita novo, é uma ordem guiada por cima do que existe.

**Nunca inventa dado na conta real.** Nenhum valor de exemplo é gravado como
se fosse real; campos vazios ficam vazios até a pessoa preencher.

**Conta antiga nunca vê isto.** `onboarding_concluido_em is null` e a conta
foi criada antes da existência do onboarding → marcar como concluído sem
mostrar nada, não empurrar o fluxo para quem já usa o app.

## Onde ele mora tecnicamente

- Estado: um wizard de poucos passos, cada um seu próprio componente, sem
  rota própria — um overlay sobre o painel, na linha do que já existe para
  sheets. Sair no meio preserva o que já foi salvo (regra da idempotência
  acima).
- Dado: nenhuma tabela nova além da coluna de progresso em `profiles`. Tudo o
  resto já existe.
- Entrada: dispara uma vez, depois do primeiro login, quando
  `onboarding_concluido_em is null`. Um link em Configurações ("Refazer a
  configuração inicial") permite rodar de novo por vontade própria.

## Como isto se encaixa com o prompt de redesign visual

O prompt de evolução visual (seção 14.1) também especifica onboarding, com os
mesmos campos essencialmente — nome, orçamento, entrada recorrente,
categorias, limites, lembretes, primeiro gasto — mas dentro de uma direção
visual mais elaborada (progresso mostrado, cada etapa salva de forma
idempotente, pulável). Esta nota foi escrita ANTES daquele prompt existir
como sequência combinada de trabalho; quando a fase de onboarding daquele
prompt for implementada, é este documento que deve ser revisado e
substituído — as regras acima (pulável, retomável, idempotente, sem dado
fictício) continuam valendo e não precisam ser redecididas, só desenhadas de
novo com a linguagem visual da fase 1 daquele prompt.

## Recomendação

Baixo risco, alto retorno: nenhuma tabela nova de peso, nenhuma mudança de
schema em dado existente, e o pior caso de bug (etapa que falha) é uma pessoa
ver o painel vazio de novo — o comportamento de hoje, não uma regressão. Vale
a pena antes de qualquer coisa mais arriscada da fase 8.
