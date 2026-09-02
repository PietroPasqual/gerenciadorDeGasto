import { Check } from 'lucide-react'
import { CAPAS, NOME_DA_CAPA, type Capa as NomeDeCapa } from '@/lib/painel'
import { cn } from '@/lib/utils'

/**
 * A faixa decorativa no topo do painel.
 *
 * É GRADIENTE E NÃO IMAGEM, e isso foi decidido, não improvisado: capa
 * exigiria arquivos originais em AVIF/WebP, um por variante, e o projeto não
 * tem nenhum. Capa de banco de imagens seria promessa que o produto não
 * cumpre, e hotlink seria dependência de um domínio de terceiro numa tela que
 * precisa abrir offline. O gradiente sai das variáveis do tema, então a mesma
 * capa é rosa no tema rosa e verde no verde, escurece junto no modo escuro,
 * não custa um byte de rede e entra no cache do service worker de graça.
 *
 * NENHUM TEXTO POR CIMA DELA
 *
 * O gradiente varia de luminosidade ao longo da faixa, então texto ali teria
 * contraste diferente em cada ponto — exatamente o tipo de coisa que a
 * calibração do themes.css não alcança, e que já custou caro neste app quando
 * um `opacity-60` derrubou o comparativo anual para 2,54:1. Então a capa é só
 * decoração: `aria-hidden`, e o "Olá, Fulano" fica ABAIXO dela, sobre o fundo
 * de sempre, com a cor de sempre. O scrim existe para essa transição não ser
 * uma linha reta no meio da tela.
 */
export function Capa({ nome }: { nome: NomeDeCapa }) {
  if (nome === 'nenhuma') return null

  return (
    <div
      aria-hidden
      className="relative -mt-6 mb-2 h-capa sm:-mt-8"
      /* As margens laterais negativas sangram a faixa até a borda da tela,
         por fora do padding do .container: uma capa com 1rem de fundo
         sobrando dos dois lados pareceria um card mal cortado.

         Vão por style e não por classe porque o padding que elas anulam é
         `max(1rem, env(...))`, e negar isso exige `calc(-1 * max(...))` —
         `-mx-[max(...)]` do Tailwind geraria `margin: -max(...)`, que não é
         CSS válido e some sem erro nenhum.

         O -mt é classe porque ali o valor é fixo: é o py-6/sm:py-8 do <main>,
         e a capa precisa encostar no header. */
      style={{
        marginLeft: 'calc(-1 * max(1rem, env(safe-area-inset-left)))',
        marginRight: 'calc(-1 * max(1rem, env(safe-area-inset-right)))',
      }}
    >
      <div className="absolute inset-0" style={{ backgroundImage: `var(--capa-${nome})` }} />
      {/* O scrim dissolve a base no fundo da página. Fica num nó separado
          porque são duas camadas de background-image, e empilhá-las na mesma
          propriedade tornaria a ordem delas dependente de quem escreve. */}
      <div className="absolute inset-0 bg-scrim" />
    </div>
  )
}

/**
 * O seletor de capa, que só aparece com o painel em modo de edição.
 *
 * Cada botão é a própria capa em miniatura: escolher "Brasa" numa lista de
 * texto exigiria abrir para descobrir o que é. O nome vai junto mesmo assim —
 * a amostra é conteúdo não-textual, e quem não distingue as cores precisa do
 * rótulo para escolher.
 */
export function SeletorDeCapa({
  atual,
  onEscolher,
}: {
  atual: NomeDeCapa
  onEscolher: (capa: NomeDeCapa) => void
}) {
  return (
    <div role="group" aria-label="Capa do painel" className="flex flex-wrap gap-2">
      {CAPAS.map((nome) => {
        const escolhida = nome === atual
        return (
          <button
            key={nome}
            type="button"
            onClick={() => onEscolher(nome)}
            aria-pressed={escolhida}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-xl border px-2 pr-3 text-corpo transition-colors duration-rapido',
              escolhida ? 'border-primary bg-primary-soft font-medium' : 'border-border hover:bg-realce',
            )}
          >
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border"
              style={nome === 'nenhuma' ? undefined : { backgroundImage: `var(--capa-${nome})` }}
            >
              {/* O tique vai SOBRE a amostra, e não ao lado: com seis botões
                  numa linha, um indicador extra por botão empurraria o último
                  para fora em qualquer celular.

                  E vai dentro de um disco opaco de --background. Um ícone
                  solto aqui estaria sobre um gradiente que muda de
                  luminosidade ponto a ponto, sem contraste garantido em lugar
                  nenhum — e o mínimo de 3:1 para conteúdo não-textual vale
                  aqui como vale no resto do app. O disco dá a ele um fundo
                  conhecido. */}
              {escolhida && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-background">
                  <Check className="h-3.5 w-3.5 text-foreground" />
                </span>
              )}
            </span>
            {NOME_DA_CAPA[nome]}
          </button>
        )
      })}
    </div>
  )
}
