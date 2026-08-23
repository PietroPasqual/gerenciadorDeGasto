import * as React from 'react'
import { AlertTriangle, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SelectSimples } from '@/components/common/select-simples'
import { formatCentavos } from '@/lib/money'
import { useEhMobile } from '@/lib/hooks'
import { sugerirCategoria, sugerirFormaPagamento } from '@/lib/categorizar'
import { agruparPorDestinatario, type GrupoDescricao } from '@/lib/agrupar-descricoes'
import {
  atualizarCategoriaDeVarios,
  atualizarFormaDeVarios,
  listarLancamentosDoAno,
} from '@/services/transactions'
import type { Category, PaymentMethod, Transaction } from '@/lib/database.types'

type Escolha = { categoria: string | null; forma: string | null }

/**
 * Preenche categoria E forma de pagamento dos gastos que estão sem, no ano
 * inteiro, decidindo uma vez por destinatário.
 *
 * Por que os dois campos na mesma tela: extrato de banco não traz nenhum dos
 * dois, então depois de importar faltam os dois nas mesmas centenas de linhas.
 * Fazer duas passadas pela mesma lista seria trabalho dobrado à toa.
 *
 * A diferença entre eles vale saber:
 *
 * - CATEGORIA não dá para inferir. "Pix enviado para Verli Friedrich" pode ser
 *   aluguel, mercado ou empréstimo; só você sabe. O palpite por palavra-chave
 *   só acerta quando vem nome de comércio, o que é cara de fatura de cartão.
 * - FORMA DE PAGAMENTO quase sempre ESTÁ escrita: "Pix enviado" é Pix,
 *   "DEBITO DE CARTAO" é débito. Não é palpite sobre intenção, é o banco
 *   dizendo como o dinheiro saiu — então esta costuma vir preenchida sozinha.
 *
 * Só mexe em campo que está vazio. O que você preencheu à mão fica.
 */
export function PreencherEmBloco({
  aberto,
  onOpenChange,
  ano,
  categorias,
  formas,
  aoAplicar,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  ano: number
  categorias: Category[]
  formas: PaymentMethod[]
  aoAplicar: (quantidade: number) => void
}) {
  const ehCelular = useEhMobile(640)
  const [carregando, setCarregando] = React.useState(false)
  const [aplicando, setAplicando] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [pendentes, setPendentes] = React.useState<Transaction[] | null>(null)
  const [escolhas, setEscolhas] = React.useState<Record<string, Escolha>>({})
  const [mostrarTodos, setMostrarTodos] = React.useState(false)

  React.useEffect(() => {
    if (!aberto) {
      setPendentes(null)
      setEscolhas({})
      setErro('')
      setAplicando(false)
      setMostrarTodos(false)
      return
    }
    let cancelado = false
    setCarregando(true)
    void listarLancamentosDoAno(ano)
      // Falta ALGUM dos dois: uma linha já categorizada mas sem forma continua
      // sendo trabalho pendente.
      .then(
        (linhas) =>
          !cancelado &&
          setPendentes(linhas.filter((l) => l.tipo === 'gasto' && (!l.category_id || !l.payment_method_id))),
      )
      .catch(
        (e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível ler os lançamentos.'),
      )
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [aberto, ano])

  const grupos = React.useMemo<GrupoDescricao[]>(
    () => (pendentes ? agruparPorDestinatario(pendentes) : []),
    [pendentes],
  )

  // Os palpites entram como valor inicial: poupam um toque quando acertam e
  // ficam vazios quando não têm o que dizer.
  React.useEffect(() => {
    if (grupos.length === 0) return
    setEscolhas((atual) => {
      if (Object.keys(atual).length > 0) return atual
      const inicial: Record<string, Escolha> = {}
      for (const g of grupos) {
        inicial[g.chave] = {
          categoria: sugerirCategoria(g.rotulo, categorias),
          forma: sugerirFormaPagamento(g.exemploCru, formas),
        }
      }
      return inicial
    })
  }, [grupos, categorias, formas])

  const LIMITE = 12
  const visiveis = mostrarTodos ? grupos : grupos.slice(0, LIMITE)
  const marcados = grupos.filter((g) => escolhas[g.chave]?.categoria || escolhas[g.chave]?.forma)
  const lancamentosMarcados = marcados.reduce((s, g) => s + g.ids.length, 0)
  const preenchidasForma = grupos
    .filter((g) => escolhas[g.chave]?.forma)
    .reduce((s, g) => s + g.ids.length, 0)

  const definir = (chave: string, campo: keyof Escolha, valor: string | null) =>
    setEscolhas((a) => ({
      ...a,
      [chave]: { ...(a[chave] ?? { categoria: null, forma: null }), [campo]: valor },
    }))

  async function aplicar() {
    setAplicando(true)
    try {
      // Uma requisição por valor, e não por lançamento: junta os ids de todos
      // os destinatários que caíram na mesma categoria (e na mesma forma).
      const porCategoria = new Map<string, string[]>()
      const porForma = new Map<string, string[]>()
      for (const g of marcados) {
        const e = escolhas[g.chave]
        if (e.categoria) porCategoria.set(e.categoria, [...(porCategoria.get(e.categoria) ?? []), ...g.ids])
        if (e.forma) porForma.set(e.forma, [...(porForma.get(e.forma) ?? []), ...g.ids])
      }
      for (const [categoria, ids] of porCategoria) await atualizarCategoriaDeVarios(ids, categoria)
      for (const [forma, ids] of porForma) await atualizarFormaDeVarios(ids, forma)
      aoAplicar(lancamentosMarcados)
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
      setAplicando(false)
    }
  }

  const corpo = (
    <div className="space-y-4">
      {carregando ? (
        <div className="grid min-h-[8rem] place-items-center" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Lendo os lançamentos de {ano}…</span>
        </div>
      ) : (pendentes?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todos os gastos de {ano} já têm categoria e forma de pagamento. Não há o que preencher.
        </p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Os {pendentes?.length} gastos pendentes não têm nome de destinatário na descrição (são coisas como
          “TRANSF ENVIADA PIX”), então não dá para agrupar. Dá para preencher um a um na aba Gastos.
        </p>
      ) : (
        <>
          <p className="text-sm">
            <strong>{pendentes?.length}</strong> gastos de {ano} estão sem categoria ou sem forma de
            pagamento, vindos de <strong>{grupos.length}</strong>{' '}
            {grupos.length === 1 ? 'destinatário' : 'destinatários'}. O que você escolher vale para todas as
            linhas daquele destinatário.
          </p>
          {preenchidasForma > 0 && (
            <p className="text-sm text-muted-foreground">
              A forma de pagamento de {preenchidasForma}{' '}
              {preenchidasForma === 1 ? 'lançamento veio preenchida' : 'lançamentos veio preenchida'} pela
              própria descrição (“Pix enviado”, “débito”…). Confira antes de aplicar.
            </p>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border">
            {visiveis.map((g) => (
              <li key={g.chave} className="space-y-2 p-3">
                <span className="block">
                  <span className="block truncate text-sm font-medium">{g.rotulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.ids.length} {g.ids.length === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
                    {formatCentavos(g.total)}
                  </span>
                </span>
                {/* Empilhados no celular e lado a lado a partir de sm: dois
                    selects numa linha de 390px deixariam 90px para cada. */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <SelectSimples
                    valor={escolhas[g.chave]?.categoria ?? null}
                    onChange={(v) => definir(g.chave, 'categoria', v)}
                    opcoes={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
                    placeholder="Categoria"
                    rotuloVazio="Sem categoria"
                    ariaLabel={`Categoria de ${g.rotulo}`}
                    className="border-input"
                  />
                  <SelectSimples
                    valor={escolhas[g.chave]?.forma ?? null}
                    onChange={(v) => definir(g.chave, 'forma', v)}
                    opcoes={formas.map((f) => ({ id: f.id, nome: f.nome }))}
                    placeholder="Forma de pagamento"
                    rotuloVazio="Sem forma"
                    ariaLabel={`Forma de pagamento de ${g.rotulo}`}
                    className="border-input"
                  />
                </div>
              </li>
            ))}
          </ul>

          {grupos.length > LIMITE && (
            <Button variant="outline" className="w-full" onClick={() => setMostrarTodos((v) => !v)}>
              {mostrarTodos
                ? `Mostrar só os ${LIMITE} maiores`
                : `Ver os outros ${grupos.length - LIMITE} destinatários`}
            </Button>
          )}

          <p className="text-sm text-muted-foreground">
            Só preenche campo vazio. O que você já escolheu à mão fica como está.
          </p>
        </>
      )}

      {erro && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>
          Cancelar
        </Button>
        <Button
          onClick={() => void aplicar()}
          disabled={lancamentosMarcados === 0 || aplicando || carregando}
        >
          {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {aplicando ? 'Aplicando…' : `Preencher ${lancamentosMarcados}`}
        </Button>
      </div>
    </div>
  )

  const titulo = 'Preencher em bloco'
  const descricao = `Categoria e forma de pagamento por destinatário, valendo para todos os lançamentos dele em ${ano}.`

  if (ehCelular) {
    return (
      <Sheet open={aberto} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{descricao}</SheetDescription>
          <div className="mt-4">{corpo}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
        <div className="mt-4">{corpo}</div>
      </DialogContent>
    </Dialog>
  )
}
