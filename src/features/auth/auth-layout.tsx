import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wallet } from 'lucide-react'

export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string
  descricao: string
  children: React.ReactNode
  rodape?: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Coluna decorativa (some no mobile) */}
      <div className="relative hidden overflow-hidden bg-primary-soft lg:block">
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2 text-accent-foreground">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="titulo-serif text-lg">Gerenciador de Gastos</span>
          </Link>
          <blockquote className="max-w-sm space-y-3 text-accent-foreground">
            <p className="titulo-serif text-2xl leading-snug">
              “Todo mês no lugar certo: entradas, gastos fixos, metas e o quanto sobrou.”
            </p>
            <footer className="text-sm opacity-70">Seu planner financeiro, sem planilha.</footer>
          </blockquote>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="space-y-2">
            <h1 className="titulo-serif text-2xl">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>
          {children}
          {rodape && <div className="text-center text-sm text-muted-foreground">{rodape}</div>}
        </motion.div>
      </div>
    </div>
  )
}

/** Botão do Google com o SVG oficial em quatro cores. */
export function BotaoGoogle({ onClick, carregando }: { onClick: () => void; carregando?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        />
      </svg>
      Continuar com Google
    </button>
  )
}
