import { AbasMes, type AbaMes } from './abas-mes'
import { formatCentavos } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { CaixaDoMes, ResumoCalculado } from '@/lib/calculations'

/**
 * Barra fixa do mês no celular: abas + faixa de resumo.
 *
 * As duas coisas grudam juntas logo abaixo do header porque são a mesma
 * pergunta — "onde estou e como está o mês" — e duas faixas com `sticky` em
 * alturas diferentes dependeriam de medir a altura de uma para posicionar a
 * outra. Aqui é um bloco só.
 *
 * O saldo negativo tinge a faixa inteira: dá para ver que o mês está no
 * vermelho sem ler número nenhum.
 */
export function BarraMesCelular({
  resumo,
  caixa,
  aba,
  onAbaChange,
}: {
  resumo: ResumoCalculado
  caixa: CaixaDoMes
  aba: AbaMes
  onAbaChange: (aba: AbaMes) => void
}) {
  // Paridade com o resumo do PC: com cartão de fatura, a faixa mostra o que
  // sai da conta, e o saldo sai daí. Sem cartão os dois números são o mesmo e
  // a faixa fica idêntica à de antes.
  const temFatura = caixa.totalSaidasCaixa !== resumo.totalSaidas
  const saidas = temFatura ? caixa.totalSaidasCaixa : resumo.totalSaidas
  const saldo = resumo.totalEntradas - saidas
  const negativo = saldo < 0

  return (
    <div
      className={cn(
        'sticky z-20 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:hidden',
        // 4rem = altura do header do app; o env() acompanha o notch.
        'top-[calc(4rem+env(safe-area-inset-top))]',
      )}
    >
      {/* Tinta do saldo negativo como camada própria: empilhar duas cores de
          fundo na mesma classe depende da ordem no CSS gerado, não da ordem
          que escrevemos aqui. */}
      {negativo && <div aria-hidden className="pointer-events-none absolute inset-0 bg-destructive/10" />}

      <div className="relative">
        <AbasMes aba={aba} onChange={onAbaChange} />

        {/* O saldo ganha a coluna mais larga: é o número que a pessoa vem
            conferir, e é o que mais cresce (leva sinal na frente). */}
        <dl className="grid grid-cols-[1fr,1fr,1.25fr] items-end gap-1.5 pb-2 pt-0.5">
          <Numero rotulo="Entradas" valor={resumo.totalEntradas} className="text-success" />
          <Numero
            rotulo={temFatura ? 'Sai da conta' : 'Saídas'}
            valor={saidas}
            className="text-destructive"
          />
          <Numero
            rotulo="Saldo"
            valor={saldo}
            destaque
            className={negativo ? 'text-destructive' : 'text-foreground'}
          />
        </dl>
      </div>
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  className,
  destaque,
}: {
  rotulo: string
  valor: number
  className?: string
  destaque?: boolean
}) {
  const texto = formatCentavos(valor)

  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className={cn('tabular whitespace-nowrap leading-tight', tamanho(texto, destaque), className)}>
        {texto}
      </dd>
    </div>
  )
}

/**
 * Encolhe o número em vez de cortá-lo. "R$ 125.988,…" não diz nada, e a faixa
 * existe justamente para bater o olho e saber como o mês está — melhor o valor
 * inteiro dois pontos menor do que meio valor.
 */
function tamanho(texto: string, destaque?: boolean) {
  const escala = destaque
    ? ['text-[0.9375rem] font-bold', 'text-[0.8125rem] font-bold', 'text-[0.6875rem] font-bold']
    : ['text-[0.8125rem] font-semibold', 'text-[0.6875rem] font-semibold', 'text-[0.625rem] font-semibold']
  if (texto.length > 13) return escala[2]
  if (texto.length > 10) return escala[1]
  return escala[0]
}
