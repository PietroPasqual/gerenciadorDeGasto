import * as React from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useEhMobile } from '@/lib/hooks'
import { apagarDados, contarDados, type Contagem } from '@/services/dados'

/** Digitar isto é o que libera o botão. */
const PALAVRA = 'APAGAR'

const ROTULOS: Array<[keyof Contagem, string, string]> = [
  ['lancamentos', 'lançamento', 'lançamentos'],
  ['entradas', 'entrada', 'entradas'],
  ['gastosFixos', 'gasto fixo', 'gastos fixos'],
  ['aportes', 'aporte em meta', 'aportes em metas'],
  ['investimentos', 'investimento', 'investimentos'],
]
const ROTULOS_CATALOGO: Array<[keyof Contagem, string, string]> = [
  ['metas', 'meta', 'metas'],
  ['desejos', 'item na lista de desejos', 'itens na lista de desejos'],
  ['categorias', 'categoria', 'categorias'],
  ['formasPagamento', 'forma de pagamento', 'formas de pagamento'],
]

/**
 * Apagar tudo e recomeçar.
 *
 * Esta é a única operação do app sem volta e que atinge todos os meses de uma
 * vez, então ela é deliberadamente CHATA de executar:
 *
 * 1. Fica no fim das Configurações, longe do caminho de qualquer tarefa comum.
 * 2. A confirmação CONTA o que existe e mostra os números. "Apagar tudo?" não
 *    é informação; "673 lançamentos, 2 metas, 1 gasto fixo" é.
 * 3. Exige digitar a palavra APAGAR. Um "tem certeza?" com botão Sim é clicado
 *    no reflexo; digitar não é.
 * 4. O catálogo (categorias, formas, metas) só some se você marcar. O caso
 *    comum é limpar a movimentação e manter a configuração.
 *
 * Não encerra a conta nem apaga o perfil — limpa os dados e para aí.
 */
export function ApagarDados({ aoApagar }: { aoApagar: () => void }) {
  const ehCelular = useEhMobile(640)
  const [aberto, setAberto] = React.useState(false)
  const [contagem, setContagem] = React.useState<Contagem | null>(null)
  const [carregando, setCarregando] = React.useState(false)
  const [apagando, setApagando] = React.useState(false)
  const [incluirCatalogo, setIncluirCatalogo] = React.useState(false)
  const [digitado, setDigitado] = React.useState('')
  const [erro, setErro] = React.useState('')

  React.useEffect(() => {
    if (!aberto) {
      setContagem(null)
      setDigitado('')
      setIncluirCatalogo(false)
      setErro('')
      setApagando(false)
      return
    }
    let cancelado = false
    setCarregando(true)
    void contarDados()
      .then((c) => !cancelado && setContagem(c))
      .catch(
        (e) => !cancelado && setErro(e instanceof Error ? e.message : 'Não foi possível ler seus dados.'),
      )
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [aberto])

  const linhas = React.useMemo(() => {
    if (!contagem) return []
    const lista = incluirCatalogo ? [...ROTULOS, ...ROTULOS_CATALOGO] : ROTULOS
    return lista
      .filter(([chave]) => contagem[chave] > 0)
      .map(([chave, sing, plur]) => `${contagem[chave]} ${contagem[chave] === 1 ? sing : plur}`)
  }, [contagem, incluirCatalogo])

  const total = linhas.length
  const confirmado = digitado.trim().toUpperCase() === PALAVRA

  async function executar() {
    if (!confirmado) return
    setApagando(true)
    try {
      await apagarDados({ incluirCatalogo })
      setAberto(false)
      aoApagar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível apagar.')
      setApagando(false)
    }
  }

  const corpo = (
    <div className="space-y-4">
      {carregando ? (
        <div className="grid min-h-[6rem] place-items-center" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Contando seus dados…</span>
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Não há nada para apagar{incluirCatalogo ? '' : ' na sua movimentação'}.
        </p>
      ) : (
        <>
          <p className="text-sm">Isto apaga, de todos os meses e anos:</p>
          <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {linhas.map((l) => (
              <li key={l} className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5 shrink-0 text-destructive" />
                {l}
              </li>
            ))}
          </ul>
        </>
      )}

      <label className="flex items-start gap-3 rounded-lg border border-border p-3">
        <Checkbox
          checked={incluirCatalogo}
          onCheckedChange={(v) => setIncluirCatalogo(v === true)}
          aria-label="Apagar também categorias, formas de pagamento e metas"
          className="mt-0.5"
        />
        <span className="text-sm">
          <strong>Apagar também o que eu configurei</strong> — categorias, formas de pagamento, metas e lista
          de desejos. Sem marcar, sua configuração fica e só a movimentação some.
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm">
          Para confirmar, digite <strong>{PALAVRA}</strong>:
        </span>
        <Input
          value={digitado}
          onChange={(e) => setDigitado(e.target.value)}
          placeholder={PALAVRA}
          autoComplete="off"
          aria-label={`Digite ${PALAVRA} para confirmar`}
        />
      </label>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        Não há como desfazer. Se quiser guardar antes, use o Exportar CSV na tela do mês.
      </p>

      {erro && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setAberto(false)} disabled={apagando}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={() => void executar()}
          disabled={!confirmado || apagando || carregando || total === 0}
        >
          {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {apagando ? 'Apagando…' : 'Apagar para sempre'}
        </Button>
      </div>
    </div>
  )

  const titulo = 'Apagar todos os dados'
  const descricao = 'Isto não tem desfazer. Confira o que vai sumir antes de confirmar.'

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-destructive">Zona de perigo</CardTitle>
          <CardDescription>
            Limpar tudo e recomeçar do zero. Útil depois de uma importação que não deu certo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setAberto(true)}>
            <Trash2 className="h-4 w-4" />
            Apagar todos os dados
          </Button>
        </CardContent>
      </Card>

      {ehCelular ? (
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetContent>
            <SheetTitle>{titulo}</SheetTitle>
            <SheetDescription>{descricao}</SheetDescription>
            <div className="mt-4">{corpo}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-w-lg">
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descricao}</DialogDescription>
            <div className="mt-4">{corpo}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
