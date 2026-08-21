import { cn } from '@/lib/utils'

/**
 * Desenhos dos estados vazios.
 *
 * São SVG inline e não imagem: precisam virar junto com o tema (são quatro
 * cores x claro/escuro) e um PNG por combinação seriam trinta e dois arquivos.
 * Aqui o traço é `currentColor` e o destaque é `--primary`, então o desenho
 * acompanha sem ninguém exportar nada.
 *
 * Todos nascem com aria-hidden: quem conta o que está acontecendo é o texto do
 * EstadoVazio ao lado, e um leitor de tela anunciando "ilustração de uma lista
 * vazia" só atrapalha.
 */
type Props = { className?: string }

const base = 'h-16 w-20 text-muted-foreground/40'

/** Lista sem itens — usada em tabelas e listagens. */
export function IlustracaoLista({ className }: Props) {
  return (
    <svg viewBox="0 0 80 64" fill="none" aria-hidden className={cn(base, className)}>
      <rect x="12" y="8" width="56" height="48" rx="6" stroke="currentColor" strokeWidth="2" />
      <path
        d="M22 24h24M22 34h32M22 44h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* a primeira linha em destaque sugere onde o conteúdo vai aparecer */}
      <path
        d="M22 24h14"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Sem dados para desenhar — usada nos cards de gráfico. */
export function IlustracaoGrafico({ className }: Props) {
  return (
    <svg viewBox="0 0 80 64" fill="none" aria-hidden className={cn(base, className)}>
      <circle cx="40" cy="32" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
      <path
        d="M40 12a20 20 0 0 1 17.3 10"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="40" cy="32" r="8" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** Nenhuma meta ainda — alvo com a flecha ainda fora. */
export function IlustracaoMeta({ className }: Props) {
  return (
    <svg viewBox="0 0 80 64" fill="none" aria-hidden className={cn(base, className)}>
      <circle cx="36" cy="32" r="19" stroke="currentColor" strokeWidth="2" />
      <circle cx="36" cy="32" r="11" stroke="currentColor" strokeWidth="2" />
      <circle cx="36" cy="32" r="3.5" fill="hsl(var(--primary))" />
      <path d="M58 12 41 27" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M58 12v6M58 12h-6"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const ILUSTRACOES = {
  lista: IlustracaoLista,
  grafico: IlustracaoGrafico,
  meta: IlustracaoMeta,
} as const

export type NomeIlustracao = keyof typeof ILUSTRACOES
