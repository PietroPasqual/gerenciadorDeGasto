import { formatCentavos } from './money'
import { formatDataISO, nomeDoMes, type Periodo } from './dates'
import { faturaDaCompra, vencimentoAdiado, vencimentoDaFatura } from './fatura'
import { datasDasParcelas, dividirEmParcelas } from './parcelamento'
import { vaiParaFatura, type FormaComFatura } from './calculations'

/**
 * O que vai acontecer quando este lançamento for salvo.
 *
 * Um gasto no crédito não é um gasto: é um gasto agora e um débito na conta
 * daqui a dois meses, e a parcela de hoje é mais onze que ninguém digitou.
 * Tudo isso o app já calcula corretamente — só calculava DEPOIS de salvar,
 * quando o número na tela já tinha mudado e o único jeito de entender era
 * refazer a conta de cabeça.
 *
 * Este arquivo antecipa essas consequências para o formulário poder mostrá-las
 * antes do toque em Salvar. Ele não decide nada novo: `vaiParaFatura`,
 * `faturaDaCompra` e `dividirEmParcelas` continuam sendo as únicas fontes da
 * verdade, e é de propósito que aqui não haja nenhuma regra própria — uma
 * segunda regra escrita para a prévia acabaria discordando do que o app faz.
 */

export type TomConsequencia = 'neutro' | 'atencao'

export interface Consequencia {
  id: 'fora-do-mes' | 'fatura' | 'competencia' | 'parcelas' | 'repeticao' | 'sem-fechamento'
  /** A frase curta — é o que a pessoa lê de relance. */
  titulo: string
  /** O porquê, uma linha. Vazio quando o título já basta. */
  detalhe: string
  tom: TomConsequencia
}

/** A forma de pagamento com o que a prévia precisa saber dela. */
export interface FormaDoRascunho extends FormaComFatura {
  nome: string
  tipo: string
  dia_vencimento: number | null
}

/** O lançamento como ele está no formulário, ainda não salvo. */
export interface Rascunho {
  tipo: 'gasto' | 'entrada'
  data: string
  /** TOTAL da compra, não o da parcela — é como a maquininha pergunta. */
  valorCentavos: number
  /** 1 = à vista. */
  parcelas: number
  formaId: string | null
}

function periodoDaData(dataISO: string): Periodo {
  const [ano, mes] = dataISO.slice(0, 10).split('-').map(Number)
  return { ano, mes }
}

/**
 * As consequências, na ordem em que valem a pena ser lidas.
 *
 * O aviso vem primeiro porque é o único que pode fazer alguém desistir de
 * salvar; o resto é informação, e informação embaixo de aviso ainda é lida.
 * Lista vazia é o caso comum e o certo: um gasto no débito, hoje, à vista não
 * tem consequência nenhuma que a pessoa já não saiba, e um aviso que aparece
 * sempre vira parte do fundo.
 */
export function consequenciasDoRascunho(
  rascunho: Rascunho,
  formas: FormaDoRascunho[],
  periodoAberto: Periodo,
): Consequencia[] {
  const lista: Consequencia[] = []
  if (!rascunho.data) return lista

  const compra = periodoDaData(rascunho.data)
  const parcelas = Math.max(1, Math.round(rascunho.parcelas))

  // ------------------------------------------------------- fora do mês aberto
  if (compra.ano !== periodoAberto.ano || compra.mes !== periodoAberto.mes) {
    lista.push({
      id: 'fora-do-mes',
      titulo: `Este lançamento é de ${nomeDoMes(compra.mes)} de ${compra.ano}`,
      detalhe: `A tela está em ${nomeDoMes(periodoAberto.mes)} de ${periodoAberto.ano}, então ele não vai aparecer nesta lista depois de salvo.`,
      tom: 'atencao',
    })
  }

  // Entrada não tem fatura nem parcela: o dinheiro entra na data e pronto.
  if (rascunho.tipo === 'entrada') return lista

  const forma = rascunho.formaId ? formas.find((f) => f.id === rascunho.formaId) : undefined
  const naFatura = vaiParaFatura(
    { data: rascunho.data, valor_centavos: rascunho.valorCentavos, payment_method_id: rascunho.formaId },
    formas,
  )

  // ------------------------------------------------------------------- fatura
  if (naFatura && forma && forma.dia_fechamento !== null) {
    const fatura = faturaDaCompra(rascunho.data, forma.dia_fechamento)
    const vencimento = forma.dia_vencimento !== null ? vencimentoDaFatura(fatura, forma.dia_vencimento) : null
    const adiado = forma.dia_vencimento !== null && vencimentoAdiado(fatura, forma.dia_vencimento)

    lista.push({
      id: 'fatura',
      titulo: `${parcelas > 1 ? 'A 1ª parcela entra' : 'Entra'} na fatura de ${nomeDoMes(fatura.mes)}`,
      detalhe: vencimento
        ? `${forma.nome} fecha no dia ${forma.dia_fechamento} e vence em ${formatDataISO(vencimento)}${adiado ? ' — empurrado por cair no fim de semana' : ''}.`
        : `${forma.nome} fecha no dia ${forma.dia_fechamento}. O dia do vencimento ainda não está configurado.`,
      tom: 'neutro',
    })

    lista.push({
      id: 'competencia',
      titulo: `Gasto de ${nomeDoMes(compra.mes)}, sai da conta em ${nomeDoMes(fatura.mes)}`,
      detalhe:
        'No total de gastos deste mês ele conta agora; no que sai do bolso, só quando a fatura vencer.',
      tom: 'neutro',
    })
  } else if (forma && forma.tipo === 'credito' && forma.dia_fechamento === null) {
    // O cartão sem fechamento se comporta como dinheiro — que é o padrão
    // seguro da 0009, mas não é o que alguém espera de um cartão de crédito.
    lista.push({
      id: 'sem-fechamento',
      titulo: `${forma.nome} ainda não tem dia de fechamento`,
      detalhe: `Sem ele o gasto pesa em ${nomeDoMes(compra.mes)} mesmo, e não numa fatura. Dá para configurar em Formas de pagamento.`,
      tom: 'atencao',
    })
  }

  if (parcelas <= 1) return lista

  // ----------------------------------------------------------------- parcelas
  const datas = datasDasParcelas(rascunho.data, parcelas)
  const ultima = periodoDaData(datas[datas.length - 1])

  if (rascunho.valorCentavos > 0) {
    const valores = dividirEmParcelas(rascunho.valorCentavos, parcelas)
    const sobra = valores[0] !== valores[1]
    lista.push({
      id: 'parcelas',
      titulo: sobra
        ? `1x de ${formatCentavos(valores[0])} e ${parcelas - 1}x de ${formatCentavos(valores[1])}`
        : `${parcelas}x de ${formatCentavos(valores[0])}`,
      detalhe: sobra
        ? 'A sobra de centavos vai na primeira, que é como o cartão faz.'
        : `Total de ${formatCentavos(rascunho.valorCentavos)}.`,
      tom: 'neutro',
    })
  } else {
    lista.push({
      id: 'parcelas',
      titulo: `${parcelas}x`,
      detalhe: 'Preencha o valor total da compra para ver quanto fica cada parcela.',
      tom: 'neutro',
    })
  }

  // ---------------------------------------------------------------- repetição
  lista.push({
    id: 'repeticao',
    titulo: `As outras ${parcelas - 1} ${parcelas - 1 === 1 ? 'parcela entra' : 'parcelas entram'} nos meses seguintes`,
    detalhe: `Ficam lançadas agora, uma por mês, até ${nomeDoMes(ultima.mes)} de ${ultima.ano}.`,
    tom: 'neutro',
  })

  return lista
}
