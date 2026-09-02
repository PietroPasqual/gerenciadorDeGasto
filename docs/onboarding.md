# Primeiro acesso guiado (implementado — migration `0022`)

> Esta nota substitui a proposta anterior, escrita antes de o guia existir. As
> regras que ela defendia — pulável, retomável, idempotente, sem dado fictício
> — continuam valendo; o que mudou foi a forma de garanti-las.

## O que ele resolve

Quem cria conta caía direto num painel de mês vazio. A `0004` semeia categorias
e formas de pagamento, então a tela não estava literalmente em branco — mas
nada nela ainda era da pessoa: nome genérico, nenhum orçamento, nenhuma entrada
recorrente, lembretes com o padrão da `0017` que ninguém confirmou.

O guia é uma lista de sete passos: nome, orçamento, entrada recorrente,
categorias, limites, lembretes e o primeiro gasto.

## A decisão que organiza tudo: o estado é DERIVADO, não guardado

O óbvio seria guardar "em que passo a pessoa está". Isso cria uma segunda
verdade que envelhece — o ponteiro diria "passo 2" enquanto o orçamento do
passo 2 já existe, e a tela pediria de novo algo já feito.

Em vez disso, cada passo pergunta ao dado real: tem nome? tem orçamento? tem
entrada recorrente? alguma categoria com limite? algum lançamento? Quem
configurou o orçamento pelas Configurações volta ao guia e encontra o passo
pronto, sem ninguém ter avisado o guia.

Três propriedades saem daí de graça:

- **Retomável** — não há progresso para perder. Fechar no meio e voltar amanhã
  mostra exatamente o que ainda falta.
- **Idempotente** — salvar duas vezes escreve o mesmo dado no mesmo lugar,
  porque cada passo usa os mesmos serviços que as Configurações usam. O guia
  não é um caminho de escrita novo; é uma ordem sugerida por cima do que existe.
- **Honesto** — ele nunca afirma que algo está configurado quando não está.

## Os dois passos que não dão para derivar

Categorias e lembretes já nascem preenchidos (`0004` e `0017`), e "está bom
assim" é uma resposta legítima. Não há nada no dado que distinga "conferi e
gostei" de "nunca olhei".

Para esses existe `profiles.onboarding_vistos`, um `text[]` que guarda só o "eu
olhei isto". Ele **nunca contradiz o dado**, porque só acrescenta: um passo é
feito se o dado diz que sim **ou** se está na lista.

## O que a `0022` guarda

| Coluna              | Para quê                                                             |
| ------------------- | -------------------------------------------------------------------- |
| `onboarding_em`     | Quando o guia foi encerrado — concluído OU dispensado. NULL = nunca. |
| `onboarding_vistos` | Os passos resolvidos sem mudar dado.                                 |

Quem já usava o app nunca vê o guia: a migration marca toda conta existente
como encerrada. Empurrar uma configuração inicial para quem tem um ano de
lançamentos seria ruído, não ajuda.

## Regras que o código cumpre, e onde

- **Nunca grava dado de exemplo.** "Pular" não escreve valor nenhum — só avança.
  Campo em branco fica em branco.
- **Tudo é pulável.** Todo passo tem `opcional: true`, e "Fazer isto depois"
  encerra de vez.
- **Abre uma vez por sessão.** A decisão é tomada na primeira leitura do perfil
  e não é revista: uma gravação posterior que devolvesse um perfil parcial
  reabriria o guia por cima do que a pessoa está fazendo.
- **O último passo sai do guia.** "Lançar meu primeiro gasto" leva à folha de
  verdade (`?novo=1`, o mesmo atalho do manifest). Uma cópia menor dela, sem
  parcelas, fatura e consequências, ensinaria o app errado.
- **Dá para reabrir.** Configurações → Perfil → "Abrir o guia de novo". Sem essa
  porta ele seria irrecuperável, e ele continua útil no terceiro mês de uso —
  é a lista do que ainda falta configurar.

## Onde está

- Regra pura e testada: `src/lib/onboarding.ts`
- Leituras e escritas: `src/features/onboarding/use-guia.ts`
- Tela: `src/features/onboarding/guia-primeiro-acesso.tsx`
- Montagem: `src/components/layout/layout-app.tsx`
