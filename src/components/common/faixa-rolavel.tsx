import { cn } from '@/lib/utils'

/**
 * Faixa que desliza de lado no celular e vira grade no desktop.
 *
 * Nasceu de três cópias idênticas — os indicadores do comparativo, os da
 * wishlist e a régua de meses das metas —, cujos próprios comentários já
 * diziam "mesmo tratamento dos indicadores do comparativo anual". Uma cópia
 * só corrige de cada vez; um componente corrige as três.
 *
 * POR QUE ELA RECEBE FOCO
 *
 * O axe marcava `scrollable-region-focusable` (serious) nas três: a faixa
 * rola, mas o conteúdo dela é só texto — nenhum botão, nenhum campo. Sem um
 * ponto de foco, quem navega por teclado não tem como rolar, e o que está à
 * direita simplesmente não existe para essa pessoa.
 *
 * O custo é uma parada de tabulação a mais no desktop, onde a faixa já virou
 * grade e não rola. É o preço de tornar o conteúdo alcançável no celular, e é
 * mais barato do que a alternativa (tornar focável cada cartão de estatística,
 * que criaria três a seis paradas em vez de uma).
 *
 * O anel de foco vem da regra global de `:focus-visible` do index.css.
 */
export function FaixaRolavel({
  rotulo,
  className,
  children,
}: {
  /** O que a faixa contém, para quem chega nela pelo teclado ou por leitor de tela. */
  rotulo: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      tabIndex={0}
      className={cn('sem-barra-rolagem overflow-x-auto', className)}
    >
      {children}
    </div>
  )
}
