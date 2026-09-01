import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Download,
  LineChart,
  Layers,
  Moon,
  PiggyBank,
  Repeat,
  Smartphone,
  Sparkles,
  Target,
  WalletMinimal,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * O conteúdo da landing, separado da composição.
 *
 * Tudo aqui é verificável no produto. Nada de avaliação inventada, número de
 * usuários, integração que não existe, preço ou selo — um app de dinheiro que
 * exagera na porta de entrada já começou errado.
 */

export const PASSOS = [
  {
    Icone: WalletMinimal,
    titulo: 'Lance',
    texto:
      'Gasto, entrada ou aporte em poucos toques. Parcelou em 10x? O app cria as dez e sabe em que fatura cada uma cai.',
  },
  {
    Icone: LineChart,
    titulo: 'Entenda',
    texto:
      'Para onde o dinheiro foi, quanto sai da conta neste mês e o que vence essa semana — com a diferença entre as duas coisas escrita na tela.',
  },
  {
    Icone: Target,
    titulo: 'Planeje',
    texto:
      'Teto do mês com quanto ainda dá para gastar por dia, metas com prazo e o comparativo dos doze meses.',
  },
]

type Recurso = {
  Icone: typeof CalendarDays
  titulo: string
  texto: string
  /** Cards maiores carregam o que a pessoa usa todo dia. */
  largo?: boolean
}

export const RECURSOS: Recurso[] = [
  {
    Icone: CalendarDays,
    titulo: 'O mês inteiro numa tela',
    texto:
      'Entradas avulsas e recorrentes, gastos fixos com “pago?”, gastos do dia a dia, investimentos e aportes em metas. Edição direta na linha, como planilha, com Enter e setas.',
    largo: true,
  },
  {
    Icone: CreditCard,
    titulo: 'Fatura de cartão de verdade',
    texto:
      'Dia de fechamento e de vencimento por cartão. “Gastei” conta pela data da compra; “sai da conta” conta pelo vencimento — e a tela diz qual é qual.',
  },
  {
    Icone: Layers,
    titulo: 'Parcelas sem dor de cabeça',
    texto: 'Edite ou apague uma parcela só, ou a série inteira. O app pergunta antes qual das duas.',
  },
  {
    Icone: Target,
    titulo: 'Metas com prazo',
    texto:
      'Até dez metas, com aporte, resgate e transferência entre elas. Com prazo, o app mostra quanto falta por mês — e se o ritmo deste ano chega lá.',
  },
  {
    Icone: PiggyBank,
    titulo: 'Orçamento que responde',
    texto: 'Teto do mês, limite por categoria e quanto ainda dá para gastar por dia até o fim.',
  },
  {
    Icone: Repeat,
    titulo: 'Acha a assinatura esquecida',
    texto:
      'Cobrança que se repete todo mês com valor parecido vira sugestão de gasto fixo — e o app avisa o que vence antes de vencer.',
  },
  {
    Icone: Download,
    titulo: 'Seus dados entram e saem',
    texto:
      'Importe extrato em CSV com prévia e sem duplicar. Exporte o mês ou o ano. Leve tudo num backup JSON — e traga de volta sem sobrescrever o que já existe.',
    largo: true,
  },
]

export function GradeRecursos() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RECURSOS.map((r) => (
        <Card key={r.titulo} className={cn('h-full', r.largo && 'sm:col-span-2 lg:col-span-3')}>
          <CardContent className={cn('flex h-full gap-4 p-5 sm:p-6', r.largo && 'sm:items-center')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-strong">
              <r.Icone className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-medium">{r.titulo}</h3>
              <p className="text-sm text-muted-foreground">{r.texto}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Segurança em linguagem simples.
 *
 * O que está escrito aqui é o que o banco faz de fato: a policy
 * `user_id = auth.uid()` nas quatro operações de cada tabela, conferida por
 * uma suíte que roda sob um papel sem `bypassrls` — sem isso o teste passaria
 * com todas as policies apagadas. O número de testes é o real.
 */
export const SEGURANCA = [
  {
    titulo: 'Cada linha tem dono',
    texto:
      'Não é o app que filtra seus dados: é o próprio banco. Toda tabela tem uma regra que só deixa passar as linhas da sua conta, nas quatro operações.',
  },
  {
    titulo: 'Provado a cada mudança',
    texto:
      '69 testes sobem um Postgres limpo, criam dois usuários e tentam ler, alterar e apagar os dados um do outro. Se qualquer regra cair, a entrega para.',
  },
  {
    titulo: 'O app não guarda segredo',
    texto:
      'O navegador só recebe a chave pública. Não existe servidor nosso no meio, e ninguém aqui tem acesso ao seu banco — o finZ não conversa com instituição nenhuma.',
  },
]

export const NO_CELULAR = [
  {
    Icone: Smartphone,
    titulo: 'Instala na tela inicial',
    texto: 'Abre como aplicativo, com atalho para lançar gasto ao segurar o ícone.',
  },
  {
    Icone: Sparkles,
    titulo: 'Tudo que existe no PC existe aqui',
    texto:
      'Nenhuma função é exclusiva da tela grande. Onde não cabe uma tabela, vira card ou folha — e há teste automático conferindo isso nas duas larguras.',
  },
  {
    Icone: Moon,
    titulo: 'Quatro cores, claro e escuro',
    texto: 'Rosa, azul, verde ou roxo, cada um com modo escuro. No desktop, ainda dá para adensar as linhas.',
  },
]

export function SetaCta() {
  return <ArrowRight className="h-4 w-4" />
}
