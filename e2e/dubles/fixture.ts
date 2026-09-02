/**
 * Os dublês leem o estado que o teste plantou em `window.__FIXTURE__`.
 *
 * Cada spec monta o cenário que precisa sem subir banco: `page.addInitScript`
 * define a fixture antes do app carregar. Escritas ficam em
 * `window.__ESCRITAS__`, para o teste afirmar "isto foi gravado" sem servidor.
 */
declare global {
  interface Window {
    __FIXTURE__?: Record<string, unknown>
    __ESCRITAS__?: Array<{ chave: string; args: unknown[] }>
  }
}

/**
 * Leitura sem fixture é ERRO, não lista vazia.
 *
 * A primeira versão devolvia `{}` para chave desconhecida, e o painel quebrou
 * lá dentro fazendo `.reduce` num objeto — o teste falhou com "elemento não
 * encontrado", que não diz nada sobre a causa. Um dublê que inventa dado
 * transforma erro de fixture em bug fantasma da tela.
 */
const EH_LEITURA = /\.(listar|obter|carregar)/

/**
 * O prefixo é CONTRATO, não palpite.
 *
 * Toda leitura de serviço começa com `listar`, `obter` ou `carregar`. Batizar
 * uma leitura de outro jeito a faz cair no ramo de escrita e devolver `{}`, e
 * a tela quebra num ponto que não tem nada a ver com a causa. Já aconteceu
 * duas vezes; o conserto é o nome, não a regex.
 */

/**
 * A fixture pode responder diferente POR ARGUMENTO.
 *
 * `reports.obterComparativoAnual#[2026]` ganha de `reports.obterComparativoAnual`.
 * Existe porque o comparativo passou a pedir dois anos ao mesmo serviço, e com
 * uma resposta só para os dois o teste da comparação entre anos comparava um
 * ano consigo mesmo — passaria com a lógica invertida.
 *
 * A chave curta continua valendo como padrão, então nenhuma fixture existente
 * precisou mudar.
 */
function chaveComArgs(chave: string, args: unknown[]): string {
  return `${chave}#${JSON.stringify(args)}`
}

export async function doFixture(chave: string, args: unknown[]): Promise<unknown> {
  const fixture = window.__FIXTURE__ ?? {}
  const ehLeitura = EH_LEITURA.test(chave)

  /**
   * A escrita é registrada ANTES de a fixture poder ditar o retorno.
   *
   * Na primeira versão, fixturar o retorno de uma escrita a tirava de
   * `__ESCRITAS__`: dava para observar a chamada OU controlar a resposta,
   * nunca as duas. Isso quebrou um teste real — a tela grava a dispensa da
   * sugestão de assinatura e depois adota a linha que o servidor devolve; com
   * `{}` de resposta, a dispensa desaparecia e o cartão voltava. O defeito era
   * do dublê, não da tela.
   */
  if (!ehLeitura) {
    window.__ESCRITAS__ = window.__ESCRITAS__ ?? []
    window.__ESCRITAS__.push({ chave, args })
  }

  // A específica por argumento primeiro; a genérica é o padrão.
  for (const candidata of [chaveComArgs(chave, args), chave]) {
    if (!(candidata in fixture)) continue
    const valor = fixture[candidata]
    if (typeof valor === 'object' && valor !== null && 'erro' in (valor as object)) {
      // Permite ao teste exercitar o estado de erro das telas.
      throw new Error(String((valor as { erro: unknown }).erro))
    }
    return valor
  }

  if (ehLeitura) {
    throw new Error(
      `Fixture faltando para "${chave}". Adicione-a em prepararApp() — o dublê ` +
        'não inventa dado, porque dado inventado vira bug fantasma na tela.',
    )
  }

  return {}
}

export {}
