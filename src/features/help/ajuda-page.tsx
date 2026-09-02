import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { EstadoVazio } from '@/components/common/estados'
import { filtrarTopicos, realcarTrechos } from '@/lib/busca-ajuda'
import { cn } from '@/lib/utils'
import { GRUPOS, TOPICOS, type TopicoAjuda } from './conteudo'

/**
 * O manual.
 *
 * Duas leituras diferentes acontecem aqui, e a tela serve as duas: quem chegou
 * com uma dúvida formada ("por que meu gasto de agosto não descontou") digita e
 * lê um assunto; quem chegou para conhecer o app rola e lê tudo. Por isso os
 * tópicos ficam ABERTOS: sanfona fechada obriga a abrir um por um, e mata o
 * Ctrl+F do navegador, que é a busca que a pessoa já sabe usar.
 *
 * Cada tópico tem endereço próprio (`/ajuda#fatura`), e é assim que as outras
 * telas mandam para cá — a explicação longa mora num lugar só.
 */
export function AjudaPage() {
  const [busca, setBusca] = React.useState('')
  const { hash } = useLocation()
  const alvo = hash.replace('#', '')

  const encontrados = React.useMemo(() => filtrarTopicos(TOPICOS, busca), [busca])
  const buscando = busca.trim() !== ''

  /**
   * Chegou por link com âncora: rola até o tópico e o destaca por um instante.
   *
   * O salto do navegador sozinho deixa o título colado no topo e sem nenhuma
   * pista de qual dos doze blocos é o que responde à pergunta — ainda mais
   * porque quem veio de outra tela não escolheu este destino, foi mandado.
   */
  React.useEffect(() => {
    if (!alvo) return
    document.getElementById(alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [alvo])

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Ajuda"
        descricao="Como o app funciona, e por que os números fazem o que fazem."
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar na ajuda — ex.: fatura, parcelas, offline"
          aria-label="Buscar na ajuda"
          className="h-12 pl-9 pr-11 text-base"
        />
        {buscando && (
          <button
            type="button"
            onClick={() => setBusca('')}
            aria-label="Limpar a busca"
            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {buscando ? (
        encontrados.length === 0 ? (
          <EstadoVazio
            titulo="Nada na ajuda sobre isso"
            descricao="Tente uma palavra mais curta — ou role a página, que o manual inteiro está aqui embaixo."
            ilustracao="lista"
          />
        ) : (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{encontrados.length}</strong>{' '}
              {encontrados.length === 1 ? 'assunto encontrado' : 'assuntos encontrados'}.
            </p>
            {encontrados.map((topico) => (
              <BlocoTopico key={topico.id} topico={topico} busca={busca} destacado={topico.id === alvo} />
            ))}
          </section>
        )
      ) : (
        <>
          <Indice />
          {GRUPOS.map((grupo) => (
            <section key={grupo.id} className="space-y-4">
              <div>
                <h2 className="text-secao font-semibold">{grupo.titulo}</h2>
                <p className="text-sm text-muted-foreground">{grupo.descricao}</p>
              </div>
              {TOPICOS.filter((t) => t.grupo === grupo.id).map((topico) => (
                <BlocoTopico key={topico.id} topico={topico} busca="" destacado={topico.id === alvo} />
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Os doze assuntos em uma tela.
 *
 * O manual passa de uma tela de altura, e sem isto a única forma de saber o que
 * tem aqui é rolar até o fim. Não é `sticky` de propósito: no celular ele
 * comeria metade da tela, e no PC a busca logo acima já é o caminho rápido.
 */
function Indice() {
  return (
    <nav aria-label="Assuntos da ajuda" className="flex flex-wrap gap-2">
      {TOPICOS.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          className="alvo-toque flex items-center rounded-full border border-border px-3.5 text-sm transition-colors hover:bg-accent"
        >
          {t.titulo}
        </a>
      ))}
    </nav>
  )
}

function BlocoTopico({
  topico,
  busca,
  destacado,
}: {
  topico: TopicoAjuda
  busca: string
  destacado: boolean
}) {
  return (
    <Card
      id={topico.id}
      // `scroll-mt`: o cabeçalho do celular é fixo, e sem margem de rolagem o
      // título do tópico para exatamente atrás dele.
      className={cn('scroll-mt-24', destacado && 'ring-2 ring-primary')}
    >
      <CardHeader className="pb-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <topico.Icone className="h-5 w-5" />
        </span>
        <CardTitle>
          <Realce texto={topico.titulo} busca={busca} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          <Realce texto={topico.resumo} busca={busca} />
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Os assuntos ficam abertos, então repetir a linha que casou num bloco
            à parte mostraria a mesma frase duas vezes. O realce responde a
            mesma pergunta — por que este resultado apareceu — sem repetir. */}
        <ul className="space-y-2 text-sm text-muted-foreground">
          {topico.corpo.map((linha) => (
            <li key={linha} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>
                <Realce texto={linha} busca={busca} />
              </span>
            </li>
          ))}
        </ul>

        {topico.para && (
          <Link
            to={topico.para}
            className="alvo-toque inline-flex items-center gap-1.5 text-sm font-medium text-accent-foreground hover:underline"
          >
            Ir para {topico.titulo.toLowerCase()}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * O texto com os termos da busca marcados.
 *
 * `<mark>` e não uma <span> colorida: o elemento existe para isto, e leitores
 * de tela anunciam o trecho como destacado. A cor de fundo vem do realce do
 * tema, que já é calibrado para o texto normal continuar legível por cima —
 * amarelo de navegador reprovaria contraste no modo escuro.
 */
function Realce({ texto, busca }: { texto: string; busca: string }) {
  const pedacos = realcarTrechos(texto, busca)
  return (
    <>
      {pedacos.map((p, i) =>
        p.realce ? (
          <mark key={i} className="rounded bg-realce px-0.5 text-foreground">
            {p.texto}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.texto}</React.Fragment>
        ),
      )}
    </>
  )
}
