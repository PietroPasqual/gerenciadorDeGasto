import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthLayout } from './auth-layout'
import { CampoAuth, ErroDoFormulario } from './campos'
import { loginSchema, type LoginForm } from './schemas'
import { useAuthStore } from '@/store/auth'

export function LoginPage() {
  const { entrar, recuperarSenha, session } = useAuthStore()
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  /** null = não pedido; 'enviando' | 'enviado' | a mensagem de erro. */
  const [recuperacao, setRecuperacao] = useState<'enviando' | 'enviado' | null>(null)
  const campoEmail = useRef<HTMLInputElement | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const { ref: refEmail, ...restoEmail } = register('email')

  if (session) return <Navigate to="/painel" replace />

  const aoEnviar = async (dados: LoginForm) => {
    setEnviando(true)
    setErroGeral('')
    setRecuperacao(null)
    try {
      await entrar(dados.email, dados.senha)
      navegar('/painel', { replace: true })
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : 'Não foi possível entrar.')
      // O foco volta para o e-mail: sem isto ele fica no botão, e quem navega
      // por teclado precisa subir o formulário inteiro às cegas para corrigir.
      setFocus('email')
    } finally {
      setEnviando(false)
    }
  }

  const aoRecuperar = async () => {
    const email = getValues('email')
    if (!email) {
      setErroGeral('Digite seu e-mail no campo acima e toque de novo em “Esqueci minha senha”.')
      campoEmail.current?.focus()
      return
    }
    setErroGeral('')
    setRecuperacao('enviando')
    try {
      await recuperarSenha(email)
      setRecuperacao('enviado')
    } catch (erro) {
      setRecuperacao(null)
      setErroGeral(erro instanceof Error ? erro.message : 'Não foi possível enviar o link.')
    }
  }

  return (
    <AuthLayout
      titulo="Entrar"
      descricao="Acesse seu planner financeiro."
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="font-medium text-primary-strong hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
        <ErroDoFormulario>{erroGeral}</ErroDoFormulario>

        {recuperacao === 'enviado' && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Se existir uma conta com esse e-mail, o link de recuperação já está a caminho. Confira também a
              caixa de spam.
            </span>
          </p>
        )}

        <CampoAuth
          id="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          erro={errors.email?.message}
          {...restoEmail}
          ref={(el) => {
            refEmail(el)
            campoEmail.current = el
          }}
        />

        <CampoAuth
          id="senha"
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          erro={errors.senha?.message}
          acao={
            <button
              type="button"
              onClick={() => void aoRecuperar()}
              disabled={recuperacao === 'enviando'}
              className="text-xs text-primary-strong hover:underline disabled:opacity-60"
            >
              {recuperacao === 'enviando' ? 'Enviando…' : 'Esqueci minha senha'}
            </button>
          }
          {...register('senha')}
        />

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
