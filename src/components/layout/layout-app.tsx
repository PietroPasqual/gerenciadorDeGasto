import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, LogOut, MoreVertical, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Marca } from '@/components/common/marca'
import { LimiteDeErro } from '@/components/common/limite-de-erro'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BarraInferior } from './barra-inferior'
import { BarraLateral } from './barra-lateral'
import { PaletaComandos } from './paleta-comandos'
import { NAVEGACAO } from './navegacao'
import { useAcoesPagina } from '@/store/acoes-pagina'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

export function LayoutApp() {
  const perfil = useAuthStore((s) => s.profile)
  const sair = useAuthStore((s) => s.sair)
  const escuro = useTemaStore((s) => s.escuro)
  const alternarEscuro = useTemaStore((s) => s.alternarEscuro)
  const local = useLocation()
  const acoesPagina = useAcoesPagina()

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <BarraLateral className="hidden lg:flex" />

      {/* min-w-0: sem isto uma tabela larga estica o irmão do flex e empurra a
          barra lateral para fora da tela. */}
      <div className="min-w-0 flex-1">
        {/* De lg para cima quem navega é a barra lateral; este header inteiro
          some, e a altura dele volta para o conteúdo. */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="container flex h-16 items-center justify-between gap-4">
            <NavLink to="/painel" aria-label="finZ — ir para o painel">
              <Marca />
            </NavLink>

            {/* Entre sm e lg: tema, nome e sair ficam à mostra aqui. De lg para
              cima quem carrega os três é o rodapé da barra lateral. */}
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={alternarEscuro}
                aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
              >
                {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <span className="max-w-[10rem] truncate text-sm text-muted-foreground">
                {perfil?.nome || 'Minha conta'}
              </span>
              <Button variant="ghost" size="icon" onClick={() => void sair()} aria-label="Sair da conta">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* No celular a navegação foi para a barra de baixo; o que sobra aqui
              são as ações da PÁGINA atual (exportar CSV etc.), que no desktop
              ficam no cabeçalho dela. Sem isso elas não teriam lugar no
              celular — ver a regra de paridade. */}
            {acoesPagina.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="sm:hidden">
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Ações desta tela">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[14rem]">
                  <DropdownMenuLabel>Nesta tela</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {acoesPagina.map((acao) => (
                    <DropdownMenuItem
                      key={acao.id}
                      disabled={acao.desabilitada}
                      onSelect={acao.executar}
                      className="min-h-[2.75rem]"
                    >
                      {acao.Icone && <acao.Icone />}
                      {acao.rotulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Abas entre sm e lg: no celular a navegação é a barra inferior, e de
          lg para cima é a barra lateral (este header inteiro some). */}
          <nav
            className="container fade-scroll-x hidden gap-1 overflow-x-auto pb-2 sm:flex"
            aria-label="Navegação principal"
          >
            {NAVEGACAO.map(({ para, rotulo, Icone }) => (
              <NavLink
                key={para}
                to={para}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary-soft font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </NavLink>
            ))}
          </nav>
        </header>

        <motion.main
          key={local.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          // pb generoso no celular: a barra inferior é fixa e cobriria o fim da página.
          className="container space-y-6 py-6 pb-28 sm:py-8 sm:pb-8"
        >
          {/* O limite de espera fica AQUI dentro, e não em volta das rotas: a
              barra lateral, o cabeçalho e a barra inferior continuam na tela
              enquanto o pedaço da página desce. Trocar a moldura inteira por um
              spinner faria a navegação parecer um recarregamento. */}
          {/* Pelo mesmo motivo, o limite de erro fica dentro do <main>: uma
              tela que quebra não pode levar junto a navegação que tira o
              usuário dali. A chave é a rota, para o erro não sobreviver a uma
              troca de página. */}
          <LimiteDeErro chave={local.pathname}>
            <Suspense fallback={<EsperandoPagina />}>
              <Outlet />
            </Suspense>
          </LimiteDeErro>
        </motion.main>
      </div>

      <BarraInferior />
      <PaletaComandos />
    </div>
  )
}

/** Mesma linguagem do carregamento da sessão, no tamanho da área de conteúdo. */
function EsperandoPagina() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Carregando a página…</span>
    </div>
  )
}
