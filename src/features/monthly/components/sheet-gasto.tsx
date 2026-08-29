import * as React from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { centavosParaTexto, formatCentavos } from '@/lib/money'
import { formatDataISO, paraDataISO, periodoAtual, primeiroDiaISO } from '@/lib/dates'
import { MAX_PARCELAS, datasDasParcelas, dividirEmParcelas } from '@/lib/parcelamento'
import { cn } from '@/lib/utils'
import type { Category, PaymentMethod, Transaction } from '@/lib/database.types'

export interface DadosGasto {
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
 * Lançar/editar um gasto no celular.
 *
 * A ordem dos campos é a do polegar, não a da tabela: o valor vem primeiro e
 * já com foco, porque é a única coisa que a pessoa sempre sabe na hora. Forma
 * e categoria são chips e não <select> — um toque em vez de abrir uma lista.
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

  const [valorTexto, setValorTexto] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [data, setData] = React.useState(() => dataPadrao(ano, mes))
  const [formaId, setFormaId] = React.useState<string | null>(null)
  const [categoriaId, setCategoriaId] = React.useState<string | null>(null)
  // 1 = à vista. Só aparece em lançamento novo: parcelar um gasto que já
  // existe seria apagá-lo e criar N no lugar, e isso a pessoa faz explicitamente.
  const [parcelas, setParcelas] = React.useState(1)
  const valorRef = React.useRef<HTMLInputElement>(null)

  // Ao abrir, recarrega o formulário a partir do gasto (ou zera, se for novo).
  React.useEffect(() => {
    if (!aberta) return
    setValorTexto(gasto ? centavosParaTexto(gasto.valor_centavos) : '')
    setDescricao(gasto?.descricao ?? '')
    setData(gasto?.data.slice(0, 10) ?? dataPadrao(ano, mes))
    setFormaId(gasto?.payment_method_id ?? null)
    setCategoriaId(gasto?.category_id ?? null)
    setParcelas(1)
    // O teclado numérico já sobe: é o campo que a pessoa veio preencher.
    const t = setTimeout(() => valorRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [aberta, gasto, ano, mes])

  const centavos = React.useMemo(() => {
    const digitos = valorTexto.replace(/\D/g, '')
    return digitos ? Number(digitos) : 0
  }, [valorTexto])

  const montar = (): DadosGasto => ({
    data: data || dataPadrao(ano, mes),
    descricao: descricao.trim() || 'Gasto',
    payment_method_id: formaId,
    category_id: categoriaId,
    valor_centavos: centavos,
    parcelas: parcelas > 1 ? parcelas : undefined,
  })

  const salvar = (continuar: boolean) => {
    if (centavos === 0 && !descricao.trim()) return
    onSalvar(montar())
    if (continuar) {
      // Forma, categoria e data seguem preenchidas: lançar vários seguidos é
      // o caso comum, e repetir a escolha a cada item cansa.
      setValorTexto('')
      setDescricao('')
      valorRef.current?.focus()
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={aberta} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle className="mb-4">{editando ? 'Editar gasto' : 'Novo gasto'}</SheetTitle>

        <div className="space-y-5">
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
              placeholder="Ex.: Mercado"
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

          <Chips
            rotulo="Forma de pagamento"
            opcoes={formasPagamento}
            selecionado={formaId}
            onSelecionar={setFormaId}
          />
          <Chips
            rotulo="Categoria"
            opcoes={categorias}
            selecionado={categoriaId}
            onSelecionar={setCategoriaId}
            comCor
          />

          {!editando && (
            <CampoParcelas
              parcelas={parcelas}
              onChange={setParcelas}
              totalCentavos={centavos}
              primeiraDataISO={data || dataPadrao(ano, mes)}
            />
          )}

          <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-border bg-card px-5 pb-1 pt-3">
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
      </SheetContent>
    </Sheet>
  )
}

/** Lista de chips de escolha única — inclui "Sem definir" para poder limpar. */
function Chips({
  rotulo,
  opcoes,
  selecionado,
  onSelecionar,
  comCor,
}: {
  rotulo: string
  opcoes: Array<{ id: string; nome: string; cor?: string }>
  selecionado: string | null
  onSelecionar: (id: string | null) => void
  comCor?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{rotulo}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = selecionado === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelecionar(ativo ? null : o.id)}
              aria-pressed={ativo}
              className={cn(
                'flex min-h-[2.75rem] items-center gap-2 rounded-full border px-4 text-corpo transition-colors',
                ativo
                  ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                  : 'border-border hover:bg-accent',
              )}
            >
              {comCor && o.cor && (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: o.cor }}
                />
              )}
              {o.nome}
              {ativo && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Em quantas vezes.
 *
 * O valor digitado continua sendo o TOTAL da compra, não o da parcela — é como
 * a maquininha pergunta ("R$ 1.200 em 12x") e como a pessoa pensa. A prévia
 * mostra o valor de cada parcela justamente porque a divisão nem sempre é
 * redonda, e ver "1x de R$ 33,34 e 2x de R$ 33,33" antes de salvar evita a
 * dúvida de um centavo depois.
 */
function CampoParcelas({
  parcelas,
  onChange,
  totalCentavos,
  primeiraDataISO,
}: {
  parcelas: number
  onChange: (n: number) => void
  totalCentavos: number
  primeiraDataISO: string
}) {
  const valores = totalCentavos > 0 && parcelas > 1 ? dividirEmParcelas(totalCentavos, parcelas) : []
  const datas = parcelas > 1 ? datasDasParcelas(primeiraDataISO, parcelas) : []
  const primeiraDiferente = valores.length > 1 && valores[0] !== valores[1]

  return (
    <div className="space-y-2">
      <Label htmlFor="sheet-parcelas">Parcelas</Label>
      <div className="flex items-center gap-2">
        {/* Alvos de 44px: no celular estes são os botões, não o campo. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={parcelas <= 1}
          onClick={() => onChange(Math.max(1, parcelas - 1))}
          aria-label="Menos uma parcela"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          id="sheet-parcelas"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PARCELAS}
          value={parcelas}
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) ? Math.min(MAX_PARCELAS, Math.max(1, Math.round(n))) : 1)
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

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        {parcelas <= 1 ? (
          'À vista — o valor sai todo de uma vez.'
        ) : valores.length === 0 ? (
          `${parcelas}x — preencha o valor total da compra para ver cada parcela.`
        ) : primeiraDiferente ? (
          <>
            1x de <strong>{formatCentavos(valores[0])}</strong> e {parcelas - 1}x de{' '}
            <strong>{formatCentavos(valores[1])}</strong>. A sobra de centavos vai na primeira, que é como o
            cartão faz. Última em {formatDataISO(datas[datas.length - 1])}.
          </>
        ) : (
          <>
            {parcelas}x de <strong>{formatCentavos(valores[0])}</strong>. Última em{' '}
            {formatDataISO(datas[datas.length - 1])}.
          </>
        )}
      </p>
    </div>
  )
}
