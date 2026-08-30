# Offline: o que já funciona, e o risco de escrever offline

## O que a fase 3 entregou

**Consulta offline.** A casca do app (JS, CSS, fontes, ícones) fica em cache na
instalação, então o app abre sem rede. Os dados do mês usam `NetworkFirst` com 4
segundos de espera: com rede, o número é sempre o do servidor; sem rede, cai para
a última resposta guardada, e a tela avisa que está offline.

`NetworkFirst` e não `CacheFirst` porque isto é um app de dinheiro. Mostrar o
saldo de ontem como se fosse o de hoje é pior do que demorar meio segundo a mais.

**Escrever offline não funciona**, e é isso que esta nota discute.

## O que falta para escrever offline

Uma fila de sincronização: a gravação vai para uma fila local (IndexedDB), a tela
mostra o lançamento como se tivesse sido salvo, e o service worker despacha
quando a rede voltar.

A parte fácil é a fila. A parte difícil é o que acontece quando duas coisas
mexem no mesmo dado.

## Os quatro conflitos, em ordem de gravidade

**1. Edição concorrente do mesmo lançamento.** Você edita o valor de um gasto no
celular offline, e no PC edita o mesmo gasto para outro valor. Quando o celular
sincroniza, ele sobrescreve o PC — sem avisar ninguém, porque o `update` do
Supabase não sabe que havia outra versão. O número muda sozinho e não há registro
de que mudou. Esse é o pior caso: silencioso e sobre dinheiro.

Solução conhecida: coluna de versão (ou `updated_at`) e `update ... where versao
= X`, com a gravação falhando quando alguém passou na frente. Aí a tela precisa
mostrar as duas versões e perguntar. Isso é uma tela nova, não um detalhe.

**2. Excluído de um lado, editado do outro.** Você exclui o gasto no PC; o
celular, offline, edita esse mesmo gasto. Na sincronização o `update` não acha a
linha. Recriar ressuscita algo que a pessoa apagou de propósito; descartar joga
fora uma edição que ela fez de propósito. Não existe resposta certa sem
perguntar.

**3. A fila é uma ordem, e a ordem importa.** "Criar meta" e depois "aportar
nessa meta" só funciona nessa ordem — e o aporte se refere a um `goal_id` que
ainda não existe no servidor. Ou a fila carrega ids provisórios e os reescreve na
sincronização (mais código, mais lugar para errar), ou operações dependentes
ficam de fora e só as independentes vão para a fila.

**4. A fila falha no meio.** Cinco operações enfileiradas, a terceira é rejeitada
pelo banco (uma constraint, um limite de metas). As duas primeiras já entraram.
Parar deixa a fila travada para sempre; pular deixa o app em silêncio com um
lançamento que nunca existiu. Precisa de uma tela de "isto não deu para salvar" —
outra tela nova.

## Um risco a mais, específico deste app

A importação de CSV já tem impressão digital e índice único (0008), então
reimportar não duplica. Uma fila de sincronização **não** teria essa proteção nos
lançamentos avulsos: despachar duas vezes o mesmo "criar gasto" — porque o app
foi fechado entre o envio e a confirmação — cria dois gastos iguais. Resolver
isso pede uma chave de idempotência por operação enfileirada, gerada no cliente.

## Recomendação

**Não implementar agora.** O trabalho real não é a fila, são as duas telas de
resolução de conflito e a coluna de versão em todas as tabelas — e isso é do
tamanho de uma fase inteira, não de um item.

Antes disso, há uma pergunta de produto que vale responder primeiro: quantos
aparelhos você usa de fato? Se a resposta for "um celular, e o PC de vez em
quando", os conflitos 1 e 2 quase nunca acontecem, e uma fila simples com chave
de idempotência (resolvendo só o risco de duplicata) já entrega quase todo o
valor por uma fração do custo. Se forem dois aparelhos em uso paralelo — ou se um
dia houver conta compartilhada, ver `docs/conta-compartilhada.md` — aí a versão
completa é obrigatória, e fazer a simples primeiro seria trabalho jogado fora.

Enquanto isso, o comportamento atual é honesto: o app abre offline, mostra o que
tem, e diz que gravar precisa de rede.
