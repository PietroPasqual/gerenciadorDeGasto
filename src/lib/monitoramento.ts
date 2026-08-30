/**
 * Monitoramento de erro em produção.
 *
 * Sem isto, um erro que só acontece no celular de quem usa o app é um relato
 * de "travou" sem stack, sem rota e sem versão — impossível de corrigir.
 *
 * Fica DESLIGADO por padrão. Sem `VITE_SENTRY_DSN` o app não carrega o Sentry
 * e não manda nada para lugar nenhum: rodar local ou fazer um fork não deve
 * despachar erro para um serviço de terceiro sem alguém ter pedido.
 *
 * O que NÃO é enviado, de propósito: nada de valor, descrição de gasto, nome
 * de categoria ou e-mail. Um relatório de erro de app de finanças que carrega
 * "Farmácia R$ 340,00" é um vazamento — o que interessa é onde o código
 * quebrou, não com qual dinheiro.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN

export function iniciarMonitoramento(): void {
  if (!dsn || import.meta.env.DEV) return

  // Import dinâmico: sem DSN configurado, o Sentry nem entra no pacote que o
  // usuário baixa.
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      // 10% das sessões para desempenho; erro continua sendo 100%.
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(evento) {
        // A URL pode carregar filtros de busca, que são dado do usuário.
        if (evento.request?.url) evento.request.url = evento.request.url.split('?')[0]
        delete evento.user
        return evento
      },
    })
  })
}

/** Manda um erro já capturado (o limite de erro usa isto). */
export function reportarErro(erro: unknown, contexto?: Record<string, string>): void {
  if (!dsn || import.meta.env.DEV) return
  void import('@sentry/react').then((Sentry) => {
    Sentry.captureException(erro, contexto ? { tags: contexto } : undefined)
  })
}
