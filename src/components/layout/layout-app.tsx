import { Suspense, lazy, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, MoreVertical } from 'lucide-react'
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
import { Dock, RESERVA_INFERIOR, RESERVA_LATERAL } from './dock'
import { PaletaComandos } from './paleta-comandos'
import { useAcoesPagina } from '@/store/acoes-pagina'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useDockStore } from '@/store/dock'
import { MOV } from '@/lib/movimento'
import { deveAparecer } from '@/lib/onboarding'
/**
 * Carregado sob demanda, como as páginas.
 *
 * Estático, ele custava 8,4 kB no pacote inicial — o guia arrasta os serviços
 * de categorias, entradas recorrentes e perfil — e esse peso cairia sobre
 * todo mundo para servir a tela que só a conta nova vê, uma vez.
 */
const GuiaPrimeiroAcesso = lazy(() =>
  import('@/features/onboarding/guia-primeiro-acesso').then((m) => ({ default: m.GuiaPrimeiroAcesso })),
)

/**
 * A casca do app (fase 3).
 *
 * Antes havia TRÊS navegações aqui: a barra lateral de lg para cima, uma
 * faixa de abas entre sm e lg, e a barra inferior no celular. Cada tela nova
 * precisava ser cadastrada nas três, cada uma tinha o seu jeito de pintar o
 * item ativo, e o header carregava tema, nome e sair em duas larguras
 * diferentes com regras de `hidden` cruzadas.
 *
 * Agora é uma só — o dock —, e o que sobra aqui é o que nunca foi navegação:
 * a marca, as ações da PÁGINA atual e a área de conteúdo.
 */
export function LayoutApp() {
  const perfil = useAuthStore((s) => s.profile)
  const local = useLocation()
  const acoesPagina = useAcoesPagina()
  const posicao = useDockStore((s) => s.posicao)

  /**
   * O guia de primeiro acesso abre UMA VEZ por sessão, e só para quem nunca o
   * encerrou — a 0022 marcou toda conta que já existia como encerrada, então
   * quem tem um ano de lançamentos nunca vê isto.
   *
   * O `abriu` é o que impede o guia de voltar quando a pessoa sai dele para
   * lançar o primeiro gasto: ela continua com `onboarding_em` nulo, de
   * propósito (o passo não foi feito), mas ser reaberta no meio do caminho
   * seria uma armadilha.
   */
  const [guiaAberto, setGuiaAberto] = useState(false)
  const [abriu, setAbriu] = useState(false)

  useEffect(() => {
    if (abriu || !perfil) return
    // A decisão é tomada na PRIMEIRA leitura do perfil e não é revista: uma
    // gravação posterior que devolvesse um perfil parcial (uma tela salvando
    // só um campo) reabriria o guia por cima do que a pessoa está fazendo.
    setAbriu(true)
    if (deveAparecer(perfil.onboarding_em)) setGuiaAberto(true)
  }, [abriu, perfil])

  return (
    // A reserva lateral fica AQUI e não no <main>: com o dock encostado numa
    // lateral, o header também não pode passar por baixo dele.
    <div className={cn('min-h-dvh bg-background', RESERVA_LATERAL[posicao])}>
      {/* O header encolheu: com a navegação no dock, o que resta é a marca e
          as ações da tela atual. Ele é de vidro pelo mesmo motivo do dock — o
          conteúdo corre por baixo, e uma faixa opaca no topo cortaria a
          página em duas. */}
      <header className="vidro sticky top-0 z-30 border-b border-vidro pt-[env(safe-area-inset-top)]">
        <div className="container flex h-14 items-center justify-between gap-4">
          <NavLink to="/painel" aria-label="finZ — ir para o painel">
            <Marca />
          </NavLink>

          {/* As ações da PÁGINA atual (exportar CSV etc.). No desktop elas já
              aparecem no cabeçalho da própria tela; aqui existem para o
              celular, onde não há lugar para elas — ver a regra de paridade.
              Tema, nome e sair NÃO estão mais aqui: foram para o "Mais" do
              dock, num lugar só, em vez de dois recortes por largura. */}
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
      </header>

      <motion.main
        key={local.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: MOV.normal, ease: 'easeOut' }}
        /* `pt-` e não `py-`: a reserva de baixo é do dock, e um `sm:py-8`
           escreveria padding-bottom de dentro de uma media query — que ganha
           do `pb-dock-reserva` sem prefixo e devolvia 32px de folga onde
           precisam ser 80. O defeito só aparecia de sm para cima. */
        className={cn('container space-y-6 pt-6 sm:pt-8', RESERVA_INFERIOR[posicao])}
      >
        {/* O limite de espera fica AQUI dentro, e não em volta das rotas: o
            header e o dock continuam na tela enquanto o pedaço da página
            desce. Trocar a moldura inteira por um spinner faria a navegação
            parecer um recarregamento. */}
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

      <Dock />
      <PaletaComandos />
      {/* Montado só quando abre: o guia lê categorias, entradas recorrentes e
          "existe algum lançamento?", e fazer essas três leituras em toda tela
          para quem já encerrou seria pagar por um formulário que ninguém vai
          ver. */}
      {guiaAberto && (
        <Suspense fallback={null}>
          <GuiaPrimeiroAcesso aberto onFechar={() => setGuiaAberto(false)} />
        </Suspense>
      )}
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
