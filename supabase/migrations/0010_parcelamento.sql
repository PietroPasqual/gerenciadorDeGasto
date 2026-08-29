-- ---------------------------------------------------------------------
-- 0010 — parcelamento
--
-- "12x de R$ 200" vira 12 lançamentos de verdade, um por mês, amarrados
-- por um `parcelamento_id` — e não um lançamento só com um campo
-- "parcelado". A razão é a fatura: cada parcela precisa cair sozinha na
-- fatura do seu mês, e o mês que a pessoa abre precisa mostrar o que ela
-- vai pagar naquele mês, não a compra inteira.
--
-- A divisão em centavos mora em src/lib/parcelamento.ts e tem teste que
-- varre milhares de combinações: a soma das parcelas fecha exatamente com
-- o total, sempre, com a sobra na primeira parcela (convenção dos
-- emissores brasileiros, e a que faz a fatura do app bater com a do banco
-- logo no primeiro mês).
--
-- Nada aqui muda lançamento existente: as três colunas nascem nulas e
-- lançamento sem parcelamento continua idêntico ao de hoje.
-- ---------------------------------------------------------------------

alter table public.transactions
  add column if not exists parcelamento_id uuid,
  add column if not exists parcela         integer,
  add column if not exists parcelas_total  integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_parcelamento_ck') then
    alter table public.transactions add constraint transactions_parcelamento_ck check (
      -- Ou os três campos existem, ou nenhum: meia série é estado inválido.
      (parcelamento_id is null and parcela is null and parcelas_total is null)
      or (
        parcelamento_id is not null
        and parcela is not null
        and parcelas_total is not null
        and parcelas_total >= 2
        and parcela between 1 and parcelas_total
      )
    );
  end if;
end $$;

-- Buscar a série inteira a partir de uma parcela é a operação central do
-- "editar/excluir: só esta ou todas?".
create index if not exists transactions_parcelamento_idx
  on public.transactions (user_id, parcelamento_id)
  where parcelamento_id is not null;

comment on column public.transactions.parcelamento_id is
  'Amarra as parcelas de uma mesma compra. NULL em lançamento avulso.';
comment on column public.transactions.parcela is
  'Número desta parcela dentro da série — o "3" de "3/12".';
