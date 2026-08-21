import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  MoreVertical,
  Moon,
  Settings,
  Sun,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Marca } from '@/components/common/marca'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BarraInferior } from './barra-inferior'
import { useAcoesPagina } from '@/store/acoes-pagina'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

const NAVEGACAO = [
  { para: '/painel', rotulo: 'Painel', Icone: LayoutDashboard },
  { para: '/mes', rotulo: 'Controle mensal', Icone: CalendarDays },
  { para: '/comparativo', rotulo: 'Comparativo anual', Icone: LineChart },
  { para: '/metas', rotulo: 'Metas', Icone: Target },
  { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings },
  { para: '/ajuda', rotulo: 'Ajuda', Icone: HelpCircle },
]

export function LayoutApp() {
  const perfil = useAuthStore((s) => s.profile)
  const sair = useAuthStore((s) => s.sair)
  const escuro = useTemaStore((s) => s.escuro)
  const alternarEscuro = useTemaStore((s) => s.alternarEscuro)
  const local = useLocation()
  const acoesPagina = useAcoesPagina()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <NavLink to="/painel" aria-label="finZ — ir para o painel">
            <Marca />
          </NavLink>

          {/* Telas grandes: as ações ficam à mostra, há espaço de sobra. */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={alternarEscuro}
              aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <span className="max-w-[10rem] truncate text-sm text-muted-foreground">
              {perfil?.nome || 'Minha conta'}
            </span>
            <Button variant="ghost" size="icon" onClick={() => void sair()} aria-label="Sair da conta">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* No celular a navegação foi para a barra de baixo; o que sobra aqui
              são as ações da PÁGINA atual (exportar CSV etc.), que no desktop
              ficam no cabeçalho dela. Sem isso elas não teriam lugar no
              celular — ver a regra de paridade. */}
          {acoesPagina.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Ações desta tela">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[14rem]">
                <DropdownMenuLabel>Nesta tela</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {acoesPagina.map((acao) => (
                  <DropdownMenuItem
                    key={acao.id}
                    disabled={acao.desabilitada}
                    onSelect={acao.executar}
                    className="min-h-[2.75rem]"
                  >
                    {acao.Icone && <acao.Icone />}
                    {acao.rotulo}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Abas só a partir de sm; no celular a navegação é a barra inferior. */}
        <nav
          className="container fade-scroll-x hidden gap-1 overflow-x-auto pb-2 sm:flex"
          aria-label="Navegação principal"
        >
          {NAVEGACAO.map(({ para, rotulo, Icone }) => (
            <NavLink
              key={para}
              to={para}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary-soft font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </NavLink>
          ))}
        </nav>
      </header>

      <motion.main
        key={local.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        // pb generoso no celular: a barra inferior é fixa e cobriria o fim da página.
        className="container space-y-6 py-6 pb-28 sm:py-8 sm:pb-8"
      >
        <Outlet />
      </motion.main>

      <BarraInferior />
    </div>
  )
}
