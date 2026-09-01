import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Config separada porque a suíte de RLS precisa de um Postgres no ar, e o
 * `npm run test` tem que continuar rodando em qualquer máquina sem preparo.
 * Rode `./scripts/pg-teste.sh` antes — ou use `npm run test:rls`, que faz isso.
 */
export default defineConfig({
  // O alias `@` não vem do vite.config.ts: esta config é independente, e sem
  // ele o teste de backup não enxerga src/lib/backup.ts.
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['src/test/rls/**/*.test.ts'],
    environment: 'node',
    // Sequencial: os testes compartilham um banco só, e paralelizar faria um
    // delete de um teste apagar a linha que outro acabou de conferir.
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
