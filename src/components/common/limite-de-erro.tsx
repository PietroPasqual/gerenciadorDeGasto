import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  children: ReactNode
  /**
   * Muda quando a rota muda. Um erro preso numa tela não pode sobreviver à
   * navegação: sem isto, quebrar o /mes deixaria o app inteiro travado na tela
   * de erro mesmo depois de o usuário voltar para o painel.
   */
  chave?: string
  /** Onde o "voltar" leva. A landing não tem painel para onde voltar. */
  destinoInicio?: string
}

interface Estado {
  erro: Error | null
}

/**
 * Rede de segurança de render. Antes disto, qualquer exceção dentro de uma tela
 * derrubava a árvore inteira e sobrava uma página branca sem botão nenhum —
 * o pior estado possível, porque nem "tentar novamente" existia.
 *
 * A mensagem técnica fica no console, não na cara de quem está tentando lançar
 * um gasto: para o usuário só interessa que deu errado e como sair dali.
 */
export class LimiteDeErro extends Component<Props, Estado> {
  state: Estado = { erro: null }

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[finZ] erro de render não tratado:', erro, info.componentStack)
  }

  componentDidUpdate(anterior: Props) {
    if (this.state.erro && anterior.chave !== this.props.chave) this.setState({ erro: null })
  }

  render() {
    if (!this.state.erro) return this.props.children

    const inicio = this.props.destinoInicio ?? '/painel'
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/30" role="alert">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium">Essa tela travou</p>
              <p className="text-sm text-muted-foreground">
                Seus dados estão salvos — o problema foi só em mostrar essa página. Tentar de novo costuma
                resolver.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              {/* min-h-11 = 44px, o alvo de toque do celular. */}
              <Button className="min-h-11 flex-1" onClick={() => this.setState({ erro: null })}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Tentar novamente
              </Button>
              <Button
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  window.location.href = inicio
                }}
              >
                <Home className="mr-2 h-4 w-4" aria-hidden />
                Voltar ao início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
