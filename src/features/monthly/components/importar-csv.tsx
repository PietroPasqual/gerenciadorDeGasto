import * as React from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCentavos } from '@/lib/money'
import { formatDataISO } from '@/lib/dates'
import { useEhMobile } from '@/lib/hooks'
import {
  adivinharColunas,
  decodificarTexto,
  lerCSV,
  prepararImportacao,
  type ArquivoCSV,
  type Campo,
  type Existente,
  type Mapa,
  type RegraSinal,
  type Resultado,
} from '@/lib/importar-csv'
import { criarLancamentosEmLote, listarLancamentosPorIntervalo } from '@/services/transactions'
import type { Category, PaymentMethod } from '@/lib/database.types'

const SEM_COLUNA = '__nenhuma__'

const ROTULOS: Record<Campo, string> = {
  data: 'Data',
  descricao: 'Descrição',
  valor: 'Valor',
  categoria: 'Categoria',
  forma: 'Forma de pagamento',
}

const OBRIGATORIOS: Campo[] = ['data', 'valor']

/**
 * Importa lançamentos de um CSV — extrato do banco, fatura do cartão ou o
 * arquivo que o próprio app exporta.
 *
 * Duas decisões que valem explicar:
 *
 * 1. A linha repetida NÃO é bloqueada, é marcada e deixada de fora por padrão.
 *    Importar o mesmo extrato duas vezes é o erro mais fácil de cometer aqui, e
 *    dobrar o gasto do mês em silêncio seria pior do que qualquer travamento.
 *    Mas parcela de cartão repete valor de propósito, então quem quiser trazer
 *    as repetidas marca a caixa e traz.
 *
 * 2. A data importada manda, mesmo caindo fora do mês aberto. O lançamento vai
 *    para o mês da data dele, e a tela avisa quantos foram parar em outro mês —
 *    em vez de descartar linha que o usuário quis trazer.
 */
export function ImportarCSV({
  aberto,
  onOpenChange,
  ano,
  mes,
  categorias,
  formas,
  aoImportar,
}: {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  ano: number
  mes: number
  categorias: Category[]
  formas: PaymentMethod[]
  aoImportar: (quantidade: number) => void
}) {
  const ehCelular = useEhMobile(640)

  const [arquivo, setArquivo] = React.useState<ArquivoCSV | null>(null)
  const [nomeArquivo, setNomeArquivo] = React.useState('')
  const [mapa, setMapa] = React.useState<Mapa | null>(null)
  const [regraSinal, setRegraSinal] = React.useState<RegraSinal>('pelo-sinal')
  const [trazerDuplicados, setTrazerDuplicados] = React.useState(false)
  const [erroLeitura, setErroLeitura] = React.useState('')
  const [existentes, setExistentes] = React.useState<Existente[] | null>(null)
  const [gravando, setGravando] = React.useState(false)
  const entradaRef = React.useRef<HTMLInputElement | null>(null)

  // Fechar e reabrir tem de começar do zero: manter o arquivo anterior é o
  // caminho mais curto para importar o extrato errado sem perceber.
  React.useEffect(() => {
    if (aberto) return
    setArquivo(null)
    setNomeArquivo('')
    setMapa(null)
    setRegraSinal('pelo-sinal')
    setTrazerDuplicados(false)
    setErroLeitura('')
    setExistentes(null)
    setGravando(false)
  }, [aberto])

  async function escolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const file = evento.target.files?.[0]
    // Permite escolher o MESMO arquivo de novo depois de um erro.
    evento.target.value = ''
    if (!file) return

    setErroLeitura('')
    try {
      const lido = lerCSV(decodificarTexto(await file.arrayBuffer()))
      if (lido.linhas.length === 0) {
        setErroLeitura('O arquivo não tem nenhuma linha além do cabeçalho.')
        return
      }
      setArquivo(lido)
      setNomeArquivo(file.name)
      setMapa(adivinharColunas(lido.cabecalho))
    } catch {
      setErroLeitura('Não foi possível ler este arquivo. Ele é mesmo um CSV?')
    }
  }

  // Busca no banco o que já existe no intervalo do arquivo, para achar repetido.
  const previa = React.useMemo(() => {
    if (!arquivo || !mapa) return null
    return prepararImportacao({
      arquivo,
      mapa,
      regraSinal,
      categorias,
      formas,
      existentes: existentes ?? [],
    })
  }, [arquivo, mapa, regraSinal, categorias, formas, existentes])

  React.useEffect(() => {
    if (!previa || previa.prontos.length === 0 || existentes !== null) return
    const datas = previa.prontos.map((p) => p.data).sort()
    let cancelado = false
    void listarLancamentosPorIntervalo(datas[0], datas[datas.length - 1])
      .then((linhas) => {
        if (cancelado) return
        setExistentes(
          linhas.map((l) => ({
            data: l.data,
            descricao: l.descricao,
            valor_centavos: l.valor_centavos,
            tipo: l.tipo,
          })),
        )
      })
      // Sem a lista, a importação segue sem marcar repetidos — é melhor do que
      // travar a tela. O aviso na conferência diz que a checagem não rodou.
      .catch(() => !cancelado && setExistentes([]))
    return () => {
      cancelado = true
    }
  }, [previa, existentes])

  const faltando = mapa ? OBRIGATORIOS.filter((c) => mapa[c] === -1) : []
  const selecionados = previa ? previa.prontos.filter((p) => trazerDuplicados || !p.duplicado) : []
  const duplicados = previa ? previa.prontos.filter((p) => p.duplicado).length : 0
  const foraDoMes = selecionados.filter((p) => {
    const [a, m] = p.data.split('-').map(Number)
    return a !== ano || m !== mes
  }).length

  async function importar() {
    if (selecionados.length === 0) return
    setGravando(true)
    try {
      const quantidade = await criarLancamentosEmLote(
        selecionados.map(({ data, descricao, valor_centavos, tipo, category_id, payment_method_id }) => ({
          data,
          descricao,
          valor_centavos,
          tipo,
          category_id,
          payment_method_id,
        })),
      )
      aoImportar(quantidade)
      onOpenChange(false)
    } catch (erro) {
      setErroLeitura(erro instanceof Error ? erro.message : 'Não foi possível importar.')
      setGravando(false)
    }
  }

  const corpo = (
    <div className="space-y-5">
      {!arquivo ? (
        <>
          <button
            type="button"
            onClick={() => entradaRef.current?.click()}
            className="flex min-h-[9rem] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 text-center transition-colors hover:border-primary hover:bg-primary-soft"
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="font-medium">Escolher arquivo CSV</span>
            <span className="text-sm text-muted-foreground">
              Extrato do banco, fatura do cartão ou um CSV exportado daqui
            </span>
          </button>
          <p className="text-sm text-muted-foreground">
            O arquivo precisa ter pelo menos uma coluna de <strong>data</strong> e uma de{' '}
            <strong>valor</strong>. Na próxima tela você confere de onde vem cada informação antes de qualquer
            coisa ser gravada.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <span className="truncate text-sm font-medium">{nomeArquivo}</span>
            {/* Sem size="sm" no celular: os 36px dele ficam abaixo do alvo
                mínimo de toque. No desktop pode encolher. */}
            <Button
              variant="ghost"
              onClick={() => entradaRef.current?.click()}
              className="h-11 px-4 sm:h-9 sm:px-3"
            >
              Trocar
            </Button>
          </div>

          {/* O mapeamento vem recolhido quando o palpite achou tudo o que é
              obrigatório. Aberto, ele são cinco selects que empurram o
              resultado — a única coisa que a pessoa precisa conferir antes de
              gravar — para baixo da dobra no celular. Falta coluna? abre. */}
          <details className="rounded-lg border border-border" open={faltando.length > 0}>
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">
              De onde vem cada informação
              {faltando.length === 0 && (
                <span className="ml-2 font-normal text-muted-foreground">· reconhecido pelo cabeçalho</span>
              )}
            </summary>
            <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
              {(Object.keys(ROTULOS) as Campo[]).map((campo) => (
                <label key={campo} className="space-y-1.5">
                  <span className="text-sm text-muted-foreground">
                    {ROTULOS[campo]}
                    {OBRIGATORIOS.includes(campo) && <span className="text-destructive"> *</span>}
                  </span>
                  <Select
                    value={mapa && mapa[campo] >= 0 ? String(mapa[campo]) : SEM_COLUNA}
                    onValueChange={(v) =>
                      setMapa((m) => (m ? { ...m, [campo]: v === SEM_COLUNA ? -1 : Number(v) } : m))
                    }
                  >
                    <SelectTrigger aria-label={`Coluna de ${ROTULOS[campo]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_COLUNA}>Não importar</SelectItem>
                      {arquivo.cabecalho.map((nome, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {nome || `Coluna ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ))}
            </div>
          </details>

          <label className="block space-y-1.5">
            <span className="text-sm text-muted-foreground">O que fazer com os valores</span>
            <Select value={regraSinal} onValueChange={(v) => setRegraSinal(v as RegraSinal)}>
              <SelectTrigger aria-label="Como interpretar o sinal do valor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pelo-sinal">Negativo é gasto, positivo é entrada</SelectItem>
                <SelectItem value="tudo-gasto">Tratar tudo como gasto</SelectItem>
                <SelectItem value="tudo-entrada">Tratar tudo como entrada</SelectItem>
              </SelectContent>
            </Select>
          </label>

          {faltando.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Escolha a coluna de {faltando.map((c) => ROTULOS[c].toLowerCase()).join(' e de ')} para
                continuar.
              </span>
            </p>
          ) : (
            previa && <Conferencia previa={previa} selecionados={selecionados} foraDoMes={foraDoMes} />
          )}

          {duplicados > 0 && (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={trazerDuplicados}
                onCheckedChange={(v) => setTrazerDuplicados(v === true)}
                aria-label="Importar também os repetidos"
                className="mt-0.5"
              />
              <span className="text-sm">
                <strong>
                  {duplicados} {duplicados === 1 ? 'linha parece repetida' : 'linhas parecem repetidas'}
                </strong>{' '}
                — mesma data, descrição e valor de algo que já existe. Ficam de fora, a não ser que você
                marque aqui.
              </span>
            </label>
          )}
        </>
      )}

      {erroLeitura && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {erroLeitura}
        </p>
      )}

      <input
        ref={entradaRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="sr-only"
        onChange={escolherArquivo}
        tabIndex={-1}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gravando}>
          Cancelar
        </Button>
        <Button onClick={() => void importar()} disabled={selecionados.length === 0 || gravando}>
          {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {gravando
            ? 'Importando…'
            : selecionados.length > 0
              ? `Importar ${selecionados.length} ${selecionados.length === 1 ? 'lançamento' : 'lançamentos'}`
              : 'Importar'}
        </Button>
      </div>
    </div>
  )

  const titulo = 'Importar CSV'
  const descricao = `Trazer lançamentos de um arquivo para o controle de ${mes}/${ano}.`

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

/** O resumo do que vai entrar, com as primeiras linhas para conferir de olho. */
function Conferencia({
  previa,
  selecionados,
  foraDoMes,
}: {
  previa: Resultado
  /** O que vai entrar de fato — já sem os repetidos, se estiverem de fora. */
  selecionados: Resultado['prontos']
  foraDoMes: number
}) {
  const AMOSTRA = 5
  // A amostra sai dos SELECIONADOS, não de todos os prontos: mostrar uma linha
  // que não vai ser importada, ao lado de um botão com outro número, faz o
  // usuário conferir a coisa errada.
  const amostra = selecionados.slice(0, AMOSTRA)

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span>
          <strong>{selecionados.length}</strong>{' '}
          {selecionados.length === 1 ? 'lançamento pronto' : 'lançamentos prontos'}
          {previa.ordemData === 'mes-dia' && ' · datas lidas como mês/dia'}
          {previa.ordemData === 'dia-mes' && ' · datas lidas como dia/mês'}
          {foraDoMes > 0 && ` · ${foraDoMes} de outro mês, que vão para o mês da data`}
        </span>
      </p>

      {amostra.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          {/* Data e valor medem o próprio conteúdo (w-px + nowrap); a
              descrição fica com toda a sobra e é a única que corta
              (w-full + max-w-0, que é o que faz truncate valer dentro de td).
              Largura fixa não serve: R$ 1.234.567,89 não cabe no mesmo número
              de rem que R$ 8,00. */}
          <table className="w-full text-sm">
            <tbody>
              {amostra.map((p) => (
                <tr key={p.linha} className="border-b border-border last:border-0">
                  <td className="w-px whitespace-nowrap px-2 py-2 text-xs text-muted-foreground sm:px-3 sm:text-sm">
                    {formatDataISO(p.data)}
                  </td>
                  <td className="w-full max-w-0 truncate px-2 py-2 sm:px-3">{p.descricao}</td>
                  <td
                    className={`w-px whitespace-nowrap px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm ${
                      p.tipo === 'gasto' ? 'text-destructive' : 'text-success'
                    }`}
                  >
                    {p.tipo === 'gasto' ? '−' : '+'}
                    {formatCentavos(p.valor_centavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selecionados.length > AMOSTRA && (
        <p className="text-xs text-muted-foreground">
          Mostrando as {AMOSTRA} primeiras de {selecionados.length}.
        </p>
      )}

      {previa.problemas.length > 0 && (
        <details className="rounded-lg bg-muted/50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {previa.problemas.length}{' '}
            {previa.problemas.length === 1 ? 'linha será ignorada' : 'linhas serão ignoradas'}
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {previa.problemas.slice(0, 8).map((p) => (
              <li key={p.linha}>
                Linha {p.linha}: {p.motivo}
              </li>
            ))}
            {previa.problemas.length > 8 && <li>e mais {previa.problemas.length - 8}…</li>}
          </ul>
        </details>
      )}
    </div>
  )
}
