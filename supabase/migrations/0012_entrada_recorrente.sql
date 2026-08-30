-- ---------------------------------------------------------------------
-- 0012 — entrada recorrente
--
-- O PROBLEMA
--
-- Gasto fixo se repete sozinho desde a 0001. Salário não: ele é
-- redigitado todo mês, na mão, com o mesmo valor. É a única coisa
-- garantida do mês que o app obriga a repetir.
--
-- A SOLUÇÃO
--
-- Uma definição única com vigência, exatamente no modelo da 0005 —
-- `recurring_incomes` é a `fixed_expenses` do outro lado do sinal. Quem
-- decide se ela conta num mês é a mesma função `fixo_vigente`, sem
-- inventar uma segunda regra de vigência que pudesse divergir.
--
-- O `fim` preserva histórico, e isso é o ponto: quem troca de emprego em
-- junho encerra o salário antigo em maio e começa o novo em junho. Os
-- meses de janeiro a maio continuam mostrando o valor antigo, porque
-- foi o que entrou de verdade. Apagar a linha reescreveria o passado.
--
-- REGRA 8
--
-- A tabela nasce vazia. Enquanto não houver nenhuma entrada recorrente
-- cadastrada, `resumo_mensal` e `comparativo_anual` devolvem exatamente
-- os mesmos números de antes — a soma nova é sempre 0.
--
-- O QUE ESTA MIGRATION NÃO FAZ, DE PROPÓSITO
--
-- Não converte as entradas avulsas que já existem em `incomes`. Elas são
-- dado que o usuário digitou para meses específicos, e transformá-las
-- numa regra recorrente seria adivinhar a intenção dele e, pior, poder
-- somar duas vezes o mesmo salário. As duas listas convivem, e a tela
-- avisa quando encontra uma avulsa com a mesma descrição de uma
-- recorrente no mesmo mês.
-- ---------------------------------------------------------------------

create table if not exists public.recurring_incomes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  descricao         text not null,
  valor_centavos    bigint not null default 0,
  -- Dia em que costuma cair. Só informativo, como dia_vencimento do fixo.
  dia_recebimento   integer check (dia_recebimento between 1 and 31),
  ativo             boolean not null default true,
  ordem             integer not null default 0,
  created_at        timestamptz not null default now(),
  -- Vigência, mesmo formato e mesmas regras da 0005.
  inicio_ano        integer,
  inicio_mes        integer,
  fim_ano           integer,
  fim_mes           integer,
  constraint recurring_incomes_vigencia_ck check (
    (inicio_ano is null) = (inicio_mes is null)
    and (fim_ano is null) = (fim_mes is null)
    and (inicio_mes is null or inicio_mes between 1 and 12)
    and (fim_mes is null or fim_mes between 1 and 12)
    and (inicio_ano is null or inicio_ano between 1900 and 2999)
    and (fim_ano is null or fim_ano between 1900 and 2999)
    and (inicio_ano is null or fim_ano is null
         or (fim_ano * 12 + fim_mes) >= (inicio_ano * 12 + inicio_mes))
  )
);

create index if not exists recurring_incomes_user_idx
  on public.recurring_incomes (user_id, ordem);

alter table public.recurring_incomes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'recurring_incomes' and policyname = 'recurring_incomes_owner'
  ) then
    create policy recurring_incomes_owner on public.recurring_incomes
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

comment on table public.recurring_incomes is
  'Entrada que se repete todo mês (salário). Vigência no modelo da 0005: fim preserva histórico.';

-- ---------------------------------------------------------------------
-- Resumo mensal — entradas passam a incluir as recorrentes vigentes
--
-- Cópia da definição da 0009; só o bloco `entradas` muda. As saídas
-- continuam com a regra de caixa da fatura, intocadas.
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
                  and t.data >= p.inicio and t.data < p.fim), 0)
    + coalesce((select sum(valor_centavos) from public.recurring_incomes r, uid
                where r.user_id = uid.id and r.ativo
                  and public.fixo_vigente(p_ano, p_mes, r.inicio_ano, r.inicio_mes,
                                          r.fim_ano, r.fim_mes)), 0) as total
  ),
  saidas as (
    select
      coalesce((select sum(t.valor_centavos)
                  from public.transactions t
                  cross join uid
                  cross join periodo p
                  left join public.payment_methods pm
                    on pm.id = t.payment_method_id and pm.user_id = uid.id
                 where t.user_id = uid.id and t.tipo = 'gasto'
                   and public.mes_de_caixa(t.data, pm.dia_fechamento,
                                           pm.fatura_inicio_ano, pm.fatura_inicio_mes) = p.inicio), 0)
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
-- Comparativo anual — mesma adição, mês a mês
--
-- Cópia da definição da 0007; entra a CTE `ent_recorrentes`, no mesmo
-- formato da `fixos` (uma linha por mês, com a vigência decidindo).
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
  ent_recorrentes as (
    select m.mes,
           coalesce(sum(r.valor_centavos), 0)::bigint as total
      from meses m
      cross join uid
      left join public.recurring_incomes r
        on r.user_id = uid.id
       and r.ativo
       and public.fixo_vigente(p_ano, m.mes, r.inicio_ano, r.inicio_mes, r.fim_ano, r.fim_mes)
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
    (coalesce(ei.total, 0) + coalesce(et.total, 0) + coalesce(er.total, 0))::bigint as entradas,
    (coalesce(st.total, 0) + coalesce(fx.total, 0))::bigint                         as saidas,
    (coalesce(ei.total, 0) + coalesce(et.total, 0) + coalesce(er.total, 0)
      - coalesce(st.total, 0) - coalesce(fx.total, 0))::bigint                      as diferenca
  from meses m
  left join fixos           fx on fx.mes = m.mes
  left join ent_recorrentes er on er.mes = m.mes
  left join ent_incomes     ei on ei.mes = m.mes
  left join ent_tx          et on et.mes = m.mes
  left join sai_tx          st on st.mes = m.mes
  order by m.mes;
$$;

-- ---------------------------------------------------------------------
-- carregar_mes — a nova lista entra no JSON
--
-- Vem inteira (sem filtrar por vigência): a tabela mostra todas e marca
-- as que não valem no mês, igual à de gastos fixos. Quem soma é quem
-- filtra.
-- ---------------------------------------------------------------------
create or replace function public.carregar_mes(p_ano integer, p_mes integer)
returns jsonb
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  periodo as (
    select make_date(p_ano, p_mes, 1) as inicio,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date as fim
  )
  select jsonb_build_object(
    'formasPagamento', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.payment_methods x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'categorias', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.categories x, uid
       where x.user_id = uid.id
    ), '[]'::jsonb),

    'metas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.created_at)
        from public.goals x, uid
       where x.user_id = uid.id
    ), '[]'::jsonb),

    'entradas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
        from public.incomes x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'entradasRecorrentes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.descricao)
        from public.recurring_incomes x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'gastosFixos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.fixed_expenses x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'pagamentos', coalesce((
      select jsonb_agg(to_jsonb(x))
        from public.fixed_expense_payments x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'lancamentos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.data, x.created_at)
        from public.transactions x, uid, periodo p
       where x.user_id = uid.id and x.data >= p.inicio and x.data < p.fim
    ), '[]'::jsonb),

    'investimentos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
        from public.investments x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
         and x.goal_id is null
    ), '[]'::jsonb),

    'aportes', coalesce((
      select jsonb_agg(to_jsonb(x))
        from public.goal_contributions x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'faturas', coalesce((
      select jsonb_agg(to_jsonb(f))
        from public.faturas_do_mes(p_ano, p_mes) f
    ), '[]'::jsonb)
  );
$$;
