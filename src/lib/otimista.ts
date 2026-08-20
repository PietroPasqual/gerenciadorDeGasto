import { toast } from 'sonner'

/**
 * Update otimista com rollback.
 *
 * 1. aplica a mudança na UI na hora (`aplicar`)
 * 2. dispara a chamada ao Supabase
 * 3. sucesso -> `confirmar` troca o dado provisório pelo do servidor
 *    erro    -> restaura o snapshot anterior e mostra toast
 */
export async function executarOtimista<Estado, Resultado>(opcoes: {
  snapshot: Estado
  aplicar: () => void
  restaurar: (snapshot: Estado) => void
  acao: () => Promise<Resultado>
  confirmar?: (resultado: Resultado) => void
  mensagemErro?: string
}): Promise<Resultado | null> {
  const { snapshot, aplicar, restaurar, acao, confirmar, mensagemErro } = opcoes
  aplicar()
  try {
    const resultado = await acao()
    confirmar?.(resultado)
    return resultado
  } catch (erro) {
    restaurar(snapshot)
    const detalhe = erro instanceof Error ? erro.message : ''
    toast.error(mensagemErro ?? 'Não foi possível salvar', {
      description: detalhe || 'A alteração foi desfeita. Tente novamente.',
    })
    return null
  }
}
