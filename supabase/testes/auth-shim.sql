-- ---------------------------------------------------------------------
-- Shim de auth para teste local — NÃO vai para produção.
--
-- O Supabase provê `auth.users` e `auth.uid()`. Num Postgres puro eles
-- não existem, e sem eles nenhuma policy consegue rodar. Este arquivo
-- replica o MÍNIMO necessário, e a fidelidade do que ele replica é o que
-- decide se o teste de RLS vale alguma coisa:
--
--   * `auth.uid()` lê `request.jwt.claim.sub`, que é onde o PostgREST põe
--     o `sub` do JWT. É a mesma variável de sessão.
--   * O papel `authenticated` é criado SEM ser dono de nenhuma tabela e
--     SEM `bypassrls`. Isso é o essencial: dono de tabela ignora RLS por
--     padrão, então um teste que rodasse como `postgres` passaria mesmo
--     com todas as policies apagadas — e não provaria nada.
--   * As tabelas ficam com o dono `postgres` e são concedidas a
--     `authenticated`, exatamente como o Supabase faz.
--
-- O que este shim NÃO cobre, e é honesto dizer: bugs do PostgREST e do
-- GoTrue. Ele prova que as POLICIES estão certas, não que a stack inteira
-- está.
-- ---------------------------------------------------------------------

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
