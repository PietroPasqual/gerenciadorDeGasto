import * as React from 'react'
import { AlertTriangle, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SelectSimples } from '@/components/common/select-simples'
import { formatCentavos } from '@/lib/money'
import { useEhMobile } from '@/lib/hooks'
import { sugerirCategoria } from '@/lib/categorizar'
import { agruparPorDestinatario, type GrupoDescricao } from '@/lib/agrupar-descricoes'
import { atualizarCategoriaDeVarios, listarLancamentosDoAno } from '@/services/transactions'
import type { Category, Transaction } from '@/lib/database.types'

/**
 * Preenche a categoria dos gastos que estão sem, no ano inteiro.
 *
 * A primeira versão disto só tentava adivinhar por palavra-chave, e num extrato
 * real acertou ZERO de 311. O motivo não era a lista estar pequena: extrato de
 * conta no Brasil é Pix para nome de gente e de empresa ("Pix enviado para
 * Verli Friedrich"), e nenhuma lista de palavras sabe quem é essa pessoa.
 * Palavra-chave funciona em fatura de cartão, onde vem o nome do comércio.
 *
 * Então a tela mudou de "eu adivinho" para "você decide uma vez por
 * destinatário". As doze linhas do mesmo nome viram uma escolha só. O palpite
 * continua, mas agora é o que ele sempre deveria ter sido: um atalho que
 * preenche alguns campos, não a funcionalidade inteira.
 *
 * Só mexe em quem está sem categoria. O que você classificou à mão fica.
 */
export function CategorizarAutomatico({
  aberto,
  onOpenChange,
  ano,
  categorias,
  aoAplicar,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  ano: number
  categorias: Category[]
  aoAplicar: (quantidade: number) => void
}) {
  const ehCelular = useEhMobile(640)
  const [carregando, setCarregando] = React.useState(false)
  const [aplicando, setAplicando] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [semCategoria, setSemCategoria] = React.useState<Transaction[] | null>(null)
  /** chave do grupo -> id da categoria escolhida */
  const [escolhas, setEscolhas] = React.useState<Record<string, string | null>>({})
  const [mostrarTodos, setMostrarTodos] = React.useState(false)

  React.useEffect(() => {
    if (!aberto) {
      setSemCategoria(null)
      setEscolhas({})
      setErro('')
      setAplicando(false)
      setMostrarTodos(false)
      return
    }
    let cancelado = false
    setCarregando(true)
    void listarLancamentosDoAno(ano)
      .then(
        (linhas) => !cancelado && setSemCategoria(linhas.filter((l) => l.tipo === 'gasto' && !l.category_id)),
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
    () => (semCategoria ? agruparPorDestinatario(semCategoria) : []),
    [semCategoria],
  )

  // O palpite entra como valor inicial de cada grupo — quando acerta, poupa um
  // toque; quando não acerta, o campo fica vazio esperando você.
  React.useEffect(() => {
    if (grupos.length === 0) return
    setEscolhas((atual) => {
      if (Object.keys(atual).length > 0) return atual
      const inicial: Record<string, string | null> = {}
      for (const g of grupos) inicial[g.chave] = sugerirCategoria(g.rotulo, categorias)
      return inicial
    })
  }, [grupos, categorias])

  const LIMITE = 12
  const visiveis = mostrarTodos ? grupos : grupos.slice(0, LIMITE)
  const totalSemCategoria = semCategoria?.length ?? 0
  const marcados = grupos.filter((g) => escolhas[g.chave])
  const lancamentosMarcados = marcados.reduce((s, g) => s + g.ids.length, 0)

  async function aplicar() {
    setAplicando(true)
    try {
      // Uma requisição por categoria, e não por lançamento: agrupa os ids de
      // todos os destinatários que caíram na mesma categoria.
      const porCategoria = new Map<string, string[]>()
      for (const g of marcados) {
        const id = escolhas[g.chave]!
        porCategoria.set(id, [...(porCategoria.get(id) ?? []), ...g.ids])
      }
      let feitos = 0
      for (const [categoria, ids] of porCategoria) {
        feitos += await atualizarCategoriaDeVarios(ids, categoria)
      }
      aoAplicar(feitos)
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
      ) : totalSemCategoria === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todos os gastos de {ano} já têm categoria. Não há o que preencher.
        </p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Os {totalSemCategoria} gastos sem categoria não têm nome de destinatário na descrição (são coisas
          como “TRANSF ENVIADA PIX”), então não dá para agrupar. Dá para classificar um a um na aba Gastos.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Os <strong>{totalSemCategoria}</strong> gastos sem categoria de {ano} vêm de{' '}
            <strong>{grupos.length}</strong> {grupos.length === 1 ? 'destinatário' : 'destinatários'}. Escolha
            a categoria de cada um e todas as linhas dele vão junto.
          </p>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {visiveis.map((g) => (
              <li key={g.chave} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.rotulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.ids.length} {g.ids.length === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
                    {formatCentavos(g.total)}
                  </span>
                </span>
                <SelectSimples
                  valor={escolhas[g.chave] ?? null}
                  onChange={(v) => setEscolhas((a) => ({ ...a, [g.chave]: v }))}
                  opcoes={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
                  placeholder="Categoria"
                  rotuloVazio="Deixar sem categoria"
                  ariaLabel={`Categoria de ${g.rotulo}`}
                  className="w-40 shrink-0 border-input"
                />
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
            Só mexe em quem está sem categoria. O que você já classificou à mão fica como está.
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
          {aplicando ? 'Aplicando…' : `Categorizar ${lancamentosMarcados}`}
        </Button>
      </div>
    </div>
  )

  const titulo = 'Categorizar em bloco'
  const descricao = `Escolha a categoria por destinatário e ela vale para todos os lançamentos dele em ${ano}.`

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
