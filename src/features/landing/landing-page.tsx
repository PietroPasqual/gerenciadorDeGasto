import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Marca } from '@/components/common/marca'
import { PreviaApp } from '@/components/common/previa-app'
import { useAuthStore } from '@/store/auth'
import { MOV } from '@/lib/movimento'
import { GradeRecursos, NO_CELULAR, PASSOS, SEGURANCA } from './secoes'

export function LandingPage() {
  const session = useAuthStore((s) => s.session)

  /**
   * A regra global de prefers-reduced-motion (src/index.css) zera
   * animation-duration e transition-duration — e não alcança o Framer Motion,
   * que anima por JS em transform inline. Quem pediu menos movimento no
   * sistema recebia a página inteira deslizando assim mesmo; daí o hook.
   */
  const reduzir = useReducedMotion()

  /** Entrada ao chegar na tela, usada por todas as seções abaixo do hero. */
  const aoEntrar = (atraso = 0) => ({
    initial: reduzir ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: MOV.lento, delay: reduzir ? 0 : atraso },
  })

  const paraComecar = session ? '/painel' : '/criar-conta'

  return (
    <div className="min-h-dvh bg-background">
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

      {/* ------------------------------------------------------------ hero */}
      {/* Duas colunas (D8): o texto conta, a prévia mostra. Um app de dinheiro
          que não se deixa ver antes do cadastro pede fé demais de quem chega. */}
      <section className="container relative overflow-hidden py-16 sm:py-24">
        <div className="absolute -right-24 -top-16 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={reduzir ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOV.lento }}
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
              Controle mensal completo, fatura de cartão, metas com prazo e o ano inteiro. Em reais, em
              português, com o resumo do mês sempre à vista.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={paraComecar}>
                  Começar agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/entrar">Já tenho conta</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua conta já vem com categorias e formas de pagamento prontas.
            </p>
          </motion.div>

          <motion.div
            initial={reduzir ? false : { opacity: 0, y: 24, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: -1.5 }}
            transition={{ duration: MOV.lento, delay: 0.15 }}
            // Largura de tela de app, e não a coluna inteira: solta, a prévia
            // esticava para 668px e os valores iam parar na borda direita — lia
            // como banner, não como o produto.
            className="mx-auto w-full max-w-[23rem]"
          >
            <PreviaApp />
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------- fluxo */}
      <section className="container py-12 sm:py-16">
        <motion.h2 {...aoEntrar()} className="titulo-serif text-2xl sm:text-3xl">
          Lançar, entender, planejar
        </motion.h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PASSOS.map((passo, i) => (
            <motion.div key={passo.titulo} {...aoEntrar(i * 0.06)}>
              <Card className="h-full">
                <CardContent className="space-y-3 p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-strong">
                    <passo.Icone className="h-5 w-5" />
                  </span>
                  <h3 className="titulo-serif text-lg">{passo.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{passo.texto}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- recursos */}
      <section className="container py-12 sm:py-16">
        <motion.div {...aoEntrar()} className="max-w-2xl space-y-3">
          <h2 className="titulo-serif text-2xl sm:text-3xl">O que já está pronto</h2>
          <p className="text-muted-foreground">
            Nada aqui é promessa de versão futura — é o que abre quando você entra.
          </p>
        </motion.div>
        <motion.div {...aoEntrar(0.05)} className="mt-8">
          <GradeRecursos />
        </motion.div>
      </section>

      {/* ------------------------------------------------------- segurança */}
      <section className="container py-12 sm:py-16">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr,1.2fr] lg:items-center">
            <motion.div {...aoEntrar()} className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Segurança
              </span>
              <h2 className="titulo-serif text-2xl sm:text-3xl">Quem separa os dados é o banco</h2>
              <p className="text-muted-foreground">
                Não adianta o app prometer isolamento se a regra mora no app. No finZ ela mora uma camada
                abaixo, onde nem uma falha na tela consegue passar por cima.
              </p>
            </motion.div>
            <motion.ul {...aoEntrar(0.05)} className="space-y-4">
              {SEGURANCA.map((item) => (
                <li key={item.titulo} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-medium">{item.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{item.texto}</p>
                  </div>
                </li>
              ))}
            </motion.ul>
          </CardContent>
        </Card>
      </section>

      {/* --------------------------------------------------- celular e tema */}
      <section className="container py-12 sm:py-16">
        <motion.h2 {...aoEntrar()} className="titulo-serif text-2xl sm:text-3xl">
          Feito para o bolso, não só para a mesa
        </motion.h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {NO_CELULAR.map((item, i) => (
            <motion.div key={item.titulo} {...aoEntrar(i * 0.06)}>
              <Card className="h-full">
                <CardContent className="space-y-3 p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-strong">
                    <item.Icone className="h-5 w-5" />
                  </span>
                  <h3 className="font-medium">{item.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{item.texto}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        {/* Dizer o que ainda NÃO faz é o que dá crédito ao resto da página. */}
        <motion.p {...aoEntrar(0.1)} className="mt-6 text-sm text-muted-foreground">
          Sem rede, o app abre e mostra o mês que você já visitou. Gravar offline ainda não — preferimos não
          ter essa função a ter uma que perca lançamento na hora de sincronizar.
        </motion.p>
      </section>

      {/* --------------------------------------------------- chamada final */}
      <section className="container pb-20">
        <motion.div {...aoEntrar()}>
          <Card className="overflow-hidden bg-primary-soft">
            <CardContent className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
              <div className="space-y-2">
                <h2 className="titulo-serif text-2xl">Comece pelo mês atual</h2>
                <p className="text-sm text-muted-foreground">
                  Lance o primeiro gasto hoje e veja o resumo do mês se formar.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to={paraComecar}>
                  Criar minha conta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------- rodapé */}
      <footer className="border-t border-border">
        <div className="container flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Marca />
            <p className="max-w-xs text-sm text-muted-foreground">
              Planner financeiro pessoal, em reais e em português. Sem planilha, sem fórmula quebrada.
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-col gap-2 text-sm">
            <Link
              to="/entrar"
              className="alvo-toque inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              to="/criar-conta"
              className="alvo-toque inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              Criar conta
            </Link>
            <Link
              to="/ajuda"
              className="alvo-toque inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              Ajuda
            </Link>
          </nav>
        </div>
        <div className="container border-t border-border py-6 text-xs text-muted-foreground">
          O finZ não se conecta a nenhuma instituição financeira. Os dados são os que você lança.
        </div>
      </footer>
    </div>
  )
}
