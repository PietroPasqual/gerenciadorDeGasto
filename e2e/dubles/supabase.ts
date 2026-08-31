/**
 * Dublê do cliente Supabase para o E2E.
 *
 * A sessão vem de `window.__SESSAO__`, plantada pela fixture antes do app
 * carregar. Isso exercita o caminho REAL do `inicializar()` do store — o app
 * chama `getSession`, assina `onAuthStateChange` e busca o perfil, como sempre.
 * Forjar o estado do store direto pularia esse caminho, que é onde mora a
 * lógica de rota protegida.
 *
 * O que não é coberto: o GoTrue de verdade. Cadastro e login com senha errada
 * são testados como formulário e navegação, não como autenticação.
 */
declare global {
  interface Window {
    __SESSAO__?: { user: { id: string; email: string } } | null
  }
}

const sessao = () => (typeof window === 'undefined' ? null : (window.__SESSAO__ ?? null))

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: sessao() }, error: null }),
    // O `userIdAtual` do services/base chama isto. Faltava, e qualquer tela
    // que o usasse morria com "getUser is not a function" — um erro que fala
    // do dublê, não da tela.
    getUser: async () => ({ data: { user: sessao()?.user ?? null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async ({ password }: { password: string }) =>
      password === 'errada'
        ? { data: { session: null }, error: { message: 'Credenciais inválidas' } }
        : { data: { session: sessao() }, error: null },
    signUp: async () => ({ data: { session: sessao() }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
  },
} as never

export {}
