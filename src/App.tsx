import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LayoutApp } from '@/components/layout/layout-app'
import { RotaProtegida } from '@/features/auth/rota-protegida'
import { LandingPage } from '@/features/landing/landing-page'
import { LoginPage } from '@/features/auth/login-page'
import { CadastroPage } from '@/features/auth/cadastro-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ControleMensalPage } from '@/features/monthly/controle-mensal-page'
import { ComparativoAnualPage } from '@/features/annual/comparativo-anual-page'
import { MetasPage } from '@/features/goals/metas-page'
import { ConfiguracoesPage } from '@/features/settings/configuracoes-page'
import { AjudaPage } from '@/features/help/ajuda-page'
import { ProvedorAcoesPagina } from '@/store/acoes-pagina'
import { useEhMobile } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'
import { useTemaStore } from '@/store/tema'

export default function App() {
  const ehMobile = useEhMobile(640)
  const inicializar = useAuthStore((s) => s.inicializar)
  const profile = useAuthStore((s) => s.profile)
  const definirTema = useTemaStore((s) => s.definirTema)
  const local = useLocation()

  useEffect(() => inicializar(), [inicializar])

  // Ao entrar, o tema salvo no perfil manda (sem regravar no banco)
  useEffect(() => {
    if (profile?.tema) definirTema(profile.tema, false)
  }, [profile?.tema, definirTema])

  return (
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
  )
}
