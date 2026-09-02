import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CampoAuth, ErroDoFormulario } from '@/features/auth/campos'
import { trocaDeSenhaSchema, type TrocaDeSenhaForm } from '@/features/auth/schemas'
import { useAuthStore } from '@/store/auth'

/**
 * Segurança e sessão.
 *
 * A fase 6 pede esta seção "caso existam opções reais", e o "caso" é a parte
 * importante: com a chave pública — a única que o cliente tem — dá para trocar
 * a senha e encerrar a sessão, e não dá para apagar a conta. Uma seção que
 * listasse "encerrar conta" e depois pedisse para mandar e-mail seria pior do
 * que seção nenhuma.
 *
 * Então o que está aqui é o que funciona, e o que não funciona está escrito
 * como não funciona.
 */
export function SegurancaSessao() {
  const user = useAuthStore((s) => s.user)
  const trocarSenha = useAuthStore((s) => s.trocarSenha)
  const sair = useAuthStore((s) => s.sair)
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<TrocaDeSenhaForm>({ resolver: zodResolver(trocaDeSenhaSchema) })

  const aoEnviar = async (dados: TrocaDeSenhaForm) => {
    setEnviando(true)
    setErroGeral('')
    try {
      await trocarSenha(dados.senha)
      reset()
      toast.success('Senha trocada', {
        description: 'A próxima entrada já usa a nova.',
      })
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Não foi possível trocar a senha.'
      setErroGeral(mensagem)
      setFocus('senha')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            Trocar a senha
          </CardTitle>
          <CardDescription>
            Vale a partir da próxima entrada. As sessões já abertas continuam abertas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
            <ErroDoFormulario>{erroGeral}</ErroDoFormulario>

            <CampoAuth
              id="nova-senha"
              rotulo="Nova senha"
              type="password"
              autoComplete="new-password"
              dica="Pelo menos 6 caracteres."
              erro={errors.senha?.message}
              {...register('senha')}
            />
            <CampoAuth
              id="confirmar-nova-senha"
              rotulo="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              erro={errors.confirmarSenha?.message}
              {...register('confirmarSenha')}
            />

            <Button type="submit" className="min-h-11 w-full" disabled={enviando}>
              {enviando ? 'Trocando…' : 'Trocar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
            Conta e sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Você está usando o app como</p>
            {/* `break-all`: e-mail longo em 360px estourava o card de lado. */}
            <p className="break-all font-medium">{user?.email ?? '—'}</p>
          </div>

          <Button variant="outline" className="min-h-11 w-full" onClick={() => void sair()}>
            <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
            Sair da conta
          </Button>

          {/* Dito aqui porque é aqui que a pessoa vem procurar. Prometer
              "encerrar conta" e depois não entregar seria pior. */}
          <p className="rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
            Trocar o e-mail e encerrar a conta não são feitos pelo app. Para apagar tudo o que é seu sem
            encerrar a conta, use <strong>Apagar dados</strong>, na seção de dados.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
