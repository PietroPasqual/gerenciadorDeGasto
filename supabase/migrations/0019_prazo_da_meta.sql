-- ---------------------------------------------------------------------
-- 0019 — prazo opcional na meta
--
-- O PROBLEMA
--
-- A meta tem valor-alvo e não tem data-alvo, então o app não responde a
-- pergunta que a pessoa realmente faz: "quanto preciso guardar por mês
-- para chegar lá?". Sem data não há divisão possível — só um número
-- grande e um número pequeno, sem relação entre eles.
--
-- OPCIONAL, E É A REGRA 8
--
-- Duas colunas anuláveis. Meta sem prazo continua exatamente como hoje:
-- nenhuma projeção aparece, nenhum número muda, nenhuma barra de
-- progresso se mexe. Quem nunca abrir esta tela não vai notar que a
-- 0019 rodou.
--
-- MÊS, NÃO DIA
--
-- Aporte é mensal (goal_contributions tem ano e mes, sem dia), então um
-- prazo com dia prometeria uma precisão que o resto do modelo não tem.
-- "Dezembro de 2026" é a granularidade honesta.
--
-- O QUE O BANCO GARANTE
--
-- Os dois campos andam juntos — ano sem mês não diz nada — e o mês fica
-- entre 1 e 12. O ano fica entre 2000 e 2200: não é uma regra de
-- negócio, é a rede contra o dedo escorregado que digita 20026 e faz a
-- projeção dizer "faltam 216 mil meses".
--
-- `num_nonnulls` E NÃO UM `or` DE DUAS PERNAS
--
-- A primeira versão era `(ambos null) or (ano between ... and mes
-- between ...)`, e ela ACEITAVA ano sem mês: com mes null, o segundo
-- `between` vale NULL, o `and` vira NULL, o `or` vira NULL — e check
-- constraint passa quando dá NULL. Um teste contra Postgres de verdade
-- pegou; ler o SQL não teria pegado.
-- ---------------------------------------------------------------------

alter table public.goals
  add column if not exists prazo_ano int,
  add column if not exists prazo_mes int;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'goals_prazo_ck') then
    alter table public.goals add constraint goals_prazo_ck check (
      num_nonnulls(prazo_ano, prazo_mes) in (0, 2)
      and (prazo_ano is null or prazo_ano between 2000 and 2200)
      and (prazo_mes is null or prazo_mes between 1 and 12)
    );
  end if;
end $$;

comment on column public.goals.prazo_ano is
  'Ano-alvo da meta. Null = meta sem prazo, que é o comportamento de antes da 0019.';
comment on column public.goals.prazo_mes is
  'Mês-alvo da meta (1-12). Anda junto com prazo_ano — ver goals_prazo_ck.';
