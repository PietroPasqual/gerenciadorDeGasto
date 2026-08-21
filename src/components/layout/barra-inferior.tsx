import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  Target,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

/** Os três destinos mais usados ficam diretos; o resto vive em "Mais". */
const DIRETOS = [
  { para: '/painel', rotulo: 'Painel', Icone: LayoutDashboard },
  { para: '/mes', rotulo: 'Mês', Icone: CalendarDays },
  { para: '/metas', rotulo: 'Metas', Icone: Target },
]

const EM_MAIS = [
  { para: '/comparativo', rotulo: 'Comparativo anual', Icone: LineChart },
  { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings },
  { para: '/ajuda', rotulo: 'Ajuda', Icone: HelpCircle },
]

/**
 * Navegação inferior do celular. Fica embaixo porque é onde o polegar chega —
 * o menu antigo vivia no canto superior, o ponto mais distante da mão.
 */
export function BarraInferior() {
  const [mais, setMais] = React.useState(false)
  const local = useLocation()
  const perfil = useAuthStore((s) => s.profile)
  const sair = useAuthStore((s) => s.sair)
  const escuro = useTemaStore((s) => s.escuro)
  const alternarEscuro = useTemaStore((s) => s.alternarEscuro)

  const emMais = EM_MAIS.some((i) => i.para === local.pathname)

  const classeItem = (ativo: boolean) =>
    cn(
      'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.6875rem] transition-colors',
      ativo ? 'bg-primary-soft font-medium text-accent-foreground' : 'text-muted-foreground',
    )

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur sm:hidden',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <div className="flex items-stretch gap-1 px-2 pt-1">
          {DIRETOS.map(({ para, rotulo, Icone }) => (
            <NavLink key={para} to={para} className={({ isActive }) => classeItem(isActive)}>
              <Icone className="h-5 w-5" />
              {rotulo}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMais(true)} className={classeItem(emMais)}>
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      <Sheet open={mais} onOpenChange={setMais}>
        <SheetContent>
          <SheetTitle className="mb-3">Mais</SheetTitle>

          <div className="space-y-1">
            {EM_MAIS.map(({ para, rotulo, Icone }) => (
              <NavLink
                key={para}
                to={para}
                onClick={() => setMais(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[3rem] items-center gap-3 rounded-xl px-3 text-corpo',
                    isActive ? 'bg-primary-soft font-medium text-accent-foreground' : 'hover:bg-accent',
                  )
                }
              >
                <Icone className="h-5 w-5 shrink-0" />
                {rotulo}
              </NavLink>
            ))}
          </div>

          <div className="my-3 h-px bg-border" />

          <p className="px-3 pb-1 text-rotulo uppercase text-muted-foreground">
            {perfil?.nome || 'Minha conta'}
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={alternarEscuro}
              className="flex min-h-[3rem] w-full items-center gap-3 rounded-xl px-3 text-left text-corpo hover:bg-accent"
            >
              {escuro ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              {escuro ? 'Tema claro' : 'Tema escuro'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMais(false)
                void sair()
              }}
              className="flex min-h-[3rem] w-full items-center gap-3 rounded-xl px-3 text-left text-corpo text-destructive hover:bg-accent"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Sair da conta
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
