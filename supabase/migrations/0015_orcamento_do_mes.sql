-- ---------------------------------------------------------------------
-- 0015 — orçamento do mês inteiro
--
-- O PROBLEMA
--
-- Existe limite por categoria desde a 0001. Mas a pergunta que alguém
-- faz de fato no dia 18 não é "quanto sobrou de mercado" — é "quanto eu
-- ainda posso gastar por dia até o fim do mês". Para responder isso
-- falta um teto geral.
--
-- ONDE MORA
--
-- Uma coluna no perfil, e não uma tabela por mês. O teto é uma decisão
-- de vida ("gasto até R$ 3.000 por mês"), não um número que muda toda
-- virada de mês; uma tabela por mês obrigaria a redigitá-lo em janeiro,
-- que é exatamente o problema que a 0012 resolveu para o salário.
--
-- Se um dia fizer sentido variar por mês, o caminho é uma tabela nova
-- com vigência (modelo da 0005) tendo esta coluna como padrão — e não
-- mexer nesta.
--
-- REGRA 8
--
-- Nasce em 0, que significa "sem orçamento definido". Com 0, a tela não
-- mostra o bloco e nada muda para quem já usa o app. Nenhum agregado é
-- tocado: o orçamento é comparação, não um valor que entra em soma
-- nenhuma.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists orcamento_centavos bigint not null default 0
    check (orcamento_centavos >= 0);

comment on column public.profiles.orcamento_centavos is
  'Teto de gastos do mês, em centavos. 0 = sem orçamento definido (a tela não mostra o bloco).';
