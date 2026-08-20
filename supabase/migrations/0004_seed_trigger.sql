-- =====================================================================
-- 0004_seed_trigger.sql — Seed automatico de usuario novo.
-- Ao criar uma conta (auth.users), cria o profile e popula as formas de
-- pagamento e categorias padrao. SECURITY DEFINER porque roda antes de
-- existir sessao para o usuario.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  v_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, nome, tema)
  values (new.id, v_nome, 'rosa')
  on conflict (id) do nothing;

  -- Formas de pagamento padrao
  insert into public.payment_methods (user_id, nome, tipo, ordem)
  values
    (new.id, 'Dinheiro', 'dinheiro', 1),
    (new.id, 'Pix',      'pix',      2),
    (new.id, 'Débito',   'debito',   3),
    (new.id, 'Boleto',   'boleto',   4),
    (new.id, 'Crédito',  'credito',  5);

  -- Categorias padrao (cores pastel)
  insert into public.categories (user_id, nome, cor, ordem)
  values
    (new.id, 'Contas',             '#f6a5c0',  1),
    (new.id, 'Saúde',              '#a5d8f6',  2),
    (new.id, 'Lazer',              '#c3b1f6',  3),
    (new.id, 'Transporte',         '#f6cfa5',  4),
    (new.id, 'Vestuário',          '#f6a5a5',  5),
    (new.id, 'Despesas eventuais', '#b1e5c3',  6),
    (new.id, 'iFood',              '#f6b8a5',  7),
    (new.id, 'Mercado',            '#a5f6d8',  8),
    (new.id, 'Assinaturas',        '#d8a5f6',  9),
    (new.id, 'Academia',           '#a5b8f6', 10),
    (new.id, 'Presentes',          '#f6a5e0', 11),
    (new.id, 'Desenvolvimento',    '#c9f6a5', 12),
    (new.id, 'Cartões',            '#f6e3a5', 13);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Reparo: popula dados padrao para um usuario ja existente que esteja
-- sem formas de pagamento/categorias (util em migracao de conta antiga).
-- ---------------------------------------------------------------------
create or replace function public.seed_defaults_if_empty()
returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuario nao autenticado';
  end if;

  insert into public.profiles (id, nome) values (v_uid, '')
  on conflict (id) do nothing;

  if not exists (select 1 from public.payment_methods where user_id = v_uid) then
    insert into public.payment_methods (user_id, nome, tipo, ordem)
    values (v_uid, 'Dinheiro', 'dinheiro', 1),
           (v_uid, 'Pix', 'pix', 2),
           (v_uid, 'Débito', 'debito', 3),
           (v_uid, 'Boleto', 'boleto', 4),
           (v_uid, 'Crédito', 'credito', 5);
  end if;

  if not exists (select 1 from public.categories where user_id = v_uid) then
    insert into public.categories (user_id, nome, cor, ordem)
    values (v_uid, 'Contas', '#f6a5c0', 1),
           (v_uid, 'Saúde', '#a5d8f6', 2),
           (v_uid, 'Lazer', '#c3b1f6', 3),
           (v_uid, 'Transporte', '#f6cfa5', 4),
           (v_uid, 'Vestuário', '#f6a5a5', 5),
           (v_uid, 'Despesas eventuais', '#b1e5c3', 6),
           (v_uid, 'iFood', '#f6b8a5', 7),
           (v_uid, 'Mercado', '#a5f6d8', 8),
           (v_uid, 'Assinaturas', '#d8a5f6', 9),
           (v_uid, 'Academia', '#a5b8f6', 10),
           (v_uid, 'Presentes', '#f6a5e0', 11),
           (v_uid, 'Desenvolvimento', '#c9f6a5', 12),
           (v_uid, 'Cartões', '#f6e3a5', 13);
  end if;
end;
$$;
