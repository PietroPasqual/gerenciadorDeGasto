import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  Settings,
  Sun,
  Target,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
          <NavLink to="/painel" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="titulo-serif text-lg">Gerenciador de Gastos</span>
          </NavLink>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={alternarEscuro}
              aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground sm:inline">
              {perfil?.nome || 'Minha conta'}
            </span>
            <Button variant="ghost" size="icon" onClick={() => void sair()} aria-label="Sair da conta">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navegação — vira barra rolável no mobile, sem quebrar o layout */}
        <nav
          className="container fade-scroll-x flex gap-1 overflow-x-auto pb-2"
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
