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

| No PC | No celular |
|---|---|
| Abrir qualquer das 6 telas — abas no topo (sm–lg) ou barra lateral (lg+) | Barra inferior: Painel, Mês, Metas e **Mais** (Comparativo anual, Configurações, Ajuda) |
| Trocar tema claro/escuro e sair — rodapé da barra lateral | Sheet **Mais**, no fim da lista |
| Paleta de comandos (⌘K) | Não existe — e não precisa: as três coisas que ela faz têm caminho próprio (navegar → barra inferior, ações da tela → menu ⋯, tema/densidade → Configurações) |

## Controle mensal

| No PC | No celular |
|---|---|
| Trocar de mês — setas ‹ › e combo | Faixa de pílulas dos 12 meses **e** swipe horizontal no conteúdo |
| Trocar de ano — combo | Combo no início da faixa de meses |
| Ver os sete blocos do mês | Seis abas roláveis (Resumo · Entradas · Fixos · Gastos · Investir · Análise), com a aba na URL |
| Ver entradas/saídas/saldo — card lateral | Faixa fixa abaixo das abas, sempre à vista |
| Importar CSV — botão no cabeçalho | Menu **⋯** do topo |
| Categorizar automaticamente — botão no cabeçalho | Menu **⋯** do topo |
| Exportar CSV — botão no cabeçalho | Menu **⋯** do topo |
| Lançar gasto — linha de adição da tabela | Botão flutuante **+** → sheet, com o valor já em foco |
| Conferir o CSV antes de gravar — diálogo central | A mesma conferência em sheet de baixo para cima |
| Editar gasto — células da linha | Tocar no card → mesma sheet |
| Excluir gasto — lixeira da linha (aparece no hover) | Botão **Excluir** dentro da sheet |
| Marcar gasto fixo como pago — caixa na linha | Botão "pago" no card (alvo de 44px) |
| Desde/até quando o fixo é pago — chip embaixo do nome → sheet | O mesmo chip e a mesma sheet |
| Entradas, aportes por meta e aportes avulsos — linha inline | A mesma linha em duas faixas: nome em cima, valor + ação embaixo |
| Gastos por categoria e por forma de pagamento | Aba **Análise** |

## Comparativo anual

| No PC | No celular |
|---|---|
| Ver os 12 meses — tabela de 4 colunas | Cards de duas linhas (mês + diferença / entrou + saiu) |
| Totais e médias do ano — três cards lado a lado | Faixa que desliza, com snap |
| Abrir um mês no controle mensal — clicar no nome | Tocar no card inteiro |
| Exportar CSV — botão no cabeçalho | Menu **⋯** |
| Gráfico entrada × gastos, com média e tooltip | O mesmo gráfico |

## Metas

| No PC | No celular |
|---|---|
| Editar os 12 meses de cada meta — grade meta × mês | Tocar no card da meta → sheet com os doze meses em campos de tamanho de dedo |
| Total guardado por mês — rodapé da grade | Faixa deslizante com os doze meses |
| Progresso de cada meta | O mesmo card |
| Wishlist: nome, valor, prioridade e "conquistado" — linha de 5 colunas | Card de três faixas, com as estrelas em 44px |

## Configurações

| No PC | No celular |
|---|---|
| Ver as quatro seções — coluna única com índice e scroll-spy (lg+) | Quatro abas |
| Criar categoria / forma / meta — linha de adição | Botão de largura total → sheet |
| Editar — células inline | Tocar no card → sheet |
| Reordenar — setas ↑ ↓ na linha (aparecem no hover) | **Subir** / **Descer** dentro da sheet |
| Excluir — lixeira na linha | **Excluir** dentro da sheet, com confirmação que diz o que acontece com o que já foi lançado |
| Escolher a cor da categoria | A mesma paleta de 16 tons (no PC atrás de um botão, no celular aberta na sheet) |
| Tema de cor, com miniatura de cada um | O mesmo |
| Modo escuro | O mesmo |
| Nome do perfil | O mesmo |

### A única linha assimétrica

| No PC | No celular |
|---|---|
| **Densidade** confortável/compacta | Não existe — de propósito |

A densidade troca `--campo-altura`, `--linha-y` e `--card-padding`, e essas
variáveis só entram atrás de `md:` nos componentes: no celular a altura dos
campos é alvo de toque e não pode encolher. Um controle que existisse ali e não
mudasse nada seria pior do que não existir. É a mesma natureza do ⌘K: uma
preferência de tela grande, não uma função escondida.

Conferido: com `compacto` forçado no localStorage a 360px, os campos continuam
com 44px e a página tem exatamente a mesma altura.
