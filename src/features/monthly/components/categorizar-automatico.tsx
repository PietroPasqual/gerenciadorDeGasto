import * as React from 'react'
import { AlertTriangle, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { formatCentavos } from '@/lib/money'
import { useEhMobile } from '@/lib/hooks'
import { sugerirCategoria } from '@/lib/categorizar'
import { atualizarCategoriaDeVarios, listarLancamentosDoAno } from '@/services/transactions'
import type { Category, Transaction } from '@/lib/database.types'

type Grupo = { categoria: Category; ids: string[]; total: number; exemplos: string[] }

/**
 * Preenche a categoria de lançamentos que estão sem, adivinhando pela
 * descrição.
 *
 * Trabalha no ANO inteiro, e não no mês aberto, de propósito: quem importa um
 * extrato importa um ano de uma vez, e repetir a operação doze vezes não é
 * conserto, é castigo.
 *
 * Só mexe em quem está SEM categoria. Nunca sobrescreve uma escolha sua — se
 * você classificou algo à mão, fica como está, mesmo que a regra discorde.
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

  React.useEffect(() => {
    if (!aberto) {
      setSemCategoria(null)
      setErro('')
      setAplicando(false)
      return
    }
    let cancelado = false
    setCarregando(true)
    void listarLancamentosDoAno(ano)
      .then((linhas) => {
        if (cancelado) return
        setSemCategoria(linhas.filter((l) => l.tipo === 'gasto' && !l.category_id))
      })
      .catch(
        (e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível ler os lançamentos.'),
      )
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [aberto, ano])

  const grupos = React.useMemo<Grupo[]>(() => {
    if (!semCategoria) return []
    const mapa = new Map<string, Grupo>()
    for (const lancamento of semCategoria) {
      const id = sugerirCategoria(lancamento.descricao, categorias)
      if (!id) continue
      const categoria = categorias.find((c) => c.id === id)
      if (!categoria) continue
      const grupo = mapa.get(id) ?? { categoria, ids: [], total: 0, exemplos: [] }
      grupo.ids.push(lancamento.id)
      grupo.total += lancamento.valor_centavos
      if (grupo.exemplos.length < 2 && !grupo.exemplos.includes(lancamento.descricao)) {
        grupo.exemplos.push(lancamento.descricao)
      }
      mapa.set(id, grupo)
    }
    return [...mapa.values()].sort((a, b) => b.ids.length - a.ids.length)
  }, [semCategoria, categorias])

  const reconhecidos = grupos.reduce((s, g) => s + g.ids.length, 0)
  const totalSemCategoria = semCategoria?.length ?? 0
  const restantes = totalSemCategoria - reconhecidos

  async function aplicar() {
    setAplicando(true)
    try {
      let feitos = 0
      for (const grupo of grupos) {
        feitos += await atualizarCategoriaDeVarios(grupo.ids, grupo.categoria.id)
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
      ) : (
        <>
          <p className="text-sm">
            <strong>{reconhecidos}</strong> de <strong>{totalSemCategoria}</strong>{' '}
            {totalSemCategoria === 1 ? 'gasto sem categoria' : 'gastos sem categoria'} em {ano}{' '}
            {reconhecidos === 1 ? 'foi reconhecido' : 'foram reconhecidos'} pela descrição.
            {restantes > 0 && (
              <>
                {' '}
                {restantes === 1
                  ? 'O outro fica como está — em geral é Pix para pessoa, que o extrato não explica.'
                  : `Os outros ${restantes} ficam como estão — em geral são Pix para pessoas, que o extrato não explica.`}
              </>
            )}
          </p>

          {grupos.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {grupos.map((g) => (
                <li key={g.categoria.id} className="flex items-start gap-3 p-3">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.categoria.cor }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <strong className="text-sm">{g.categoria.nome}</strong>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {g.ids.length} {g.ids.length === 1 ? 'gasto' : 'gastos'} · {formatCentavos(g.total)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {g.exemplos.join(' · ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
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
        <Button onClick={() => void aplicar()} disabled={reconhecidos === 0 || aplicando || carregando}>
          {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {aplicando ? 'Aplicando…' : `Categorizar ${reconhecidos}`}
        </Button>
      </div>
    </div>
  )

  const titulo = 'Categorizar automaticamente'
  const descricao = `Preencher a categoria dos gastos de ${ano} que estão sem, pela descrição.`

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
      <DialogContent className="max-w-lg">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
        <div className="mt-4">{corpo}</div>
      </DialogContent>
    </Dialog>
  )
}
