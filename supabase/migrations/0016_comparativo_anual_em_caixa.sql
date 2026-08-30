-- ---------------------------------------------------------------------
-- 0016 — o comparativo anual passa a falar a mesma língua do mês
--
-- O PROBLEMA
--
-- A fase 2 moveu as saídas de `resumo_mensal` para CAIXA (o mês em que a
-- fatura vence). `comparativo_anual` ficou em COMPETÊNCIA (o mês da
-- compra). O resultado é o app se contradizendo sobre o mesmo mês:
--
--   tela do mês    -> "Agosto · sai da conta  R$ 2.631,85"
--   comparativo    -> "Agosto · saiu          R$ 2.922,56"
--
-- Não é arredondamento nem recorte diferente: são duas perguntas
-- distintas com o mesmo rótulo, em duas telas que a pessoa abre uma
-- depois da outra.
--
-- Havia um segundo efeito, mais silencioso. As observações do painel
-- comparam o total de saídas do mês (caixa) com a média dos meses do
-- comparativo (competência) — "23% a menos que a sua média". Comparar
-- duas medidas diferentes dá uma frase que parece informação e é ruído.
--
-- A DECISÃO
--
-- O comparativo passa a caixa. Três razões:
--
--   1. O número central dele é a DIFERENÇA (entradas − saídas), que é um
--      saldo — conceito de caixa, igual ao saldo do mês.
--   2. Elimina a contradição entre as duas telas sem criar nenhuma: o
--      comparativo não mostra categorias, então não há nada ali que
--      precise da visão por competência.
--   3. A análise por competência continua existindo onde ela é a
--      pergunta certa: o donut do painel e a aba Análise do mês, ambos
--      já rotulados como "pela data da compra".
--
-- REGRA 8
--
-- Só muda para quem configurou fatura em algum cartão — e essa pessoa já
-- escolheu, ao configurar, que o saldo dela conta pelo vencimento. Sem
-- cartão com fatura, `mes_de_caixa` devolve o próprio mês da compra e os
-- doze meses saem idênticos aos de antes.
-- ---------------------------------------------------------------------

create or replace function public.comparativo_anual(p_ano integer)
returns table (
  mes        integer,
  entradas   bigint,
  saidas     bigint,
  diferenca  bigint
)
language sql
stable
as $$
  with uid as (select auth.uid() as id),
  ano as (
    select make_date(p_ano, 1, 1) as inicio,
           make_date(p_ano + 1, 1, 1) as fim
  ),
  meses as (select generate_series(1, 12) as mes),
  fixos as (
    select m.mes,
           coalesce(sum(f.valor_centavos), 0)::bigint as total
      from meses m
      cross join uid
      left join public.fixed_expenses f
        on f.user_id = uid.id
       and f.ativo
       and public.fixo_vigente(p_ano, m.mes, f.inicio_ano, f.inicio_mes, f.fim_ano, f.fim_mes)
     group by m.mes
  ),
  ent_recorrentes as (
    select m.mes,
           coalesce(sum(r.valor_centavos), 0)::bigint as total
      from meses m
      cross join uid
      left join public.recurring_incomes r
        on r.user_id = uid.id
       and r.ativo
       and public.fixo_vigente(p_ano, m.mes, r.inicio_ano, r.inicio_mes, r.fim_ano, r.fim_mes)
     group by m.mes
  ),
  ent_incomes as (
    select i.mes, sum(i.valor_centavos)::bigint as total
      from public.incomes i, uid
     where i.user_id = uid.id and i.ano = p_ano
     group by i.mes
  ),
  -- Entrada não tem fatura: continua pelo mês da própria data.
  ent_tx as (
    select extract(month from t.data)::integer as mes, sum(t.valor_centavos)::bigint as total
      from public.transactions t, uid, ano a
     where t.user_id = uid.id and t.tipo = 'entrada'
       and t.data >= a.inicio and t.data < a.fim
     group by 1
  ),
  -- Saída agrupa pelo MÊS DE CAIXA, a mesma função que resumo_mensal usa.
  -- O filtro do ano também passa a ser sobre o mês de caixa: uma compra de
  -- dezembro que só vence em janeiro pertence ao ano seguinte, e contá-la
  -- em dezembro deixaria a soma dos doze meses diferente do que as telas
  -- mensais mostram.
  sai_tx as (
    select extract(month from public.mes_de_caixa(t.data, pm.dia_fechamento,
                                                  pm.fatura_inicio_ano, pm.fatura_inicio_mes))::integer as mes,
           sum(t.valor_centavos)::bigint as total
      from public.transactions t
      cross join uid
      cross join ano a
      left join public.payment_methods pm
        on pm.id = t.payment_method_id and pm.user_id = uid.id
     where t.user_id = uid.id and t.tipo = 'gasto'
       and public.mes_de_caixa(t.data, pm.dia_fechamento,
                               pm.fatura_inicio_ano, pm.fatura_inicio_mes) >= a.inicio
       and public.mes_de_caixa(t.data, pm.dia_fechamento,
                               pm.fatura_inicio_ano, pm.fatura_inicio_mes) < a.fim
     group by 1
  )
  select
    m.mes,
    (coalesce(ei.total, 0) + coalesce(et.total, 0) + coalesce(er.total, 0))::bigint as entradas,
    (coalesce(st.total, 0) + coalesce(fx.total, 0))::bigint                         as saidas,
    (coalesce(ei.total, 0) + coalesce(et.total, 0) + coalesce(er.total, 0)
      - coalesce(st.total, 0) - coalesce(fx.total, 0))::bigint                      as diferenca
  from meses m
  left join fixos           fx on fx.mes = m.mes
  left join ent_recorrentes er on er.mes = m.mes
  left join ent_incomes     ei on ei.mes = m.mes
  left join ent_tx          et on et.mes = m.mes
  left join sai_tx          st on st.mes = m.mes
  order by m.mes;
$$;

comment on function public.comparativo_anual(integer) is
  'Entradas e saídas mês a mês. As saídas usam o mês de CAIXA, igual a resumo_mensal — as duas telas não podem discordar sobre o mesmo mês.';
