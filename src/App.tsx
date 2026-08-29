import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LayoutApp } from '@/components/layout/layout-app'
import { LimiteDeErro } from '@/components/common/limite-de-erro'
import { RotaProtegida } from '@/features/auth/rota-protegida'
import { LandingPage } from '@/features/landing/landing-page'
import { LoginPage } from '@/features/auth/login-page'
import { CadastroPage } from '@/features/auth/cadastro-page'
import {
  AjudaPage,
  aquecerPaginas,
  ComparativoAnualPage,
  ConfiguracoesPage,
  ControleMensalPage,
  DashboardPage,
  MetasPage,
  ROTAS_PREGUICOSAS,
} from '@/lib/paginas'
import { ProvedorAcoesPagina } from '@/store/acoes-pagina'
import { useEhMobile } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

export default function App() {
  const ehMobile = useEhMobile(640)
  const inicializar = useAuthStore((s) => s.inicializar)
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const definirTema = useTemaStore((s) => s.definirTema)
  const local = useLocation()

  useEffect(() => inicializar(), [inicializar])

  // Aquece os pedaços das páginas de dentro do app: ou porque o usuário já caiu
  // direto numa delas (link, atalho da tela inicial), ou porque acabou de
  // entrar e a próxima navegação será para uma. Quem está só na landing não
  // baixa nada disso.
  useEffect(() => {
    if (session || ROTAS_PREGUICOSAS.includes(local.pathname)) aquecerPaginas()
  }, [session, local.pathname])

  // Ao entrar, o tema salvo no perfil manda (sem regravar no banco)
  useEffect(() => {
    if (profile?.tema) definirTema(profile.tema, false)
  }, [profile?.tema, definirTema])

  // O limite externo pega o que quebrar fora das telas do app (landing, login)
  // e o que escapar do limite de dentro do layout.
  return (
    <LimiteDeErro chave={local.pathname} destinoInicio="/">
      <TooltipProvider delayDuration={200}>
      <ProvedorAcoesPagina>
      <AnimatePresence mode="wait">
        <Routes location={local} key={local.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/criar-conta" element={<CadastroPage />} />

          <Route
            element={
              <RotaProtegida>
                <LayoutApp />
              </RotaProtegida>
            }
          >
            <Route path="/painel" element={<DashboardPage />} />
            <Route path="/mes" element={<ControleMensalPage />} />
            <Route path="/comparativo" element={<ComparativoAnualPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/ajuda" element={<AjudaPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {/* No celular o toast vai para baixo, perto do polegar — mas acima da
          barra de navegação, senão ele cobriria as abas. */}
      <Toaster
        position={ehMobile ? 'bottom-center' : 'top-right'}
        offset={ehMobile ? 88 : 16}
        richColors
        closeButton
      />
      </ProvedorAcoesPagina>
      </TooltipProvider>
    </LimiteDeErro>
  )
}
