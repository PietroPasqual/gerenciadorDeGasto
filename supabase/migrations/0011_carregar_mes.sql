-- ---------------------------------------------------------------------
-- 0011 — uma requisição em vez de dez
--
-- O PROBLEMA
--
-- `use-controle-mensal.ts` dispara dez chamadas paralelas para montar o
-- mês. Em wi-fi isso é invisível. Em 4G ruim — ou no metrô, que é onde
-- o app foi feito para ser usado — cada uma paga a latência inteira, e o
-- navegador limita quantas correm de fato ao mesmo tempo. O mês só
-- aparece quando a última chega, então o tempo de tela é o da PIOR das
-- dez, não o da média.
--
-- A SOLUÇÃO
--
-- Uma função que devolve tudo num JSON só. A forma dos dados na tela não
-- muda: cada chave do JSON tem exatamente o mesmo conteúdo, na mesma
-- ordem, que a chamada correspondente devolvia.
--
-- SECURITY INVOKER (o padrão, e por isso não declarado): a função roda
-- com o papel de quem chamou, então cada select aqui dentro passa pelas
-- policies de RLS normalmente. Trocar para DEFINER faria esta função
-- devolver o mês de qualquer usuário para qualquer um — o `where user_id`
-- explícito de cada bloco é cinto, não suspensório.
--
-- A ordem de cada lista repete a do cliente de propósito. `order by` que
-- diverge do que a tela esperava é o tipo de mudança que não quebra
-- nada visivelmente e faz a linha nova aparecer no lugar errado.
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

    -- Faixa meio-aberta, como na 0007: é o que usa transactions_user_data_idx.
    'lancamentos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.data, x.created_at)
        from public.transactions x, uid, periodo p
       where x.user_id = uid.id and x.data >= p.inicio and x.data < p.fim
    ), '[]'::jsonb),

    -- O cliente já filtrava goal_id nulo depois de receber; filtrar aqui
    -- evita trafegar linha que seria descartada.
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
    ), '[]'::jsonb)
  );
$$;

comment on function public.carregar_mes(integer, integer) is
  'Tudo o que a tela de controle mensal precisa, num JSON só. Espelha as dez consultas que o cliente fazia em paralelo.';
