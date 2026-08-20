-- =====================================================================
-- 0003_views.sql — Agregados no banco (nada de somar linha a linha no cliente).
--
-- Convencoes de calculo, validas em todo o app:
--   entradas  = incomes(mes) + transactions(tipo='entrada', mes)
--   saidas    = transactions(tipo='gasto', mes) + gastos fixos ativos
--               (a definicao de gasto fixo se repete em TODO mes)
--   investido = goal_contributions(mes)  [aportes com meta]
--             + investments(mes) sem meta [aportes avulsos]
--   saldo     = entradas - saidas
--
-- Todas as funcoes sao SECURITY INVOKER (padrao): a RLS do usuario
-- continua valendo dentro delas. O filtro por auth.uid() e explicito
-- para que os indices por user_id sejam usados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Resumo do mes
-- ---------------------------------------------------------------------
create or replace function public.resumo_mensal(p_ano integer, p_mes integer)
returns table (
  total_entradas       bigint,
  total_saidas         bigint,
  saldo                bigint,
  total_investido      bigint,
  percentual_investido numeric
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  entradas as (
    select
      coalesce((select sum(valor_centavos) from public.incomes i, uid
                where i.user_id = uid.id and i.ano = p_ano and i.mes = p_mes), 0)
    + coalesce((select sum(valor_centavos) from public.transactions t, uid
                where t.user_id = uid.id and t.tipo = 'entrada'
                  and extract(year from t.data) = p_ano
                  and extract(month from t.data) = p_mes), 0) as total
  ),
  saidas as (
    select
      coalesce((select sum(valor_centavos) from public.transactions t, uid
                where t.user_id = uid.id and t.tipo = 'gasto'
                  and extract(year from t.data) = p_ano
                  and extract(month from t.data) = p_mes), 0)
    + coalesce((select sum(valor_centavos) from public.fixed_expenses f, uid
                where f.user_id = uid.id and f.ativo), 0) as total
  ),
  investido as (
    select
      coalesce((select sum(valor_centavos) from public.goal_contributions g, uid
                where g.user_id = uid.id and g.ano = p_ano and g.mes = p_mes), 0)
    + coalesce((select sum(valor_centavos) from public.investments v, uid
                where v.user_id = uid.id and v.ano = p_ano and v.mes = p_mes
                  and v.goal_id is null), 0) as total
  )
  select
    entradas.total,
    saidas.total,
    entradas.total - saidas.total,
    investido.total,
    case when entradas.total > 0
      then round((investido.total::numeric / entradas.total::numeric) * 100, 2)
      else 0
    end
  from entradas, saidas, investido;
$$;

-- ---------------------------------------------------------------------
-- Gastos por categoria (inclui gastos fixos + lancamentos do mes)
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
     group by f.category_id
  ),
  somados as (
    select cid, sum(total)::bigint as total from gastos group by cid
  )
  select
    c.id,
    c.nome,
    c.cor,
    c.limite_centavos,
    coalesce(s.total, 0)::bigint,
    case when c.limite_centavos is null or c.limite_centavos = 0 then 0
      else round((coalesce(s.total, 0)::numeric / c.limite_centavos::numeric) * 100, 2)
    end
  from public.categories c
  cross join uid
  left join somados s on s.cid = c.id
  where c.user_id = uid.id
  order by c.ordem, c.nome;
$$;

-- ---------------------------------------------------------------------
-- Saidas por forma de pagamento (inclui gastos fixos)
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
     group by f.payment_method_id
  ),
  somados as (
    select pid, sum(total)::bigint as total from gastos group by pid
  )
  select p.id, p.nome, p.tipo, coalesce(s.total, 0)::bigint
    from public.payment_methods p
    cross join uid
    left join somados s on s.pid = p.id
   where p.user_id = uid.id and p.ativo
   order by p.ordem, p.nome;
$$;

-- ---------------------------------------------------------------------
-- Investimentos do mes por meta (+ bucket "Sem meta")
-- ---------------------------------------------------------------------
create or replace function public.investimentos_por_meta(p_ano integer, p_mes integer)
returns table (
  goal_id             uuid,
  nome                text,
  valor_meta_centavos bigint,
  valor_centavos      bigint
)
language sql
stable
as $$
  with uid as (select auth.uid() as id)
  select g.id, g.nome, g.valor_meta_centavos,
         coalesce((select sum(gc.valor_centavos)
                     from public.goal_contributions gc
                    where gc.goal_id = g.id and gc.ano = p_ano and gc.mes = p_mes), 0)::bigint
    from public.goals g, uid
   where g.user_id = uid.id
  union all
  select null::uuid, 'Sem meta'::text, 0::bigint,
         coalesce((select sum(v.valor_centavos)
                     from public.investments v, uid
                    where v.user_id = uid.id and v.ano = p_ano and v.mes = p_mes
                      and v.goal_id is null), 0)::bigint;
$$;

-- ---------------------------------------------------------------------
-- Comparativo anual: 12 meses com entrada, gasto e diferenca
-- ---------------------------------------------------------------------
create or replace function public.comparativo_anual(p_ano integer)
returns table (
  mes        integer,
  entradas   bigint,
  saidas     bigint,
  diferenca  bigint
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  meses as (select generate_series(1, 12) as mes),
  fixos as (
    select coalesce(sum(f.valor_centavos), 0)::bigint as total
      from public.fixed_expenses f, uid
     where f.user_id = uid.id and f.ativo
  ),
  ent_incomes as (
    select i.mes, sum(i.valor_centavos)::bigint as total
      from public.incomes i, uid
     where i.user_id = uid.id and i.ano = p_ano
     group by i.mes
  ),
  ent_tx as (
    select extract(month from t.data)::integer as mes, sum(t.valor_centavos)::bigint as total
      from public.transactions t, uid
     where t.user_id = uid.id and t.tipo = 'entrada'
       and extract(year from t.data) = p_ano
     group by 1
  ),
  sai_tx as (
    select extract(month from t.data)::integer as mes, sum(t.valor_centavos)::bigint as total
      from public.transactions t, uid
     where t.user_id = uid.id and t.tipo = 'gasto'
       and extract(year from t.data) = p_ano
     group by 1
  )
  select
    m.mes,
    (coalesce(ei.total, 0) + coalesce(et.total, 0))::bigint as entradas,
    (coalesce(st.total, 0) + fixos.total)::bigint            as saidas,
    (coalesce(ei.total, 0) + coalesce(et.total, 0)
      - coalesce(st.total, 0) - fixos.total)::bigint         as diferenca
  from meses m
  cross join fixos
  left join ent_incomes ei on ei.mes = m.mes
  left join ent_tx      et on et.mes = m.mes
  left join sai_tx      st on st.mes = m.mes
  order by m.mes;
$$;

-- ---------------------------------------------------------------------
-- Resumo de metas do ano (total guardado por meta no ano e no total)
-- ---------------------------------------------------------------------
create or replace function public.resumo_metas(p_ano integer)
returns table (
  goal_id             uuid,
  nome                text,
  valor_meta_centavos bigint,
  guardado_ano        bigint,
  guardado_total      bigint,
  percentual          numeric
)
language sql
stable
as $$
  with uid as (select auth.uid() as id)
  select
    g.id,
    g.nome,
    g.valor_meta_centavos,
    coalesce((select sum(c.valor_centavos) from public.goal_contributions c
               where c.goal_id = g.id and c.ano = p_ano), 0)::bigint,
    coalesce((select sum(c.valor_centavos) from public.goal_contributions c
               where c.goal_id = g.id), 0)::bigint,
    case when g.valor_meta_centavos > 0 then
      round((coalesce((select sum(c.valor_centavos) from public.goal_contributions c
                        where c.goal_id = g.id), 0)::numeric
             / g.valor_meta_centavos::numeric) * 100, 2)
      else 0 end
  from public.goals g, uid
  where g.user_id = uid.id
  order by g.ordem, g.nome;
$$;
