-- ---------------------------------------------------------------------
-- 0023 — o painel é da pessoa
--
-- O PROBLEMA
--
-- O painel mostra quatro blocos, sempre os mesmos, sempre na mesma ordem:
-- donut de categorias, frases do mês, cards de resumo, atalhos. Quem abre
-- o app todo dia para ver o saldo rola por cima do donut toda vez; quem
-- usa cartão e vive de fatura queria o contrário. Nenhum dos dois pode
-- fazer nada a respeito.
--
-- TRÊS COLUNAS, E POR QUE NÃO UM JSONB SÓ
--
-- O óbvio seria um `painel jsonb` com uma lista de {id, visivel, ordem}.
-- Isso guarda a mesma informação em dois lugares — a posição no array E um
-- campo de ordem — e os dois divergem no primeiro bug de escrita.
--
--   painel_ordem     -> a ordem, que é a ordem DO ARRAY. Não existe campo
--                       de posição, então não há o que divergir.
--   painel_ocultos   -> quem a pessoa escondeu, explicitamente.
--   painel_capa      -> o NOME do gradiente da capa, não o gradiente.
--
-- POR QUE "OCULTOS" É UMA LISTA SEPARADA, E NÃO A AUSÊNCIA EM `ordem`
--
-- Seria mais curto dizer "está em `ordem` = aparece". Mas aí um widget
-- NOVO, lançado numa versão futura, também está ausente de `ordem` — e o
-- app não teria como distinguir "a pessoa escondeu isto" de "isto ainda
-- não existia quando ela mexeu no painel". O primeiro caso pede respeitar
-- a escolha; o segundo pede mostrar o widget novo.
--
-- Com as duas listas a regra fica sem ambiguidade, e está escrita uma vez
-- só em src/lib/painel.ts:
--
--   renderiza = (ordem ∩ conhecidos) ++ (conhecidos \ ordem) \ ocultos
--
-- ou seja: a ordem salva primeiro, o que o app conhece e ela não menciona
-- logo atrás (é widget novo, e ele aparece), menos o que foi escondido.
--
-- POR QUE O NOME DA CAPA, E NÃO A COR
--
-- As capas são gradientes montados a partir das variáveis do tema
-- (--capa-aurora e companhia, em src/styles/themes.css): a mesma capa é
-- rosa no tema rosa e verde no verde, e escurece junto no modo escuro.
-- Gravar a cor resolvida congelaria isso e ainda deixaria o painel com uma
-- cor de tema que a pessoa nem usa mais. Nome desconhecido cai no padrão,
-- então mudar o desenho de uma capa — ou aposentar uma — não invalida o
-- que já está gravado.
--
-- QUEM JÁ USA O APP NÃO VÊ DIFERENÇA
--
-- Os defaults são vazio, vazio e 'aurora'. Lista vazia significa "nunca
-- mexi", e a regra acima devolve exatamente os quatro widgets na ordem que
-- o app declara — que é a ordem de hoje. Ninguém abre o app amanhã com o
-- painel remontado.
--
-- REGRA 8
--
-- Nenhum número muda. Estas colunas não entram em soma nenhuma: elas
-- decidem a ORDEM e a PRESENÇA de blocos que continuam calculando o que já
-- calculavam, com as mesmas consultas e o mesmo cache.
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists painel_ordem text[] not null default '{}';

alter table public.profiles
  add column if not exists painel_ocultos text[] not null default '{}';

alter table public.profiles
  add column if not exists painel_capa text not null default 'aurora';

-- Tetos de sanidade, como os da 0018 e da 0022: são campos que o cliente
-- escreve, e um array que cresce sem limite é vetor de abuso barato. Os
-- números têm folga larga sobre os quatro widgets de hoje — o limite existe
-- para impedir megabytes, não para apertar o produto.
alter table public.profiles
  drop constraint if exists profiles_painel_ordem_curta;
alter table public.profiles
  add constraint profiles_painel_ordem_curta
  check (array_length(painel_ordem, 1) is null or array_length(painel_ordem, 1) <= 40);

alter table public.profiles
  drop constraint if exists profiles_painel_ocultos_curta;
alter table public.profiles
  add constraint profiles_painel_ocultos_curta
  check (array_length(painel_ocultos, 1) is null or array_length(painel_ocultos, 1) <= 40);

-- A capa é um nome curto, não um gradiente inteiro: sem isto o campo aceita
-- um CSS de qualquer tamanho, e ele volta para dentro de um style do painel.
alter table public.profiles
  drop constraint if exists profiles_painel_capa_curta;
alter table public.profiles
  add constraint profiles_painel_capa_curta
  check (length(painel_capa) <= 32);

comment on column public.profiles.painel_ordem is
  'Ordem dos widgets do painel. A ordem é a do array; não há campo de posição.';
comment on column public.profiles.painel_ocultos is
  'Widgets que a pessoa escondeu. Separado de painel_ordem para distinguir "escondi" de "ainda não existia".';
comment on column public.profiles.painel_capa is
  'Nome do gradiente de capa (ver --capa-* em src/styles/themes.css). Nome desconhecido cai no padrão.';
