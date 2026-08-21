import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SecaoConfig {
  id: string
  rotulo: string
  Icone: React.ComponentType<{ className?: string }>
}

/**
 * Qual seção está sendo lida agora (D7).
 *
 * Um IntersectionObserver por seção, com a "linha de leitura" em ~35% do topo
 * da janela: quando a seção cruza essa linha ela vira a ativa. Usar o simples
 * `isIntersecting` não serve — com quatro seções na tela ao mesmo tempo várias
 * ficam "intersecting" e o índice pisca entre elas.
 */
export function useSecaoVisivel(secoes: SecaoConfig[], ligado: boolean) {
  const [ativa, setAtiva] = React.useState(secoes[0]?.id ?? '')

  React.useEffect(() => {
    if (!ligado) return
    const elementos = secoes
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => e !== null)
    if (elementos.length === 0) return

    const visiveis = new Map<string, boolean>()

    /**
     * Uma decisão só, chamada pelos dois gatilhos.
     *
     * Antes o observer e o listener de rolagem chamavam setAtiva cada um por
     * sua conta, e o observer — que dispara depois — desfazia a regra do fim
     * da página. Aqui a ordem é explícita: a última seção ganha quando você
     * chegou ao fim; fora isso vale a primeira que cruzou a linha de leitura.
     */
    const recalcular = () => {
      const chegouAoFim =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      // A última seção nunca acende sozinha: a página acaba antes de ela
      // conseguir cruzar a linha, então "Formas de pagamento" ficava marcada
      // enquanto você olhava "Metas".
      if (chegouAoFim) {
        setAtiva(secoes[secoes.length - 1].id)
        return
      }
      const atual = secoes.find((s) => visiveis.get(s.id))
      if (atual) setAtiva(atual.id)
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visiveis.set(e.target.id, e.isIntersecting)
        recalcular()
      },
      // topo em -35% e base em -60%: sobra uma faixa fina no terço superior,
      // e só uma seção por vez costuma tocá-la.
      { rootMargin: '-35% 0px -60% 0px', threshold: 0 },
    )
    elementos.forEach((e) => observador.observe(e))

    window.addEventListener('scroll', recalcular, { passive: true })
    recalcular()

    return () => {
      observador.disconnect()
      window.removeEventListener('scroll', recalcular)
    }
  }, [secoes, ligado])

  return ativa
}

/** Índice lateral clicável, com a seção atual destacada. */
export function IndiceConfig({
  secoes,
  ativa,
  className,
}: {
  secoes: SecaoConfig[]
  ativa: string
  className?: string
}) {
  return (
    <nav aria-label="Seções das configurações" className={className}>
      <ul className="sticky top-8 space-y-1">
        {secoes.map(({ id, rotulo, Icone }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={ativa === id ? 'true' : undefined}
              onClick={(e) => {
                // scrollIntoView em vez do salto do navegador: o `smooth` deixa
                // claro que você continua na mesma página, só noutro pedaço.
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.replaceState(null, '', `#${id}`)
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                ativa === id
                  ? 'bg-primary-soft font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icone className="h-4 w-4 shrink-0" />
              {rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
