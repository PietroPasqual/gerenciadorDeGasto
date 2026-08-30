import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * A partir de quantas linhas vale virtualizar.
 *
 * Abaixo disso o DOM inteiro é barato e a virtualização só traria problema:
 * ela quebra o Ctrl+F do navegador, o Tab entre células e a rolagem até uma
 * âncora. Acima, um extrato de um ano inteiro põe milhares de nós na página e
 * a rolagem trava no celular.
 */
export const LIMITE_VIRTUALIZACAO = 200

/**
 * Renderiza só as linhas visíveis, com uma folga acima e abaixo.
 *
 * A altura estimada não precisa ser exata — o virtualizador mede as linhas de
 * verdade depois de montá-las e corrige sozinho. Ela só evita a barra de
 * rolagem pular no primeiro quadro.
 */
export function ListaVirtual<T>({
  itens,
  alturaEstimada,
  alturaMaxima = '70vh',
  chave,
  children,
  className,
}: {
  itens: T[]
  alturaEstimada: number
  /** O contêiner rola por dentro; sem teto, virtualizar não teria efeito. */
  alturaMaxima?: string
  chave: (item: T, indice: number) => string
  children: (item: T, indice: number) => React.ReactNode
  className?: string
}) {
  const refRolagem = React.useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: itens.length,
    getScrollElement: () => refRolagem.current,
    estimateSize: () => alturaEstimada,
    // Cinco linhas de folga: rolando rápido no celular, sem elas aparece um
    // rasgo branco antes de a próxima linha montar.
    overscan: 5,
  })

  return (
    <div ref={refRolagem} className={className} style={{ maxHeight: alturaMaxima, overflowY: 'auto' }}>
      <div style={{ height: virtual.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtual.getVirtualItems().map((linha) => (
          <div
            key={chave(itens[linha.index], linha.index)}
            ref={virtual.measureElement}
            data-index={linha.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${linha.start}px)`,
            }}
          >
            {children(itens[linha.index], linha.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
