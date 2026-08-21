-- ---------------------------------------------------------------------
-- 0005 — vigência dos gastos fixos
--
-- O PROBLEMA
-- Até aqui um gasto fixo não tinha noção nenhuma de tempo: as funções de
-- agregação somavam `select sum(valor_centavos) ... where ativo`, sem
-- filtro de período. Um aluguel de R$ 1.800 cadastrado em agosto era
-- contado também em janeiro..julho — R$ 12.600 de saída que nunca
-- existiram, no painel e no comparativo anual.
--
-- O inverso também doía: para parar de pagar a academia só havia `ativo =
-- false`, que a apagava de TODOS os meses, inclusive dos que foram pagos
-- de verdade.
--
-- A SOLUÇÃO
-- Cada gasto fixo passa a ter uma vigência: (inicio_ano, inicio_mes) e,
-- opcionalmente, (fim_ano, fim_mes). Ele só entra na conta dos meses
-- dentro dessa janela.
--
-- NULL = sem limite daquele lado. As linhas que já existem ficam com os
-- quatro campos nulos, ou seja, continuam valendo para todo mês — de
-- propósito: uma migration não deve mudar sozinha os números que você já
-- viu. Depois de rodar isto, abra cada gasto fixo e diga desde quando ele
-- é pago. (Se preferir chutar tudo de uma vez pelo mês de cadastro, o
-- UPDATE está comentado no fim do arquivo.)
--
-- `ativo` continua existindo e continua sendo um interruptor geral: quem
-- quer encerrar preservando o histórico usa `fim`.
-- ---------------------------------------------------------------------

alter table public.fixed_expenses
  add column if not exists inicio_ano integer,
  add column if not exists inicio_mes integer,
  add column if not exists fim_ano    integer,
  add column if not exists fim_mes    integer;

-- ano/mes andam sempre em par, e mes é 1..12.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fixed_expenses_vigencia_ck') then
    alter table public.fixed_expenses add constraint fixed_expenses_vigencia_ck check (
      (inicio_ano is null) = (inicio_mes is null)
      and (fim_ano is null) = (fim_mes is null)
      and (inicio_mes is null or inicio_mes between 1 and 12)
      and (fim_mes    is null or fim_mes    between 1 and 12)
      and (inicio_ano is null or inicio_ano between 1900 and 2999)
      and (fim_ano    is null or fim_ano    between 1900 and 2999)
      -- fim nunca antes do início
      and (
        inicio_ano is null or fim_ano is null
        or (fim_ano * 12 + fim_mes) >= (inicio_ano * 12 + inicio_mes)
      )
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Helper: o gasto fixo vale neste mês?
--
-- Comparamos ano*12 + mes para não precisar de duas comparações
-- encadeadas (ano maior OU ano igual e mês maior). immutable porque só
-- depende dos argumentos — assim o planner pode usá-la à vontade.
-- ---------------------------------------------------------------------
create or replace function public.fixo_vigente(
  p_ano      integer,
  p_mes      integer,
  inicio_ano integer,
  inicio_mes integer,
  fim_ano    integer,
  fim_mes    integer
) returns boolean
language sql
immutable
as $$
  select (inicio_ano is null or (p_ano * 12 + p_mes) >= (inicio_ano * 12 + inicio_mes))
     and (fim_ano    is null or (p_ano * 12 + p_mes) <= (fim_ano    * 12 + fim_mes));
$$;

-- =====================================================================
-- As quatro agregações que somavam gastos fixos passam a filtrar por
-- vigência. São `create or replace` das definições da 0003 — só muda a
-- cláusula do gasto fixo; o resto está igual, repetido aqui porque o
-- Postgres não sabe substituir um pedaço de função.
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
                where f.user_id = uid.id and f.ativo
                  and public.fixo_vigente(p_ano, p_mes, f.inicio_ano, f.inicio_mes,
                                          f.fim_ano, f.fim_mes)), 0) as total
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
-- Saidas por forma de pagamento
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
  select p.id, p.nome, p.tipo, coalesce(s.total, 0)::bigint
    from public.payment_methods p
    cross join uid
    left join somados s on s.pid = p.id
   where p.user_id = uid.id and p.ativo
   order by p.ordem, p.nome;
$$;

-- ---------------------------------------------------------------------
-- Comparativo anual
--
-- Aqui está a mudança que mais importa: `fixos` era UM total colado nos
-- doze meses (`cross join fixos`). Agora é um total POR mês, calculado
-- com a vigência de cada gasto — é o que faz janeiro parar de mostrar um
-- aluguel que só começou em agosto.
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
    select m.mes,
           coalesce(sum(f.valor_centavos), 0)::bigint as total
      from meses m
      cross join uid
      left join public.fixed_expenses f
        on f.user_id = uid.id
       and f.ativo
       and public.fixo_vigente(p_ano, m.mes, f.inicio_ano, f.inicio_mes, f.fim_ano, f.fim_mes)
     group by m.mes
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
    (coalesce(ei.total, 0) + coalesce(et.total, 0))::bigint      as entradas,
    (coalesce(st.total, 0) + coalesce(fx.total, 0))::bigint      as saidas,
    (coalesce(ei.total, 0) + coalesce(et.total, 0)
      - coalesce(st.total, 0) - coalesce(fx.total, 0))::bigint   as diferenca
  from meses m
  left join fixos       fx on fx.mes = m.mes
  left join ent_incomes ei on ei.mes = m.mes
  left join ent_tx      et on et.mes = m.mes
  left join sai_tx      st on st.mes = m.mes
  order by m.mes;
$$;

-- ---------------------------------------------------------------------
-- Opcional: chutar a vigência pelo mês de cadastro de cada gasto fixo.
-- Rode SÓ se você cadastrou cada fixo no mês em que começou a pagá-lo.
-- ---------------------------------------------------------------------
-- update public.fixed_expenses
--    set inicio_ano = extract(year  from created_at)::integer,
--        inicio_mes = extract(month from created_at)::integer
--  where inicio_ano is null;
