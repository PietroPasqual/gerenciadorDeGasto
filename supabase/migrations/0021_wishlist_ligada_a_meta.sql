-- ---------------------------------------------------------------------
-- 0021 — a wishlist ganha os três estados
--
-- O PROBLEMA
--
-- A wishlist tinha dois estados: pendente e conquistado. E o card mostrava
-- "Falta juntar R$ 4.300,00" somando tudo o que estava pendente — que é
-- exatamente ler a lista de desejos como dinheiro já comprometido. Querer
-- um notebook não reserva um centavo; a frase dizia o contrário.
--
-- Faltava o estado do meio, o único em que existe dinheiro de verdade
-- envolvido: "estou juntando para isso".
--
-- A DECISÃO: UMA LIGAÇÃO, NÃO UM ROTULINHO
--
-- `goal_id` nulo em `wishlist_items`. Os três estados passam a ser
-- DERIVADOS, e não um campo que alguém precisa manter em dia:
--
--   concluido = true          -> conquistado
--   goal_id is not null       -> estou juntando (o quanto vem da meta)
--   caso contrário            -> quero comprar
--
-- Uma coluna de status seria uma segunda verdade: daria para marcar
-- "juntando" sem nenhuma meta atrás, e a tela mostraria progresso de um
-- dinheiro que não existe. Aqui, se há progresso, há uma meta com aportes.
--
-- `on delete set null` e não `cascade`: apagar a meta não pode apagar o
-- desejo. Ele volta a ser "quero comprar", que é a verdade — a vontade
-- continua, o plano de juntar é que acabou.
--
-- POR QUE UM TRIGGER, E NÃO SÓ A CHAVE ESTRANGEIRA
--
-- A checagem de chave estrangeira do Postgres NÃO passa pela RLS. Sem o
-- trigger, um cliente que adivinhasse o uuid de uma meta de outra pessoa
-- conseguiria apontar o próprio desejo para ela. Não vazaria nada (a
-- leitura de `goals` continua barrada pela policy), mas guardaria uma
-- referência que não deveria existir — e dado torto é o começo de um bug
-- que ninguém consegue explicar depois.
--
-- REGRA 8
--
-- Nenhum número muda. A coluna nasce nula em toda linha existente, e
-- linha com `goal_id` nulo se comporta exatamente como antes.
-- ---------------------------------------------------------------------

alter table public.wishlist_items
  add column if not exists goal_id uuid references public.goals (id) on delete set null;

-- A busca é sempre "os desejos desta meta", nunca "as metas deste desejo".
create index if not exists wishlist_goal_idx
  on public.wishlist_items (user_id, goal_id)
  where goal_id is not null;

-- ---------------------------------------------------------------------
-- A meta apontada tem que ser de quem está apontando
-- ---------------------------------------------------------------------
create or replace function public.wishlist_meta_do_usuario()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.goal_id is null then
    return new;
  end if;
  -- `security invoker` de propósito: a consulta abaixo passa pela policy de
  -- `goals`, então a meta de outra pessoa simplesmente não é encontrada.
  if not exists (
    select 1 from public.goals g
     where g.id = new.goal_id
       and g.user_id = new.user_id
  ) then
    raise exception 'A meta ligada ao desejo precisa ser sua.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists wishlist_meta_do_usuario_trigger on public.wishlist_items;
create trigger wishlist_meta_do_usuario_trigger
  before insert or update of goal_id on public.wishlist_items
  for each row execute function public.wishlist_meta_do_usuario();
