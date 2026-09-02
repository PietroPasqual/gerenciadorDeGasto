import { ChevronDown, ChevronUp, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * `inert` como atributo, e não como prop tipada.
 *
 * O React 18 não conhece `inert` — os tipos não o declaram, e um `inert={true}`
 * seria descartado na serialização por ser booleano desconhecido. String vazia
 * é o que vira `inert=""` no HTML, que é a forma válida do atributo.
 *
 * Onde o navegador é velho demais para `inert` (antes do Chrome 102 / Safari
 * 15.5), o `pointer-events-none` ao lado ainda barra dedo e mouse; só a
 * tabulação entra nos cards. É degradação aceitável para um modo em que a
 * pessoa está a um clique de "Concluir".
 */
const FORA_DE_ALCANCE = { inert: '' } as unknown as { inert?: '' }

/**
 * A moldura de um widget do painel.
 *
 * Fora do modo de edição ela não desenha NADA: devolve o conteúdo como ele
 * era antes da fase 4, sem uma div a mais. O painel de quem nunca tocou em
 * "Personalizar" tem exatamente a marcação que tinha.
 *
 * POR QUE SETAS, E NÃO ARRASTAR
 *
 * Arrastar é o gesto óbvio e é a escolha errada aqui:
 *
 *   - custa uma biblioteca (o app tem 28,8 kB de folga no orçamento de bundle
 *     e nenhum motivo para gastá-los com isto);
 *   - não tem equivalente de teclado que não seja, no fim, uma lista de
 *     comandos "mover para cima" e "mover para baixo" — ou seja, isto aqui;
 *   - num painel que rola, arrastar o último card até o topo exige segurar e
 *     esperar a tela rolar sozinha, que é a pior interação de toque que
 *     existe.
 *
 * Com quatro widgets, duas setas resolvem qualquer arranjo em no máximo três
 * toques, e funcionam igual no dedo, no mouse e no teclado.
 */
export function Widget({
  id,
  titulo,
  editando,
  primeiro,
  ultimo,
  onMover,
  onEsconder,
  children,
}: {
  id: string
  /** O nome que os botões de mover e esconder anunciam. */
  titulo: string
  editando: boolean
  primeiro: boolean
  ultimo: boolean
  onMover: (id: string, direcao: -1 | 1) => void
  onEsconder: (id: string) => void
  children: React.ReactNode
}) {
  if (!editando) return <>{children}</>

  return (
    <section
      aria-label={titulo}
      className={cn(
        'rounded-lg border border-dashed border-primary/40 bg-primary-soft/30 p-2',
        'transition-colors duration-rapido',
      )}
    >
      <div className="mb-2 flex items-center gap-1 px-1">
        <span className="min-w-0 flex-1 truncate text-rotulo uppercase text-muted-foreground">{titulo}</span>

        {/* O rótulo de cada botão diz O QUE ele move, e não só "para cima".
            Numa tela com quatro widgets em modo de edição há oito botões de
            seta, e "Mover para cima" oito vezes não distingue nada para quem
            navega por leitor de tela. */}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={primeiro}
          onClick={() => onMover(id, -1)}
          aria-label={`Mover ${titulo} para cima`}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={ultimo}
          onClick={() => onMover(id, 1)}
          aria-label={`Mover ${titulo} para baixo`}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={() => onEsconder(id)}
          aria-label={`Esconder ${titulo}`}
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>

      {/* `inert` deixa o conteúdo à mostra mas fora do alcance: em modo de
          edição os alvos que importam são os de reorganizar, e um painel
          onde um toque mal-calibrado no card de atalhos leva a pessoa para
          outra tela no meio da personalização perde o trabalho dela.
          Também tira os links da ordem de tabulação, então Tab caminha pelas
          setas em vez de entrar em cada card. */}
      <div {...FORA_DE_ALCANCE} className="pointer-events-none">
        {children}
      </div>
    </section>
  )
}
