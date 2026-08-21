import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  ArrowRight,
  CalendarDays,
  LineChart,
  PiggyBank,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Marca } from '@/components/common/marca'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'

const RECURSOS = [
  {
    Icone: CalendarDays,
    titulo: 'Um mês por vez',
    texto: 'Entradas, gastos fixos com “pago?”, gastos do dia a dia e investimentos na mesma tela.',
  },
  {
    Icone: Target,
    titulo: 'Metas de verdade',
    texto: 'Até 10 metas, com o quanto você guardou em cada mês e a barra de progresso.',
  },
  {
    Icone: LineChart,
    titulo: 'O ano inteiro',
    texto: 'Comparativo de entrada x gastos nos 12 meses, com os meses no vermelho destacados.',
  },
  {
    Icone: PiggyBank,
    titulo: 'Limite por categoria',
    texto: 'Defina um teto para iFood, mercado, lazer… e veja a barra ficar vermelha quando estourar.',
  },
]

export function LandingPage() {
  const session = useAuthStore((s) => s.session)
  const refSecao = useRef<HTMLDivElement>(null)

  // Animação de scroll discreta (parallax leve no bloco de destaque)
  const { scrollYProgress } = useScroll({ target: refSecao, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [30, -30])
  const opacidade = useTransform(scrollYProgress, [0, 0.3, 1], [0.4, 1, 1])

  return (
    <div className="min-h-screen bg-background">
      <header className="container flex h-20 items-center justify-between">
        <Marca />
        <div className="flex items-center gap-2">
          {session ? (
            <Button asChild>
              <Link to="/painel">Abrir o app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/entrar">Entrar</Link>
              </Button>
              <Button asChild>
                <Link to="/criar-conta">Criar conta</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="container relative overflow-hidden py-16 sm:py-24">
        <div className="absolute -right-24 -top-16 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus dados só seus — protegidos por RLS no Supabase
          </span>
          <h1 className="titulo-serif text-4xl leading-tight sm:text-5xl">
            O planner financeiro da planilha, agora como app.
          </h1>
          <p className="text-lg text-muted-foreground">
            Controle mensal completo, metas, wishlist e comparativo anual. Em reais, em português, com o
            resumo do mês sempre à vista.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={session ? '/painel' : '/criar-conta'}>
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/entrar">Já tenho conta</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Recursos com scroll animation */}
      <section ref={refSecao} className="container py-12 sm:py-20">
        <motion.div style={{ y, opacity: opacidade }} className="grid gap-4 sm:grid-cols-2">
          {RECURSOS.map((recurso, indice) => (
            <motion.div
              key={recurso.titulo}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: indice * 0.06 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <recurso.Icone className="h-5 w-5" />
                  </span>
                  <CardTitle>{recurso.titulo}</CardTitle>
                  <CardDescription>{recurso.texto}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Chamada final */}
      <section className="container pb-24">
        <Card className="overflow-hidden bg-primary-soft">
          <CardContent className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="space-y-2">
              <h2 className="titulo-serif text-2xl">Comece pelo mês atual</h2>
              <p className="text-sm text-muted-foreground">
                Sua conta já vem com categorias e formas de pagamento prontas. É só lançar.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to={session ? '/mes' : '/criar-conta'}>
                Criar minha conta
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Feito para uso diário — sem planilha, sem fórmula quebrada.
      </footer>
    </div>
  )
}
