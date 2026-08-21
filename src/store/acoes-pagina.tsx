import * as React from 'react'

/**
 * Ações da página atual, para o menu "⋯" do topo no celular.
 *
 * Por que existe: no desktop cada página põe seus botões no próprio cabeçalho
 * (exportar CSV, seletor de período...). No celular esse cabeçalho não cabe, e
 * a regra de paridade proíbe simplesmente escondê-lo. Então a página *declara*
 * suas ações e o layout decide onde mostrá-las — inline no desktop, dentro do
 * "⋯" no celular. Assim é impossível uma ação existir só num tamanho de tela.
 */
export interface AcaoPagina {
  id: string
  rotulo: string
  Icone?: React.ComponentType<{ className?: string }>
  executar: () => void
  desabilitada?: boolean
}

const Contexto = React.createContext<{
  acoes: AcaoPagina[]
  registrar: (acoes: AcaoPagina[]) => void
}>({ acoes: [], registrar: () => {} })

export function ProvedorAcoesPagina({ children }: { children: React.ReactNode }) {
  const [acoes, setAcoes] = React.useState<AcaoPagina[]>([])
  const registrar = React.useCallback((novas: AcaoPagina[]) => setAcoes(novas), [])
  const valor = React.useMemo(() => ({ acoes, registrar }), [acoes, registrar])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** Lido pelo layout para montar o menu "⋯". */
export function useAcoesPagina() {
  return React.useContext(Contexto).acoes
}

/**
 * Chamado pela página para declarar o que ela sabe fazer.
 * `deps` controla quando reregistrar — as ações fecham sobre estado da página
 * (ex.: os dados a exportar), então precisam ser atualizadas quando ele muda.
 */
export function useRegistrarAcoes(criar: () => AcaoPagina[], deps: unknown[]) {
  const { registrar } = React.useContext(Contexto)
  const criarRef = React.useRef(criar)
  criarRef.current = criar

  React.useEffect(() => {
    registrar(criarRef.current())
    return () => registrar([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
