import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Moon, Rows3, Search, Sun } from 'lucide-react'
import { NAVEGACAO } from './navegacao'
import { useAcoesPagina } from '@/store/acoes-pagina'
import { useDensidadeStore } from '@/store/densidade'
import { useTemaStore } from '@/store/tema'
import { cn } from '@/lib/utils'

interface Comando {
  id: string
  grupo: string
  rotulo: string
  Icone?: React.ComponentType<{ className?: string }>
  executar: () => void
  desabilitado?: boolean
}

/** ⌘ no Mac, Ctrl no resto. Só para desenhar a dica — o atalho escuta os dois. */
const ehMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const EVENTO_ABRIR = 'finz:abrir-paleta'

/**
 * Abre a paleta de fora dela.
 *
 * Quem quisesse isto antes fabricava um `KeyboardEvent` de ⌘K e jogava na
 * window — a barra lateral fazia exatamente isso. Funcionava por tabela: o
 * atalho é um `toggle`, então um segundo disparo com a paleta já aberta a
 * FECHAVA, e o "Buscar…" do dock viraria um interruptor em vez de um botão.
 *
 * Um evento próprio que só abre resolve os dois problemas, e não depende mais
 * de o atalho continuar sendo ⌘K.
 */
export function abrirPaleta() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR))
}

/**
 * Paleta de comandos (D4).
 *
 * Construída direto no Dialog do Radix, que o app já usa: `cmdk` resolveria o
 * mesmo e traria mais uma dependência para uma lista de ~10 itens filtrada por
 * `includes`.
 *
 * As ações da PÁGINA entram junto com os destinos (é o mesmo registro que
 * alimenta o menu "⋯" do celular), então "Exportar CSV" é alcançável pelo
 * teclado sem ninguém cadastrar nada duas vezes.
 */
export function PaletaComandos() {
  const [aberta, setAberta] = React.useState(false)
  const [busca, setBusca] = React.useState('')
  const [indice, setIndice] = React.useState(0)
  const navegar = useNavigate()
  const acoesPagina = useAcoesPagina()
  const escuro = useTemaStore((e) => e.escuro)
  const alternarEscuro = useTemaStore((e) => e.alternarEscuro)
  const densidade = useDensidadeStore((e) => e.densidade)
  const definirDensidade = useDensidadeStore((e) => e.definirDensidade)

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setAberta((v) => !v)
      }
    }
    const aoPedirAbertura = () => setAberta(true)
    window.addEventListener('keydown', aoTeclar)
    window.addEventListener(EVENTO_ABRIR, aoPedirAbertura)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      window.removeEventListener(EVENTO_ABRIR, aoPedirAbertura)
    }
  }, [])

  const comandos: Comando[] = React.useMemo(
    () => [
      ...NAVEGACAO.map((n) => ({
        id: `ir:${n.para}`,
        grupo: 'Ir para',
        rotulo: n.rotulo,
        Icone: n.Icone,
        executar: () => navegar(n.para),
      })),
      ...acoesPagina.map((a) => ({
        id: `acao:${a.id}`,
        grupo: 'Nesta tela',
        rotulo: a.rotulo,
        Icone: a.Icone,
        executar: a.executar,
        desabilitado: a.desabilitada,
      })),
      {
        id: 'tema',
        grupo: 'Aparência',
        rotulo: escuro ? 'Usar tema claro' : 'Usar tema escuro',
        Icone: escuro ? Sun : Moon,
        executar: alternarEscuro,
      },
      {
        id: 'densidade',
        grupo: 'Aparência',
        rotulo: densidade === 'compacto' ? 'Densidade confortável' : 'Densidade compacta',
        Icone: Rows3,
        executar: () => definirDensidade(densidade === 'compacto' ? 'confortavel' : 'compacto'),
      },
    ],
    [acoesPagina, navegar, escuro, alternarEscuro, densidade, definirDensidade],
  )

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? comandos.filter((c) => `${c.grupo} ${c.rotulo}`.toLowerCase().includes(termo))
    : comandos

  // Digitar encurta a lista; sem isto a seleção fica apontando para um índice
  // que não existe mais e o Enter não faz nada.
  React.useEffect(() => setIndice(0), [termo])
  React.useEffect(() => {
    if (aberta) {
      setBusca('')
      setIndice(0)
    }
  }, [aberta])

  const rodar = (c: Comando | undefined) => {
    if (!c || c.desabilitado) return
    setAberta(false)
    c.executar()
  }

  const aoTeclarNaLista = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndice((i) => Math.min(i + 1, filtrados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndice((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rodar(filtrados[indice])
    }
  }

  let grupoAnterior = ''

  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={setAberta}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <DialogPrimitive.Content
          onKeyDown={aoTeclarNaLista}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-[18vh] z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden',
            'rounded-2xl border border-border bg-popover shadow-2',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Buscar comando</DialogPrimitive.Title>

          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ir para uma tela ou executar uma ação…"
              aria-label="Buscar comando"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain p-2">
            {filtrados.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nada encontrado para “{busca}”.
              </li>
            )}
            {filtrados.map((c, i) => {
              const novoGrupo = c.grupo !== grupoAnterior
              grupoAnterior = c.grupo
              return (
                <li key={c.id}>
                  {novoGrupo && (
                    <p className="px-3 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                      {c.grupo}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={c.desabilitado}
                    onMouseMove={() => setIndice(i)}
                    onClick={() => rodar(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      i === indice && !c.desabilitado
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {c.Icone && <c.Icone className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    {c.rotulo}
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Dica de atalho para o rodapé da barra lateral. */
export function DicaAtalho({ className }: { className?: string }) {
  const [mac, setMac] = React.useState(false)
  React.useEffect(() => setMac(ehMac()), [])
  return (
    <kbd
      className={cn('rounded border border-border px-1.5 py-0.5 text-micro text-muted-foreground', className)}
    >
      {mac ? '⌘' : 'Ctrl'} K
    </kbd>
  )
}
