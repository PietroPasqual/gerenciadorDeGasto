# Tabela de paridade — PC ↔ celular

Regra 0.5 do plano de design: **nenhuma função pode existir só no PC.** Se algo
não cabe na tela pequena, ele muda de forma — vira sheet, acordeão, aba, lista —
mas não some.

Esta tabela é a prova disso. Cada linha diz onde a mesma coisa está nos dois
tamanhos. **Célula vazia é bug, não decisão de design.**

Cada linha desta tabela agora é **teste automático** (`e2e/paridade.spec.ts`),
rodando em 390px e 1280px no CI. A conferência à mão que originou a tabela está
registrada abaixo, mas quem garante que ela continua verdadeira é o `npm run
test:e2e` — uma tabela conferida à mão apodrece na terceira feature.

O E2E já pegou uma célula que era falsa: a linha de "compra parcelada" afirmava
um campo de parcelas na linha de adição do PC, e ele nunca existiu — o campo só
vivia na sheet, que no desktop só abria para EDITAR. Lançar uma compra parcelada
era impossível no PC. Hoje há um botão "Lançar gasto" no cabeçalho da tabela,
que abre a mesma sheet.

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

## Painel — projeção de fechamento

A única frase do app que fala do futuro, e por isso a única que precisa se
apresentar como projeção. Cala antes do dia 10 (`dia 3 não tem média`), nos
últimos dias do mês, e quando não há gasto do dia a dia para fazer ritmo.

| No PC                                                         | No celular                            |
| ------------------------------------------------------------- | ------------------------------------- |
| "R$ 820,00 é o que deve sobrar no fim do mês" nas observações | A mesma frase, nas mesmas observações |
| "É projeção, não fato — faltam 13 dias" na própria frase      | O mesmo                               |
| Sem base para projetar — a frase simplesmente não aparece     | O mesmo                               |

## Painel — compra fora do padrão

Fato, não conselho — a régua do `observacoes.ts`: mostra um número conferível
e não diz o que fazer com ele. Cala sem cinco compras anteriores na categoria
(sem base não há média), abaixo de R$ 50 (múltiplo de uma média pequena não
vale o alerta) e para compra parcelada (o valor da parcela é uma fração do
preço cheio, não o preço).

| No PC                                                              | No celular                            |
| ------------------------------------------------------------------ | ------------------------------------- |
| "R$ 400,00 é 4× a sua média em Mercado (normalmente R$ 100,00)"    | A mesma frase, nas mesmas observações |
| Nenhuma compra passa nas travas — a frase simplesmente não aparece | O mesmo                               |

## Controle mensal

| No PC                                                                        | No celular                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Trocar de mês — setas ‹ › e combo                                            | Faixa de pílulas dos 12 meses **e** swipe horizontal no conteúdo                               |
| Trocar de ano — combo                                                        | Combo no início da faixa de meses                                                              |
| Ver os sete blocos do mês                                                    | Seis abas roláveis (Resumo · Entradas · Fixos · Gastos · Investir · Análise), com a aba na URL |
| Ver entradas/saídas/saldo — card lateral                                     | Faixa fixa abaixo das abas, sempre à vista                                                     |
| Importar CSV — botão no cabeçalho                                            | Menu **⋯** do topo                                                                             |
| Preencher em bloco (categoria + forma) — botão no cabeçalho                  | Menu **⋯** do topo                                                                             |
| Exportar CSV — botão no cabeçalho                                            | Menu **⋯** do topo                                                                             |
| Lançar gasto — linha de adição da tabela                                     | Botão flutuante **+** → sheet, com o valor já em foco                                          |
| Conferir o CSV antes de gravar — diálogo central                             | A mesma conferência em sheet de baixo para cima                                                |
| Editar gasto — células da linha                                              | Tocar no card → mesma sheet                                                                    |
| Excluir gasto — lixeira da linha (aparece no hover)                          | Botão **Excluir** dentro da sheet                                                              |
| Marcar gasto fixo como pago — caixa na linha                                 | Botão "pago" no card (alvo de 44px)                                                            |
| Desde/até quando o fixo é pago — chip embaixo do nome → sheet                | O mesmo chip e a mesma sheet                                                                   |
| Entradas, aportes por meta e aportes avulsos — linha inline                  | A mesma linha em duas faixas: nome em cima, valor + ação embaixo                               |
| Gastos por categoria e por forma de pagamento                                | Aba **Análise**                                                                                |
| Entrada recorrente (salário) — bloco na aba Entradas                         | O mesmo bloco, na aba **Entradas**                                                             |
| Desde/até quando a entrada é recebida — chip → sheet                         | O mesmo chip e a mesma sheet, com 44px de alvo                                                 |
| Aviso de recorrente e avulsa com a mesma descrição no mês                    | O mesmo aviso                                                                                  |
| Ver "X novos · Y já existiam" antes de gravar a importação                   | A mesma contagem no topo da sheet de conferência                                               |
| Corrigir a categoria e guardar a regra — toast com "Lembrar"                 | O mesmo toast, na faixa de baixo perto do polegar                                              |
| Buscar lançamento por descrição — campo acima da tabela                      | O mesmo campo, com 44px de altura                                                              |
| Filtrar por tipo, categoria, forma e faixa de valor                          | A mesma sheet, aberta pelo botão de filtros                                                    |
| Ver "Mostrando N de M" e limpar filtros                                      | O mesmo                                                                                        |
| Filtro na URL, para o voltar desfazer a busca                                | O mesmo                                                                                        |
| Orçamento do mês e "quanto sobra por dia" — cartão na aba Resumo             | O mesmo cartão, na aba **Resumo**                                                              |
| Definir/mudar o teto de gastos — botão no cartão                             | O mesmo botão, com 44px, abrindo a mesma sheet                                                 |
| Ver as faturas que vencem no mês — cartão na aba Resumo                      | O mesmo cartão, na aba **Resumo**                                                              |
| Marcar fatura como paga — botão no cartão da fatura                          | O mesmo botão, com 44px de altura                                                              |
| Ver "Gastei" e "Sai da conta" separados                                      | Os dois na faixa fixa: a faixa mostra "Sai da conta", e o cartão de Resumo mostra os dois      |
| Lançar compra parcelada — "Parcelar compra" na folha de lançamento           | A mesma folha e o mesmo campo, com − e + de 44px                                               |
| Ver em que fatura a compra cai, antes de salvar                              | O mesmo bloco, na mesma folha                                                                  |
| Ver competência × caixa antes de salvar ("gasto de agosto, sai em setembro") | O mesmo                                                                                        |
| Ver como as parcelas se dividem, antes de salvar                             | O mesmo                                                                                        |
| Ser avisado de que o lançamento é de outro mês                               | O mesmo aviso, na mesma folha                                                                  |
| Lançar ENTRADA pela mesma folha — botão "Entrada" no topo dela               | O mesmo botão, com 44px                                                                        |
| Ver "3/12" na linha do gasto                                                 | A mesma etiqueta no card                                                                       |
| Ver "fat. set" no gasto que vai para uma fatura                              | A mesma etiqueta no card                                                                       |
| Editar/excluir parcela — pergunta "só esta ou as N?"                         | O mesmo diálogo, com os botões empilhados e 44px cada                                          |
| Marcar vários lançamentos — botão "Marcar" no cabeçalho da tabela            | O mesmo botão, e o card inteiro vira alvo da marcação                                          |
| Ver quantos, quanto somam e de que recorte saíram                            | A mesma barra, presa acima da navegação (o FAB se recolhe)                                     |
| Categorizar em lote / trocar a forma em lote                                 | As mesmas ações, na mesma barra                                                                |
| Duplicar os marcados, com desfazer                                           | O mesmo                                                                                        |
| Excluir os marcados — confirmação que diz o escopo, e desfazer               | O mesmo diálogo, com botões de 44px                                                            |

## Comparativo anual

| No PC                                                               | No celular                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Ver os 12 meses — tabela de 4 colunas                               | Cards de duas linhas (mês + diferença / entrou + saiu)  |
| Totais e médias do REALIZADO — três cards lado a lado               | Faixa que desliza, com snap                             |
| Abrir um mês no controle mensal — clicar no nome                    | Tocar no card inteiro                                   |
| Abrir um mês — clique na linha da tabela **ou** no ponto do gráfico | Toque no card do mês **ou** tocando no ponto do gráfico |
| Exportar CSV — botão no cabeçalho                                   | Menu **⋯**                                              |
| Gráfico entrada × gastos, com média e tooltip                       | O mesmo gráfico                                         |
| Ver realizado e previsto separados, com o previsto escrito          | Os mesmos cartões, na faixa que desliza                 |
| Ver a variação vs o ano anterior, com a base entre parênteses       | O mesmo                                                 |
| Ler de onde saiu a comparação, o que é previsão e a tendência       | O mesmo bloco de leitura                                |
| Ver a faixa de "previsto" no gráfico                                | O mesmo                                                 |
| Ver uma categoria ao longo dos 12 meses — chips + barras            | Os mesmos chips, na faixa que rola de lado              |
| Ler que aquele bloco conta por competência, e não por caixa         | O mesmo aviso e o mesmo link para a ajuda               |

## Metas

| No PC                                                                     | No celular                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Editar os 12 meses de cada meta — grade meta × mês                        | Tocar no card da meta → sheet com os doze meses em campos de tamanho de dedo |
| Total guardado por mês — rodapé da grade                                  | Faixa deslizante com os doze meses                                           |
| Progresso de cada meta                                                    | O mesmo card                                                                 |
| Wishlist: nome, valor, prioridade e estado — linha de 5 colunas           | Card de faixas, com as estrelas e o estado em 44px                           |
| Ver o estado do desejo: quero comprar / estou juntando / conquistado      | O mesmo botão, na última faixa do card                                       |
| Ligar um desejo a uma meta — folha com as três opções                     | A mesma folha                                                                |
| Ver quanto a meta ligada já tem, e quanto isso cobre do desejo            | O mesmo                                                                      |
| Ser avisado quando a mesma meta banca dois desejos                        | O mesmo aviso, na mesma folha                                                |
| Prazo da meta — chip **Sem prazo / Até dez/26** embaixo do nome (Config.) | O mesmo chip, com 44px, no card da meta                                      |
| "Faltam R$ 4.200 em 7 meses — R$ 600 por mês" no card da meta             | O mesmo texto, no mesmo card                                                 |
| "No ritmo deste ano (R$ 800 por mês), chega em dez/25"                    | O mesmo — e some nos dois quando a base é pequena demais                     |
| Meta sem prazo: "Faltam R$ X" e, com base, o mês de chegada               | O mesmo — e some a segunda frase quando a base é pequena                     |
| "Guardar em <meta>" — botão no card, folha com os 12 meses                | O mesmo botão, com 44px, e a mesma folha                                     |
| "Resgatar ou transferir" — botão no cabeçalho da grade                    | O mesmo botão; é a MESMA folha do controle mensal                            |

## Configurações

| No PC                                                           | No celular                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ver as oito seções — coluna única com índice e scroll-spy (lg+) | Oito abas numa tira rolável, com apelido curto onde o nome não cabe                          |
| Criar categoria / forma / meta — linha de adição                | Botão de largura total → sheet                                                               |
| Editar — células inline                                         | Tocar no card → sheet                                                                        |
| Reordenar — setas ↑ ↓ na linha (aparecem no hover)              | **Subir** / **Descer** dentro da sheet                                                       |
| Excluir — lixeira na linha                                      | **Excluir** dentro da sheet, com confirmação que diz o que acontece com o que já foi lançado |
| Escolher a cor da categoria                                     | A mesma paleta de 16 tons (no PC atrás de um botão, no celular aberta na sheet)              |
| Tema de cor, com miniatura de cada um                           | O mesmo                                                                                      |
| Modo escuro                                                     | O mesmo                                                                                      |
| Nome do perfil — seção **Perfil**, separada de Aparência        | O mesmo                                                                                      |
| Ligar e desligar cada tipo de lembrete — seção **Lembretes**    | O mesmo, com a linha inteira em 44px como alvo do interruptor                                |
| Escolher a antecedência do aviso (0 a 15 dias)                  | O mesmo campo, com 44px de altura                                                            |
| Ver onde a importação mora, e ir até lá — seção **Dados**       | O mesmo card e o mesmo link                                                                  |
| Ver o e-mail da conta — seção **Segurança e sessão**            | O mesmo                                                                                      |
| Trocar a senha, com as duas validações antes de enviar          | O mesmo formulário, com campos de 44px                                                       |
| Sair da conta a partir das configurações                        | O mesmo botão (a moldura do app também tem o dela)                                           |

## Cartão de crédito

A fatura é opt-in por cartão: enquanto ela não é configurada, todas estas
linhas simplesmente não aparecem, e a tela é a de antes da fase 2.

| No PC                                                                | No celular                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Configurar fechamento e vencimento — chip embaixo do nome do cartão  | O mesmo chip no card da forma de pagamento, com 44px de altura |
| Escolher desde quando a fatura vale                                  | O mesmo, na mesma sheet                                        |
| Ver o exemplo ("compra em 20/08 → fatura de set/25") antes de salvar | O mesmo                                                        |
| Ver o aviso de que o app não conhece feriado                         | O mesmo                                                        |

## Lembretes de vencimento

O app já sabia o dia de vencimento do gasto fixo (0001) e o da fatura (0009), e
guardava para si. Os lembretes são cálculo puro sobre a data de hoje no aparelho
de quem está olhando — nada é agendado, nada é enviado. Só o mês corrente gera
aviso, e o que foi marcado como pago some.

| No PC                                                   | No celular                                             |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Painel **Vence por aqui**, no topo da aba Resumo do mês | O mesmo painel, no mesmo lugar                         |
| Cada linha leva à tela onde se resolve o vencimento     | O mesmo, com a linha inteira em 44px                   |
| Fatura fechando, fatura vencendo e gasto fixo vencendo  | Os mesmos três tipos                                   |
| O que venceu aparece em vermelho e não caduca           | O mesmo, com o cabeçalho virando **Tem coisa vencida** |
| Nenhum vencimento por perto — o painel some inteiro     | O mesmo: some, não vira card dizendo que não há nada   |
| Desligar cada tipo em Configurações → Lembretes         | O mesmo, na aba **Lembretes**                          |

## Sugestão de assinatura

Sai da aba **Fixos** do mês, acima da tabela — que é onde mora a resposta. A
detecção olha doze meses e tem seis travas (ver `src/lib/assinaturas.ts`), todas
inclinadas para o mesmo lado: **sugerir de menos**. Sugestão errada num app de
dinheiro custa mais que sugestão ausente.

| No PC                                                                | No celular                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Cartão "Isto parece uma assinatura", acima dos gastos fixos          | O mesmo cartão, na aba **Fixos**                               |
| **Virar gasto fixo** — nasce com nome, valor, dia, categoria e forma | O mesmo botão, com 44px de altura                              |
| Vigência começa no primeiro mês em que a cobrança apareceu           | O mesmo — a vigência não depende do tamanho da tela            |
| Aviso quando o valor oscilou ("Variou entre X e Y")                  | O mesmo                                                        |
| **Agora não** — dispensa, e a dispensa fica no perfil                | O mesmo; dispensar no celular vale no PC, por isso não é local |
| Nada repetido o bastante — o cartão não aparece                      | O mesmo: some, não vira card dizendo que não achou nada        |

## Backup e restauração

O arquivo é JSON versionado. Restaurar **nunca apaga nem altera** o que já
existe — só entra o que falta, e o mesmo arquivo pode ser restaurado duas vezes
sem duplicar. Duas defesas contra duplicata: o `id`, que viaja no arquivo, e a
impressão digital da `0008`, recalculada pelo conteúdo dos dois lados para pegar
a linha que existe aqui com outro id.

| No PC                                                                | No celular                        |
| -------------------------------------------------------------------- | --------------------------------- |
| **Baixar backup** — Configurações → Dados                            | O mesmo botão, com 44px           |
| **Restaurar de um arquivo** — seletor de arquivo do sistema          | O mesmo, com o seletor do celular |
| Prévia do que vai entrar, tabela por tabela — diálogo                | A mesma prévia, em sheet          |
| Arquivo que não é backup do finZ — frase dizendo o que fazer         | A mesma frase                     |
| **Trocar também minhas configurações** — a única parte que substitui | O mesmo, desmarcado por padrão    |
| Nada novo no arquivo — o botão diz "Nada para restaurar"             | O mesmo                           |

## Offline e versão nova

Ver `docs/offline.md` para o que funciona sem rede e por que gravar offline
ainda não entrou.

| No PC                                                     | No celular                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| Abrir o app sem rede e ver o mês já visitado              | O mesmo                                                             |
| Aviso de "sem internet" — canto inferior esquerdo         | O mesmo aviso, centralizado acima da barra inferior                 |
| Aviso de versão nova, com botão "Atualizar"               | O mesmo, com o botão em 44px                                        |
| Atalho para lançar gasto — paleta de comandos (⌘K) ou FAB | Atalho **Lançar gasto** ao segurar o ícone do app, que abre a folha |

## Ajuda

O manual é dado (`src/features/help/conteudo.ts`), não JSX: é isso que dá o que
buscar. Os assuntos ficam sempre abertos — sanfona fechada mata o Ctrl+F do
navegador, que é a busca que a pessoa já sabe usar.

Cada assunto tem endereço próprio (`/ajuda#fatura`), e é por ele que as outras
telas mandam para cá. Um teste varre a árvore atrás de todo `<LinkAjuda>` e
confere que o destino existe: link de ajuda quebrado é pior que link nenhum,
porque a página abre e não responde.

| No PC                                                      | No celular                        |
| ---------------------------------------------------------- | --------------------------------- |
| Buscar na ajuda — campo no topo                            | O mesmo campo, com 48px de altura |
| Ver o termo realçado no texto, com acento                  | O mesmo                           |
| Índice dos assuntos em pílulas                             | As mesmas pílulas, com 44px       |
| Abrir um assunto por link (`/ajuda#fatura`), destacado     | O mesmo                           |
| "Como a fatura é calculada" — no painel de faturas         | O mesmo link, no mesmo painel     |
| 'Por que "Gastei" e "Sai da conta" são diferentes'         | O mesmo link, no cartão de resumo |
| "O que o fechamento e o vencimento mudam" — configurações  | O mesmo                           |
| "O que entra, o que fica e o que nunca é apagado" — backup | O mesmo                           |

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
