import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEhMobile } from '@/lib/hooks'
import { cn } from '@/lib/utils'

/**
 * Abas do controle mensal — SÓ no celular.
 *
 * A página tem sete blocos empilhados. No desktop eles cabem numa grade de
 * duas colunas e ver tudo de uma vez é a graça; em 360px viravam 4.600px de
 * rolagem e achar "Gastos" custava meia dúzia de deslizadas. Aqui o mesmo
 * conteúdo vira aba: nada desaparece, muda de forma (regra 0.5).
 *
 * A aba fica na URL (`?aba=gastos`) para o voltar do navegador desfazer a
 * troca de aba, e para um link apontar direto para a seção certa.
 */
export const ABAS_MES = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'entradas', rotulo: 'Entradas' },
  { id: 'fixos', rotulo: 'Fixos' },
  { id: 'gastos', rotulo: 'Gastos' },
  { id: 'investir', rotulo: 'Investir' },
  { id: 'analise', rotulo: 'Análise' },
] as const

export type AbaMes = (typeof ABAS_MES)[number]['id']

/** Quem abre o mês quase sempre quer lançar um gasto. */
export const ABA_PADRAO: AbaMes = 'gastos'

function ehAba(valor: string | null): valor is AbaMes {
  return ABAS_MES.some((a) => a.id === valor)
}

export function useAbaMes(): [AbaMes, (aba: AbaMes) => void] {
  const [params, setParams] = useSearchParams()
  const bruto = params.get('aba')
  const aba = ehAba(bruto) ? bruto : ABA_PADRAO

  const definir = React.useCallback(
    (nova: AbaMes) => {
      setParams(
        (atuais) => {
          const proximos = new URLSearchParams(atuais)
          proximos.set('aba', nova)
          return proximos
        },
        // push, não replace: o botão voltar do celular precisa desfazer a
        // troca de aba antes de sair da tela.
        { replace: false },
      )
    },
    [setParams],
  )

  return [aba, definir]
}

/**
 * Faixa rolável de abas. Não usamos o padrão ARIA de tablist/tabpanel porque
 * no desktop as mesmas seções aparecem todas de uma vez, sem faixa nenhuma —
 * painéis órfãos seriam mentira para o leitor de tela. Botões com
 * `aria-current` descrevem exatamente o que acontece.
 */
export function AbasMes({
  aba,
  onChange,
  className,
}: {
  aba: AbaMes
  onChange: (aba: AbaMes) => void
  className?: string
}) {
  const faixaRef = React.useRef<HTMLDivElement | null>(null)
  const refs = React.useRef(new Map<AbaMes, HTMLButtonElement>())

  // Ao trocar de aba (inclusive pelo voltar do navegador) a pílula ativa pode
  // estar fora da parte visível da faixa; centraliza ela.
  //
  // Rolamos a faixa na mão em vez de usar scrollIntoView porque ele mexe
  // também na rolagem vertical da página — e a faixa é `sticky`, então a
  // página daria um pulo a cada toque. `?.` no método: jsdom (testes) não
  // implementa scroll.
  const jaMontou = React.useRef(false)
  React.useEffect(() => {
    const faixa = faixaRef.current
    const pilula = refs.current.get(aba)
    if (!faixa || !pilula) return
    const alvo = pilula.offsetLeft - (faixa.clientWidth - pilula.offsetWidth) / 2
    faixa.scrollTo?.({
      left: Math.max(alvo, 0),
      // Na 1ª pintura a faixa já nasce posicionada; animar seria ver a tela
      // "se ajeitando" sozinha ao abrir o mês.
      behavior: jaMontou.current ? 'smooth' : 'auto',
    })
    jaMontou.current = true
  }, [aba])

  return (
    <div
      ref={faixaRef}
      className={cn('sem-barra-rolagem -mx-4 overflow-x-auto px-4', className)}
      aria-label="Seções do mês"
      role="group"
    >
      <div className="flex w-max gap-1.5 py-1.5">
        {ABAS_MES.map(({ id, rotulo }) => {
          const ativa = id === aba
          return (
            <button
              key={id}
              type="button"
              ref={(el) => {
                if (el) refs.current.set(id, el)
                else refs.current.delete(id)
              }}
              aria-current={ativa ? 'true' : undefined}
              onClick={() => onChange(id)}
              className={cn(
                'flex min-h-[2.75rem] shrink-0 items-center rounded-full px-4 text-sm transition-colors',
                ativa ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground',
              )}
            >
              {rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Um bloco da página. No celular só existe quando é a aba escolhida; de `sm`
 * para cima existe sempre, porque lá a grade mostra tudo junto.
 *
 * Desmonta de verdade em vez de esconder com CSS (`hidden`): o celular deixa
 * de montar sete blocos — com quatro gráficos do Recharts — para mostrar um
 * só. Componentes que se desenham a partir do tamanho do pai também passam a
 * nascer já com o tamanho certo, em vez de dentro de um `display:none`.
 *
 * O preço é que trocar de aba remonta a seção: os inputs não controlados
 * perdem o texto ainda não salvo. Todos eles salvam no `blur`, e trocar de
 * aba tira o foco antes, então na prática nada se perde.
 */
export function SecaoMes({ id, aba, children }: { id: AbaMes; aba: AbaMes; children: React.ReactNode }) {
  const ehCelular = useEhMobile(640)
  if (ehCelular && id !== aba) return null
  return <>{children}</>
}
