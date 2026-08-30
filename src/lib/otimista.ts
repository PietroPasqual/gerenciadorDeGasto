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
 * Quem quer saber que uma escrita deu certo.
 *
 * Existe para o cache de leitura (src/lib/cache.tsx) poder invalidar o que
 * ficou velho sem que cada uma das dezenas de chamadas de `executarOtimista`
 * precise lembrar de avisar. Toda escrita do app passa por aqui, então este é
 * o único lugar onde a notificação não pode ser esquecida.
 *
 * Dispara só no SUCESSO: uma escrita que falhou já foi desfeita pelo rollback,
 * e invalidar ali faria a tela buscar de novo o mesmo dado que ela acabou de
 * restaurar — piscando sem motivo.
 */
type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()

export function aoGravar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

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
    for (const ouvinte of ouvintes) ouvinte()
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
