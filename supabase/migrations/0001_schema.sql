-- =====================================================================
-- 0001_schema.sql — Tabelas base do Gerenciador de Gastos
-- Regras gerais:
--   * Todo valor monetario e inteiro em CENTAVOS (bigint). Nunca float.
--   * Toda tabela tem user_id e RLS: user_id = auth.uid().
--   * Datas/timestamps em UTC (timestamptz). O cliente formata no fuso local.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.tema_cor as enum ('rosa', 'azul', 'verde', 'roxo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_pagamento as enum ('dinheiro', 'pix', 'debito', 'credito', 'boleto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_lancamento as enum ('gasto', 'entrada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  tema        public.tema_cor not null default 'rosa',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payment_methods
-- ---------------------------------------------------------------------
create table if not exists public.payment_methods (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  nome     text not null,
  tipo     public.tipo_pagamento not null default 'dinheiro',
  ativo    boolean not null default true,
  ordem    integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists payment_methods_user_idx on public.payment_methods (user_id, ordem);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  nome             text not null,
  limite_centavos  bigint check (limite_centavos is null or limite_centavos >= 0),
  cor              text not null default '#f5a3c7',
  ordem            integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id, ordem);

-- ---------------------------------------------------------------------
-- goals (maximo de 10 por usuario — garantido por trigger)
-- ---------------------------------------------------------------------
create table if not exists public.goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  nome                text not null,
  valor_meta_centavos bigint not null default 0 check (valor_meta_centavos >= 0),
  ordem               integer not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id, ordem);

create or replace function public.enforce_goal_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  select count(*) into total from public.goals where user_id = new.user_id;
  if total >= 10 then
    raise exception 'Limite de 10 metas por usuario atingido';
  end if;
  return new;
end;
$$;

drop trigger if exists goals_limit_trigger on public.goals;
create trigger goals_limit_trigger
  before insert on public.goals
  for each row execute function public.enforce_goal_limit();

-- ---------------------------------------------------------------------
-- goal_contributions — quanto foi guardado em cada meta, por mes
-- ---------------------------------------------------------------------
create table if not exists public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  goal_id        uuid not null references public.goals (id) on delete cascade,
  ano            integer not null check (ano between 1900 and 2999),
  mes            integer not null check (mes between 1 and 12),
  valor_centavos bigint not null default 0,
  created_at     timestamptz not null default now(),
  unique (goal_id, ano, mes)
);
create index if not exists goal_contributions_user_periodo_idx
  on public.goal_contributions (user_id, ano, mes);

-- ---------------------------------------------------------------------
-- wishlist_items
-- ---------------------------------------------------------------------
create table if not exists public.wishlist_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  nome           text not null,
  valor_centavos bigint not null default 0 check (valor_centavos >= 0),
  prioridade     integer not null default 3 check (prioridade between 1 and 5),
  concluido      boolean not null default false,
  concluido_em   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists wishlist_user_idx on public.wishlist_items (user_id, concluido, prioridade desc);

-- ---------------------------------------------------------------------
-- incomes — entradas do mes
-- ---------------------------------------------------------------------
create table if not exists public.incomes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  ano            integer not null check (ano between 1900 and 2999),
  mes            integer not null check (mes between 1 and 12),
  descricao      text not null default '',
  valor_centavos bigint not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists incomes_user_periodo_idx on public.incomes (user_id, ano, mes);

-- ---------------------------------------------------------------------
-- fixed_expenses — definicao que se repete todo mes
-- ---------------------------------------------------------------------
create table if not exists public.fixed_expenses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  nome              text not null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  category_id       uuid references public.categories (id) on delete set null,
  valor_centavos    bigint not null default 0,
  dia_vencimento    integer check (dia_vencimento between 1 and 31),
  ativo             boolean not null default true,
  ordem             integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists fixed_expenses_user_idx on public.fixed_expenses (user_id, ordem);

-- ---------------------------------------------------------------------
-- fixed_expense_payments — o "pago?" e por mes
-- ---------------------------------------------------------------------
create table if not exists public.fixed_expense_payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  fixed_expense_id  uuid not null references public.fixed_expenses (id) on delete cascade,
  ano               integer not null check (ano between 1900 and 2999),
  mes               integer not null check (mes between 1 and 12),
  pago              boolean not null default false,
  pago_em           timestamptz,
  unique (fixed_expense_id, ano, mes)
);
create index if not exists fixed_expense_payments_user_periodo_idx
  on public.fixed_expense_payments (user_id, ano, mes);

-- ---------------------------------------------------------------------
-- transactions — gastos/entradas avulsos do mes
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  data              date not null default (now() at time zone 'utc')::date,
  descricao         text not null default '',
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  category_id       uuid references public.categories (id) on delete set null,
  valor_centavos    bigint not null default 0,
  tipo              public.tipo_lancamento not null default 'gasto',
  created_at        timestamptz not null default now()
);
create index if not exists transactions_user_data_idx on public.transactions (user_id, data);

-- ---------------------------------------------------------------------
-- investments — investimentos do mes, opcionalmente ligados a uma meta
-- ---------------------------------------------------------------------
create table if not exists public.investments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  ano            integer not null check (ano between 1900 and 2999),
  mes            integer not null check (mes between 1 and 12),
  goal_id        uuid references public.goals (id) on delete set null,
  valor_centavos bigint not null default 0,
  descricao      text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists investments_user_periodo_idx on public.investments (user_id, ano, mes);
