import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

/** Segura a rota até a sessão ser resolvida; sem sessão, manda para /entrar. */
export function RotaProtegida({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session)
  const inicializado = useAuthStore((s) => s.inicializado)
  const local = useLocation()

  if (!inicializado) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Carregando sua conta…</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />

  return <>{children}</>
}
