import {
  CalendarDays,
  CreditCard,
  Database,
  Download,
  Keyboard,
  LineChart,
  ListChecks,
  Scale,
  Settings,
  Sparkles,
  Split,
  Target,
  Upload,
  WifiOff,
} from 'lucide-react'
import { MAX_METAS } from '@/lib/limites'
import { MAX_PARCELAS } from '@/lib/parcelamento'
import type { TopicoBuscavel } from '@/lib/busca-ajuda'

/**
 * O manual, como DADO.
 *
 * Estava como JSX espalhado pela página, e por isso a busca não tinha o que
 * buscar: o texto só existia depois de renderizado. Aqui ele é uma lista, a
 * busca filtra a lista, e a página só desenha o que sobrou.
 *
 * A regra editorial: este arquivo explica o que o app FAZ, nunca o que ele
 * deveria fazer. Uma ajuda que descreve uma versão imaginada é pior do que
 * ajuda nenhuma, porque a pessoa passa a duvidar do que está vendo na tela.
 * E ele não é o lugar onde uma decisão importante aparece pela primeira vez —
 * essa aparece na tela em que ela acontece; aqui fica a explicação longa.
 */

export type GrupoAjuda = 'conceitos' | 'telas' | 'detalhes'

export interface TopicoAjuda extends TopicoBuscavel {
  grupo: GrupoAjuda
  Icone: React.ComponentType<{ className?: string }>
  /** A tela de que o tópico fala, quando ele fala de uma. */
  para?: string
}

export const GRUPOS: Array<{ id: GrupoAjuda; titulo: string; descricao: string }> = [
  {
    id: 'conceitos',
    titulo: 'As ideias que o app usa',
    descricao: 'Cinco assuntos que explicam por que os números fazem o que fazem.',
  },
  { id: 'telas', titulo: 'Tela por tela', descricao: 'O que dá para fazer em cada lugar.' },
  { id: 'detalhes', titulo: 'Detalhes que economizam tempo', descricao: 'Atalhos e miudezas.' },
]

export const TOPICOS: TopicoAjuda[] = [
  // ------------------------------------------------------------- conceitos
  {
    id: 'competencia-e-caixa',
    grupo: 'conceitos',
    Icone: Scale,
    titulo: 'Competência e caixa',
    resumo: 'O mês em que você gastou nem sempre é o mês em que o dinheiro sai da conta.',
    sinonimos: ['não desconta', 'não descontou', 'saldo errado', 'gastei mas não saiu', 'regime'],
    corpo: [
      'Competência é o mês em que a compra aconteceu. É o que responde "onde meu dinheiro foi", e é por competência que os gastos aparecem na lista do mês e nos gráficos por categoria.',
      'Caixa é o mês em que o dinheiro sai da conta de verdade. É o que responde "quanto vai sair", e é por caixa que o saldo e o orçamento contam.',
      'Para quase tudo os dois são o mesmo mês. Quem separa os dois é o cartão de crédito: uma compra de agosto no crédito é gasto de agosto, mas só sai da conta quando a fatura vencer.',
      'É por isso que o resumo do mês mostra dois números diferentes: "Gastei" (competência) e "Sai da conta" (caixa). Quando eles não batem, a diferença é o que foi para uma fatura futura — e o app mostra esse valor com nome.',
    ],
  },
  {
    id: 'fatura',
    grupo: 'conceitos',
    Icone: CreditCard,
    titulo: 'Como a fatura do cartão é calculada',
    resumo: 'O dia do fechamento decide em qual fatura a compra cai. O vencimento só diz quando pagar.',
    sinonimos: ['crédito', 'cartao', 'fechamento', 'vencimento', 'quando vou pagar'],
    corpo: [
      'Você configura duas datas em cada cartão, nas Configurações: o dia do fechamento e o dia do vencimento.',
      'Compra feita ATÉ o dia do fechamento entra na fatura que vence no mês seguinte. Compra feita depois já é do ciclo seguinte, e vence um mês depois disso.',
      'O próprio dia do fechamento pertence à fatura que está fechando. É a convenção da maioria dos emissores, e é a que erra para o lado seguro: antecipa o gasto em vez de atrasá-lo.',
      'Fechamento no dia 31 num mês que não tem 31 vira o último dia daquele mês — não invade o mês seguinte.',
      'Se o vencimento cair num sábado ou domingo, o app mostra a segunda-feira seguinte. Feriado não entra na conta: exigiria um calendário que o app não tem, e chutar erraria mais do que acertaria.',
      'Um cartão sem dia de fechamento se comporta como dinheiro: o gasto pesa no próprio mês. É o padrão seguro, e a folha de lançamento avisa quando é o caso.',
      'Configurar o fechamento vale a partir do mês em que você configurou, e não para trás. Sem isso, preencher esse campo reescreveria de uma vez o mês de todo gasto de crédito do seu histórico.',
      'Ao lançar, a folha diz em que fatura a compra vai cair antes de você salvar. Na lista, o gasto que vai para uma fatura ganha a etiqueta "fat." com o mês.',
    ],
  },
  {
    id: 'parcelamento',
    grupo: 'conceitos',
    Icone: Split,
    titulo: 'Compras parceladas',
    resumo: 'Você informa o total da compra; o app cria uma linha por parcela, cada uma no seu mês.',
    sinonimos: ['parcelas', 'dividir', 'vezes', '12x', 'centavos'],
    corpo: [
      `Em "Parcelar compra", diga em quantas vezes (até ${MAX_PARCELAS}). O valor digitado continua sendo o TOTAL — é como a maquininha pergunta ("R$ 1.200 em 12x") e como a gente pensa.`,
      'São lançamentos de verdade, um por mês, e não uma compra só marcada como parcelada: cada parcela precisa cair na fatura do seu mês, senão o mês que você abre mostraria a compra inteira.',
      'Quando a divisão não é exata, a sobra de centavos vai na primeira parcela — que é como o cartão faz. A folha mostra a divisão antes de salvar ("1x de R$ 33,34 e 2x de R$ 33,33").',
      'Na lista, cada parcela aparece com a etiqueta "2/12". Sem ela, uma parcela é indistinguível de um gasto avulso que se repete todo mês.',
      'Ao editar ou excluir uma parcela, o app pergunta se é só esta ou a compra inteira — a mesma pergunta que um calendário faz num evento que se repete.',
      'Editar a série inteira muda descrição, forma e categoria. O valor fica de fora: mudar o total exige redividir tudo, e isso é apagar e recriar, não editar.',
      'Marcar várias parcelas e excluir em lote apaga exatamente as marcadas. O resto da série continua lá, e a confirmação diz isso antes.',
    ],
  },
  {
    id: 'backup',
    grupo: 'conceitos',
    Icone: Database,
    titulo: 'Backup e restauração',
    resumo:
      'Um arquivo com tudo, que você pode guardar ou levar para outra conta. Restaurar nunca apaga nada.',
    sinonimos: ['exportar tudo', 'json', 'trocar de conta', 'perdi os dados', 'importar backup'],
    corpo: [
      'Em Configurações, "Baixar backup" gera um arquivo JSON com tudo: lançamentos, gastos fixos, entradas, categorias, formas de pagamento, metas, aportes e wishlist.',
      'A regra que define a restauração: ela NUNCA apaga nem sobrescreve. Só entra o que falta. É isso que torna seguro clicar duas vezes por engano.',
      'Antes de gravar, a tela mostra o que vai entrar e o que já existe. O botão só libera depois disso.',
      'Duas defesas contra duplicata: o identificador de cada linha viaja no arquivo, e o app ainda compara o conteúdo — porque a mesma linha pode existir aqui com outro identificador (digitada de novo, ou vinda de um CSV reimportado depois do backup).',
      'Restaurar numa conta diferente funciona: o app refaz os vínculos entre as linhas (um aporte continua apontando para a meta certa) em vez de gravar referências que não existem do outro lado.',
      'Trocar as configurações (tema, orçamento, preferências) é uma escolha à parte na tela de restauração, e vem desmarcada.',
      'Um arquivo que não é backup do finZ é recusado antes de qualquer escrita.',
    ],
  },
  {
    id: 'offline',
    grupo: 'conceitos',
    Icone: WifiOff,
    titulo: 'O app sem internet',
    resumo: 'Dá para consultar o que já foi aberto. Lançar e editar ainda precisam de conexão.',
    sinonimos: ['sem rede', 'avião', 'metrô', 'não salva', 'pwa', 'instalar'],
    corpo: [
      'O app se instala como aplicativo (PWA) e abre sem rede: a casca fica guardada no aparelho.',
      'Os dados do mês são buscados no servidor primeiro, com quatro segundos de espera. Sem rede, o app cai para a última resposta guardada e avisa na tela que está offline.',
      'Buscar primeiro no servidor, e não no cache, é de propósito: isto é um app de dinheiro, e mostrar o saldo de ontem como se fosse o de hoje é pior do que esperar meio segundo.',
      'Escrever offline ainda NÃO funciona. Um lançamento feito sem conexão não é salvo, e a tela mostra o erro em vez de fingir que deu certo.',
      'O motivo de não existir ainda: uma fila de gravação é fácil; decidir o que fazer quando o celular offline e o PC editam o mesmo gasto é que não é. Enquanto não houver uma resposta que não perca dinheiro em silêncio, o app prefere recusar a escrita.',
    ],
  },

  // ----------------------------------------------------------------- telas
  {
    id: 'controle-mensal',
    grupo: 'telas',
    Icone: CalendarDays,
    titulo: 'Controle mensal',
    para: '/mes',
    resumo: 'A tela de trabalho: o que entrou, o que saiu e o que ainda vai sair no mês.',
    sinonimos: ['mes', 'lançar', 'gasto', 'entrada', 'fixo'],
    corpo: [
      'Escolha ano e mês no topo. No celular dá para deslizar de lado para trocar de mês, e as abas dividem a tela em Resumo, Entradas, Fixos, Gastos, Investir e Análise.',
      'Entradas: tudo que entrou. As sem data valem para o mês inteiro (salário); as com data vêm de lançamentos avulsos ou da importação de extrato.',
      'Entradas recorrentes: cadastre uma vez e diga desde quando vale. Assim um salário que começou em agosto não aparece em janeiro.',
      'Gastos fixos: cadastre uma vez, com o dia do vencimento e desde quando paga (e até quando, se já encerrou). O "pago?" é marcado mês a mês.',
      'Gastos do mês: no PC, digite na última linha e pressione Enter; no celular, toque no botão "+". Tocar num gasto abre a folha de edição.',
      'Investimentos: informe quanto guardou em cada meta. Dá para resgatar ou transferir entre metas pelo botão da própria seção.',
      'Filtros não mudam os totais do mês. O que você filtra é a lista; o resumo continua sendo do mês inteiro, senão digitar no campo de busca pareceria fazer dinheiro sumir.',
    ],
  },
  {
    id: 'lancar',
    grupo: 'telas',
    Icone: CreditCard,
    titulo: 'Lançar um gasto ou uma entrada',
    para: '/mes?aba=gastos&novo=1',
    resumo: 'A mesma folha nos dois tamanhos, e ela diz o que vai acontecer antes de você salvar.',
    sinonimos: ['novo gasto', 'adicionar', 'cadastrar', 'consequencia'],
    corpo: [
      'A folha abre pelo botão "+" no celular e por "Lançar gasto" no PC. O campo de valor já vem com o foco: é a única coisa que a gente sempre sabe na hora.',
      'O primeiro botão escolhe entre Gasto e Entrada. Entrada com data tem descrição, valor e dia — é o que a tabela de Entradas mostra dela.',
      'Forma de pagamento e categoria são botões, não listas: um toque em vez de abrir um menu. Tocar de novo no que já está escolhido limpa a escolha.',
      'Antes do botão de salvar, o app diz o que vai acontecer: em que fatura a compra cai, que o gasto é de um mês e sai da conta em outro, como as parcelas se dividem, e se o lançamento é de outro mês (aí ele não vai aparecer na lista que está aberta).',
      'Quando não há nada de inesperado — um gasto à vista, no débito, no mês aberto — a folha fica calada. Aviso que aparece sempre deixa de ser lido.',
      '"Salvar e lançar outro" mantém forma, categoria e data preenchidas: lançar vários seguidos é o caso comum.',
    ],
  },
  {
    id: 'filtros-e-lote',
    grupo: 'telas',
    Icone: ListChecks,
    titulo: 'Achar lançamentos e mudar vários de uma vez',
    para: '/mes?aba=gastos',
    resumo: 'Busca, filtros e ações em lote — o caminho para arrumar um extrato recém-importado.',
    sinonimos: ['selecionar', 'marcar', 'categorizar', 'excluir varios', 'duplicar', 'buscar'],
    corpo: [
      'A busca por descrição ignora acento e maiúscula: quem digita "farmacia" acha "Drogaria Farmácia São Paulo".',
      'Os filtros somam critérios: categoria "Mercado" e valor acima de R$ 100 traz as compras de mercado acima de R$ 100.',
      '"Só os sem categoria" e "só os sem forma de pagamento" são os filtros que achamos o que ficou para trás depois de importar um extrato.',
      'O filtro fica no endereço da página: o botão voltar desfaz a busca em vez de sair da tela, e o link leva alguém direto ao mesmo recorte.',
      '"Marcar" liga a seleção. A barra que aparece diz quantos estão marcados, quanto eles somam e de que recorte saíram.',
      'Com os marcados dá para trocar a categoria, trocar a forma de pagamento, duplicar e excluir. Duplicar e excluir têm "desfazer".',
      'Marcado que sai da tela (porque você trocou de mês ou apertou o filtro) sai da seleção. Nenhuma ação em lote toca no que você não está vendo.',
      'A cópia de uma parcela sai solta, sem o vínculo com a compra parcelada — e o app avisa quando é o caso.',
    ],
  },
  {
    id: 'importar',
    grupo: 'telas',
    Icone: Upload,
    titulo: 'Importar extrato em CSV',
    para: '/mes',
    resumo: 'Traga o extrato do banco ou do cartão, com prévia antes de gravar.',
    sinonimos: ['csv', 'extrato', 'planilha', 'duplicado'],
    corpo: [
      'A tela mostra uma prévia do que entendeu do arquivo antes de gravar qualquer coisa.',
      'O app reconhece o que já foi importado antes pelo conteúdo da linha, e não importa a mesma coisa duas vezes. Mandar o mesmo arquivo de novo completa o que faltou em vez de duplicar.',
      'Extrato de banco costuma não trazer categoria nem forma de pagamento. Depois de importar, use o filtro "só os sem categoria" e a marcação em lote — ou "Preencher em bloco", que aplica regras.',
      'Quando você corrige a categoria de um gasto, o app oferece guardar aquilo como regra para a próxima importação. É uma oferta, não uma pergunta: aparece por alguns segundos e some.',
    ],
  },
  {
    id: 'comparativo',
    grupo: 'telas',
    Icone: LineChart,
    titulo: 'Comparativo anual',
    para: '/comparativo',
    resumo: 'Os 12 meses lado a lado, com o que já aconteceu e o que está previsto.',
    sinonimos: ['ano', 'grafico', 'evolução', 'tendencia', 'ano passado', 'comparar'],
    corpo: [
      'Mostra os 12 meses com entrada, gastos e a diferença entre os dois.',
      'Meses no vermelho (saiu mais do que entrou) ficam destacados.',
      'Meses futuros aparecem como "previsto": eles já contam os gastos fixos que se repetem, porque esses são os únicos que dá para saber com antecedência. No gráfico, a faixa cinza marca onde a previsão começa.',
      'Os três números do topo são do REALIZADO — só os meses que já aconteceram. O que ainda vai acontecer aparece embaixo, escrito como previsão, para o total não misturar fato com estimativa.',
      'A comparação com o ano anterior usa só os meses que já aconteceram E tiveram movimento nos dois anos. A tela diz quais meses entraram na conta: comparar três meses contra doze daria um número bonito e falso.',
      'Quando o ano anterior era zero naquele recorte, o app mostra a diferença em reais em vez de um percentual — sair de R$ 0 não é "aumento de X%".',
      'A tendência compara a média dos três últimos meses com movimento contra a dos três anteriores. Ela só aparece com seis meses de movimento, e variação abaixo de 5% é chamada de estável: é ruído do mês, não tendência.',
      'O bloco "Uma categoria ao longo do ano" mostra os doze meses de uma categoria só, para responder "o mercado está subindo?". Ele conta pela DATA DA COMPRA, e não pelo vencimento da fatura — diferente dos números do topo da tela, e por isso está escrito ali.',
      'Clicar no mês — na tabela, no card ou no ponto do gráfico — abre aquele mês no controle mensal.',
      '"Exportar CSV" aqui baixa o ano inteiro.',
    ],
  },
  {
    id: 'metas',
    grupo: 'telas',
    Icone: Target,
    titulo: 'Metas e wishlist',
    para: '/metas',
    resumo: 'Onde o dinheiro guardado vai parar, e a lista do que você quer comprar.',
    sinonimos: ['juntar', 'guardar', 'objetivo', 'prazo', 'sonho', 'desejo', 'quero comprar'],
    corpo: [
      `Metas: até ${MAX_METAS}, com valor-alvo. A grade mostra quanto foi guardado em cada uma, mês a mês, e é editável ali mesmo.`,
      'Editar uma célula da grade é a mesma coisa que editar em "Investimentos do mês" — são o mesmo dado, vistos de dois lugares.',
      'Uma meta pode ter prazo (mês e ano). Com prazo, o card diz quanto falta guardar por mês para chegar lá, e como está o ritmo atual.',
      'Sem prazo, o card diz quanto falta e — se houver histórico — em que mês você chega no ritmo deste ano.',
      'A projeção só aparece quando há histórico suficiente para ela significar alguma coisa: pelo menos três meses decorridos e algum valor guardado. Sem base, o app não chuta.',
      '"Guardar em <meta>", no card, lança o aporte em dois toques. O campo abre com o valor que o mês já tem, porque ele SUBSTITUI aquele mês — não soma.',
      '"Resgatar ou transferir" tira dinheiro de uma meta ou move entre duas. Resgatar reduz o total investido do mês; transferir não muda o total, só troca de meta. O movimento entra no mês de hoje.',
      'Wishlist é o que você QUER comprar: nome, valor e prioridade de 1 a 5 estrelas. Ela não é dinheiro comprometido — não sai de nenhum saldo e não entra em nenhum total do mês.',
      'Cada desejo tem três estados: "quero comprar" (só a vontade, nenhum dinheiro separado), "estou juntando" (ligado a uma meta, e o quanto ela já tem aparece ali) e "conquistado".',
      'Ligar um desejo a uma meta é o que faz o valor guardado aparecer nele. O botão de estado, na linha do desejo, abre as três opções.',
      'Se a mesma meta banca dois desejos, o app avisa: o dinheiro guardado é o mesmo para os dois, ele não se divide sozinho.',
      'Apagar uma meta não apaga o desejo ligado a ela — ele volta a ser "quero comprar". A vontade continua; o plano de juntar é que acabou.',
      'Marcar um item da wishlist como conquistado só muda o item. Se a compra aconteceu, ela precisa ser lançada como gasto, como qualquer outra.',
    ],
  },
  {
    id: 'configuracoes',
    grupo: 'telas',
    Icone: Settings,
    titulo: 'Configurações',
    para: '/configuracoes',
    resumo: 'Perfil, aparência, lembretes, categorias, cartões, metas, dados e sessão.',
    sinonimos: ['tema', 'escuro', 'limite', 'orçamento', 'apagar tudo', 'senha', 'sair', 'conta'],
    corpo: [
      'São oito seções, na ordem do que é seu para o que é irreversível. No PC elas ficam numa coluna com um índice ao lado; no celular viram abas que deslizam.',
      'Perfil: o nome pelo qual o app te chama, e o botão que reabre o guia de primeiro acesso.',
      'Aparência: tema rosa, azul, verde ou roxo — e modo escuro, que combina com qualquer um. A densidade só existe de tablet para cima, porque é lá que ela muda alguma coisa.',
      'Lembretes: escolha com quantos dias de antecedência o app avisa de faturas e gastos fixos que vencem, e quais tipos você quer ver.',
      'Categorias e limites: nome, cor e limite mensal (opcional). A barra da categoria fica amarela a partir de 80% do limite e vermelha quando estoura.',
      'Formas de pagamento: crie uma linha por cartão (Crédito 1, Crédito 2…) para separar as saídas. É aqui que entram o dia do fechamento e o do vencimento.',
      'Importação e dados: baixar backup, restaurar de um arquivo e apagar tudo. A importação de extrato em si acontece no controle mensal, porque cada arquivo entra num mês — e esta seção leva até lá.',
      'Segurança e sessão: ver o e-mail da conta, trocar a senha e sair. Trocar o e-mail e encerrar a conta não são feitos pelo app; "apagar dados" limpa o que é seu sem encerrar a conta.',
      'Trocar a senha não pede a senha antiga: quem já está com a sessão aberta já provou quem é. A defesa contra sessão roubada é sair da conta, que está ali do lado.',
    ],
  },

  // -------------------------------------------------------------- detalhes
  {
    id: 'primeiro-acesso',
    grupo: 'telas',
    Icone: Sparkles,
    titulo: 'O guia de primeiro acesso',
    para: '/configuracoes',
    resumo: 'Sete passos para deixar o app com a sua cara. Todos puláveis.',
    sinonimos: ['comecar', 'início', 'configurar', 'tutorial', 'primeiros passos'],
    corpo: [
      'Ele aparece uma vez, na conta nova: nome, orçamento do mês, sua entrada que se repete, categorias, limites, avisos de vencimento e o primeiro gasto.',
      'Nenhum passo é obrigatório. "Pular este passo" avança sem gravar nada, e "Fazer isto depois" encerra o guia de vez.',
      'O estado de cada passo é lido do que existe na sua conta, não de um progresso guardado. Se você configurar o orçamento pelas Configurações, o passo aparece pronto sem o guia precisar saber.',
      'Por isso ele é retomável: fechar no meio e voltar amanhã mostra exatamente o que ainda falta, em qualquer aparelho.',
      'O último passo leva à folha de lançamento de verdade, e não a uma cópia menor dela.',
      'Para abrir de novo: Configurações → Perfil → "Abrir o guia de novo". Ele continua servindo como lista do que ainda falta configurar.',
    ],
  },
  {
    id: 'atalhos',
    grupo: 'detalhes',
    Icone: Keyboard,
    titulo: 'Atalhos de teclado',
    resumo: 'As tabelas do PC funcionam como uma planilha.',
    sinonimos: ['teclado', 'enter', 'tab'],
    corpo: [
      'Enter vai para a próxima célula e salva o que você digitou.',
      'Shift + Enter volta para a célula anterior.',
      'Tab anda pelos campos na ordem natural.',
      'As setas ↑ e ↓ sobem e descem mantendo a mesma coluna.',
    ],
  },
  {
    id: 'valores-e-exportacao',
    grupo: 'detalhes',
    Icone: Download,
    titulo: 'Campos de valor e exportação',
    resumo: 'Como digitar dinheiro, e o que sai nos arquivos.',
    sinonimos: ['virgula', 'centavo', 'excel', 'exportar'],
    corpo: [
      'Os campos de valor funcionam como em caixa eletrônico: os dígitos entram da direita para a esquerda, então digitar "150" vira R$ 1,50.',
      'Todo valor é guardado em centavos inteiros, do começo ao fim. O app nunca usa número quebrado para dinheiro, e por isso a soma das parcelas fecha exatamente com o total.',
      '"Exportar CSV" no controle mensal baixa o mês inteiro; no comparativo, o ano.',
      'O arquivo usa ponto e vírgula e abre direto no Excel em português.',
    ],
  },
]

/** Um tópico pelo id — é assim que outras telas apontam para a explicação. */
export function topicoPorId(id: string): TopicoAjuda | undefined {
  return TOPICOS.find((t) => t.id === id)
}
