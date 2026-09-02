import { CalendarDays, HelpCircle, LayoutDashboard, LineChart, Settings, Target } from 'lucide-react'

/**
 * Os seis destinos do app, numa lista só.
 *
 * Antes três lugares desenhavam navegação — a barra lateral, as abas do
 * header e a barra inferior — e a lista de "quais destinos são diretos"
 * estava escrita à mão dentro da barra inferior, separada desta. As duas
 * envelheceram apartadas.
 *
 * Agora quem desenha é um componente só (o dock), e a divisão entre o que
 * fica à mão e o que fica atrás de "Mais" mora AQUI, junto dos destinos, e
 * não dentro de quem os pinta.
 *
 * `curto` existe porque o rótulo do dock divide a largura da tela com outros
 * quatro: "Comparativo anual" embaixo de um ícone de 20px vira reticências em
 * qualquer celular, e reticências não dizem nada. `rotulo` continua sendo o
 * nome inteiro — é ele que a paleta de comandos busca e que o leitor de tela
 * anuncia.
 */
export const NAVEGACAO = [
  { para: '/painel', rotulo: 'Painel', curto: 'Painel', Icone: LayoutDashboard, noDock: true },
  { para: '/mes', rotulo: 'Controle mensal', curto: 'Mês', Icone: CalendarDays, noDock: true },
  { para: '/metas', rotulo: 'Metas', curto: 'Metas', Icone: Target, noDock: true },
  { para: '/comparativo', rotulo: 'Comparativo anual', curto: 'Ano', Icone: LineChart, noDock: true },
  { para: '/configuracoes', rotulo: 'Configurações', curto: 'Ajustes', Icone: Settings, noDock: false },
  { para: '/ajuda', rotulo: 'Ajuda', curto: 'Ajuda', Icone: HelpCircle, noDock: false },
] as const

export type Destino = (typeof NAVEGACAO)[number]

/**
 * O que o dock carrega direto, e o que fica no "Mais".
 *
 * Quatro diretos e não seis: o dock flutua e não ocupa a largura toda, então
 * cada item a mais estreita todos os outros. Com quatro destinos + o botão
 * "Mais", cada alvo fica em 48px num aparelho de 320px — acima dos 44px que o
 * projeto exige — e ainda sobra folga para o rótulo curto caber sem truncar.
 *
 * Quais quatro é a mesma escolha que a barra inferior já fazia, de propósito:
 * isto é uma troca de navegação num app em uso, e mudar o desenho E a ordem
 * na mesma tacada obrigaria a reaprender duas coisas.
 */
export const DESTINOS_DO_DOCK = NAVEGACAO.filter((n) => n.noDock)
export const DESTINOS_NO_MAIS = NAVEGACAO.filter((n) => !n.noDock)
