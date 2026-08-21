import { CalendarDays, HelpCircle, LayoutDashboard, LineChart, Settings, Target } from 'lucide-react'

/**
 * Os seis destinos do app, numa lista só.
 *
 * Três lugares desenham navegação — a barra lateral (lg+), as abas do header
 * (sm..lg) e a barra inferior do celular — e uma tela nova tem que aparecer
 * nos três. Com a lista repetida, some de um deles e ninguém percebe.
 */
export const NAVEGACAO = [
  { para: '/painel', rotulo: 'Painel', Icone: LayoutDashboard },
  { para: '/mes', rotulo: 'Controle mensal', Icone: CalendarDays },
  { para: '/comparativo', rotulo: 'Comparativo anual', Icone: LineChart },
  { para: '/metas', rotulo: 'Metas', Icone: Target },
  { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings },
  { para: '/ajuda', rotulo: 'Ajuda', Icone: HelpCircle },
] as const
