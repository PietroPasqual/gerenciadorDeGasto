import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AuthLayout } from './auth-layout'
import { CampoAuth, ErroDoFormulario } from './campos'
import { cadastroSchema, type CadastroForm } from './schemas'
import { useAuthStore } from '@/store/auth'

export function CadastroPage() {
  const { criarConta, session } = useAuthStore()
  const navegar = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CadastroForm>({ resolver: zodResolver(cadastroSchema) })

  if (session) return <Navigate to="/painel" replace />

  const aoEnviar = async (dados: CadastroForm) => {
    setEnviando(true)
    setErroGeral('')
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
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível criar a conta.'
      setErroGeral(mensagem)
      // Conta já existente é o caso mais comum, e o campo a corrigir é o
      // e-mail — é para lá que o foco volta.
      setFocus('email')
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
        <ErroDoFormulario>
          {erroGeral}
          {erroGeral.includes('Já existe') && (
            <>
              {' '}
              <Link to="/entrar" className="font-medium underline">
                Entrar nela
              </Link>
              .
            </>
          )}
        </ErroDoFormulario>

        <CampoAuth
          id="nome"
          rotulo="Nome"
          autoComplete="name"
          placeholder="Seu nome"
          dica="É como o app vai te chamar. Dá para mudar depois."
          erro={errors.nome?.message}
          {...register('nome')}
        />

        <CampoAuth
          id="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          erro={errors.email?.message}
          {...register('email')}
        />

        <CampoAuth
          id="senha"
          rotulo="Senha"
          type="password"
          autoComplete="new-password"
          // A exigência aparece ANTES de errar: como instrução, não como
          // correção depois do envio recusado.
          dica="Pelo menos 6 caracteres."
          erro={errors.senha?.message}
          {...register('senha')}
        />

        <CampoAuth
          id="confirmarSenha"
          rotulo="Confirmar senha"
          type="password"
          autoComplete="new-password"
          erro={errors.confirmarSenha?.message}
          {...register('confirmarSenha')}
        />

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
