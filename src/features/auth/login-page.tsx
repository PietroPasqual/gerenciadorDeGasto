import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from './auth-layout'
import { loginSchema, type LoginForm } from './schemas'
import { useAuthStore } from '@/store/auth'

export function LoginPage() {
  const { entrar, recuperarSenha, session } = useAuthStore()
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (session) return <Navigate to="/painel" replace />

  const aoEnviar = async (dados: LoginForm) => {
    setEnviando(true)
    try {
      await entrar(dados.email, dados.senha)
      navegar('/painel', { replace: true })
    } catch (erro) {
      toast.error('Não foi possível entrar', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    } finally {
      setEnviando(false)
    }
  }

  const aoRecuperar = async () => {
    const email = getValues('email')
    if (!email) return toast.info('Digite seu e-mail no campo acima primeiro.')
    try {
      await recuperarSenha(email)
      toast.success('Enviamos um link de recuperação para o seu e-mail.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível enviar o link.')
    }
  }

  return (
    <AuthLayout
      titulo="Entrar"
      descricao="Acesse seu planner financeiro."
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" {...register('email')} />
          {errors.email && (
            <p role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="senha">Senha</Label>
            <button type="button" onClick={aoRecuperar} className="text-xs text-primary hover:underline">
              Esqueci minha senha
            </button>
          </div>
          <Input id="senha" type="password" autoComplete="current-password" {...register('senha')} />
          {errors.senha && (
            <p role="alert" className="text-xs text-destructive">
              {errors.senha.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  )
}
