import { toast } from 'sonner'

/**
 * Campos como o MoneyInput chamam onValueChange a cada dígito digitado, então
 * a mesma célula pode disparar várias chamadas de executarOtimista em sequência
 * rápida. Esse contador por `chave` garante que só a chamada mais recente pode
 * confirmar ou desfazer — uma requisição antiga que erre depois de uma mais
 * nova ter sido aplicada não pode reverter a edição mais recente.
 */
const versaoPorChave = new Map<string, number>()

/**
 * Update otimista com rollback.
 *
 * 1. aplica a mudança na UI na hora (`aplicar`)
 * 2. dispara a chamada ao Supabase
 * 3. sucesso -> `confirmar` troca o dado provisório pelo do servidor
 *    erro    -> restaura o snapshot anterior e mostra toast
 *
 * `chave`, quando informada, identifica o que está sendo editado (ex.:
 * `entrada:${id}`) para aplicar a regra "só a chamada mais recente vence"
 * acima.
 */
export async function executarOtimista<Estado, Resultado>(opcoes: {
  chave?: string
  snapshot: Estado
  aplicar: () => void
  restaurar: (snapshot: Estado) => void
  acao: () => Promise<Resultado>
  confirmar?: (resultado: Resultado) => void
  mensagemErro?: string
}): Promise<Resultado | null> {
  const { chave, snapshot, aplicar, restaurar, acao, confirmar, mensagemErro } = opcoes

  let minhaVersao = 0
  if (chave) {
    minhaVersao = (versaoPorChave.get(chave) ?? 0) + 1
    versaoPorChave.set(chave, minhaVersao)
  }
  const aindaEhAUltima = () => !chave || versaoPorChave.get(chave) === minhaVersao

  aplicar()
  try {
    const resultado = await acao()
    if (aindaEhAUltima()) confirmar?.(resultado)
    return resultado
  } catch (erro) {
    if (aindaEhAUltima()) {
      restaurar(snapshot)
      const detalhe = erro instanceof Error ? erro.message : ''
      toast.error(mensagemErro ?? 'Não foi possível salvar', {
        description: detalhe || 'A alteração foi desfeita. Tente novamente.',
      })
    }
    return null
  }
}
