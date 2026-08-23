-- ---------------------------------------------------------------------
-- 0006 — gasto sem categoria e sem forma de pagamento param de sumir
--
-- O PROBLEMA
--
-- `gastos_por_categoria` e `saidas_por_forma_pagamento` partem da tabela
-- de catálogo (categories / payment_methods) e trazem os totais por LEFT
-- JOIN. O efeito colateral é que um gasto com category_id NULL não tem
-- linha de catálogo para casar — e desaparece do resultado inteiro.
--
-- Isso era quase invisível enquanto todo gasto nascia de um formulário
-- que pedia categoria. A importação de extrato acabou com isso: extrato
-- de banco não traz categoria, então centenas de lançamentos entram com
-- NULL de uma vez.
--
-- O sintoma é pior do que "faltar uma fatia". O gráfico dividia o total
-- entre as categorias que sobraram e mostrava 100% — num mês com
-- R$ 5.401,10 de saídas, o donut dizia "Contas R$ 1.701,42 · 100%".
-- Os outros R$ 3.699,68 não estavam em lugar nenhum, e o número que
-- aparecia afirmava ser o todo. Total errado é pior do que total
-- faltando: não há como o usuário perceber.
--
-- A SOLUÇÃO
--
-- Uma linha sintética "Sem categoria" / "Sem forma de pagamento", com id
-- NULL, só quando existe algo sem classificar. Ela vai por último e leva
-- uma cor neutra — não é uma categoria de verdade, é o resto.
--
-- Nada muda para quem classifica tudo: sem gasto órfão, a linha não
-- aparece e o resultado é idêntico ao de antes.
--
-- O CLIENTE PRECISA ACEITAR category_id NULL nessas linhas. O tipo já
-- permitia (uuid), e a tela trata o NULL como "sem categoria".
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Gastos por categoria
-- ---------------------------------------------------------------------
create or replace function public.gastos_por_categoria(p_ano integer, p_mes integer)
returns table (
  category_id      uuid,
  nome             text,
  cor              text,
  limite_centavos  bigint,
  gasto_centavos   bigint,
  percentual_limite numeric
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  gastos as (
    select t.category_id as cid, sum(t.valor_centavos) as total
      from public.transactions t, uid
     where t.user_id = uid.id and t.tipo = 'gasto'
       and extract(year from t.data) = p_ano
       and extract(month from t.data) = p_mes
     group by t.category_id
    union all
    select f.category_id as cid, sum(f.valor_centavos) as total
      from public.fixed_expenses f, uid
     where f.user_id = uid.id and f.ativo
       and public.fixo_vigente(p_ano, p_mes, f.inicio_ano, f.inicio_mes, f.fim_ano, f.fim_mes)
     group by f.category_id
  ),
  somados as (
    select cid, sum(total)::bigint as total from gastos group by cid
  )
  -- A coluna `ord` só existe para ordenar: `returns table` fixa as seis
  -- colunas de saída, então ela morre na subconsulta.
  select category_id, nome, cor, limite_centavos, gasto_centavos, percentual_limite
  from (
  -- As categorias de verdade, como antes.
  select
    c.id as category_id,
    c.nome as nome,
    c.cor as cor,
    c.limite_centavos as limite_centavos,
    coalesce(s.total, 0)::bigint as gasto_centavos,
    case when c.limite_centavos is null or c.limite_centavos = 0 then 0
      else round((coalesce(s.total, 0)::numeric / c.limite_centavos::numeric) * 100, 2)
    end as percentual_limite,
    c.ordem as ord
  from public.categories c
  cross join uid
  left join somados s on s.cid = c.id
  where c.user_id = uid.id

  union all

  -- O resto, numa linha só, e só se existir. `where cid is null` no
  -- lugar de um group by: já está somado acima.
  select
    null::uuid,
    'Sem categoria',
    '#94a3b8',                  -- cinza: não é cor de categoria, é o resto
    null::bigint,
    s.total,
    0::numeric,
    2147483647 as ord           -- sempre por último, depois de qualquer ordem
  from somados s
  where s.cid is null and s.total > 0
  ) todos
  order by ord, nome;
$$;

-- ---------------------------------------------------------------------
-- Saidas por forma de pagamento — mesmo problema, mesma correção
-- ---------------------------------------------------------------------
create or replace function public.saidas_por_forma_pagamento(p_ano integer, p_mes integer)
returns table (
  payment_method_id uuid,
  nome              text,
  tipo              public.tipo_pagamento,
  gasto_centavos    bigint
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  gastos as (
    select t.payment_method_id as pid, sum(t.valor_centavos) as total
      from public.transactions t, uid
     where t.user_id = uid.id and t.tipo = 'gasto'
       and extract(year from t.data) = p_ano
       and extract(month from t.data) = p_mes
     group by t.payment_method_id
    union all
    select f.payment_method_id as pid, sum(f.valor_centavos) as total
      from public.fixed_expenses f, uid
     where f.user_id = uid.id and f.ativo
       and public.fixo_vigente(p_ano, p_mes, f.inicio_ano, f.inicio_mes, f.fim_ano, f.fim_mes)
     group by f.payment_method_id
  ),
  somados as (
    select pid, sum(total)::bigint as total from gastos group by pid
  )
  select payment_method_id, nome, tipo, gasto_centavos
  from (
  select p.id as payment_method_id, p.nome as nome, p.tipo as tipo,
         coalesce(s.total, 0)::bigint as gasto_centavos, p.ordem as ord
    from public.payment_methods p
    cross join uid
    left join somados s on s.pid = p.id
   where p.user_id = uid.id and p.ativo

  union all

  select
    null::uuid,
    'Sem forma de pagamento',
    -- O enum não tem um valor "nenhum", e inventar um mudaria o tipo. A
    -- tela usa isto só como rótulo, então o primeiro valor serve.
    (enum_first(null::public.tipo_pagamento)),
    s.total,
    2147483647 as ord
  from somados s
  where s.pid is null and s.total > 0
  ) todos
  order by ord, nome;
$$;
