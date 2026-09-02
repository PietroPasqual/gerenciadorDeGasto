import * as React from 'react'
import { CheckCircle2, Circle, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Cabecalho, Linha } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { Estrelas } from '@/components/common/estrelas'
import { EstadoVazio } from '@/components/common/estados'
import { FaixaRolavel } from '@/components/common/faixa-rolavel'
import { formatCentavos } from '@/lib/money'
import { progressoWishlist } from '@/lib/calculations'
import {
  montarDesejos,
  resumirWishlist,
  type DesejoNaTela,
  type EstadoDesejo,
  type MetaLigada,
} from '@/lib/wishlist'
import { cn } from '@/lib/utils'
import type { WishlistItem } from '@/lib/database.types'

const TEMPLATE = 'md:grid-cols-[1fr,10rem,9rem,11rem,2.5rem]'

const ROTULO: Record<EstadoDesejo, string> = {
  quero: 'Quero comprar',
  juntando: 'Estou juntando',
  conquistado: 'Conquistado',
}

/**
 * A lista de desejos, em três estados.
 *
 * O card antigo somava tudo o que estava pendente e chamava de "Falta juntar".
 * Isso lê uma lista de vontades como dinheiro comprometido — querer um
 * notebook não reserva um centavo —, e é justamente o que a fase 6 proíbe.
 *
 * Agora os estados são três, e o do meio é o único em que existe dinheiro:
 * "estou juntando" quer dizer que o desejo está ligado a uma META, e o quanto
 * vem de lá. Sem meta ligada, o valor do desejo é o preço da coisa, não um
 * compromisso — e a tela diz isso com todas as letras.
 */
export function Wishlist({
  itens,
  metas,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  itens: WishlistItem[]
  /** As metas disponíveis para ligar, com o quanto cada uma já tem. */
  metas: MetaLigada[]
  onAdicionar: (nome: string, valor: number, prioridade: number) => void
  onEditar: (id: string, mudancas: Partial<WishlistItem>) => void
  onRemover: (id: string) => void
}) {
  const [nome, setNome] = React.useState('')
  const [valorCentavos, setValorCentavos] = React.useState(0)
  const [prioridade, setPrioridade] = React.useState(3)
  const [editandoEstado, setEditandoEstado] = React.useState<DesejoNaTela | null>(null)

  const desejos = React.useMemo(() => montarDesejos(itens, metas), [itens, metas])
  const resumo = React.useMemo(() => resumirWishlist(desejos), [desejos])
  const progresso = progressoWishlist(itens)

  const adicionar = () => {
    if (!nome.trim()) return
    onAdicionar(nome.trim(), valorCentavos, prioridade)
    setNome('')
    setValorCentavos(0)
    setPrioridade(3)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Wishlist</CardTitle>
        <CardDescription>
          A lista não reserva dinheiro. Só o que está ligado a uma meta tem valor guardado atrás.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Faixa que desliza no celular, três colunas de sm para cima — mesmo
            tratamento dos indicadores do comparativo anual. */}
        <FaixaRolavel
          rotulo="Resumo da wishlist"
          className={cn(
            '-mx-5 flex snap-x snap-mandatory gap-3 px-5 pb-1',
            'sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0',
          )}
        >
          <Indicador
            Icone={Circle}
            rotulo="Quero comprar"
            valor={resumo.quero}
            // "em desejos", e não "falta juntar": é o preço somado das coisas
            // que você quer, e nenhum centavo dele está separado.
            detalhe={resumo.quero > 0 ? `${formatCentavos(resumo.totalDesejado)} em desejos` : undefined}
          />
          <Indicador
            Icone={PiggyBank}
            rotulo="Estou juntando"
            valor={resumo.juntando}
            className="text-primary"
            detalhe={resumo.juntando > 0 ? `${formatCentavos(resumo.guardadoNasMetas)} nas metas` : undefined}
          />
          <Indicador
            Icone={CheckCircle2}
            rotulo="Conquistados"
            valor={resumo.conquistados}
            className="text-success"
          />
        </FaixaRolavel>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso da wishlist</span>
            <span className="tabular font-medium">
              {progresso.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            </span>
          </div>
          <Progress
            value={progresso.percentual}
            aria-label={`Progresso da wishlist: ${Math.round(progresso.percentual)}%`}
          />
        </div>

        {itens.length === 0 ? (
          <EstadoVazio titulo="Sua wishlist está vazia" descricao="Adicione o primeiro desejo abaixo." />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE}>
              <span>Item</span>
              <span className="text-right">Valor</span>
              <span>Prioridade</span>
              <span>Estado</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>

            {/* CELULAR: card de faixas — [nome] / [valor 🗑] / [estrelas] /
                [estado]. A ordem no DOM segue as colunas do desktop; no
                celular o `order` reposiciona sem duplicar markup. */}
            {desejos.map((desejo) => (
              <Linha
                key={desejo.item.id}
                template={TEMPLATE}
                destacada={desejo.estado === 'conquistado'}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:grid md:gap-2"
              >
                <Input
                  data-celula
                  aria-label="Nome do item"
                  defaultValue={desejo.item.nome}
                  onBlur={(e) => {
                    if (e.target.value !== desejo.item.nome)
                      onEditar(desejo.item.id, { nome: e.target.value })
                  }}
                  className={cn(
                    'order-1 min-w-0 flex-1 basis-full border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:order-none md:basis-auto md:font-normal',
                    desejo.estado === 'conquistado' && 'text-muted-foreground line-through',
                  )}
                />
                <MoneyInput
                  data-celula
                  aria-label="Valor do item"
                  value={desejo.item.valor_centavos}
                  onValueChange={(v) => onEditar(desejo.item.id, { valor_centavos: v })}
                  className="order-2 min-w-0 flex-1 border-transparent bg-transparent font-medium hover:border-input focus:bg-card md:order-none md:font-normal"
                />
                <Estrelas
                  valor={desejo.item.prioridade}
                  onChange={(p) => onEditar(desejo.item.id, { prioridade: p })}
                  className="order-4 basis-full md:order-none md:basis-auto"
                  botaoClassName="h-11 w-11 md:h-auto md:w-auto"
                />
                <BotaoEstado desejo={desejo} onAbrir={() => setEditandoEstado(desejo)} />
                <div className="acoes-hover order-3 flex shrink-0 justify-end md:order-none">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemover(desejo.item.id)}
                    aria-label={`Excluir ${desejo.item.nome}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {/* Adição com a mesma forma do card. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:grid md:grid-cols-[1fr,10rem,9rem,2.5rem] md:gap-2">
          <Input
            placeholder="Novo desejo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome do novo desejo"
            className="min-w-0 flex-1"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Valor do novo desejo"
            className="basis-full md:basis-auto"
          />
          <div className="flex basis-full items-center md:basis-auto">
            <Estrelas
              valor={prioridade}
              onChange={setPrioridade}
              botaoClassName="h-11 w-11 md:h-auto md:w-auto"
            />
          </div>
          <Button
            size="icon"
            className="order-first shrink-0 md:order-none"
            onClick={adicionar}
            aria-label="Adicionar desejo"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <SheetEstado
        desejo={editandoEstado}
        metas={metas}
        onFechar={() => setEditandoEstado(null)}
        onEscolher={(mudancas) => {
          if (editandoEstado) onEditar(editandoEstado.item.id, mudancas)
          setEditandoEstado(null)
        }}
      />
    </Card>
  )
}

/**
 * O estado como UM controle, e não três.
 *
 * Antes havia só uma caixa "conquistado", e nenhum lugar para dizer "estou
 * juntando". Uma caixa mais um seletor de meta seriam dois controles para um
 * estado só, e daria para marcar "juntando" e "conquistado" ao mesmo tempo.
 * Aqui o botão MOSTRA o estado e ABRE a escolha — o alvo é o mesmo nos dois
 * tamanhos e tem 44px.
 */
function BotaoEstado({ desejo, onAbrir }: { desejo: DesejoNaTela; onAbrir: () => void }) {
  const { estado, metaNome, percentual } = desejo

  return (
    <button
      type="button"
      data-celula
      onClick={onAbrir}
      aria-label={`Estado de ${desejo.item.nome}: ${ROTULO[estado]}. Tocar para mudar.`}
      className={cn(
        'alvo-toque order-5 flex min-w-0 basis-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors md:order-none md:basis-auto',
        estado === 'conquistado' && 'border-success/40 bg-success/10',
        estado === 'juntando' && 'border-primary/40 bg-primary-soft',
        estado === 'quero' && 'border-border hover:bg-accent',
      )}
    >
      {estado === 'conquistado' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
      ) : estado === 'juntando' ? (
        <PiggyBank className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">
        {estado === 'juntando' && metaNome ? (
          <>
            {metaNome}
            {percentual !== null && <span className="text-muted-foreground"> · {percentual}%</span>}
          </>
        ) : (
          ROTULO[estado]
        )}
      </span>
    </button>
  )
}

function SheetEstado({
  desejo,
  metas,
  onFechar,
  onEscolher,
}: {
  desejo: DesejoNaTela | null
  metas: MetaLigada[]
  onFechar: () => void
  onEscolher: (mudancas: Partial<WishlistItem>) => void
}) {
  return (
    <Sheet open={desejo !== null} onOpenChange={(aberta) => !aberta && onFechar()}>
      <SheetContent aria-describedby={undefined} className="overflow-y-auto">
        <SheetTitle className="mb-1">{desejo?.item.nome}</SheetTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Em que pé está este desejo? Ligar a uma meta é o que faz o dinheiro guardado aparecer aqui.
        </p>

        {desejo?.metaCompartilhada && (
          <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            Esta meta banca mais de um desejo. O valor guardado é o mesmo dinheiro para os dois — ele não se
            divide sozinho.
          </p>
        )}

        <div className="space-y-2">
          <Opcao
            ativa={desejo?.estado === 'quero'}
            titulo="Só quero comprar"
            detalhe="Fica na lista, sem nenhum dinheiro separado."
            onClick={() => onEscolher({ goal_id: null, concluido: false })}
          />

          {metas.length === 0 ? (
            <p className="rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
              Para juntar dinheiro para isto, crie uma meta em Configurações.
            </p>
          ) : (
            <>
              <p className="pt-2 text-sm font-medium">Estou juntando em…</p>
              {metas.map((meta) => (
                <Opcao
                  key={meta.goal_id}
                  ativa={desejo?.item.goal_id === meta.goal_id && desejo?.estado === 'juntando'}
                  titulo={meta.nome}
                  detalhe={`${formatCentavos(meta.guardado_total)} guardados nesta meta`}
                  onClick={() => onEscolher({ goal_id: meta.goal_id, concluido: false })}
                />
              ))}
            </>
          )}

          <div className="pt-2">
            <Opcao
              ativa={desejo?.estado === 'conquistado'}
              titulo="Já conquistei"
              // A ligação com a meta continua: ela conta a história de como o
              // dinheiro foi juntado, e apagá-la ao marcar seria perder isso.
              detalhe="Sai da conta de pendentes e fica riscado na lista."
              onClick={() => onEscolher({ concluido: true })}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Opcao({
  ativa,
  titulo,
  detalhe,
  onClick,
}: {
  ativa: boolean
  titulo: string
  detalhe: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        'flex w-full min-h-11 flex-col items-start justify-center rounded-xl border px-4 py-2.5 text-left transition-colors',
        ativa ? 'border-primary bg-primary-soft' : 'border-border hover:bg-accent',
      )}
    >
      <span className={cn('text-corpo', ativa && 'font-medium')}>{titulo}</span>
      <span className="text-xs text-muted-foreground">{detalhe}</span>
    </button>
  )
}

function Indicador({
  Icone,
  rotulo,
  valor,
  detalhe,
  className,
}: {
  Icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  detalhe?: string
  className?: string
}) {
  return (
    <div className="flex w-[62%] shrink-0 snap-start items-center gap-3 rounded-xl border border-border p-3 sm:w-auto sm:shrink">
      <Icone className={cn('h-5 w-5 shrink-0', className ?? 'text-muted-foreground')} />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        <p className="tabular text-lg font-semibold">{valor}</p>
        {detalhe && <p className="tabular text-xs text-muted-foreground">{detalhe}</p>}
      </div>
    </div>
  )
}
