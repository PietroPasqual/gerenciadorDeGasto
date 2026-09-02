/**
 * Os tetos que o app impõe, longe dos serviços.
 *
 * `MAX_METAS` vivia em `services/goals.ts`, e por isso qualquer arquivo que
 * quisesse só o NÚMERO arrastava junto o cliente do Supabase — o que quebra em
 * teste unitário, que não tem (nem deve ter) as variáveis de ambiente. O
 * número é regra de produto, não detalhe de serviço.
 */

/**
 * Dez metas.
 *
 * Não é limite técnico: é a grade de doze meses da tela de metas, que com
 * muito mais linhas deixa de caber e de ser lida. Mudar o número aqui muda a
 * mensagem de limite, o contador da tela e o texto da ajuda de uma vez.
 */
export const MAX_METAS = 10
