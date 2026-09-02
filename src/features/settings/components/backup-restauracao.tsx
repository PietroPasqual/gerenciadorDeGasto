import * as React from 'react'
import { Download, FileJson, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { LinkAjuda } from '@/components/common/link-ajuda'
import { useEhMobile } from '@/lib/hooks'
import { formatTimestamp } from '@/lib/dates'
import { baixarJSON, lerBackup, nomeDoArquivo, totalDeLinhas, type Backup, type Plano } from '@/lib/backup'
import { obterBackupCompleto, obterPlanoDeRestauracao, restaurar } from '@/services/backup'

/**
 * Levar os dados embora, e trazê-los de volta.
 *
 * A restauração MOSTRA ANTES DE GRAVAR. Um botão "restaurar" que escreve
 * direto pede um voto de confiança que ninguém tem motivo para dar: o arquivo
 * pode ser o errado, pode ser de outra conta, pode estar velho. A tela conta o
 * que vai entrar, tabela por tabela, e o botão só aparece depois disso.
 *
 * E a frase que resolve a pergunta que todo mundo faz nesta hora — "o que
 * acontece com o que já tenho?" — está escrita na tela, não escondida numa
 * ajuda: nada é apagado, nada é alterado, só entra o que falta.
 */
export function BackupRestauracao() {
  const ehCelular = useEhMobile(640)
  const [exportando, setExportando] = React.useState(false)
  const [arquivo, setArquivo] = React.useState<{ backup: Backup; plano: Plano } | null>(null)
  const [lendo, setLendo] = React.useState(false)
  const [gravando, setGravando] = React.useState(false)
  const [erro, setErro] = React.useState('')
  const [trocarPerfil, setTrocarPerfil] = React.useState(false)
  const entradaArquivo = React.useRef<HTMLInputElement>(null)

  const exportar = async () => {
    setExportando(true)
    try {
      const backup = await obterBackupCompleto()
      baixarJSON(nomeDoArquivo(), JSON.stringify(backup, null, 2))
      toast.success(`Backup gerado com ${totalDeLinhas(backup.dados)} linhas.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o backup.')
    } finally {
      setExportando(false)
    }
  }

  const escolherArquivo = async (arquivoEscolhido: File | undefined) => {
    if (!arquivoEscolhido) return
    setLendo(true)
    setErro('')
    setTrocarPerfil(false)
    try {
      const leitura = lerBackup(await arquivoEscolhido.text())
      if (!leitura.ok) {
        setErro(leitura.erro)
        return
      }
      setArquivo({ backup: leitura.backup, plano: await obterPlanoDeRestauracao(leitura.backup) })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.')
    } finally {
      setLendo(false)
      // Zerar o input permite escolher o MESMO arquivo de novo depois de
      // fechar sem gravar — sem isto o segundo clique não dispara nada.
      if (entradaArquivo.current) entradaArquivo.current.value = ''
    }
  }

  const gravar = async () => {
    if (!arquivo) return
    setGravando(true)
    try {
      const r = await restaurar(arquivo.plano, {
        perfil: trocarPerfil ? arquivo.backup.perfil : null,
      })
      toast.success(
        r.gravadas === 0
          ? 'Nada novo para restaurar — já estava tudo aqui.'
          : `${r.gravadas} linhas restauradas.`,
        {
          // Renomear id não é detalhe interno: acontece quando o arquivo veio
          // de outra conta deste mesmo banco, e quem restaurou merece saber
          // que os identificadores mudaram.
          description:
            r.renomeadas > 0
              ? `${r.renomeadas} vieram de outra conta e receberam identificador novo. Recarregue a tela do mês para ver.`
              : 'Recarregue a tela do mês para ver.',
        },
      )
      setArquivo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível restaurar.')
    } finally {
      setGravando(false)
    }
  }

  const Moldura = ehCelular ? Sheet : Dialog
  const Conteudo = ehCelular ? SheetContent : DialogContent
  const Titulo = ehCelular ? SheetTitle : DialogTitle
  const Descricao = ehCelular ? SheetDescription : DialogDescription

  const itensComAlgo = arquivo?.plano.itens.filter((i) => i.noArquivo > 0) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-muted-foreground" aria-hidden />
          Backup e restauração
        </CardTitle>
        <CardDescription>
          Um arquivo JSON com tudo o que é seu. Serve para guardar uma cópia, levar para outra conta ou voltar
          atrás depois de uma importação que não deu certo.
        </CardDescription>
        <LinkAjuda topico="backup">O que entra, o que fica e o que nunca é apagado</LinkAjuda>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={exportando}
            onClick={() => void exportar()}
          >
            {exportando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Baixar backup
          </Button>

          <Button
            variant="outline"
            className="min-h-11"
            disabled={lendo}
            onClick={() => entradaArquivo.current?.click()}
          >
            {lendo ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Restaurar de um arquivo
          </Button>
          <input
            ref={entradaArquivo}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Arquivo de backup"
            onChange={(e) => void escolherArquivo(e.target.files?.[0])}
          />
        </div>

        {erro && !arquivo && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Restaurar <strong>não apaga e não altera</strong> nada do que já está aqui: só entra o que falta.
          Pode restaurar o mesmo arquivo duas vezes sem duplicar.
        </p>
      </CardContent>

      <Moldura open={arquivo !== null} onOpenChange={(aberto) => !aberto && setArquivo(null)}>
        <Conteudo className={ehCelular ? undefined : 'max-w-lg'}>
          <Titulo>O que vai entrar</Titulo>
          <Descricao className="mb-3">
            {arquivo?.backup.geradoEm
              ? `Backup de ${formatTimestamp(arquivo.backup.geradoEm)}.`
              : 'Backup sem data.'}{' '}
            Nada do que já está aqui será apagado ou alterado.
          </Descricao>

          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {itensComAlgo.length === 0 ? (
              <p className="rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
                O arquivo não tem nenhuma linha para restaurar.
              </p>
            ) : (
              itensComAlgo.map((i) => (
                <div key={i.tabela} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.rotulo}</span>
                  <span className="tabular shrink-0 text-muted-foreground">
                    {i.entram === 0 ? (
                      <>já estão aqui ({i.jaExistem})</>
                    ) : (
                      <>
                        <strong className="text-foreground">+{i.entram}</strong>
                        {i.jaExistem > 0 && <> · {i.jaExistem} já estão aqui</>}
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          {arquivo && arquivo.plano.descartadas > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {arquivo.plano.descartadas} linhas do arquivo estão sem identificador e não entram — sem ele não
              dá para garantir que não virem duplicata.
            </p>
          )}

          {arquivo?.backup.perfil && (
            <label className="mt-3 flex min-h-11 items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <Checkbox
                checked={trocarPerfil}
                onCheckedChange={(v) => setTrocarPerfil(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Trocar também minhas configurações</span>
                <span className="block text-xs text-muted-foreground">
                  Nome, tema, orçamento do mês e preferências de lembrete passam a ser os do arquivo. É a
                  única parte que <strong>substitui</strong> o que você tem hoje.
                </span>
              </span>
            </label>
          )}

          {erro && (
            <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          <Button
            className="mt-4 w-full"
            disabled={gravando || (arquivo?.plano.totalEntram ?? 0) === 0}
            onClick={() => void gravar()}
          >
            {gravando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {(arquivo?.plano.totalEntram ?? 0) === 0
              ? 'Nada para restaurar'
              : `Restaurar ${arquivo?.plano.totalEntram} linhas`}
          </Button>
        </Conteudo>
      </Moldura>
    </Card>
  )
}
