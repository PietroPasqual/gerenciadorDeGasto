-- ---------------------------------------------------------------------
-- 0013 — resgate e transferência de meta
--
-- O PROBLEMA
--
-- Aporte só entrava. Não havia como tirar dinheiro de uma meta (a
-- viagem aconteceu, a reserva foi usada) nem mover entre metas ("na
-- verdade isso era para o carro, não para a viagem"). A única saída era
-- editar a célula do mês para um número menor, o que some com o
-- histórico do mês e ainda faz o "total investido" daquele mês mentir.
--
-- O MODELO
--
-- `goal_contributions` tem `unique (goal_id, ano, mes)`: uma célula por
-- meta por mês, guardando o MOVIMENTO LÍQUIDO daquele mês. Resgatar é
-- somar um valor negativo nessa célula; transferir é o mesmo movimento
-- dos dois lados.
--
-- É isso que mantém os números honestos:
--
--   * O total investido do mês passa a ser o movimento líquido. Guardar
--     R$ 500 na reserva e resgatar R$ 200 da viagem no mesmo mês dá
--     R$ 300 — que é quanto realmente saiu do bolso para as metas.
--   * Transferir NÃO muda o total do mês: sai de uma e entra na outra,
--     e a soma fica igual. Se mudasse, a transferência inventaria ou
--     destruiria dinheiro no resumo.
--   * O acumulado da meta (`resumo_metas`) cai junto, porque ele já é a
--     soma das células. Nenhuma função de agregado muda nesta migration.
--
-- A TRAVA QUE FALTAVA
--
-- Não dá para resgatar dinheiro que não está lá. O trigger abaixo recusa
-- qualquer movimento que deixe o ACUMULADO de uma meta negativo — e não
-- só o mês, porque resgatar em agosto o que foi guardado em março é
-- legítimo. Sem essa trava, um resgate a mais deixaria a meta com saldo
-- negativo e a barra de progresso mostrando um número impossível.
--
-- A trava vale para qualquer caminho: a célula editada à mão na tela do
-- mês, o resgate, a transferência e a importação. Validar só no cliente
-- deixaria de fora a edição inline, que é o caminho mais usado.
--
-- REGRA 8
--
-- Nada muda para quem já usa o app: todas as células existentes são
-- positivas, então o trigger nunca dispara sobre elas, e as funções de
-- agregado continuam idênticas.
-- ---------------------------------------------------------------------

create or replace function public.enforce_goal_saldo()
returns trigger
language plpgsql
as $$
declare
  saldo bigint;
begin
  select coalesce(sum(c.valor_centavos), 0) into saldo
    from public.goal_contributions c
   where c.goal_id = new.goal_id;

  if saldo < 0 then
    raise exception
      'Esta meta não tem esse valor guardado (saldo ficaria em %).', saldo
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.enforce_goal_saldo() is
  'Impede que o acumulado de uma meta fique negativo. Roda DEPOIS da escrita, porque precisa da soma já atualizada.';

drop trigger if exists goal_contributions_saldo_trigger on public.goal_contributions;
create constraint trigger goal_contributions_saldo_trigger
  after insert or update on public.goal_contributions
  deferrable initially deferred
  for each row execute function public.enforce_goal_saldo();

-- ---------------------------------------------------------------------
-- Resgatar de uma meta
--
-- Um upsert que SOMA (em vez de substituir), porque o mês pode já ter um
-- aporte: guardar R$ 500 e depois resgatar R$ 200 no mesmo mês tem que
-- terminar em R$ 300, não em -R$ 200.
-- ---------------------------------------------------------------------
create or replace function public.resgatar_de_meta(
  p_goal_id  uuid,
  p_ano      integer,
  p_mes      integer,
  p_centavos bigint
) returns void
language plpgsql
as $$
begin
  if p_centavos <= 0 then
    raise exception 'O valor do resgate precisa ser maior que zero.'
      using errcode = 'check_violation';
  end if;

  insert into public.goal_contributions (user_id, goal_id, ano, mes, valor_centavos)
  values (auth.uid(), p_goal_id, p_ano, p_mes, -p_centavos)
  on conflict (goal_id, ano, mes)
  do update set valor_centavos = public.goal_contributions.valor_centavos - p_centavos;
end;
$$;

-- ---------------------------------------------------------------------
-- Transferir entre metas
--
-- Os dois lados numa função só, e por isso numa transação só. Feito com
-- duas chamadas do cliente, uma falha no meio destrói dinheiro: sai da
-- origem e não chega no destino, sem nada na tela dizendo o que houve.
-- ---------------------------------------------------------------------
create or replace function public.transferir_entre_metas(
  p_origem   uuid,
  p_destino  uuid,
  p_ano      integer,
  p_mes      integer,
  p_centavos bigint
) returns void
language plpgsql
as $$
begin
  if p_centavos <= 0 then
    raise exception 'O valor da transferência precisa ser maior que zero.'
      using errcode = 'check_violation';
  end if;
  if p_origem = p_destino then
    raise exception 'Origem e destino precisam ser metas diferentes.'
      using errcode = 'check_violation';
  end if;

  insert into public.goal_contributions (user_id, goal_id, ano, mes, valor_centavos)
  values (auth.uid(), p_origem, p_ano, p_mes, -p_centavos)
  on conflict (goal_id, ano, mes)
  do update set valor_centavos = public.goal_contributions.valor_centavos - p_centavos;

  insert into public.goal_contributions (user_id, goal_id, ano, mes, valor_centavos)
  values (auth.uid(), p_destino, p_ano, p_mes, p_centavos)
  on conflict (goal_id, ano, mes)
  do update set valor_centavos = public.goal_contributions.valor_centavos + p_centavos;
end;
$$;

comment on function public.transferir_entre_metas(uuid, uuid, integer, integer, bigint) is
  'Move valor entre duas metas no mesmo mês, numa transação só. O total investido do mês não muda.';

-- ---------------------------------------------------------------------
-- carregar_mes ganha o acumulado das metas
--
-- Cópia da definição da 0012; só entra a chave `saldosMetas`. Ela é o que
-- permite a tela mostrar quanto dá para resgatar antes de a pessoa digitar
-- o valor — e é um `jsonb_object_agg` porque a tela consulta por id.
-- ---------------------------------------------------------------------
create or replace function public.carregar_mes(p_ano integer, p_mes integer)
returns jsonb
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  periodo as (
    select make_date(p_ano, p_mes, 1) as inicio,
           (make_date(p_ano, p_mes, 1) + interval '1 month')::date as fim
  )
  select jsonb_build_object(
    'formasPagamento', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.payment_methods x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'categorias', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.categories x, uid
       where x.user_id = uid.id
    ), '[]'::jsonb),

    'metas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.created_at)
        from public.goals x, uid
       where x.user_id = uid.id
    ), '[]'::jsonb),

    'entradas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
        from public.incomes x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'entradasRecorrentes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.descricao)
        from public.recurring_incomes x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'gastosFixos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordem, x.nome)
        from public.fixed_expenses x, uid
       where x.user_id = uid.id and x.ativo
    ), '[]'::jsonb),

    'pagamentos', coalesce((
      select jsonb_agg(to_jsonb(x))
        from public.fixed_expense_payments x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'lancamentos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.data, x.created_at)
        from public.transactions x, uid, periodo p
       where x.user_id = uid.id and x.data >= p.inicio and x.data < p.fim
    ), '[]'::jsonb),

    'investimentos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
        from public.investments x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
         and x.goal_id is null
    ), '[]'::jsonb),

    'aportes', coalesce((
      select jsonb_agg(to_jsonb(x))
        from public.goal_contributions x, uid
       where x.user_id = uid.id and x.ano = p_ano and x.mes = p_mes
    ), '[]'::jsonb),

    'faturas', coalesce((
      select jsonb_agg(to_jsonb(f))
        from public.faturas_do_mes(p_ano, p_mes) f
    ), '[]'::jsonb),

    -- Acumulado de cada meta desde sempre, como {goal_id: centavos}.
    -- É o teto do que dá para resgatar, e precisa aparecer na tela ANTES de
    -- a pessoa digitar o valor: sem isso, "resgatar R$ 500" é um palpite e o
    -- erro só apareceria depois de o banco recusar.
    -- Some TODOS os meses, não só o aberto: quem guardou em março pode
    -- resgatar em agosto.
    'saldosMetas', coalesce((
      select jsonb_object_agg(x.goal_id, x.total)
        from (
          select c.goal_id, sum(c.valor_centavos)::bigint as total
            from public.goal_contributions c, uid
           where c.user_id = uid.id
           group by c.goal_id
        ) x
    ), '{}'::jsonb)
  );
$$;
