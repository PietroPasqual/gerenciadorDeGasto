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
import { cadastroSchema, type CadastroForm } from './schemas'
import { useAuthStore } from '@/store/auth'

export function CadastroPage() {
  const { criarConta, session } = useAuthStore()
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroForm>({ resolver: zodResolver(cadastroSchema) })

  if (session) return <Navigate to="/painel" replace />

  const aoEnviar = async (dados: CadastroForm) => {
    setEnviando(true)
    try {
      const { precisaConfirmar } = await criarConta(dados.email, dados.senha, dados.nome)
      if (precisaConfirmar) {
        toast.success('Conta criada!', { description: 'Confirme o e-mail que enviamos para entrar.' })
        navegar('/entrar', { replace: true })
      } else {
        toast.success('Conta criada! Suas categorias e formas de pagamento já estão prontas.')
        navegar('/painel', { replace: true })
      }
    } catch (erro) {
      toast.error('Não foi possível criar a conta', {
        description: erro instanceof Error ? erro.message : undefined,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthLayout
      titulo="Criar conta"
      descricao="Em um minuto você já começa a lançar o mês."
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-primary-strong hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" autoComplete="name" placeholder="Seu nome" {...register('nome')} />
          {errors.nome && (
            <p role="alert" className="text-xs text-destructive">
              {errors.nome.message}
            </p>
          )}
        </div>

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
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" autoComplete="new-password" {...register('senha')} />
          {errors.senha && (
            <p role="alert" className="text-xs text-destructive">
              {errors.senha.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmarSenha">Confirmar senha</Label>
          <Input id="confirmarSenha" type="password" autoComplete="new-password" {...register('confirmarSenha')} />
          {errors.confirmarSenha && (
            <p role="alert" className="text-xs text-destructive">
              {errors.confirmarSenha.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
