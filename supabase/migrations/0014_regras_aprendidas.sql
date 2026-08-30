-- ---------------------------------------------------------------------
-- 0014 — o app aprende com a correção
--
-- O PROBLEMA
--
-- `src/lib/categorizar.ts` tem regras fixas no código. Elas cobrem o que
-- é comum no Brasil (iFood, Uber, farmácia, supermercado), mas não têm
-- como saber que "PAG*JOAODASILVA" é a diarista, nem que "TRANSF PARA
-- MARIA" é a mensalidade da escola. Quem sabe é o usuário — e hoje ele
-- corrige a sugestão errada todo mês, na mesma linha, sem que o app
-- lembre.
--
-- A CHAVE NÃO É A DESCRIÇÃO INTEIRA
--
-- Guardar "IFD*BRASILIA REST 4471" como regra seria inútil: o número
-- muda a cada compra e a regra nunca mais casaria. A chave é o
-- DESTINATÁRIO, extraído por `chaveDoDestinatario` (src/lib/
-- agrupar-descricoes.ts), que é a mesma função que a importação já usa
-- para agrupar — tira o verbo do pagamento, os números e as siglas de
-- empresa. É por isso que ela é `text` e não a descrição crua.
--
-- AS TRÊS TRAVAS CONTINUAM VALENDO
--
-- Uma regra aprendida é mais perigosa que uma fixa: ela nasce de um
-- clique, sem ninguém revisando. Se a chave for curta ou genérica
-- ("pix", "loja", "ab"), ela casaria com meio extrato e classificaria
-- tudo errado de uma vez. Por isso o CHECK exige pelo menos 4
-- caracteres — o mesmo MIN_PALAVRA do arquivo de regras — e o cliente
-- recusa chave de palavra única curta antes mesmo de tentar gravar.
--
-- PRECEDÊNCIA
--
-- A regra do usuário vem ANTES das fixas. Ele corrigiu de propósito; o
-- código não tem por que discordar depois.
--
-- REGRA 8
--
-- Tabela nova e vazia. Nenhuma categorização já feita muda: as regras só
-- valem para sugestão em importação futura, e sugestão nunca reescreve
-- lançamento que já existe.
-- ---------------------------------------------------------------------

create table if not exists public.category_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Chave do destinatário, já normalizada pelo cliente.
  termo        text not null check (length(trim(termo)) >= 4),
  category_id  uuid not null references public.categories (id) on delete cascade,
  -- A descrição que originou a regra, para a tela poder mostrar de onde veio.
  exemplo      text not null default '',
  created_at   timestamptz not null default now(),
  -- Uma regra por termo por usuário: corrigir de novo REESCREVE a anterior,
  -- em vez de criar uma segunda que competiria com ela.
  unique (user_id, termo)
);

create index if not exists category_rules_user_idx on public.category_rules (user_id, termo);

alter table public.category_rules enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'category_rules' and policyname = 'category_rules_owner'
  ) then
    create policy category_rules_owner on public.category_rules
      for all
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

comment on table public.category_rules is
  'Regras descrição -> categoria aprendidas com a correção do usuário. O termo é a chave do destinatário (ver src/lib/agrupar-descricoes.ts).';
