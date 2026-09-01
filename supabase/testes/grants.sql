-- Concessões equivalentes às do Supabase, aplicadas DEPOIS das migrations.
-- Sem elas o papel `authenticated` levaria "permission denied" e o teste
-- passaria pelo motivo errado: negado por falta de grant, não por RLS.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to authenticated;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated;
