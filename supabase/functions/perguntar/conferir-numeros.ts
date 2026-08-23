/**
 * Confere se todo valor em reais citado na resposta existe mesmo nos dados.
 *
 * POR QUE ISTO EXISTE
 *
 * Um modelo de linguagem pode escrever um número que parece certo e não é —
 * some duas categorias errado, inventa um total, arredonda para um valor
 * "redondo". Num app de dinheiro isso é o pior tipo de defeito: a resposta soa
 * confiante, o número é falso, e não há como o usuário saber.
 *
 * Então nada é aceito por confiança. Todo "R$ X" da resposta é conferido
 * contra os valores que a função REALMENTE mandou. O que não bater é devolvido
 * junto, e a tela avisa em vez de esconder.
 *
 * O QUE CONTA COMO "EXISTE NOS DADOS"
 *
 * Não é só a lista crua: o modelo legitimamente faz contas. "Entrou 3.680,74,
 * saiu 3.699,68, faltaram 18,94" tem um valor que não está na lista mas é a
 * diferença de dois que estão. Por isso somas e diferenças de dois valores
 * também passam. Contas de três ou mais termos não passam — a partir daí a
 * chance de coincidência fica alta e a checagem deixaria de valer.
 */

/** Um centavo de folga: arredondamento de exibição não é invenção. */
const TOLERANCIA = 1

/**
 * Acha os valores em reais escritos na resposta.
 *
 * Só o que vem com "R$" na frente. Número solto não entra: "3 meses",
 * "48%" e "2026" são números e não são dinheiro, e conferi-los produziria
 * alarme falso a cada resposta.
 */
export function valoresCitados(texto: string): number[] {
  const achados: number[] = []
  // R$ 1.234,56 | R$ 1234,56 | R$ 1.234 | R$ 12
  const regex = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g
  for (const m of texto.matchAll(regex)) {
    const centavos = Math.round(Number(m[1].replace(/\./g, '').replace(',', '.')) * 100)
    if (Number.isFinite(centavos)) achados.push(centavos)
  }
  return achados
}

/**
 * Todos os valores que a resposta pode citar sem estar inventando.
 *
 * Os pares são de posições DIFERENTES de propósito. Permitindo somar um valor
 * com ele mesmo, todo dobro passaria — e aí "R$ 600,00" seria aceito num
 * conjunto que tem R$ 300,00, sem que ninguém tenha somado nada de verdade. A
 * checagem ficaria frouxa justamente onde precisa apertar.
 */
function permitidos(base: number[]): Set<number> {
  const conjunto = new Set<number>()
  for (let i = 0; i < base.length; i++) {
    conjunto.add(Math.abs(base[i]))
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue
      conjunto.add(Math.abs(base[i] + base[j]))
      conjunto.add(Math.abs(base[i] - base[j]))
    }
  }
  return conjunto
}

function bate(valor: number, conjunto: Set<number>): boolean {
  for (let d = -TOLERANCIA; d <= TOLERANCIA; d++) {
    if (conjunto.has(valor + d)) return true
  }
  return false
}

/**
 * Devolve os valores citados que NÃO se explicam pelos dados, já formatados
 * como aparecem na resposta. Vazio = tudo confere.
 */
export function conferirValores(resposta: string, valoresDosDados: number[]): string[] {
  if (valoresDosDados.length === 0) return []
  const conjunto = permitidos(valoresDosDados)
  const suspeitos: string[] = []
  for (const citado of valoresCitados(resposta)) {
    if (!bate(citado, conjunto)) {
      suspeitos.push(
        (citado / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      )
    }
  }
  return [...new Set(suspeitos)]
}
