import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  Menu,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Topo */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* No celular tudo cabe num menu só: a barra de abas não cabia na
                largura da tela e vinha cortada no meio de "Comparativo anual". */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button variant="ghost" size="icon" className="-ml-2" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[15rem]">
                {NAVEGACAO.map(({ para, rotulo, Icone }) => {
                  const ativo = local.pathname === para
                  return (
                    <DropdownMenuItem key={para} asChild>
                      <NavLink
                        to={para}
                        className={cn(ativo && 'bg-primary-soft font-medium text-accent-foreground')}
                      >
                        <Icone className={cn(!ativo && 'text-muted-foreground')} />
                        {rotulo}
                      </NavLink>
                    </DropdownMenuItem>
                  )
                })}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="normal-case tracking-normal">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {perfil?.nome || 'Minha conta'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={alternarEscuro}>
                  {escuro ? <Sun /> : <Moon />}
                  {escuro ? 'Tema claro' : 'Tema escuro'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void sair()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut />
                  Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <NavLink to="/painel" aria-label="finZ — ir para o painel">
              <Marca />
            </NavLink>
          </div>

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

        </div>

        {/* Navegação em abas só a partir de sm; no celular ela vive no menu ☰
            acima, senão os últimos itens ficam fora da tela. */}
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

      {/* Conteúdo com transição de página */}
      <motion.main
        key={local.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="container space-y-6 py-6 sm:py-8"
      >
        <Outlet />
      </motion.main>
    </div>
  )
}
