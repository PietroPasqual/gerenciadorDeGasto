import * as React from 'react'
import { Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Paleta das categorias.
 *
 * Dezesseis tons na mesma faixa de luminosidade (o "400" das paletas comuns),
 * escolhidos para funcionar nos três lugares onde a cor aparece: bolinha de
 * 8px ao lado do nome, fatia de donut e barra de limite. Por isso nada de
 * cor pura — o vermelho e o ciano puros que o seletor do Android oferece
 * vibram na bolinha pequena e brigam entre si no gráfico.
 *
 * A ordem é a do círculo cromático: cores vizinhas ficam vizinhas, e escolher
 * "um verde diferente daquele" é olhar para o lado.
 */
export const CORES_CATEGORIA = [
  '#f87171', // vermelho
  '#fb923c', // laranja
  '#fbbf24', // âmbar
  '#facc15', // amarelo
  '#a3e635', // lima
  '#4ade80', // verde
  '#34d399', // esmeralda
  '#2dd4bf', // turquesa
  '#22d3ee', // ciano
  '#38bdf8', // celeste
  '#60a5fa', // azul
  '#818cf8', // índigo
  '#a78bfa', // violeta
  '#c084fc', // roxo
  '#e879f9', // fúcsia
  '#f472b6', // rosa
] as const

/** Cor de uma categoria nova, quando ninguém escolheu nada. */
export const COR_PADRAO = '#f472b6'

/**
 * Grade de amostras. Substitui o `<input type="color">`, que no celular abre o
 * diálogo do sistema — fora do tema do app, com alvos pequenos e uma paleta de
 * oito cores puras que não serve para nada aqui.
 *
 * Uma cor fora da lista (vinda de um cadastro antigo ou do campo livre) não
 * some: entra como uma amostra a mais, já selecionada.
 */
export function SeletorCor({
  valor,
  onChange,
  className,
}: {
  valor: string
  onChange: (cor: string) => void
  className?: string
}) {
  const normalizada = valor.toLowerCase()
  const conhecidas = CORES_CATEGORIA.map((c) => c.toLowerCase())
  const cores = conhecidas.includes(normalizada) ? conhecidas : [...conhecidas, normalizada]

  return (
    <div className={cn('grid grid-cols-6 gap-2 sm:grid-cols-8', className)} role="radiogroup" aria-label="Cor">
      {cores.map((cor) => {
        const escolhida = cor === normalizada
        return (
          <button
            key={cor}
            type="button"
            role="radio"
            aria-checked={escolhida}
            aria-label={`Cor ${cor}`}
            onClick={() => onChange(cor)}
            className={cn(
              // 44px de alvo no celular; no desktop cabem oito por linha e o
              // ponteiro não precisa de tanto.
              'grid aspect-square w-full min-w-[2.75rem] place-items-center rounded-xl transition-transform md:min-w-[2rem]',
              'ring-offset-2 ring-offset-card hover:scale-105',
              escolhida && 'ring-2 ring-foreground',
            )}
            style={{ backgroundColor: cor }}
          >
            {/* Branco sobre estes tons passa AA; o check só aparece na escolhida. */}
            {escolhida && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A mesma paleta atrás de um botão, para a célula da tabela no desktop — lá a
 * coluna tem 4rem e a grade inteira não cabe.
 */
export function BotaoCor({
  valor,
  onChange,
  rotulo,
}: {
  valor: string
  onChange: (cor: string) => void
  rotulo: string
}) {
  const [aberto, setAberto] = React.useState(false)

  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger
        aria-label={rotulo}
        className="mx-auto h-8 w-12 rounded-md border border-input transition-transform hover:scale-105"
        style={{ backgroundColor: valor }}
      />
      <DropdownMenuContent align="center" className="w-auto p-3">
        <SeletorCor
          valor={valor}
          onChange={(cor) => {
            onChange(cor)
            setAberto(false)
          }}
          className="w-[20rem] grid-cols-8"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
