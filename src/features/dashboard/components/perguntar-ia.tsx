import * as React from 'react'
import { AlertTriangle, Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PERGUNTAS_SUGERIDAS, perguntar, type Resposta } from '@/services/assistente'

/**
 * Perguntar em português sobre os próprios números.
 *
 * Três coisas ditas na tela, e não escondidas no código:
 *
 * 1. Que os dados vão para a Anthropic — mandar dado financeiro de alguém para
 *    fora sem avisar não é aceitável, por mais útil que seja o recurso.
 * 2. Que só vão AGREGADOS. Um extrato brasileiro é cheio de "Pix para <nome de
 *    alguém>", e essas pessoas não escolheram nada. A função de servidor só lê
 *    totais; nenhum lançamento sai do banco.
 * 3. Que a resposta pode errar. Ela sai de um modelo de linguagem lendo os seus
 *    totais — os cards ao lado é que são a fonte.
 */
export function PerguntarIA({ ano, mes }: { ano: number; mes: number }) {
  const [pergunta, setPergunta] = React.useState('')
  const [resposta, setResposta] = React.useState<Resposta | null>(null)
  const [erro, setErro] = React.useState('')
  const [carregando, setCarregando] = React.useState(false)

  async function enviar(texto: string) {
    const limpa = texto.trim()
    if (limpa === '' || carregando) return
    setCarregando(true)
    setErro('')
    setResposta(null)
    try {
      setResposta(await perguntar(limpa, ano, mes))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível perguntar agora.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Perguntar sobre o mês
        </CardTitle>
        <CardDescription>
          Em português mesmo. As respostas saem dos seus totais — confira sempre nos cards acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar(pergunta)
          }}
        >
          <Input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: por que gastei mais que o normal?"
            maxLength={500}
            aria-label="Sua pergunta sobre o mês"
            disabled={carregando}
          />
          <Button type="submit" disabled={carregando || pergunta.trim() === ''} className="shrink-0">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {carregando ? 'Pensando…' : 'Perguntar'}
          </Button>
        </form>

        {!resposta && !carregando && !erro && (
          <div className="flex flex-wrap gap-2">
            {PERGUNTAS_SUGERIDAS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPergunta(p)
                  void enviar(p)
                }}
                className="min-h-[2.25rem] rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {carregando && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            Lendo os seus totais…
          </p>
        )}

        {resposta && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3" aria-live="polite">
            <p className="whitespace-pre-wrap text-sm">{resposta.texto}</p>

            {/* Todo valor da resposta é conferido contra os números que foram
                enviados. Quando um não bate, isso aparece — esconder seria
                deixar um número inventado passar por conferido. */}
            {resposta.valoresNaoConferidos.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Não confira por esta resposta: <strong>{resposta.valoresNaoConferidos.join(', ')}</strong>{' '}
                  {resposta.valoresNaoConferidos.length === 1 ? 'não confere' : 'não conferem'} com os seus
                  números. Use os cards acima.
                </span>
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Resposta gerada por IA a partir dos seus totais — pode errar. Os cards acima são a fonte.
            </p>
          </div>
        )}

        {erro && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {erro}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Ao perguntar, os <strong>totais</strong> do mês e do ano são enviados ao Google (Gemini) para gerar
          a resposta. Nenhum lançamento individual é enviado — nomes de pessoas nas descrições ficam no seu
          banco.
        </p>
      </CardContent>
    </Card>
  )
}
