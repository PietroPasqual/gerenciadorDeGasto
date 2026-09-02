import * as React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Check, LogOut, MoreHorizontal, Moon, Search, Sun } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { DESTINOS_DO_DOCK, DESTINOS_NO_MAIS } from './navegacao'
import { DicaAtalho, abrirPaleta } from './paleta-comandos'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'
import { useDockStore, type PosicaoDock } from '@/store/dock'

/**
 * Onde a moldura fixa põe o dock, por posição escolhida.
 *
 * As classes são literais e não montadas por concatenação de propósito: o
 * Tailwind lê os arquivos como TEXTO, e uma classe que só existe depois de
 * `'lg:' + lado` nunca chega ao CSS gerado.
 *
 * Abaixo de lg as três posições são a MESMA coisa — embaixo. Não é descuido:
 * num celular a lateral não é alcançável com o polegar, e um dock vertical
 * encostado na esquerda comeria a largura da tabela de gastos, que é a tela
 * mais apertada do app. A escolha continua guardada e volta a valer quando a
 * pessoa abre no monitor.
 */
const POSICOES: Record<PosicaoDock, { moldura: string; barra: string }> = {
  baixo: {
    moldura: 'inset-x-0 bottom-0 items-end justify-center',
    barra: 'flex-row',
  },
  esquerda: {
    moldura: cn(
      'inset-x-0 bottom-0 items-end justify-center',
      'lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:items-center lg:justify-start',
    ),
    barra: 'flex-row lg:flex-col',
  },
  direita: {
    moldura: cn(
      'inset-x-0 bottom-0 items-end justify-center',
      'lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:items-center lg:justify-end',
    ),
    barra: 'flex-row lg:flex-col',
  },
}

/**
 * O respiro que o conteúdo reserva para não terminar embaixo do dock.
 *
 * Mora aqui, e não no layout, porque é a contrapartida direta do mapa
 * POSICOES logo acima: mudar um sem o outro deixa o dock cobrindo a última
 * linha da tela, e é o tipo de defeito que só aparece com a lista cheia.
 *
 * Embaixo de lg é sempre a reserva inferior, pela mesma razão que as três
 * posições viram uma só ali.
 */
export const RESERVA_INFERIOR: Record<PosicaoDock, string> = {
  baixo: 'pb-dock-reserva',
  esquerda: 'pb-dock-reserva lg:pb-8',
  direita: 'pb-dock-reserva lg:pb-8',
}

export const RESERVA_LATERAL: Record<PosicaoDock, string> = {
  baixo: '',
  esquerda: 'lg:pl-dock-reserva-lado',
  direita: 'lg:pr-dock-reserva-lado',
}

const NOME_DA_POSICAO: Record<PosicaoDock, string> = {
  baixo: 'Embaixo',
  esquerda: 'À esquerda',
  direita: 'À direita',
}

/**
 * Classe de um alvo do dock — item de navegação ou o botão "Mais".
 *
 * 48px de largura e 44px de altura, e não o `.alvo-toque` do projeto: aquele
 * cai para 24px onde há ponteiro fino, que é o certo para um chip dentro de
 * uma planilha densa e o errado para a navegação principal do app, que é
 * grande em qualquer aparelho.
 *
 * `min-w-12` com `px-1` é o que faz "Painel" — o rótulo mais longo do dock —
 * caber inteiro em 11px sem truncar, e mantém o dock em ~260px de largura
 * total, que passa folgado num aparelho de 320px.
 */
function classeAlvo(ativo: boolean) {
  return cn(
    'flex min-h-11 min-w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1',
    'text-micro transition-colors duration-rapido ease-padrao',
    ativo
      ? 'bg-primary-soft font-medium text-accent-foreground'
      : 'text-muted-foreground hover:bg-realce hover:text-foreground',
  )
}

/**
 * O dock flutuante — a única navegação do app.
 *
 * Substitui três componentes que desenhavam a mesma lista de destinos em
 * larguras diferentes: a barra lateral (lg+), as abas do header (sm..lg) e a
 * barra inferior (celular). Eram três desenhos, três estados de "ativo" e
 * três lugares onde uma tela nova precisava ser cadastrada.
 *
 * Ele flutua POR CIMA do conteúdo em vez de participar do fluxo. Duas
 * consequências que o código precisa tratar, e trata:
 *
 *   1. a moldura fixa cobre a largura toda da tela, então ela é
 *      `pointer-events-none` e só a barra recebe cliques — senão uma faixa
 *      invisível de 56px engoliria o toque na última linha de qualquer lista;
 *   2. o conteúdo tem que reservar espaço embaixo, e a reserva é o token
 *      `--dock-reserva`, derivado da altura e da margem do próprio dock (ver
 *      layout-app.tsx). O `pb-28` cravado da barra antiga saía do lugar toda
 *      vez que a altura mudava.
 */
export function Dock() {
  const [mais, setMais] = React.useState(false)
  const local = useLocation()
  const posicao = useDockStore((e) => e.posicao)
  const definirPosicao = useDockStore((e) => e.definirPosicao)
  const perfil = useAuthStore((e) => e.profile)
  const sair = useAuthStore((e) => e.sair)
  const escuro = useTemaStore((e) => e.escuro)
  const alternarEscuro = useTemaStore((e) => e.alternarEscuro)

  const emMais = DESTINOS_NO_MAIS.some((d) => d.para === local.pathname)
  const lugar = POSICOES[posicao] ?? POSICOES.baixo

  return (
    <>
      <div
        className={cn('pointer-events-none fixed z-40 flex', lugar.moldura)}
        /* A margem entra por style e não por classe porque os quatro lados
           precisam do mesmo `max(token, inset)`: em paisagem, num aparelho
           com notch, a margem sozinha não tira o dock de baixo do recorte, e
           na barra de gestos do iPhone quem manda é o inset. Escrever isso em
           Tailwind seria um valor arbitrário por lado. */
        style={{
          paddingTop: 'max(var(--dock-margem), env(safe-area-inset-top))',
          paddingBottom: 'max(var(--dock-margem), env(safe-area-inset-bottom))',
          paddingLeft: 'max(var(--dock-margem), env(safe-area-inset-left))',
          paddingRight: 'max(var(--dock-margem), env(safe-area-inset-right))',
        }}
      >
        <nav
          aria-label="Navegação principal"
          className={cn(
            'vidro pointer-events-auto flex items-center gap-0.5 rounded-dock border border-vidro p-1 shadow-dock',
            lugar.barra,
          )}
        >
          {DESTINOS_DO_DOCK.map(({ para, rotulo, curto, Icone }) => (
            <NavLink
              key={para}
              to={para}
              /* O rótulo curto é o que cabe; o inteiro é o que se anuncia.
                 Sem isto o leitor de tela leria "Ano", que não é o nome de
                 tela nenhuma. `aria-current` vem de graça do NavLink. */
              aria-label={rotulo}
              className={({ isActive }) => classeAlvo(isActive)}
            >
              <Icone className="h-5 w-5 shrink-0" aria-hidden />
              <span aria-hidden>{curto}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMais(true)}
            aria-haspopup="dialog"
            aria-expanded={mais}
            className={classeAlvo(emMais)}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
            <span aria-hidden>Mais</span>
            <span className="sr-only">Mais destinos e opções da conta</span>
          </button>
        </nav>
      </div>

      <Sheet open={mais} onOpenChange={setMais}>
        <SheetContent>
          <SheetTitle className="mb-3">Mais</SheetTitle>

          <div className="space-y-1">
            {DESTINOS_NO_MAIS.map(({ para, rotulo, Icone }) => (
              <NavLink
                key={para}
                to={para}
                onClick={() => setMais(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 text-corpo',
                    isActive ? 'bg-primary-soft font-medium text-accent-foreground' : 'hover:bg-realce',
                  )
                }
              >
                <Icone className="h-5 w-5 shrink-0" aria-hidden />
                {rotulo}
              </NavLink>
            ))}

            {/* A paleta era alcançável só por ⌘K, e ⌘K não existe em celular:
                a busca por comandos ficava fora do alcance de quem usa o app
                no telefone. Aqui ela ganha porta de entrada em toda largura. */}
            <button
              type="button"
              onClick={() => {
                setMais(false)
                abrirPaleta()
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-corpo hover:bg-realce"
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">Buscar tela ou ação</span>
              <DicaAtalho />
            </button>
          </div>

          {/* Só de lg para cima, porque abaixo disso não faz nada — ver o mapa
              POSICOES. Um seletor que não muda o que se vê é pior que seletor
              nenhum. */}
          <div className="hidden lg:block">
            <div className="my-3 h-px bg-border" />
            <p className="px-3 pb-2 text-rotulo uppercase text-muted-foreground" id="posicao-do-dock">
              Posição do dock
            </p>
            <div className="space-y-1" role="group" aria-labelledby="posicao-do-dock">
              {(Object.keys(NOME_DA_POSICAO) as PosicaoDock[]).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => definirPosicao(opcao)}
                  aria-pressed={posicao === opcao}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-corpo',
                    posicao === opcao
                      ? 'bg-primary-soft font-medium text-accent-foreground'
                      : 'hover:bg-realce',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {posicao === opcao && <Check className="h-4 w-4" aria-hidden />}
                  </span>
                  {NOME_DA_POSICAO[opcao]}
                </button>
              ))}
            </div>
          </div>

          <div className="my-3 h-px bg-border" />

          <p className="px-3 pb-1 text-rotulo uppercase text-muted-foreground">
            {perfil?.nome || 'Minha conta'}
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={alternarEscuro}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-corpo hover:bg-realce"
            >
              {escuro ? (
                <Sun className="h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <Moon className="h-5 w-5 shrink-0" aria-hidden />
              )}
              {escuro ? 'Tema claro' : 'Tema escuro'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMais(false)
                void sair()
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-corpo text-destructive hover:bg-realce"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              Sair da conta
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
