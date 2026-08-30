#!/usr/bin/env node
/**
 * Falha se o JS que o navegador baixa ANTES de pintar qualquer coisa passar do
 * teto.
 *
 * O comentário do `manualChunks` no vite.config.ts conta a história de por que
 * isto existe: fixar o recharts ali criava uma aresta estática a partir da
 * entrada, e o index.html vinha com um `modulepreload` de 164 kB baixados na
 * landing, onde não há gráfico nenhum. Aquilo foi achado à mão, olhando o HTML.
 * Este script põe o mesmo cuidado na máquina.
 *
 * O que conta: só o que o index.html referencia diretamente (`<script>` e
 * `<link modulepreload>`). Pedaço que desce por import dinâmico não entra —
 * ele é justamente o que o code splitting tirou do caminho crítico.
 *
 * Medido em gzip porque é assim que o byte viaja.
 */
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const DIST = 'dist'
const TETO_KB = Number(process.env.TETO_BUNDLE_KB ?? 280)

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html não existe — rode `npm run build` antes.')
  process.exit(1)
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const caminhos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])

if (caminhos.length === 0) {
  console.error('Nenhum JS referenciado no index.html — o build mudou de forma?')
  process.exit(1)
}

let total = 0
const linhas = []
for (const caminho of caminhos) {
  const bytes = gzipSync(readFileSync(join(DIST, caminho))).length
  total += bytes
  linhas.push(`  ${(bytes / 1024).toFixed(1).padStart(7)} kB  ${caminho}`)
}

const totalKB = total / 1024
console.log('JS inicial (gzip):')
console.log(linhas.join('\n'))
console.log(`  ${'-'.repeat(7)}`)
console.log(`  ${totalKB.toFixed(1).padStart(7)} kB  total   (teto: ${TETO_KB} kB)`)

if (totalKB > TETO_KB) {
  console.error(
    `\nPassou ${(totalKB - TETO_KB).toFixed(1)} kB do teto.\n` +
      'Se o peso for legítimo, suba TETO_BUNDLE_KB conscientemente — mas confira\n' +
      'antes se algo novo virou aresta estática a partir da entrada.',
  )
  process.exit(1)
}
console.log(`\nFolga: ${(TETO_KB - totalKB).toFixed(1)} kB.`)
