-- ---------------------------------------------------------------------
-- 0007 — data padrão em UTC e filtros que não usavam o índice
--
-- DOIS PROBLEMAS INDEPENDENTES, MESMA COLUNA
--
-- 1) `transactions.data` tinha default `(now() at time zone 'utc')::date`.
--    Entre 21h e a meia-noite em São Paulo, esse default grava o dia
--    seguinte. Na prática ele nunca chegou a rodar: `criarLancamento`
--    exige `data`, e as duas telas que lançam gasto mandam sempre uma
--    data calculada em horário local. Ou seja, nenhum número que você já
--    viu está errado — o que existia era uma armadilha esperando o
--    primeiro insert que esquecesse a coluna.
--
--    A correção é tirar o default em vez de consertá-lo. A coluna segue
--    `not null`, então um insert sem data passa a falhar alto na hora,
--    em vez de gravar o dia errado calado. Fuso fixo no schema seria
--    trocar um erro silencioso por outro no dia em que o app sair do
--    Brasil; fuso por perfil seria um `select` no perfil a cada insert
--    para cobrir um caminho que não existe.
--
-- 2) As funções de agregado filtravam com
--    `extract(year from t.data) = p_ano and extract(month ...) = p_mes`.
--    Chamada de função sobre a coluna não é sargável: o Postgres não
--    consegue transformar isso numa faixa, então `transactions_user_data_idx
--    (user_id, data)` só era usado pelo prefixo `user_id` — varredura de
--    todos os lançamentos do usuário, filtrando linha a linha. Com um ano
--    de extrato importado isso já são milhares de linhas por tela.
--
--    Troca para faixa meio-aberta: `data >= make_date(...) and data <
--    make_date(...) + interval '1 month'`. Meio-aberta e não `between`
--    porque `between` exigiria calcular o último dia do mês — e é
--    exatamente aí que mora o bug de fevereiro.
--
-- O RESULTADO NUMÉRICO É IDÊNTICO. As duas formas selecionam o mesmo
-- conjunto de linhas para qualquer mês: `data` é `date`, sem hora, então
-- não existe borda de fuso para escapar pela fresta.
--
-- Funções fora deste arquivo: `investimentos_por_meta` e `resumo_metas`
-- filtram por colunas `ano`/`mes` inteiras, nunca por `data`. Não têm o
-- problema e ficam como estão.
-- ---------------------------------------------------------------------

alter table public.transactions alter column data drop default;

-- ---------------------------------------------------------------------
-- Resumo mensal (última versão vinha da 0005)
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
  periodo as (
    select make_date(p_ano, p_mes, 1) as inicio,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date as fim
  ),
  entradas as (
    select
      coalesce((select sum(valor_centavos) from public.incomes i, uid
                where i.user_id = uid.id and i.ano = p_ano and i.mes = p_mes), 0)
    + coalesce((select sum(valor_centavos) from public.transactions t, uid, periodo p
                where t.user_id = uid.id and t.tipo = 'entrada'
                  and t.data >= p.inicio and t.data < p.fim), 0) as total
  ),
  saidas as (
    select
      coalesce((select sum(valor_centavos) from public.transactions t, uid, periodo p
                where t.user_id = uid.id and t.tipo = 'gasto'
                  and t.data >= p.inicio and t.data < p.fim), 0)
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
-- Gastos por categoria (última versão vinha da 0006 — a linha sintética
-- "Sem categoria" continua exatamente como está)
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
  periodo as (
    select make_date(p_ano, p_mes, 1) as inicio,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date as fim
  ),
  gastos as (
    select t.category_id as cid, sum(t.valor_centavos) as total
      from public.transactions t, uid, periodo p
     where t.user_id = uid.id and t.tipo = 'gasto'
       and t.data >= p.inicio and t.data < p.fim
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
  select category_id, nome, cor, limite_centavos, gasto_centavos, percentual_limite
  from (
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

  select
    null::uuid,
    'Sem categoria',
    '#94a3b8',
    null::bigint,
    s.total,
    0::numeric,
    2147483647 as ord
  from somados s
  where s.cid is null and s.total > 0
  ) todos
  order by ord, nome;
$$;

-- ---------------------------------------------------------------------
-- Saídas por forma de pagamento (última versão vinha da 0006)
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
  periodo as (
    select make_date(p_ano, p_mes, 1) as inicio,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date as fim
  ),
  gastos as (
    select t.payment_method_id as pid, sum(t.valor_centavos) as total
      from public.transactions t, uid, periodo p
     where t.user_id = uid.id and t.tipo = 'gasto'
       and t.data >= p.inicio and t.data < p.fim
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
    (enum_first(null::public.tipo_pagamento)),
    s.total,
    2147483647 as ord
  from somados s
  where s.pid is null and s.total > 0
  ) todos
  order by ord, nome;
$$;

-- ---------------------------------------------------------------------
-- Comparativo anual (última versão vinha da 0005)
--
-- O `extract(month ...)` da lista de seleção fica: ali ele agrupa, não
-- filtra, e agrupamento não usa índice de faixa. Quem impedia o índice
-- era só o `extract(year ...)` do WHERE.
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
  ano as (
    select make_date(p_ano, 1, 1) as inicio,
           make_date(p_ano + 1, 1, 1) as fim
  ),
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
      from public.transactions t, uid, ano a
     where t.user_id = uid.id and t.tipo = 'entrada'
       and t.data >= a.inicio and t.data < a.fim
     group by 1
  ),
  sai_tx as (
    select extract(month from t.data)::integer as mes, sum(t.valor_centavos)::bigint as total
      from public.transactions t, uid, ano a
     where t.user_id = uid.id and t.tipo = 'gasto'
       and t.data >= a.inicio and t.data < a.fim
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
