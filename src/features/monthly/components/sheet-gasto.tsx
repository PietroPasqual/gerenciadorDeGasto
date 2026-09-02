import * as React from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { centavosParaTexto } from '@/lib/money'
import { paraDataISO, periodoAtual, primeiroDiaISO } from '@/lib/dates'
import { MAX_PARCELAS } from '@/lib/parcelamento'
import { consequenciasDoRascunho } from '@/lib/consequencias'
import { cn } from '@/lib/utils'
import { ChipsEscolha } from '@/components/common/chips-escolha'
import { BlocoConsequencias } from './bloco-consequencias'
import type { Category, PaymentMethod, Transaction } from '@/lib/database.types'

export interface DadosGasto {
  tipo: 'gasto' | 'entrada'
  data: string
  descricao: string
  payment_method_id: string | null
  category_id: string | null
  valor_centavos: number
  /** Ausente ou 1 = à vista. Acima disso, `valor_centavos` é o TOTAL da compra. */
  parcelas?: number
}

/** Data padrão: hoje se o mês aberto for o atual, senão o dia 1 daquele mês. */
function dataPadrao(ano: number, mes: number) {
  const hoje = periodoAtual()
  return hoje.ano === ano && hoje.mes === mes ? paraDataISO(new Date()) : primeiroDiaISO({ ano, mes })
}

/**
 * Lançar/editar no celular — e, no PC, o caminho do botão "Lançar gasto".
 *
 * A ordem dos campos é a do polegar, não a da tabela: o valor vem primeiro e
 * já com foco, porque é a única coisa que a pessoa sempre sabe na hora. Forma
 * e categoria são chips e não <select> — um toque em vez de abrir uma lista.
 *
 * Logo acima do botão fica o que vai acontecer ao salvar: em que fatura a
 * compra cai, como ela se divide, e se o lançamento é de outro mês. Antes
 * isso só se descobria depois, olhando os totais mudarem.
 */
export function SheetGasto({
  aberta,
  onOpenChange,
  ano,
  mes,
  formasPagamento,
  categorias,
  gasto,
  onSalvar,
  onExcluir,
}: {
  aberta: boolean
  onOpenChange: (aberta: boolean) => void
  ano: number
  mes: number
  formasPagamento: PaymentMethod[]
  categorias: Category[]
  /** Ausente = novo lançamento; presente = edição. */
  gasto?: Transaction | null
  onSalvar: (dados: DadosGasto) => void
  onExcluir?: () => void
}) {
  const editando = Boolean(gasto)

  const [tipo, setTipo] = React.useState<'gasto' | 'entrada'>('gasto')
  const [valorTexto, setValorTexto] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [data, setData] = React.useState(() => dataPadrao(ano, mes))
  const [formaId, setFormaId] = React.useState<string | null>(null)
  const [categoriaId, setCategoriaId] = React.useState<string | null>(null)
  // 1 = à vista. Só aparece em lançamento novo: parcelar um gasto que já
  // existe seria apagá-lo e criar N no lugar, e isso a pessoa faz explicitamente.
  const [parcelas, setParcelas] = React.useState(1)
  // Parcelar é a exceção — quase toda compra é à vista. O campo fica recolhido
  // para o formulário caber na tela sem rolagem no caso comum.
  const [parcelando, setParcelando] = React.useState(false)
  const valorRef = React.useRef<HTMLInputElement>(null)

  // Ao abrir, recarrega o formulário a partir do gasto (ou zera, se for novo).
  React.useEffect(() => {
    if (!aberta) return
    setTipo(gasto?.tipo ?? 'gasto')
    setValorTexto(gasto ? centavosParaTexto(gasto.valor_centavos) : '')
    setDescricao(gasto?.descricao ?? '')
    setData(gasto?.data.slice(0, 10) ?? dataPadrao(ano, mes))
    setFormaId(gasto?.payment_method_id ?? null)
    setCategoriaId(gasto?.category_id ?? null)
    setParcelas(1)
    setParcelando(false)
    // O teclado numérico já sobe: é o campo que a pessoa veio preencher.
    const t = setTimeout(() => valorRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [aberta, gasto, ano, mes])

  const centavos = React.useMemo(() => {
    const digitos = valorTexto.replace(/\D/g, '')
    return digitos ? Number(digitos) : 0
  }, [valorTexto])

  const ehEntrada = tipo === 'entrada'
  // Parcelar é coisa de gasto: dinheiro que entra entra inteiro.
  const parcelasEfetivas = !editando && !ehEntrada && parcelando ? parcelas : 1

  /**
   * As mesmas funções que o app usa depois de salvar (`vaiParaFatura`,
   * `faturaDaCompra`, `dividirEmParcelas`) — a prévia não tem regra própria,
   * senão ela e o resultado acabariam discordando.
   */
  const consequencias = React.useMemo(
    () =>
      consequenciasDoRascunho(
        {
          tipo,
          data,
          valorCentavos: centavos,
          parcelas: parcelasEfetivas,
          formaId: ehEntrada ? null : formaId,
        },
        formasPagamento,
        { ano, mes },
      ),
    [tipo, data, centavos, parcelasEfetivas, formaId, ehEntrada, formasPagamento, ano, mes],
  )

  const montar = (): DadosGasto => ({
    tipo,
    data: data || dataPadrao(ano, mes),
    descricao: descricao.trim() || (ehEntrada ? 'Entrada' : 'Gasto'),
    payment_method_id: ehEntrada ? null : formaId,
    category_id: ehEntrada ? null : categoriaId,
    valor_centavos: centavos,
    parcelas: parcelasEfetivas > 1 ? parcelasEfetivas : undefined,
  })

  const salvar = (continuar: boolean) => {
    if (centavos === 0 && !descricao.trim()) return
    onSalvar(montar())
    if (continuar) {
      // Forma, categoria e data seguem preenchidas: lançar vários seguidos é
      // o caso comum, e repetir a escolha a cada item cansa.
      setValorTexto('')
      setDescricao('')
      setParcelando(false)
      setParcelas(1)
      valorRef.current?.focus()
    } else {
      onOpenChange(false)
    }
  }

  const titulo = editando ? 'Editar gasto' : ehEntrada ? 'Nova entrada' : 'Novo gasto'

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined} className="overflow-y-auto">
        <SheetTitle className="mb-4">{titulo}</SheetTitle>

        <div className="space-y-5">
          {/* Trocar gasto por entrada só faz sentido antes de existir: mudar o
              tipo de um lançamento salvo mexeria no saldo dos dois lados de
              uma vez, e isso é apagar e relançar, não editar. */}
          {!editando && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { valor: 'gasto', rotulo: 'Gasto' },
                  { valor: 'entrada', rotulo: 'Entrada' },
                ] as const
              ).map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setTipo(o.valor)}
                  aria-pressed={tipo === o.valor}
                  className={cn(
                    'min-h-11 rounded-xl border text-corpo transition-colors',
                    tipo === o.valor
                      ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          )}

          {/* Valor: o campo grande, primeiro, com o teclado numérico já aberto */}
          <div className="space-y-1.5">
            <Label htmlFor="sheet-valor">Valor</Label>
            <div className="flex items-baseline gap-2 rounded-2xl border border-input bg-card px-4 py-3">
              <span className="text-secao text-muted-foreground">R$</span>
              <input
                ref={valorRef}
                id="sheet-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valorTexto}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, '').slice(0, 15)
                  setValorTexto(digitos ? centavosParaTexto(Number(digitos)) : '')
                }}
                className="tabular w-full bg-transparent text-[1.75rem] font-semibold outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sheet-descricao">Descrição</Label>
            <Input
              id="sheet-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={ehEntrada ? 'Ex.: Freela' : 'Ex.: Mercado'}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sheet-data">Data</Label>
            <Input
              id="sheet-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Entrada com data é só descrição, valor e dia — é o que a tabela de
              Entradas mostra dela. Oferecer forma e categoria aqui criaria um
              dado que nenhuma tela exibe depois. */}
          {!ehEntrada && (
            <>
              <ChipsEscolha
                rotulo="Forma de pagamento"
                opcoes={formasPagamento}
                selecionado={formaId}
                onSelecionar={setFormaId}
              />
              <ChipsEscolha
                rotulo="Categoria"
                opcoes={categorias}
                selecionado={categoriaId}
                onSelecionar={setCategoriaId}
                comCor
              />
            </>
          )}

          {!editando && !ehEntrada && (
            <CampoParcelas
              aberto={parcelando}
              onAbrirChange={(a) => {
                setParcelando(a)
                if (!a) setParcelas(1)
                else if (parcelas < 2) setParcelas(2)
              }}
              parcelas={parcelas}
              onChange={setParcelas}
            />
          )}

          <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-border bg-card px-5 pb-1 pt-3">
            <BlocoConsequencias consequencias={consequencias} />

            <div className="space-y-2">
              <Button className="h-12 w-full text-base" onClick={() => salvar(false)}>
                {editando ? 'Salvar alterações' : 'Salvar'}
              </Button>
              {!editando && (
                <Button variant="outline" className="h-12 w-full text-base" onClick={() => salvar(true)}>
                  Salvar e lançar outro
                </Button>
              )}
              {editando && onExcluir && (
                <Button
                  variant="ghost"
                  className="h-12 w-full text-base text-destructive hover:text-destructive"
                  onClick={() => {
                    onExcluir()
                    onOpenChange(false)
                  }}
                >
                  Excluir gasto
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Em quantas vezes — recolhido até alguém pedir.
 *
 * O valor digitado continua sendo o TOTAL da compra, não o da parcela: é como
 * a maquininha pergunta ("R$ 1.200 em 12x") e como a pessoa pensa. Quanto fica
 * cada parcela e até quando a série vai são consequências, e por isso elas são
 * ditas no bloco acima do botão, junto com a fatura — não aqui, onde ficariam
 * a três campos de distância do resto do mesmo assunto.
 */
function CampoParcelas({
  aberto,
  onAbrirChange,
  parcelas,
  onChange,
}: {
  aberto: boolean
  onAbrirChange: (aberto: boolean) => void
  parcelas: number
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onAbrirChange(!aberto)}
        aria-expanded={aberto}
        aria-controls="sheet-parcelas-campo"
        className="alvo-toque flex w-full items-center justify-between rounded-xl border border-border px-4 text-corpo transition-colors hover:bg-accent"
      >
        <span>Parcelar compra</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', aberto && 'rotate-180')}
          aria-hidden
        />
      </button>

      {aberto && (
        <div id="sheet-parcelas-campo" className="flex items-center gap-2">
          {/* Alvos de 44px: no celular estes são os botões, não o campo. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={parcelas <= 2}
            onClick={() => onChange(Math.max(2, parcelas - 1))}
            aria-label="Menos uma parcela"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            id="sheet-parcelas"
            type="number"
            inputMode="numeric"
            min={2}
            max={MAX_PARCELAS}
            value={parcelas}
            aria-label="Número de parcelas"
            onChange={(e) => {
              const n = Number(e.target.value)
              onChange(Number.isFinite(n) ? Math.min(MAX_PARCELAS, Math.max(2, Math.round(n))) : 2)
            }}
            className="h-11 flex-1 text-center text-base"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={parcelas >= MAX_PARCELAS}
            onClick={() => onChange(Math.min(MAX_PARCELAS, parcelas + 1))}
            aria-label="Mais uma parcela"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
