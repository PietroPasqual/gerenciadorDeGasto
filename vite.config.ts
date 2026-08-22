/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
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
  },
})
