import { NavLink } from 'react-router-dom'
import { LogOut, Moon, Search, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Marca } from '@/components/common/marca'
import { NAVEGACAO } from './navegacao'
import { DicaAtalho } from './paleta-comandos'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

/**
 * Navegação de tela grande (D1).
 *
 * A partir de lg a barra de abas do topo dá lugar a esta coluna. Motivo: as
 * abas roubavam ~112px de ALTURA de toda página — a dimensão escassa num
 * monitor deitado — para mostrar seis destinos, enquanto sobrava largura de
 * lado. Aqui os mesmos seis viram uma lista vertical, o nome de cada um cabe
 * inteiro e a altura volta para o conteúdo.
 *
 * `sticky top-0 h-dvh` e não `fixed`: assim ela participa do flex do shell e
 * ninguém precisa repetir a largura dela como padding do conteúdo.
 */
export function BarraLateral({ className }: { className?: string }) {
  const perfil = useAuthStore((s) => s.profile)
  const sair = useAuthStore((s) => s.sair)
  const escuro = useTemaStore((s) => s.escuro)
  const alternarEscuro = useTemaStore((s) => s.alternarEscuro)

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-border bg-card/40',
        'pl-[env(safe-area-inset-left)]',
        className,
      )}
    >
      <div className="px-4 py-5">
        <NavLink to="/painel" aria-label="finZ — ir para o painel">
          <Marca />
        </NavLink>
      </div>

      {/* Só um lembrete de que o atalho existe: quem clica cai na mesma paleta
          que o ⌘K abre (o evento é global, em paleta-comandos.tsx). */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
          }
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-realce"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Buscar…</span>
          <DicaAtalho />
        </button>
      </div>

      <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {NAVEGACAO.map(({ para, rotulo, Icone }) => (
            <li key={para}>
              <NavLink
                to={para}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary-soft font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icone className="h-4 w-4 shrink-0" />
                {rotulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-1 border-t border-border px-3 py-3">
        <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">
          {perfil?.nome || 'Minha conta'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={alternarEscuro}
          aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void sair()} aria-label="Sair da conta">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}
