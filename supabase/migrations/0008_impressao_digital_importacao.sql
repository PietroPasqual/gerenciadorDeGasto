-- ---------------------------------------------------------------------
-- 0008 — importação de extrato deixa de duplicar
--
-- O PROBLEMA
--
-- `criarLancamentosEmLote` grava em blocos de 200. Se o quinto bloco
-- falhar, os quatro primeiros já entraram — e a única saída para o
-- usuário é reimportar o arquivo, o que duplica os quatro. A checagem de
-- repetido que existe hoje é só do lado do cliente: ela compara o
-- arquivo com o que já está na tela, então uma importação feita em outro
-- aparelho, ou uma que morreu no meio, passa batido.
--
-- A SOLUÇÃO
--
-- Uma impressão digital por lançamento importado, e um índice único que
-- deixa o banco recusar a segunda cópia. O cálculo está em
-- `src/lib/impressao-digital.ts`: FNV-1a de 64 bits sobre
-- `data | descrição normalizada | valor_centavos | tipo | ocorrência`.
--
-- OS DOIS CAFÉS
--
-- Dois gastos iguais no mesmo dia pelo mesmo valor existem de verdade, e
-- descartar o segundo seria apagar dinheiro que saiu. Por isso a
-- `ocorrência` entra na chave: dentro de um arquivo, o primeiro café do
-- dia é 1 e o segundo é 2, então os dois têm impressão diferente e os
-- dois entram. Reimportar o MESMO arquivo recalcula 1 e 2 na mesma
-- ordem, as duas impressões colidem, e nenhuma das duas entra de novo.
--
-- O limite conhecido: um arquivo NOVO que traga um terceiro café igual
-- no mesmo dia calcula ocorrência 1, colide com o café que já está no
-- banco e é ignorado. Isso só acontece quando dois arquivos se
-- sobrepõem parcialmente no mesmo dia. A tela de conferência mostra a
-- contagem de ignorados justamente para esse caso não passar em
-- silêncio.
--
-- POR QUE O ÍNDICE NÃO É PARCIAL
--
-- A vontade era `where fingerprint is not null`, mas `ON CONFLICT` só
-- infere um índice parcial se a consulta repetir o mesmo WHERE — e o
-- PostgREST não tem como mandar isso. Índice total resolve sozinho: no
-- Postgres, NULLs são distintos entre si num índice único, então as
-- linhas antigas (todas com fingerprint NULL) convivem sem conflito
-- nenhum, quantas forem.
--
-- REGRA 8: NADA MUDA PARA O QUE JÁ EXISTE
--
-- A coluna nasce nula e não há backfill. Lançamento antigo continua com
-- fingerprint NULL e comportamento idêntico ao de hoje; a proteção vale
-- do próximo import em diante. Reimportar por cima de um extrato antigo
-- ainda depende da checagem do cliente, que continua no lugar.
-- ---------------------------------------------------------------------

alter table public.transactions
  add column if not exists fingerprint text;

comment on column public.transactions.fingerprint is
  'Impressão digital do lançamento importado (ver src/lib/impressao-digital.ts). '
  'NULL em lançamento lançado à mão e em tudo que é anterior à 0008.';

create unique index if not exists transactions_user_fingerprint_idx
  on public.transactions (user_id, fingerprint);
