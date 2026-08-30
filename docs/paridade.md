# Tabela de paridade — PC ↔ celular

Regra 0.5 do plano de design: **nenhuma função pode existir só no PC.** Se algo
não cabe na tela pequena, ele muda de forma — vira sheet, acordeão, aba, lista —
mas não some.

Esta tabela é a prova disso. Cada linha diz onde a mesma coisa está nos dois
tamanhos. **Célula vazia é bug, não decisão de design.**

Os caminhos do celular foram verificados no navegador a 390px, um a um, e não
de memória (22 de 22). A verificação pegou dois falsos negativos que valem
lembrar para quem for refazê-la:

- Contar `nav[aria-label="Navegação principal"]` no DOM dá 3 (barra lateral,
  abas do header e barra inferior). O que importa é quantos estão **visíveis** —
  use `checkVisibility()`, não a contagem.
- `textContent` lê texto de elemento oculto. Para afirmar que algo NÃO aparece
  no celular, também vale `checkVisibility()`.

---

## Navegação

| No PC                                                                    | No celular                                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir qualquer das 6 telas — abas no topo (sm–lg) ou barra lateral (lg+) | Barra inferior: Painel, Mês, Metas e **Mais** (Comparativo anual, Configurações, Ajuda)                                                                       |
| Trocar tema claro/escuro e sair — rodapé da barra lateral                | Sheet **Mais**, no fim da lista                                                                                                                               |
| Paleta de comandos (⌘K)                                                  | Não existe — e não precisa: as três coisas que ela faz têm caminho próprio (navegar → barra inferior, ações da tela → menu ⋯, tema/densidade → Configurações) |

## Controle mensal

| No PC                                                         | No celular                                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Trocar de mês — setas ‹ › e combo                             | Faixa de pílulas dos 12 meses **e** swipe horizontal no conteúdo                               |
| Trocar de ano — combo                                         | Combo no início da faixa de meses                                                              |
| Ver os sete blocos do mês                                     | Seis abas roláveis (Resumo · Entradas · Fixos · Gastos · Investir · Análise), com a aba na URL |
| Ver entradas/saídas/saldo — card lateral                      | Faixa fixa abaixo das abas, sempre à vista                                                     |
| Importar CSV — botão no cabeçalho                             | Menu **⋯** do topo                                                                             |
| Preencher em bloco (categoria + forma) — botão no cabeçalho   | Menu **⋯** do topo                                                                             |
| Exportar CSV — botão no cabeçalho                             | Menu **⋯** do topo                                                                             |
| Lançar gasto — linha de adição da tabela                      | Botão flutuante **+** → sheet, com o valor já em foco                                          |
| Conferir o CSV antes de gravar — diálogo central              | A mesma conferência em sheet de baixo para cima                                                |
| Editar gasto — células da linha                               | Tocar no card → mesma sheet                                                                    |
| Excluir gasto — lixeira da linha (aparece no hover)           | Botão **Excluir** dentro da sheet                                                              |
| Marcar gasto fixo como pago — caixa na linha                  | Botão "pago" no card (alvo de 44px)                                                            |
| Desde/até quando o fixo é pago — chip embaixo do nome → sheet | O mesmo chip e a mesma sheet                                                                   |
| Entradas, aportes por meta e aportes avulsos — linha inline   | A mesma linha em duas faixas: nome em cima, valor + ação embaixo                               |
| Gastos por categoria e por forma de pagamento                 | Aba **Análise**                                                                                |
| Entrada recorrente (salário) — bloco na aba Entradas          | O mesmo bloco, na aba **Entradas**                                                             |
| Desde/até quando a entrada é recebida — chip → sheet          | O mesmo chip e a mesma sheet, com 44px de alvo                                                 |
| Aviso de recorrente e avulsa com a mesma descrição no mês     | O mesmo aviso                                                                                  |
| Ver "X novos · Y já existiam" antes de gravar a importação    | A mesma contagem no topo da sheet de conferência                                               |
| Buscar lançamento por descrição — campo acima da tabela       | O mesmo campo, com 44px de altura                                                              |
| Filtrar por tipo, categoria, forma e faixa de valor           | A mesma sheet, aberta pelo botão de filtros                                                    |
| Ver "Mostrando N de M" e limpar filtros                       | O mesmo                                                                                        |
| Filtro na URL, para o voltar desfazer a busca                 | O mesmo                                                                                        |
| Ver as faturas que vencem no mês — cartão na aba Resumo       | O mesmo cartão, na aba **Resumo**                                                              |
| Marcar fatura como paga — botão no cartão da fatura           | O mesmo botão, com 44px de altura                                                              |
| Ver "Gastei" e "Sai da conta" separados                       | Os dois na faixa fixa: a faixa mostra "Sai da conta", e o cartão de Resumo mostra os dois      |
| Lançar compra parcelada — campo "Parcelas" na linha de adição | O mesmo campo na sheet do FAB, com − e + de 44px                                               |
| Ver "3/12" na linha do gasto                                  | A mesma etiqueta no card                                                                       |
| Editar/excluir parcela — pergunta "só esta ou as N?"          | O mesmo diálogo, com os botões empilhados e 44px cada                                          |

## Comparativo anual

| No PC                                                               | No celular                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Ver os 12 meses — tabela de 4 colunas                               | Cards de duas linhas (mês + diferença / entrou + saiu)  |
| Totais e médias do ano — três cards lado a lado                     | Faixa que desliza, com snap                             |
| Abrir um mês no controle mensal — clicar no nome                    | Tocar no card inteiro                                   |
| Abrir um mês — clique na linha da tabela **ou** no ponto do gráfico | Toque no card do mês **ou** tocando no ponto do gráfico |
| Exportar CSV — botão no cabeçalho                                   | Menu **⋯**                                              |
| Gráfico entrada × gastos, com média e tooltip                       | O mesmo gráfico                                         |

## Metas

| No PC                                                                  | No celular                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Editar os 12 meses de cada meta — grade meta × mês                     | Tocar no card da meta → sheet com os doze meses em campos de tamanho de dedo |
| Total guardado por mês — rodapé da grade                               | Faixa deslizante com os doze meses                                           |
| Progresso de cada meta                                                 | O mesmo card                                                                 |
| Wishlist: nome, valor, prioridade e "conquistado" — linha de 5 colunas | Card de três faixas, com as estrelas em 44px                                 |

## Configurações

| No PC                                                             | No celular                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ver as quatro seções — coluna única com índice e scroll-spy (lg+) | Quatro abas                                                                                  |
| Criar categoria / forma / meta — linha de adição                  | Botão de largura total → sheet                                                               |
| Editar — células inline                                           | Tocar no card → sheet                                                                        |
| Reordenar — setas ↑ ↓ na linha (aparecem no hover)                | **Subir** / **Descer** dentro da sheet                                                       |
| Excluir — lixeira na linha                                        | **Excluir** dentro da sheet, com confirmação que diz o que acontece com o que já foi lançado |
| Escolher a cor da categoria                                       | A mesma paleta de 16 tons (no PC atrás de um botão, no celular aberta na sheet)              |
| Tema de cor, com miniatura de cada um                             | O mesmo                                                                                      |
| Modo escuro                                                       | O mesmo                                                                                      |
| Nome do perfil                                                    | O mesmo                                                                                      |

## Cartão de crédito

A fatura é opt-in por cartão: enquanto ela não é configurada, todas estas
linhas simplesmente não aparecem, e a tela é a de antes da fase 2.

| No PC                                                                | No celular                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Configurar fechamento e vencimento — chip embaixo do nome do cartão  | O mesmo chip no card da forma de pagamento, com 44px de altura |
| Escolher desde quando a fatura vale                                  | O mesmo, na mesma sheet                                        |
| Ver o exemplo ("compra em 20/08 → fatura de set/25") antes de salvar | O mesmo                                                        |
| Ver o aviso de que o app não conhece feriado                         | O mesmo                                                        |

## Offline e versão nova

Ver `docs/offline.md` para o que funciona sem rede e por que gravar offline
ainda não entrou.

| No PC                                                     | No celular                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| Abrir o app sem rede e ver o mês já visitado              | O mesmo                                                             |
| Aviso de "sem internet" — canto inferior esquerdo         | O mesmo aviso, centralizado acima da barra inferior                 |
| Aviso de versão nova, com botão "Atualizar"               | O mesmo, com o botão em 44px                                        |
| Atalho para lançar gasto — paleta de comandos (⌘K) ou FAB | Atalho **Lançar gasto** ao segurar o ícone do app, que abre a folha |

## Quando alguma tela quebra

O limite de erro (`src/components/common/limite-de-erro.tsx`) vive dentro do
`<main>`, então a moldura de navegação fica de pé nos dois tamanhos e a saída
está sempre a um toque.

| No PC                                                              | No celular                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Cartão de erro no lugar do conteúdo, abas e barra lateral intactas | O mesmo cartão, com a barra inferior intacta                |
| **Tentar novamente** — remonta a tela sem recarregar o app         | O mesmo, com os dois botões em coluna e 44px de altura cada |
| **Voltar ao início** — vai para o painel                           | O mesmo                                                     |
| Navegar para outra tela limpa o erro sozinho                       | O mesmo, inclusive pela barra inferior                      |

### A única linha assimétrica

| No PC                              | No celular                |
| ---------------------------------- | ------------------------- |
| **Densidade** confortável/compacta | Não existe — de propósito |

A densidade troca `--campo-altura`, `--linha-y` e `--card-padding`, e essas
variáveis só entram atrás de `md:` nos componentes: no celular a altura dos
campos é alvo de toque e não pode encolher. Um controle que existisse ali e não
mudasse nada seria pior do que não existir. É a mesma natureza do ⌘K: uma
preferência de tela grande, não uma função escondida.

Conferido: com `compacto` forçado no localStorage a 360px, os campos continuam
com 44px e a página tem exatamente a mesma altura.
