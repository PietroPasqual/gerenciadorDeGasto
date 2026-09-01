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

Tokens que o redesign vai pedir e que **não** foram criados agora, porque nada
os consome ainda e token sem consumidor é peso morto:

- **Blur** — o dock flutuante e o scrim da capa vão precisar. As duas coisas
  dependem de decisões ainda não tomadas.
- **Gradiente** — idem.
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
