-- ---------------------------------------------------------------------
-- 0020 — uma categoria ao longo do ano
--
-- O PROBLEMA
--
-- O comparativo mostra entradas e gastos mês a mês, e para aí. A pergunta
-- que ele não responde é a que leva alguém a abrir a tela: "o mercado
-- está subindo?". Hoje a única forma de responder é abrir doze meses e
-- anotar o número de cada um.
--
-- `gastos_por_categoria` responde isso para UM mês. Chamá-la doze vezes
-- resolveria e custaria doze idas ao servidor para desenhar uma linha —
-- num app que já roda no celular, com rede ruim, por conta do usuário.
--
-- A DECISÃO
--
-- Uma função nova que devolve o ano inteiro de uma vez, com a MESMA regra
-- da mensal. Não é uma segunda definição de "gasto da categoria": é a de
-- sempre, agrupada também por mês. Fatiar o resultado desta pelo mês tem
-- que dar exatamente o que a mensal devolve — se um dia divergirem, as
-- duas telas passam a discordar sobre o mesmo dinheiro.
--
-- COMPETÊNCIA, E NÃO CAIXA
--
-- A 0016 moveu o comparativo para caixa (o mês em que a fatura vence), e
-- explicou por quê: o número central dele é um saldo. Esta função é outra
-- coisa. "Onde meu dinheiro foi" é pergunta de COMPETÊNCIA — o mês da
-- compra —, e é a mesma medida que o donut do painel e a aba Análise já
-- usam, ambos rotulados como "pela data da compra". A tela que consumir
-- isto tem a mesma obrigação de dizer qual das duas medidas está
-- mostrando.
--
-- OS GASTOS FIXOS ENTRAM, COMO NA MENSAL
--
-- Um fixo não tem data: ele se repete nos meses em que está vigente. Por
-- isso o cruzamento com os doze meses e o `fixo_vigente` mês a mês — sem
-- ele, "Moradia" apareceria zerada num ano inteiro em que o aluguel foi
-- pago todo mês.
--
-- REGRA 8
--
-- Nada muda de número. Esta migration só ACRESCENTA uma função; nenhuma
-- das existentes é redefinida, e nenhuma tela mostra hoje o que ela
-- devolve.
--
-- SEGURANÇA
--
-- `security invoker` (o padrão do Postgres, aqui escrito por extenso):
-- a função lê `transactions`, `fixed_expenses` e `categories` com o
-- papel de quem chamou, então a RLS dessas tabelas continua sendo quem
-- decide o que sai. Um agregado `security definer` devolveria a soma de
-- todo mundo.
-- ---------------------------------------------------------------------

create or replace function public.gastos_por_categoria_ano(p_ano integer)
returns table (
  mes             integer,
  category_id     uuid,
  nome            text,
  cor             text,
  gasto_centavos  bigint
)
language sql
stable
security invoker
as $$
  with uid as (select auth.uid() as id),
  meses as (select generate_series(1, 12) as mes),
  lancados as (
    select extract(month from t.data)::integer as mes,
           t.category_id as cid,
           sum(t.valor_centavos) as total
      from public.transactions t, uid
     where t.user_id = uid.id
       and t.tipo = 'gasto'
       -- Meia-aberto à direita, como todas as outras: `<= 31/12` deixaria
       -- de fora nada e incluiria de errado nada, mas o dia 1º do ano
       -- seguinte é o corte que o índice usa.
       and t.data >= make_date(p_ano, 1, 1)
       and t.data <  make_date(p_ano + 1, 1, 1)
     group by 1, 2
  ),
  fixos as (
    select m.mes,
           f.category_id as cid,
           sum(f.valor_centavos) as total
      from public.fixed_expenses f, uid, meses m
     where f.user_id = uid.id
       and f.ativo
       and public.fixo_vigente(p_ano, m.mes, f.inicio_ano, f.inicio_mes, f.fim_ano, f.fim_mes)
     group by 1, 2
  ),
  somados as (
    select u.mes, u.cid, sum(u.total)::bigint as total
      from (select * from lancados union all select * from fixos) u
     group by 1, 2
  )
  select mes, category_id, nome, cor, gasto_centavos
  from (
    select
      s.mes as mes,
      c.id as category_id,
      c.nome as nome,
      c.cor as cor,
      s.total as gasto_centavos,
      c.ordem as ord
    from somados s
    join public.categories c on c.id = s.cid
    cross join uid
    where c.user_id = uid.id
      and s.total <> 0

    union all

    -- A mesma linha sintética da 0006. Sem ela, um ano importado de
    -- extrato (que não traz categoria) sairia quase vazio daqui, e o
    -- gráfico afirmaria que o dinheiro não foi para lugar nenhum.
    select
      s.mes,
      null::uuid,
      'Sem categoria',
      '#94a3b8',
      s.total,
      2147483647 as ord
    from somados s
    where s.cid is null and s.total <> 0
  ) todos
  order by mes, ord, nome;
$$;

grant execute on function public.gastos_por_categoria_ano(integer) to authenticated;
