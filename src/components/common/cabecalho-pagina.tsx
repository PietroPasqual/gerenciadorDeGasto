import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MOV } from '@/lib/movimento'

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  acoesInline = false,
}: {
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
  /**
   * Põe as ações NA MESMA LINHA do título já no celular, em vez de empilhá-las
   * embaixo.
   *
   * É opt-in e não o padrão porque as telas passam números diferentes de
   * botões aqui: o comparativo e o controle mensal mandam vários, e enfileirar
   * "Controle mensal" com dois botões num aparelho de 320px espremeria o
   * título até truncar. Quem tem UM botão curto — o painel, com
   * "Personalizar" — economiza uma linha inteira de 56px, que num telefone é
   * o que decide se o primeiro card aparece antes de rolar.
   */
  acoesInline?: boolean
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOV.normal }}
      className={cn(
        'flex gap-3 sm:flex-row sm:items-end sm:justify-between',
        acoesInline ? 'flex-row items-start justify-between' : 'flex-col',
      )}
    >
      {/* min-w-0 com as ações na mesma linha: sem isso um título longo estica
          o irmão do flex e empurra o botão para fora da tela. */}
      <div className={cn('space-y-1', acoesInline && 'min-w-0')}>
        <h1 className="titulo-serif text-2xl sm:text-3xl">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && (
        <div className={cn('flex flex-wrap items-center gap-2', acoesInline && 'shrink-0')}>{acoes}</div>
      )}
    </motion.header>
  )
}
