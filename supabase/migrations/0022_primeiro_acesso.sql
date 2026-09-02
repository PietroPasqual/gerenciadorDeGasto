-- ---------------------------------------------------------------------
-- 0022 — primeiro acesso guiado
--
-- O PROBLEMA
--
-- Quem cria conta cai direto num painel de mês vazio. A 0004 semeia
-- categorias e formas de pagamento, então a tela não está literalmente em
-- branco — mas nada nela ainda é da pessoa: nome genérico, nenhum
-- orçamento, nenhuma entrada recorrente, lembretes com um padrão que
-- ninguém confirmou.
--
-- DUAS COLUNAS, E O MOTIVO DE NÃO SER UM PONTEIRO DE PASSO
--
-- O óbvio seria guardar "em que passo a pessoa está". Isso cria uma
-- segunda verdade que envelhece: o ponteiro diria "passo 2" enquanto o
-- orçamento do passo 2 já existe, e a tela pediria de novo algo já feito.
--
-- Em vez disso, o estado de cada passo é DERIVADO do dado real — tem
-- nome? tem orçamento? tem entrada recorrente? tem o primeiro gasto? —, e
-- é isso que torna cada etapa idempotente de graça: salvar duas vezes
-- escreve o mesmo dado no mesmo lugar, porque cada etapa usa os mesmos
-- serviços que as Configurações já usam. O primeiro acesso não é um
-- caminho de escrita novo; é uma ordem sugerida por cima do que existe.
--
-- Sobram dois passos que NÃO dão para derivar, porque a resposta certa
-- pode ser "está bom como está": revisar as categorias que a 0004 semeou,
-- e confirmar os lembretes que a 0017 já deixou ligados. Para esses
-- existe `onboarding_vistos`, que guarda só o "eu olhei isto" — ele nunca
-- contradiz o dado, porque só acrescenta.
--
--   onboarding_em      -> quando o guia foi encerrado (concluído OU
--                         dispensado). NULL = ainda não apareceu.
--   onboarding_vistos  -> os passos que a pessoa marcou como resolvidos
--                         sem mudar nada.
--
-- QUEM JÁ USA O APP NUNCA VÊ ISTO
--
-- O `update` no fim marca toda conta existente como encerrada. Empurrar um
-- guia de configuração inicial para quem tem um ano de lançamentos seria
-- ruído, não ajuda. Conta nova nasce com NULL e vê o guia uma vez.
--
-- REGRA 8
--
-- Nenhum número muda. As colunas não entram em soma nenhuma, e o guia só
-- oferece caminhos para telas que já existiam.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarding_em timestamptz;

alter table public.profiles
  add column if not exists onboarding_vistos text[] not null default '{}';

-- Teto de sanidade, como o da 0018: são sete passos, e um array que cresce
-- sem limite é um vetor de abuso barato num campo que o cliente escreve.
alter table public.profiles
  drop constraint if exists profiles_onboarding_vistos_curto;
alter table public.profiles
  add constraint profiles_onboarding_vistos_curto
  check (array_length(onboarding_vistos, 1) is null or array_length(onboarding_vistos, 1) <= 20);

comment on column public.profiles.onboarding_em is
  'Quando o primeiro acesso guiado foi encerrado (concluído ou dispensado). NULL = ainda não apareceu.';
comment on column public.profiles.onboarding_vistos is
  'Passos resolvidos sem mudar dado — os que não dão para derivar (categorias, lembretes).';

-- Só as contas que já existem. O default continua NULL para as próximas.
update public.profiles
   set onboarding_em = now()
 where onboarding_em is null;
