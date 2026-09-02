# Design system do finZ

O que existe, onde mora, e o que deliberadamente **não** existe.

A fonte de verdade é `src/styles/themes.css` (CSS variables) exposta ao
Tailwind em `tailwind.config.js`. Componente nenhum deve escolher um valor no
olho: se um número aparece duas vezes em telas diferentes, ele é um token que
ainda não foi nomeado.

## Cor

Quatro temas (rosa, azul, verde, roxo) × claro e escuro. O tema troca só a
moldura — `primary`, `accent`, `background`. **Dinheiro não muda de cor com o
tema:** `--success` (entrada) e `--destructive` (saída) ficam fora dos blocos
por tema, porque um verde de "entrou" que virasse rosa perderia o significado.

Contraste é calculado, não estimado — `themes.css` registra as contas, incluindo
a folga para o pior fundo em que cada cor aparece. Duas armadilhas já custaram
caro e estão anotadas lá:

- `--primary` como TEXTO reprova AA nos temas claros; para isso existe
  `--primary-strong`. `text-primary` só sobre `primary-soft` ou como ícone.
- **Nunca use `opacity` para "apagar" conteúdo.** Ela multiplica o texto junto
  e passa por fora de toda a calibração. Foi assim que os meses futuros do
  comparativo anual foram parar em 2,54:1 contra o mínimo de 4,5:1, nos quatro
  temas. Para apagar, use uma superfície ou uma cor de texto própria.

**O escuro é o padrão.** Isso vale só para quem ainda não escolheu: o `persist`
do store hidrata antes, então quem já usava o claro continua no claro. O claro
não virou versão secundária por isso — os dois seguem com as mesmas contas de
contraste aqui, e o e2e mede os quatro temas nos dois modos. O que mudou foi
qual deles atende a quem não pediu nada.

O padrão aparece em dois lugares e eles têm que concordar: `escuro: true` em
`store/tema.ts` e o `<html class="dark">` do `index.html`. Lá há também um
script síncrono que lê a preferência gravada antes da primeira pintura — sem
ele, quem pediu o claro leva um flash preto enquanto o pacote JS carrega. Ele
duplica de propósito o que `aplicar()` faz: não duplicar exigiria carregar o
store, que é justamente o que demora.

## Vidro

Uma superfície translúcida com desfoque, para o que flutua POR CIMA do
conteúdo: o dock e o cabeçalho grudado. Uma barra opaca ali corta a página em
duas; uma translúcida mostra que o conteúdo continua embaixo.

A translucidez é o **conteúdo da superfície**, não um `opacity` sobre o texto —
a mesma distinção da seção de Cor. O texto do dock é pintado depois, com a cor
e o contraste de sempre.

`--vidro` é `--card` a 88% e não a 60% porque o que passa atrás entra na conta
do contraste. A pior composição é o rótulo inativo em `muted-foreground` sobre
o vidro com texto do app por trás: ~4,8:1 no claro, contra o mínimo de 4,5.
Baixar o alfa derruba esse número.

Fundo, blur e fallback andam juntos na classe `.vidro` do `index.css`, e não
como três utilitários soltos. Onde não há `backdrop-filter`, o fundo vira
opaco: sem o desfoque, a translucidez não embaça nada — ela só deixa o texto da
página aparecer atrás do texto do dock, que é o pior dos dois mundos.

## Capa

Gradientes nomeados (`--capa-aurora` e companhia) para a faixa decorativa do
topo do painel. São **gradiente e não imagem** por decisão, não por atalho:
capa exigiria arquivos originais em AVIF/WebP, um por variante, e o projeto não
tem nenhum; banco de imagens seria promessa que o produto não cumpre; hotlink
seria dependência de domínio de terceiro numa tela que abre offline.

Derivam das variáveis do tema, então a mesma capa é rosa no tema rosa e verde
no verde, escurece junto no escuro, e não custa um byte de rede.

`--capa-altura` é **6rem no celular e 9rem de sm para cima**. É o inverso da
densidade abaixo (que só vale de md para cima porque mexe em alvo de toque):
aqui o valor apertado é o do telefone. Com 9rem em toda largura, o primeiro
dado do painel começava a 361px de 844 — 43% do primeiro quadro era moldura, e
a capa respondia por 144px deles sem carregar informação nenhuma.

O perfil guarda o **nome** da capa, nunca o gradiente. Assim aposentar ou
redesenhar uma capa não invalida o que já está gravado, e nome desconhecido cai
no padrão (`lib/painel.ts`).

**Nada de texto sobre a capa.** O gradiente muda de luminosidade ao longo da
faixa, e texto ali teria contraste diferente em cada ponto — fora do alcance de
qualquer calibração deste arquivo. `--capa-scrim` existe para a base dissolver
no fundo da página, e o título fica abaixo, sobre `--background`.

## Dock

`--dock-altura`, `--dock-raio`, `--dock-margem`, `--sombra-dock` e as duas
reservas. As medidas ficam num lugar só porque **quatro** componentes as leem: o
dock, o respiro do `<main>`, o FAB e a barra de ações em lote.

`--dock-reserva` é derivada — `altura + margem + max(margem, safe-area)` — e não
um número escolhido de novo. Era exatamente assim que o `pb-28` da barra
inferior antiga saía do lugar: ele fora calibrado para a altura de uma
navegação que depois mudou, e junto com ele saíram de lugar o `bottom-24` do
FAB, o `bottom-[4.75rem]` da barra de seleção e o `bottom-[5.5rem]` do aviso de
versão. Os quatro leem o token agora.

Cuidado ao mexer no `<main>`: um `sm:py-8` escreve `padding-bottom` de dentro
de uma media query e **ganha** do `pb-dock-reserva` sem prefixo. Por isso a
casca usa `pt-`, e a reserva é dona do lado de baixo sozinha.

## Superfície

Três níveis, e nada de opacidade escolhida caso a caso:

| Nível | Token          | Onde                                 |
| ----- | -------------- | ------------------------------------ |
| 0     | `--background` | o fundo da página                    |
| 1     | `--card`       | a superfície que se destaca do fundo |
| 2     | `--superficie` | a caixa **dentro** de um card        |

`--realce` é um papel separado: fundo de hover e de item ativo.

Os dois nasceram de 42 usos ad-hoc — `bg-muted/30|40|50|60` (22 vezes, quatro
cinzas quase iguais) e `bg-accent/40|50|60` (11 vezes) — espalhados por
dezoito arquivos. São cores compostas, não opacidades: o texto por cima
mantém o contraste calibrado.

No escuro a hierarquia inverte — a caixa aninhada é mais **clara** que o card,
porque ali o que separa camadas é luz, não sombra.

## Tipografia

Fraunces em títulos e números de destaque (`.titulo-serif`, `.numero-serif`);
Inter em interface, tabelas e qualquer dado comparável — número de tabela
continua em Inter com `tabular-nums`, senão as colunas deixam de alinhar.

Escala fixa: `display`, `titulo`, `secao`, `corpo`, `rotulo`, `micro`.

`micro` (0,6875rem) foi o degrau que faltava: sem ele apareceram 14 usos de
`text-[0.7rem]`, `text-[0.6875rem]` e `text-[0.65rem]` — três tamanhos entre
10,4px e 11,2px, indistinguíveis a olho. Ele define **só o tamanho**, sem
`lineHeight` nem `letterSpacing`: fixá-los mudava a altura das telas, e a
regressão visual pegou 8px a mais no resumo do mês.

**Exceção consciente:** `barra-mes-celular.tsx` mantém tamanhos arbitrários
numa escada (0,9375 → 0,8125 → `micro` → 0,625rem). Ali o número encolhe em
vez de truncar — "R$ 125.988,…" não diz nada —, e a escada é o mecanismo, não
descuido. `previa-app.tsx` também: é uma ilustração de um app em miniatura,
não interface.

## Alvo de toque

`.alvo-toque` — 44px onde se toca, 24px onde há ponteiro fino.

O piso de 24px é o mínimo do WCAG 2.2 (`target-size`). Existe porque
`md:min-h-0` estava em onze componentes e derrubava os chips a 20px no
desktop; zero nunca foi a intenção — a intenção era compacto, e compacto tem
piso.

Usa `mouse:` e não `md:`, pelo mesmo motivo que as ações de hover: um tablet
em 1024px atende ao `md:` e não tem ponteiro fino nenhum, então receberia
alvos de 24px para tocar com o dedo.

## Movimento

Três degraus, dos dois lados:

|        | CSS                  | JS (Framer)       |
| ------ | -------------------- | ----------------- |
| rápido | `--mov-rapido` 150ms | `MOV.rapido` 0.15 |
| normal | `--mov-normal` 250ms | `MOV.normal` 0.25 |
| lento  | `--mov-lento` 400ms  | `MOV.lento` 0.4   |

Easing único: `--mov-easing` / `EASING` — sai rápido e desacelera, para o
conteúdo parecer ter chegado e não ter sido empurrado.

Havia nove durações soltas (0,22s, 0,25s, 0,3s três vezes, 0,4s, 0,5s duas
vezes, 0,6s), nenhuma escolhida em relação às outras. O Framer não lê CSS
variables, então `src/lib/movimento.ts` repete a escala — mudar um degrau
significa mudar nos dois lugares, e é mais barato que nove valores soltos.

A regra global de `prefers-reduced-motion` no `index.css` zera tudo isso; os
tokens não a contornam.

## Densidade

`--campo-altura`, `--linha-y`, `--card-padding`, trocados por
`[data-densidade='compacto']`. Só valem atrás de `md:`: no celular a altura
dos campos é alvo de toque e não pode encolher.

## Elevação

`--sombra-1` e `--sombra-2`, tingidas com o `primary` do tema — cinza puro
sobre fundo levemente colorido dá aspecto sujo. No escuro a sombra quase some;
o que separa camadas ali é o card ser mais claro que o fundo.

## O que NÃO existe, e por quê

Tokens que **não** existem, porque nada os consome e token sem consumidor é
peso morto. (Blur e gradiente saíram desta lista nas fases 3 e 4: o dock e a
capa passaram a consumi-los, e viraram as seções _Vidro_ e _Capa_ acima.)

- **Paleta de gráfico por tema.** Hoje `PALETA` vive em `donut.tsx`, com três
  tons derivados do `primary` e sete pastéis fixos. Não tem defeito medível:
  as fatias são conteúdo não-textual, separadas por um traço da cor do card, e
  os pastéis claros sobre card escuro continuam legíveis. Tokenizá-la exige
  antes decidir as cores de modo escuro, que é decisão de redesign.
- **Regressão visual por screenshot.** Foi usada como ferramenta durante a
  consolidação dos tokens (e pegou os 8px de altura do `micro`), mas não ficou
  no repositório: as capturas são específicas do ambiente que as gerou, e num
  CI com renderização de fonte diferente elas quebram por motivo errado. Se
  virar suíte permanente, precisa gerar a base dentro do mesmo container do CI.

## Como isto é verificado

| Suíte                                         | O que garante                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run test`                                | axe em jsdom: rótulo, papel ARIA, ordem de cabeçalho                         |
| `npm run test:e2e` → `acessibilidade.spec.ts` | axe em Chromium: contraste nos 4 temas × claro/escuro, tamanho de alvo, foco |
| `npm run test:e2e` → `paridade.spec.ts`       | 44px no celular, zero estouro horizontal, cada linha de `paridade.md`        |
| `npm run bundle`                              | teto de 280 kB gzip                                                          |

Contraste e tamanho de alvo **só** são vistos pela suíte de navegador — em
jsdom o axe devolve as duas regras como `incomplete`. Ver o comentário em
`src/test/a11y/paginas.test.tsx`.
