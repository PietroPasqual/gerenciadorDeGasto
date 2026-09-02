# Auditoria antes do redesign — linha de base e achados

Etapa 6 do prompt de evolução visual e funcional. **Nenhum arquivo de produto
foi alterado para produzir este relatório.** Os arquivos temporários usados nas
medições foram removidos ao fim.

Data da auditoria: 1º de setembro de 2026.

## 1. Estado do repositório

| Item               | Valor                                           |
| ------------------ | ----------------------------------------------- |
| Branch de trabalho | `claude/finance-app-typescript-supabase-fu5jm5` |
| `main`             | `350df22`, sem divergência do branch            |
| Árvore             | limpa                                           |
| `AGENTS.md`        | não existe                                      |

Duas premissas do prompt estão **desatualizadas** e não devem guiar decisões:

1. "a branch padrão estava oito commits à frente da main" — já não está. O
   merge foi feito; as duas apontam para o mesmo commit.
2. "Crie uma branch de trabalho com nome claro, como
   `codex/finz-evolucao-visual-funcional`" — o trabalho segue no branch
   designado acima, por instrução vigente do projeto. Não foi criada branch
   nova.

## 2. Linha de base executada

Todos os comandos rodaram. Nada ficou por executar por falta de ambiente.

| Comando            | Resultado                                          |
| ------------------ | -------------------------------------------------- |
| `npm run lint`     | passa (eslint + prettier + tsc)                    |
| `npm run test`     | 402 testes, 23 arquivos, todos passam              |
| `npm run build`    | passa; precache de 46 entradas (1860 KiB)          |
| `npm run bundle`   | 246,6 kB gzip de teto de 280 kB — folga de 33,4 kB |
| `npm run test:rls` | 74 testes contra Postgres 16 real, todos passam    |
| `npm run test:e2e` | 74 testes em 390 px e 1280 px, todos passam        |

Varredura de layout em 360, 390, 768, 1280 e 1440 px, em sete rotas:
**nenhum estouro horizontal, nenhum salto de nível de cabeçalho.**

## 3. Achados, por severidade

### 3.1 [ALTA] A suíte de acessibilidade não consegue ver contraste

`src/test/a11y/paginas.test.tsx` afirma no próprio comentário que o axe pega
"contraste, rótulo ausente, papel errado, ordem de cabeçalho". **Contraste ele
não pega, e não é questão de configuração: é do ambiente.** O axe precisa de
layout pintado para compor cores, e a suíte roda em jsdom.

Prova empírica: um parágrafo `#eeeeee` sobre `#ffffff` — praticamente
invisível — devolve `violations: []` e `incomplete: ["color-contrast"]`. A
categoria `incomplete` é ignorada pelo teste, então passa limpo.

Agrava: os dublês do teste devolvem listas vazias
(`obterComparativoAnual: async () => []`), então a página do comparativo é
avaliada **sem nenhuma linha de mês renderizada** — a marcação que viola nem
chega a existir no teste.

- **Impacto:** toda regressão de contraste passa despercebida, hoje e no
  redesign — justamente quando mais superfícies novas vão surgir.
- **Esforço:** médio. O axe já está no projeto; falta rodá-lo no navegador
  (o arcabouço de E2E já tem dublês e dados controlados prontos para isso).
- **Arquivos:** `src/test/a11y/paginas.test.tsx`, `e2e/`.

### 3.2 [ALTA] Contraste abaixo de AA no comparativo anual

Causa-raiz: `src/features/annual/comparativo-anual-page.tsx:209` —
`futuro && 'opacity-60'`. Os meses futuros ficam a 60% de opacidade, e isso
derruba todo texto dentro deles.

Medido com axe-core 4.10.2 no Chromium, a 390 px, depois de a animação de
entrada terminar (3 s de espera — medir antes disso dá números piores e
falsos):

| Elemento             | Claro  | Escuro | Mínimo |
| -------------------- | ------ | ------ | ------ |
| Valor `text-success` | 2,54:1 | 3,17:1 | 4,5:1  |
| Rótulo "entrou"      | 2,53:1 | 3,23:1 | 4,5:1  |
| Nome do mês          | 4,00:1 | —      | 4,5:1  |

21 nós no claro, 15 no escuro. Vale nos quatro temas — a opacidade age
depois da cor, então trocar de tema não muda nada.

- **Impacto:** metade da tabela do ano fica ilegível para baixa visão, e o
  app tem um arquivo inteiro (`themes.css`) dedicado a calibrar contraste
  que esta opacidade contorna por fora.
- **Esforço:** baixo. Trocar opacidade por uma cor de token dedicada a
  "futuro" resolve sem perder a distinção visual.

### 3.3 [ALTA] `/ajuda` tem alvos de toque de 23 px, e está fora das duas varreduras

Os links do índice da ajuda (`<Link>` dentro de `<CardTitle>`,
`ajuda-page.tsx:67`) medem 23 px de altura em 360 px e 390 px. A regra do
projeto é 44 px, declarada inegociável.

Ele sobrevive porque cai num vão entre os dois testes:

- a varredura de alvo de toque do E2E cobre `/painel`, `/mes?aba=resumo`,
  `/mes?aba=gastos`, `/metas` e `/configuracoes` — **não `/ajuda`**;
- a varredura do axe unitário cobre painel, controle mensal, comparativo e
  metas — **não `/ajuda` nem `/configuracoes`**.

- **Esforço:** baixo para o alvo; baixo para fechar o vão das varreduras.

### 3.4 [MÉDIA] Papéis ARIA inválidos na tabela de gastos fixos

axe, regra `aria-required-children` e `aria-required-parent`, ambas marcadas
**critical**: em `/mes?aba=fixos` existe `role="row"` sem o
`role="table"`/`rowgroup"` exigido em volta. Um leitor de tela não consegue
navegar a estrutura como tabela.

- **Arquivos:** `src/components/common/linha-planilha.tsx` e quem a usa.

### 3.5 [MÉDIA] Faixas roláveis inalcançáveis por teclado

axe, `scrollable-region-focusable` (serious): as faixas horizontais
`.sem-barra-rolagem` em `/metas` (2 ocorrências) e `/comparativo` (1) rolam,
mas não recebem foco — quem navega por teclado não chega ao conteúdo
escondido à direita.

### 3.6 [MÉDIA] Fatias de gráfico sem nome acessível

axe, `svg-img-alt` (serious), em `/painel` e `/mes?aba=resumo`: os `path` do
recharts não têm nome acessível. Conecta com a exigência do prompt de
"gráficos com resumo textual" e "no celular o valor acessível por toque".

### 3.7 [MÉDIA] Faltam tokens que o redesign vai exigir

O que **já existe e está bem feito**: cores com contraste calculado e
documentado por tema, escala de sombra tingida, densidade, escala tipográfica
fixa, raios, variante `mouse:`, `prefers-reduced-motion` global.

O que **não existe** e a fase 1 do prompt pede:

| Token                      | Situação hoje                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Superfícies nível 0/1/2    | só `background`/`card`/`popover`/`muted`; `muted` acumula dois papéis                                |
| Duração e easing           | cravados: `0.35s ease-out` no Tailwind, `0.6s` no `flash-salvo`, mais os de Framer Motion espalhados |
| Blur permitido             | criado na fase 3 (`--vidro`, classe `.vidro`) — o dock consome                                       |
| Gradiente                  | criado na fase 4 (`--capa-*`, `--capa-scrim`) — a capa do painel consome                             |
| Alvo de toque              | `min-h-11` repetido à mão; `min-h-[2.75rem]` aparece 10 vezes                                        |
| Largura máxima de conteúdo | só `container` com `2xl: 1400px`                                                                     |
| Paleta de gráfico          | `PALETA` cravada em `donut.tsx`, fora do sistema de temas                                            |

Há **162 valores arbitrários** `-[...]` no código, sendo `min-h-[2.75rem]`
(10x), `text-[0.7rem]` (6x) e `text-[0.65rem]` (5x) os mais repetidos — os
três são candidatos diretos a virar token.

## 4. O que já existe e NÃO deve ser recriado

O prompt propõe várias coisas que o app já tem. Recriá-las com outro nome
seria a pior forma de gastar o esforço:

| O prompt propõe                     | Já existe em                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| Lazy loading de páginas e gráficos  | `src/lib/paginas.ts`, com pré-aquecimento seletivo e recharts fora da primeira carga |
| Recuperação de senha                | `store/auth.ts:86`, fluxo oficial do Supabase                                        |
| Paleta de comandos                  | `components/layout/paleta-comandos.tsx`                                              |
| Densidade confortável/compacta      | tokens `--campo-altura`, `--linha-y`, `--card-padding`                               |
| Detecção de assinatura              | `lib/assinaturas.ts` (fase 6.2)                                                      |
| Projeção de fechamento              | `lib/observacoes.ts` (fase 6.4)                                                      |
| Orçamento e valor por dia           | `lib/orcamento.ts` (fase 4.5)                                                        |
| Backup/restauração sem sobrescrever | `lib/backup.ts` (fase 6.5)                                                           |
| Alerta de gasto atípico             | `lib/gasto-atipico.ts` (fase 6.6)                                                    |
| Nota de conta compartilhada         | `docs/conta-compartilhada.md`, com esboço de migration                               |
| Nota de contas com saldo            | `docs/contas-e-saldo.md`                                                             |
| Proposta de onboarding              | `docs/onboarding.md`                                                                 |

A landing, por outro lado, **é** um alvo legítimo: 171 linhas, três seções.
O prompt pede hero, preview, fluxo, mosaico, segurança, PWA, temas, chamada
final e footer.

## 5. Ordem de execução sugerida

Antes de qualquer pixel novo, fechar o que mede:

1. **Contraste no navegador** (3.1) — sem isso, o redesign inteiro avança às
   cegas sobre a única métrica de acessibilidade que o app diz cuidar.
2. **Corrigir os achados do axe** (3.2, 3.3, 3.4, 3.5, 3.6) — são poucos, são
   baratos, e cada um vira teste de regressão para a fase seguinte.
3. **Fechar os vãos de cobertura** — `/ajuda` e `/configuracoes` nas duas
   varreduras.
4. **Tokens** (3.7) — a fase 1 do prompt, agora com a lista concreta do que
   falta.
5. Só então landing, shell, painel e o resto.

## 6. Itens que precisavam de decisão do proprietário

Os quatro primeiros foram **decididos e implementados** nas fases 3 e 4. Ficam
registrados com a decisão e o que ela custou.

1. **"Dark-first" contradiz "sem transformar o modo claro em versão
   secundária".** → **Dark-first**, e a contradição era aparente: o padrão
   decide quem atende a ausência de escolha, não quem é de primeira classe. Os
   dois modos continuam calibrados no `themes.css` e medidos nos quatro temas
   pelo e2e de contraste. Quem já usava o claro nem percebe — o `persist`
   hidrata antes do padrão. O que a decisão exigiu de novo foi o script
   síncrono do `index.html`: sem ele, o dark-first troca o flash branco de
   antes por um flash preto na cara de quem pediu o claro.
2. **Capas do painel — quem produz os arquivos?** → **Ninguém, e não são
   arquivos.** As capas são gradientes montados a partir das variáveis do tema.
   Não é o "fallback" da pergunta: é a resposta. Acompanham os quatro temas e o
   claro/escuro sem um arquivo por variante, não custam byte de rede, entram no
   cache do service worker de graça e não prometem nada que o produto não
   cumpra. O perfil guarda o NOME da capa, então redesenhar ou aposentar uma
   não invalida o que está gravado.
3. **Dock flutuante no lugar da barra inferior — vale o risco?** → **Sim**, e o
   risco foi contido mantendo a informação no lugar: os mesmos destinos, na
   mesma ordem que a barra inferior já usava, com o mesmo "Mais". Mudou o
   desenho, não o que reaprender. Em troca, as TRÊS navegações viraram uma: o
   `nav[aria-label="Navegação principal"]` agora é único no DOM, e não só
   visível-um-de-cada-vez — o teste de paridade passou a cobrar as duas coisas.
   Ganho não previsto: a paleta de comandos só abria por ⌘K e portanto não
   existia no celular; agora abre pelo "Mais".
4. **Widgets personalizáveis — `localStorage` ou perfil?** → **Perfil**, e a
   regra de precedência não precisou existir, porque não há duas fontes:
   `painel_ordem`, `painel_ocultos` e `painel_capa` moram só na 0023. O
   critério é de quem é a preferência — "quero o saldo antes do donut" é da
   PESSOA, e ela quer isso no telefone e no computador. A posição do dock foi
   para o `localStorage` pelo mesmo critério aplicado ao contrário: "à
   esquerda" é boa ideia num monitor e péssima num celular, e é a única
   preferência do app que é do aparelho.
5. Os quatro itens de alto risco da fase 8 do prompt (contas e carteiras,
   conta compartilhada, escrita offline, Open Finance) permanecem **sem
   autorização** e com nota escrita para três deles.

## 7. Riscos de regressão a vigiar

- **Competência × caixa.** A validação da fase 4 achou quatro telas que
  misturavam as duas medidas. Todo card novo do painel repete esse risco, e
  nenhum teste automático pega — só a leitura da tela.
- **Dinheiro em centavos inteiros.** Qualquer número novo (projeção, fluxo de
  caixa, distribuição de widget) precisa continuar inteiro.
- **Orçamento de bundle.** Restam 33,4 kB de folga. Efeitos, ilustrações e
  bibliotecas de animação cabem nisso ou exigem lazy loading real.
- **Cache do mês.** A RPC única da `0011` e a chave compartilhada de doze
  meses (`useGastosRecentes`) são fáceis de duplicar sem querer ao espalhar
  dados por muitos widgets.
