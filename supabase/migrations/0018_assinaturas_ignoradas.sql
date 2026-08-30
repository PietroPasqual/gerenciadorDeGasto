-- ---------------------------------------------------------------------
-- 0018 — assinaturas que a pessoa não quer ver sugeridas
--
-- O PROBLEMA
--
-- A detecção da 6.2 olha os últimos doze meses e reencontra o mesmo
-- grupo todo mês. Sem um "não, obrigado" que dure, o cartão de sugestão
-- repete a mesma pergunta na abertura seguinte — e um aviso que não
-- aceita "não" é o jeito mais rápido de ensinar alguém a não ler aviso
-- nenhum.
--
-- POR QUE NO PERFIL, E NÃO NO localStorage
--
-- localStorage é por aparelho. Dispensar a sugestão no celular e
-- reencontrá-la no PC é a mesma pergunta feita duas vezes, e quebra a
-- paridade na prática mesmo com as duas telas tendo o botão.
--
-- A CHAVE
--
-- Guarda a chave de agrupamento (`chaveDoDestinatario`), não o id de um
-- lançamento: o que se dispensa é o DESTINATÁRIO, e ele continua o mesmo
-- quando novas cobranças chegarem no mês que vem.
--
-- REGRA 8
--
-- Default `[]`: ninguém tem sugestão dispensada até dispensar. Nenhum
-- número existente muda — isto não entra em soma nenhuma.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists assinaturas_ignoradas jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_assinaturas_ignoradas_ck') then
    alter table public.profiles add constraint profiles_assinaturas_ignoradas_ck check (
      jsonb_typeof(assinaturas_ignoradas) = 'array'
      -- Teto para a coluna não crescer sem fim num perfil antigo. 200 chaves
      -- são muito mais destinatários distintos do que uma pessoa dispensa numa
      -- vida de uso; o cliente poda antes de chegar aqui.
      and jsonb_array_length(assinaturas_ignoradas) <= 200
    );
  end if;
end $$;

comment on column public.profiles.assinaturas_ignoradas is
  'Chaves de destinatário dispensadas na sugestão de assinatura. Ver src/lib/assinaturas.ts.';
