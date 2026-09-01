import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readdirSync } from 'node:fs'

/**
 * Build do app REAL com a camada de serviços trocada por dublês.
 *
 * É o app inteiro — roteador, layout, componentes, CSS, code splitting — só que
 * os dados vêm de uma fixture que o teste planta. Isso é o que torna o E2E
 * rápido e determinístico: sem banco, sem rede, sem estado de execução anterior.
 *
 * O que ele NÃO cobre, e é honesto dizer: PostgREST, GoTrue e RLS. Quem cobre
 * RLS é a suíte de src/test/rls.
 */
const dir = path.resolve(__dirname, './e2e/dubles')
const dubles = readdirSync(dir)
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((n) => n !== 'fixture' && n !== 'supabase')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...dubles.map((n) => ({ find: `@/services/${n}`, replacement: path.join(dir, `${n}.ts`) })),
      { find: '@/lib/supabase', replacement: path.join(dir, 'supabase.ts') },
      { find: 'virtual:pwa-register', replacement: path.join(dir, 'pwa-register.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  build: { outDir: 'dist-e2e' },
  server: { port: 5180 },
  preview: { port: 5180 },
})
