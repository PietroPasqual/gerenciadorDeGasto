-- ---------------------------------------------------------------------
-- 0009 — cartão de crédito ganha fatura
--
-- O PROBLEMA
--
-- Um gasto no crédito em 20 de agosto sai do bolso em setembro, mas o app
-- contava tudo em agosto. O saldo do mês não batia com a conta de ninguém
-- que usa cartão — que é a maioria.
--
-- AS DUAS PERGUNTAS DIFERENTES
--
-- "Onde meu dinheiro foi?" e "quanto sai da minha conta?" não têm a mesma
-- resposta quando existe cartão, e tratá-las como uma só é a origem da
-- confusão. Então:
--
--   competência = o mês do gasto. É o que a análise por categoria e por
--                 forma de pagamento usam.
--   caixa       = o mês em que a fatura vence. É o que o saldo usa.
--
-- `gastos_por_categoria` e `saidas_por_forma_pagamento` NÃO mudam nesta
-- migration, de propósito: elas respondem a primeira pergunta e já estão
-- certas. Quem muda é `resumo_mensal`, que responde a segunda.
--
-- Consequência visível, e ela é intencional: num mês com cartão, o donut
-- de categorias e o total de saídas do cabeçalho deixam de bater. A tela
-- passa a mostrar os dois números com nomes diferentes ("gastei" e "sai
-- da conta") em vez de mostrar um só e deixar o outro implícito. Total
-- que não bate e não se explica é pior do que dois totais explicados.
--
-- REGRA 8: NADA MUDA SOZINHO
--
-- A fatura é OPT-IN e tem vigência, no mesmo modelo da 0005. Um cartão só
-- passa a ter fatura quando ganha `dia_fechamento` E `fatura_inicio_ano/mes`.
-- Todo cartão que já existe nasce com esses campos nulos, então esta
-- migration não muda um único número que o usuário já viu. Ligar a fatura
-- num mês passado é possível, mas é uma ação explícita dele, com o antes e
-- o depois à vista.
--
-- O fechamento é DERIVADO da data do gasto, nunca guardado por lançamento.
-- Guardar criaria uma segunda verdade que envelhece: mudar o fechamento do
-- cartão deixaria todo o histórico mentindo.
-- ---------------------------------------------------------------------

alter table public.payment_methods
  add column if not exists dia_fechamento     integer,
  add column if not exists dia_vencimento     integer,
  add column if not exists fatura_inicio_ano  integer,
  add column if not exists fatura_inicio_mes  integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payment_methods_fatura_ck') then
    alter table public.payment_methods add constraint payment_methods_fatura_ck check (
      (dia_fechamento is null or dia_fechamento between 1 and 31)
      and (dia_vencimento is null or dia_vencimento between 1 and 31)
      and (fatura_inicio_ano is null) = (fatura_inicio_mes is null)
      and (fatura_inicio_mes is null or fatura_inicio_mes between 1 and 12)
      and (fatura_inicio_ano is null or fatura_inicio_ano between 1900 and 2999)
      -- Vigência sem fechamento não teria como derivar fatura nenhuma.
      and (fatura_inicio_ano is null or dia_fechamento is not null)
    );
  end if;
end $$;

comment on column public.payment_methods.dia_fechamento is
  'Dia em que o ciclo do cartão fecha. NULL = cartão sem fatura (comportamento anterior à 0009).';
comment on column public.payment_methods.fatura_inicio_ano is
  'Vigência da regra de fatura, no modelo da 0005. NULL = nunca; compras anteriores mantêm o comportamento antigo.';

-- ---------------------------------------------------------------------
-- Pagamento da fatura — mesmo formato de fixed_expense_payments
-- ---------------------------------------------------------------------
create table if not exists public.invoice_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods (id) on delete cascade,
  ano               integer not null check (ano between 1900 and 2999),
  mes               integer not null check (mes between 1 and 12),
  pago              boolean not null default false,
  pago_em           timestamptz,
  unique (payment_method_id, ano, mes)
);
create index if not exists invoice_payments_user_periodo_idx
  on public.invoice_payments (user_id, ano, mes);

alter table public.invoice_payments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'invoice_payments' and policyname = 'invoice_payments_owner') then
    create policy invoice_payments_owner on public.invoice_payments
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Em qual fatura cai uma compra
--
-- Espelho exato de `faturaDaCompra` em src/lib/fatura.ts — regra 9: o
-- cálculo existe nos dois lados e tem que dar o mesmo resultado.
--
-- Compra ATÉ o dia do fechamento entra no ciclo que fecha, e esse ciclo
-- vence no mês seguinte. Depois do fechamento, um mês além disso.
--
-- `least(dia, último dia do mês)` porque fechamento 31 em fevereiro é 28,
-- e não 3 de março: o ciclo fecha no último dia, não invade o mês seguinte.
-- ---------------------------------------------------------------------
create or replace function public.fatura_da_compra(p_data date, p_dia_fechamento integer)
returns date
language sql
immutable
as $$
  select (
    date_trunc('month', p_data)::date
    + case
        when extract(day from p_data)::integer
             <= least(p_dia_fechamento,
                      extract(day from (date_trunc('month', p_data) + interval '1 month - 1 day'))::integer)
        then interval '1 month'
        else interval '2 months'
      end
  )::date;
$$;

comment on function public.fatura_da_compra(date, integer) is
  'Primeiro dia do mês da fatura em que a compra cai. Espelha faturaDaCompra() em src/lib/fatura.ts.';

-- ---------------------------------------------------------------------
-- A regra de fatura vale para esta compra? (vigência, modelo da 0005)
-- ---------------------------------------------------------------------
create or replace function public.fatura_vigente(
  p_data     date,
  inicio_ano integer,
  inicio_mes integer
) returns boolean
language sql
immutable
as $$
  select inicio_ano is not null
     and inicio_mes is not null
     and (extract(year from p_data)::integer * 12 + extract(month from p_data)::integer)
         >= (inicio_ano * 12 + inicio_mes);
$$;

-- ---------------------------------------------------------------------
-- O mês de CAIXA de um lançamento: em que mês ele pesa no bolso.
--
-- Para tudo que não é crédito com fatura vigente, é o próprio mês do
-- gasto — ou seja, o comportamento de sempre.
-- ---------------------------------------------------------------------
create or replace function public.mes_de_caixa(
  p_data            date,
  p_dia_fechamento  integer,
  p_inicio_ano      integer,
  p_inicio_mes      integer
) returns date
language sql
immutable
as $$
  select case
    when p_dia_fechamento is not null
         and public.fatura_vigente(p_data, p_inicio_ano, p_inicio_mes)
    then public.fatura_da_compra(p_data, p_dia_fechamento)
    else date_trunc('month', p_data)::date
  end;
$$;

-- ---------------------------------------------------------------------
-- Resumo mensal — saídas passam a ser CAIXA
--
-- Cópia da definição da 0007; só a subconsulta de saídas de transactions
-- muda, trocando o filtro por data pelo filtro por mês de caixa. As
-- entradas continuam por data: entrada não tem fatura.
--
-- O join com payment_methods é LEFT porque gasto sem forma de pagamento
-- existe (extrato importado não traz) — e sem forma não há fatura, então
-- ele cai no mês da própria data, como antes.
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
-- As faturas que pesam num mês
--
-- Uma linha por cartão com fatura vigente que tenha algo a pagar naquele
-- mês. `vencimento` sai cru: empurrar fim de semana é decisão de
-- apresentação e vive em src/lib/fatura.ts, junto do aviso na tela.
-- ---------------------------------------------------------------------
create or replace function public.faturas_do_mes(p_ano integer, p_mes integer)
returns table (
  payment_method_id uuid,
  nome              text,
  dia_fechamento    integer,
  dia_vencimento    integer,
  total_centavos    bigint,
  paga              boolean,
  pago_em           timestamptz,
  primeira_compra   date,
  ultima_compra     date
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  alvo as (select make_date(p_ano, p_mes, 1) as mes_caixa),
  linhas as (
    select pm.id, pm.nome, pm.dia_fechamento, pm.dia_vencimento,
           sum(t.valor_centavos)::bigint as total,
           min(t.data) as primeira,
           max(t.data) as ultima
      from public.payment_methods pm
      cross join uid
      cross join alvo a
      join public.transactions t
        on t.payment_method_id = pm.id
       and t.user_id = uid.id
       and t.tipo = 'gasto'
     where pm.user_id = uid.id
       and pm.tipo = 'credito'
       and pm.dia_fechamento is not null
       and public.fatura_vigente(t.data, pm.fatura_inicio_ano, pm.fatura_inicio_mes)
       and public.fatura_da_compra(t.data, pm.dia_fechamento) = a.mes_caixa
     group by pm.id, pm.nome, pm.dia_fechamento, pm.dia_vencimento, pm.ordem
     having sum(t.valor_centavos) <> 0
     order by pm.ordem, pm.nome
  )
  select l.id, l.nome, l.dia_fechamento, l.dia_vencimento, l.total,
         coalesce(ip.pago, false), ip.pago_em, l.primeira, l.ultima
    from linhas l
    left join public.invoice_payments ip
      on ip.payment_method_id = l.id and ip.ano = p_ano and ip.mes = p_mes;
$$;
