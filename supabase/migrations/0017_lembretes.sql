-- ---------------------------------------------------------------------
-- 0017 — preferências de lembrete
--
-- O PROBLEMA
--
-- `fixed_expenses.dia_vencimento` existe desde a 0001 e nunca avisou
-- ninguém. A fatura ganhou vencimento na 0009 e também não avisa. O app
-- sabe exatamente o que vence quando, e guarda isso para si.
--
-- POR QUE DENTRO DO APP, E NÃO PUSH
--
-- Push exige chave VAPID guardada, inscrições que expiram e precisam ser
-- podadas, PWA instalado na tela inicial no iOS, e uma permissão que,
-- negada uma vez, é quase irreversível. Pior: push que não chega não
-- deixa recibo — não há como depurar "não recebi".
--
-- O lembrete na tela não tem nenhum desses custos e cobre quem abre o
-- app, que é o caso de um planner de bolso. Se um dia faltar aviso fora
-- do app, a decisão se paga com uso real em vez de suposição — e estas
-- preferências continuam servindo, porque o que muda é só o canal.
--
-- ONDE MORA
--
-- Uma coluna jsonb no perfil, não uma tabela. São três interruptores e
-- um número; uma tabela por preferência seria cerimônia sem ganho, e
-- jsonb deixa acrescentar um tipo novo de aviso sem migration.
--
-- REGRA 8
--
-- O default liga os três avisos com 3 dias de antecedência. Isso NÃO
-- muda número nenhum: lembrete não entra em soma, é leitura do que já
-- estava lá. E é opt-out em vez de opt-in de propósito — um aviso de
-- vencimento que só aparece depois de a pessoa procurar a configuração
-- não avisa ninguém.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists preferencias_lembrete jsonb not null
    default '{"fatura_fechando": true, "fatura_vencendo": true, "fixo_vencendo": true, "dias_antes": 3}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferencias_lembrete_ck') then
    alter table public.profiles add constraint profiles_preferencias_lembrete_ck check (
      jsonb_typeof(preferencias_lembrete) = 'object'
      -- Antecedência entre 0 e 15 dias: acima disso o aviso fica ligado o mês
      -- inteiro e vira paisagem, que é o mesmo que não avisar.
      and coalesce((preferencias_lembrete->>'dias_antes')::int, 3) between 0 and 15
    );
  end if;
end $$;

comment on column public.profiles.preferencias_lembrete is
  'Quais lembretes aparecem e com quantos dias de antecedência. Ver src/lib/lembretes.ts.';
