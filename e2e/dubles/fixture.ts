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

export async function doFixture(chave: string, args: unknown[]): Promise<unknown> {
  const fixture = window.__FIXTURE__ ?? {}

  if (chave in fixture) {
    const valor = fixture[chave]
    if (typeof valor === 'object' && valor !== null && 'erro' in (valor as object)) {
      // Permite ao teste exercitar o estado de erro das telas.
      throw new Error(String((valor as { erro: unknown }).erro))
    }
    return valor
  }

  if (EH_LEITURA.test(chave)) {
    throw new Error(
      `Fixture faltando para "${chave}". Adicione-a em prepararApp() — o dublê ` +
        'não inventa dado, porque dado inventado vira bug fantasma na tela.',
    )
  }

  // Escrita: registra e devolve algo inócuo.
  window.__ESCRITAS__ = window.__ESCRITAS__ ?? []
  window.__ESCRITAS__.push({ chave, args })
  return {}
}

export {}
