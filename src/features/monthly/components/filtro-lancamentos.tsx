import * as React from 'react'
import { Filter, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { MoneyInput } from '@/components/common/money-input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SelectSimples } from '@/components/common/select-simples'
import { FILTRO_VAZIO, filtroEstaVazio, quantosFiltros, type Filtro } from '@/lib/filtro-lancamentos'
import type { Category, PaymentMethod } from '@/lib/database.types'
import { cn } from '@/lib/utils'

/**
 * Busca e filtro dos lançamentos do mês.
 *
 * O campo de texto fica sempre visível — é o que a pessoa usa em nove de cada
 * dez vezes. O resto vive atrás de um botão, com um selo dizendo quantos
 * critérios estão ativos: filtro aplicado que não se anuncia faz a pessoa achar
 * que perdeu lançamento.
 *
 * A mesma sheet serve aos dois tamanhos. No PC ela poderia ser um popover, mas
 * são os mesmos oito campos, e manter uma superfície só significa que corrigir
 * um comportamento corrige nos dois lugares.
 */
export function FiltroLancamentos({
  filtro,
  onMudar,
  categorias,
  formasPagamento,
  totalFiltrado,
  totalGeral,
}: {
  filtro: Filtro
  onMudar: (f: Filtro) => void
  categorias: Category[]
  formasPagamento: PaymentMethod[]
  totalFiltrado: number
  totalGeral: number
}) {
  const [aberto, setAberto] = React.useState(false)
  const ativos = quantosFiltros(filtro)
  const filtrando = !filtroEstaVazio(filtro)

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={filtro.texto}
            onChange={(e) => onMudar({ ...filtro, texto: e.target.value })}
            placeholder="Buscar por descrição…"
            aria-label="Buscar lançamento por descrição"
            className="h-11 pl-9 pr-9 md:h-10"
          />
          {filtro.texto !== '' && (
            <button
              type="button"
              onClick={() => onMudar({ ...filtro, texto: '' })}
              aria-label="Limpar a busca"
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant={ativos > 0 ? 'default' : 'outline'}
          className="h-11 shrink-0 md:h-10"
          onClick={() => setAberto(true)}
          aria-label={ativos > 0 ? `Filtros (${ativos} ativos)` : 'Filtros'}
        >
          <Filter className="h-4 w-4 md:mr-1.5" aria-hidden />
          <span className="hidden md:inline">Filtros</span>
          {ativos > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/25 px-1.5 text-xs tabular-nums">
              {ativos}
            </span>
          )}
        </Button>
      </div>

      {/* A contagem só aparece filtrando. Sem ela, uma lista curta parece
          lançamento faltando em vez de filtro aplicado. */}
      {filtrando && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            Mostrando <strong className="text-foreground">{totalFiltrado}</strong> de {totalGeral}
          </span>
          <button
            type="button"
            onClick={() => onMudar(FILTRO_VAZIO)}
            className="min-h-11 rounded-md px-1 underline decoration-dotted underline-offset-4 hover:text-foreground md:min-h-0"
          >
            limpar filtros
          </button>
        </div>
      )}

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent aria-describedby={undefined} className="overflow-y-auto">
          <SheetTitle className="mb-4">Filtrar lançamentos</SheetTitle>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                {(['todos', 'gasto', 'entrada'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onMudar({ ...filtro, tipo: t })}
                    aria-pressed={filtro.tipo === t}
                    className={cn(
                      'min-h-11 flex-1 rounded-lg border px-3 text-sm capitalize transition-colors',
                      filtro.tipo === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <SelectSimples
                valor={filtro.categoriaId}
                onChange={(v) => onMudar({ ...filtro, categoriaId: v, semCategoria: false })}
                opcoes={categorias}
                placeholder="Qualquer categoria"
                rotuloVazio="Qualquer categoria"
                ariaLabel="Filtrar por categoria"
                className="h-11 border-input md:h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <SelectSimples
                valor={filtro.formaId}
                onChange={(v) => onMudar({ ...filtro, formaId: v, semForma: false })}
                opcoes={formasPagamento}
                placeholder="Qualquer forma"
                rotuloVazio="Qualquer forma"
                ariaLabel="Filtrar por forma de pagamento"
                className="h-11 border-input md:h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Valor</Label>
              <div className="flex items-center gap-2">
                <MoneyInput
                  value={filtro.valorMin ?? 0}
                  onValueChange={(v) => onMudar({ ...filtro, valorMin: v === 0 ? null : v })}
                  aria-label="Valor mínimo"
                  className="h-11 md:h-10"
                />
                <span className="shrink-0 text-sm text-muted-foreground">até</span>
                <MoneyInput
                  value={filtro.valorMax ?? 0}
                  onValueChange={(v) => onMudar({ ...filtro, valorMax: v === 0 ? null : v })}
                  aria-label="Valor máximo"
                  className="h-11 md:h-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">Zero em qualquer lado = sem limite.</p>
            </div>

            {/* "Sem categoria" é um pedido de verdade — é como se acha o que
                ficou para trás depois de importar um extrato. */}
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={filtro.semCategoria}
                onCheckedChange={(v) => onMudar({ ...filtro, semCategoria: v === true, categoriaId: null })}
                aria-label="Só os sem categoria"
                className="mt-0.5"
              />
              <span className="text-sm">
                <strong>Só os sem categoria</strong> — o que ficou para trás depois de importar
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={filtro.semForma}
                onCheckedChange={(v) => onMudar({ ...filtro, semForma: v === true, formaId: null })}
                aria-label="Só os sem forma de pagamento"
                className="mt-0.5"
              />
              <span className="text-sm">
                <strong>Só os sem forma de pagamento</strong>
              </span>
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <Button className="min-h-11 w-full" onClick={() => setAberto(false)}>
              Ver {totalFiltrado} {totalFiltrado === 1 ? 'lançamento' : 'lançamentos'}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 w-full"
              disabled={!filtrando}
              onClick={() => onMudar(FILTRO_VAZIO)}
            >
              Limpar filtros
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
