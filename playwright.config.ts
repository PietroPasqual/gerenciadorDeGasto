import { defineConfig, devices } from '@playwright/test'

/**
 * E2E de paridade: cada linha de docs/paridade.md vira teste, nas duas larguras.
 *
 * A tabela foi conferida à mão uma vez, 22 de 22. Conferência à mão apodrece na
 * terceira feature — a que muda um breakpoint e ninguém repete os 22 caminhos.
 *
 * Roda contra o build de `vite.e2e.config.ts`: o app real com a camada de
 * serviços dublada. Sem banco, sem rede, sem estado de execução anterior.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    /**
     * Este ambiente já traz um Chromium em /opt/pw-browsers, de revisão
     * diferente da que esta versão do Playwright baixaria. Apontar para ele
     * evita um download de ~150 MB a cada execução; no CI a variável não existe
     * e o Playwright usa o browser que o próprio `playwright install` baixou.
     */
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    // Rastro só do que falhou: guardar tudo enche o artefato do CI de ruído.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx vite preview --config vite.e2e.config.ts --port 5180',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
