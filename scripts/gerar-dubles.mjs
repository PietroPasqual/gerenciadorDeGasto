#!/usr/bin/env node
/**
 * Regenera os dublês de serviço do E2E a partir dos exports reais.
 *
 * Existe porque o dublê que fica para trás não quebra o build: ele some, o
 * app importa a função de verdade, e o teste passa a falar com o Supabase de
 * produção — ou, mais provavelmente, morre num erro de rede que não diz nada.
 * Rodar isto é mais barato do que descobrir isso num CI vermelho.
 *
 * `supabase.ts`, `pwa-register.ts`, `fixture.ts` e `base.ts` ficam de fora: os
 * três primeiros são escritos à mão (têm comportamento, não só a chave da
 * fixture) e `base.ts` não é serviço, é o `unwrap` que os outros usam.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origem = path.join(raiz, 'src/services')
const destino = path.join(raiz, 'e2e/dubles')

const ESCRITOS_A_MAO = new Set(['supabase.ts', 'pwa-register.ts', 'fixture.ts'])
const NAO_E_SERVICO = new Set(['base.ts'])

let gerados = 0
for (const arquivo of readdirSync(origem).sort()) {
  if (!arquivo.endsWith('.ts') || NAO_E_SERVICO.has(arquivo) || ESCRITOS_A_MAO.has(arquivo)) continue
  const modulo = arquivo.replace(/\.ts$/, '')
  const fonte = readFileSync(path.join(origem, arquivo), 'utf8')
  const nomes = [...fonte.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1])

  /**
   * Constantes exportadas viajam LITERALMENTE.
   *
   * `MAX_METAS` vive em services/goals.ts e a tela de configurações a importa
   * de lá. Um dublê que só cobrisse funções apagaria a constante, e o build do
   * E2E quebraria num "não exporta MAX_METAS" que não tem nada a ver com o
   * teste que falhou. Só a forma de uma linha — a única que existe hoje, e a
   * única que dá para copiar sem interpretar.
   */
  const constantes = [...fonte.matchAll(/^export const [A-Za-z0-9_]+ = [^\n]*$/gm)].map((m) => m[0])
  if (nomes.length === 0 && constantes.length === 0) continue

  const corpo = [
    ...constantes,
    ...nomes.map(
      (nome) =>
        `export async function ${nome}(...args: unknown[]) {\n  return doFixture('${modulo}.${nome}', args)\n}`,
    ),
  ].join('\n')

  writeFileSync(
    path.join(destino, arquivo),
    `// Dublê gerado dos exports reais de src/services/${arquivo}.\n` +
      `// Gerado por scripts/gerar-dubles.mjs — não edite à mão.\n` +
      `import { doFixture } from './fixture'\n\n${corpo}\n`,
  )
  gerados += 1
}

console.log(`${gerados} dublês gerados em e2e/dubles/`)
