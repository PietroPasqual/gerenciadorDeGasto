-- =====================================================================
-- 0002_rls.sql — Row Level Security em todas as tabelas.
-- Politica unica por tabela: o dono da linha (user_id = auth.uid())
-- pode SELECT / INSERT / UPDATE / DELETE. Ninguem mais enxerga nada.
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.payment_methods       enable row level security;
alter table public.categories            enable row level security;
alter table public.goals                 enable row level security;
alter table public.goal_contributions    enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.incomes               enable row level security;
alter table public.fixed_expenses        enable row level security;
alter table public.fixed_expense_payments enable row level security;
alter table public.transactions          enable row level security;
alter table public.investments           enable row level security;

-- profiles usa a propria PK como dono
drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  for all
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Demais tabelas: user_id = auth.uid()
do $$
declare
  t text;
begin
  foreach t in array array[
    'payment_methods', 'categories', 'goals', 'goal_contributions',
    'wishlist_items', 'incomes', 'fixed_expenses', 'fixed_expense_payments',
    'transactions', 'investments'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format($f$
      create policy %I on public.%I
        for all
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_owner', t);
  end loop;
end $$;
