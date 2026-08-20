/** Exportação em CSV (separador ';' e BOM — abre certo no Excel pt-BR). */

import { centavosParaTexto } from './money'

export type LinhaCSV = Array<string | number | null | undefined>

function escapar(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  if (/[";\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export function gerarCSV(cabecalho: string[], linhas: LinhaCSV[]): string {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(';')).join('\r\n')
  return `﻿${conteudo}`
}

/** Valor monetário no CSV: número em pt-BR, sem símbolo (para o Excel somar). */
export function csvMoeda(centavos: number | null | undefined): string {
  return centavosParaTexto(centavos)
}

export function baixarCSV(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
