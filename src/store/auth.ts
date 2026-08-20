import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'
import { obterPerfil } from '@/services/profiles'

interface EstadoAuth {
  session: Session | null
  user: User | null
  profile: Profile | null
  carregando: boolean
  inicializado: boolean

  inicializar: () => () => void
  entrar: (email: string, senha: string) => Promise<void>
  criarConta: (email: string, senha: string, nome: string) => Promise<{ precisaConfirmar: boolean }>
  entrarComGoogle: () => Promise<void>
  recuperarSenha: (email: string) => Promise<void>
  sair: () => Promise<void>
  recarregarPerfil: () => Promise<void>
  definirProfile: (profile: Profile) => void
}

export const useAuthStore = create<EstadoAuth>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  carregando: false,
  inicializado: false,

  /** Assina as mudanças de sessão do Supabase. Retorna a função de cleanup. */
  inicializar: () => {
    supabase.auth.getSession().then(async ({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null })
      if (data.session) await get().recarregarPerfil()
      set({ inicializado: true })
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange(async (_evento, session) => {
      set({ session, user: session?.user ?? null })
      if (session) {
        await get().recarregarPerfil()
      } else {
        set({ profile: null })
      }
      set({ inicializado: true })
    })

    return () => assinatura.subscription.unsubscribe()
  },

  entrar: async (email, senha) => {
    set({ carregando: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw new Error(traduzErroAuth(error.message))
    } finally {
      set({ carregando: false })
    }
  },

  criarConta: async (email, senha, nome) => {
    set({ carregando: true })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } },
      })
      if (error) throw new Error(traduzErroAuth(error.message))
      // Sem sessão = projeto exige confirmação de e-mail
      return { precisaConfirmar: !data.session }
    } finally {
      set({ carregando: false })
    }
  },

  entrarComGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/painel` },
    })
    if (error) throw new Error(traduzErroAuth(error.message))
  },

  recuperarSenha: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/entrar`,
    })
    if (error) throw new Error(traduzErroAuth(error.message))
  },

  sair: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },

  recarregarPerfil: async () => {
    try {
      const profile = await obterPerfil()
      set({ profile })
    } catch {
      // Perfil ainda sendo criado pelo trigger: mantém o que houver
    }
  },

  definirProfile: (profile) => set({ profile }),
}))

function traduzErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail.'
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um minuto.'
  return mensagem
}
