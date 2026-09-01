/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('./public/manifest.webmanifest', 'utf8'))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // O manifest já existia em public/ e continua sendo a fonte da verdade —
      // duplicá-lo aqui deixaria dois arquivos discordando com o tempo.
      manifest,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icone-192.png', 'icone-512.png', 'icone-maskable-512.png'],
      workbox: {
        // A casca do app (JS, CSS, HTML, ícones, fontes) fica em cache na
        // instalação. É o que faz o app abrir offline em vez de dar erro de
        // rede antes de pintar qualquer coisa.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // O app é uma SPA: qualquer rota cai no index.html.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            /**
             * Os dados do mês, para CONSULTA offline.
             *
             * NetworkFirst e não CacheFirst: dinheiro é o tipo de dado em que
             * mostrar o valor de ontem como se fosse o de hoje é pior do que
             * não mostrar nada. Com rede, o número é sempre o do servidor; sem
             * rede, cai para a última resposta guardada — e aí a tela avisa que
             * está offline.
             *
             * Só GET e só as funções de leitura: gravação offline não entra
             * aqui de propósito (ver docs/offline.md).
             */
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/rest\/v1\/rpc\/(carregar_mes|resumo_mensal)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'finz-dados-mes',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 24, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Só o Supabase é fixado à mão, e por ser cache: ele é carregado na
        // partida de qualquer jeito (a sessão é conferida antes de tudo), e num
        // arquivo próprio ele sobrevive a um deploy que só mexeu no app.
        //
        // O recharts NÃO entra aqui. Fixá-lo criava uma aresta estática a
        // partir da entrada, e o index.html vinha com um <link modulepreload>
        // para os 164 kB dele — baixados na landing, onde não há gráfico
        // nenhum. Deixando o Rollup decidir, ele cai no lado de lá do import
        // dinâmico e só desce junto com a página que usa gráfico.
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // A suíte de RLS precisa de Postgres; a de E2E é do Playwright e explode
    // se o Vitest tentar coletá-la. Cada uma tem seu próprio comando.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/test/rls/**', 'e2e/**'],
  },
})
