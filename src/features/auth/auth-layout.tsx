import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Marca } from '@/components/common/marca'
import { PreviaApp } from '@/components/common/previa-app'
import { MOV } from '@/lib/movimento'

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
  // Ver a nota em landing-page.tsx: a regra CSS de prefers-reduced-motion não
  // alcança o Framer Motion, que anima por JS.
  const reduzir = useReducedMotion()

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Coluna decorativa (some no mobile). Antes eram só dois borrões e uma
          frase; agora mostra a mesma prévia da landing — quem chega aqui vindo
          de fora vê no que está entrando antes de digitar a senha. */}
      <div className="relative hidden overflow-hidden bg-primary-soft lg:block">
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between gap-8 p-12">
          <Link to="/" aria-label="finZ — voltar para o início">
            <Marca textoClassName="text-accent-foreground" />
          </Link>

          <motion.div
            initial={reduzir ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOV.lento, delay: 0.1 }}
            className="mx-auto w-full max-w-[19rem]"
          >
            <PreviaApp />
          </motion.div>

          <blockquote className="max-w-sm space-y-3 text-accent-foreground">
            <p className="titulo-serif text-xl leading-snug">
              “Todo mês no lugar certo: entradas, gastos fixos, metas e o quanto sobrou.”
            </p>
            {/* Sem `opacity`: ela multiplica o texto e derrubava esta linha
                para 4,28:1, contra o mínimo de 4,5:1 (pego pelo axe no
                navegador). A hierarquia aqui vem do tamanho, que já é bem
                menor que o da citação acima. Ver docs/design-system.md. */}
            <footer className="text-sm">Seu planner financeiro, sem planilha.</footer>
          </blockquote>
        </div>
      </div>

      <div className="flex flex-col p-6 sm:p-10">
        {/* Marca visível no mobile — na tela grande já aparece na coluna decorativa */}
        <Link to="/" className="mb-8 lg:hidden" aria-label="finZ — voltar para o início">
          <Marca />
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={reduzir ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOV.normal }}
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
    </div>
  )
}
