// Dublê gerado dos exports reais de src/services/payment-methods.ts.
// Gerado por scripts/gerar-dubles.mjs — não edite à mão.
import { doFixture } from './fixture'

export async function listarFormasPagamento(...args: unknown[]) {
  return doFixture('payment-methods.listarFormasPagamento', args)
}
export async function criarFormaPagamento(...args: unknown[]) {
  return doFixture('payment-methods.criarFormaPagamento', args)
}
export async function atualizarFormaPagamento(...args: unknown[]) {
  return doFixture('payment-methods.atualizarFormaPagamento', args)
}
export async function excluirFormaPagamento(...args: unknown[]) {
  return doFixture('payment-methods.excluirFormaPagamento', args)
}
