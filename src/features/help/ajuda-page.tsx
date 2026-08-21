import { Link } from 'react-router-dom'
import { CalendarDays, LineChart, Settings, Target, Keyboard, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'

const SECOES = [
  {
    Icone: CalendarDays,
    titulo: 'Controle mensal',
    para: '/mes',
    itens: [
      'Escolha ano e mês no topo — as setas andam de mês em mês.',
      'Entradas: tudo que entrou (salário, freela, reembolso). O total aparece no resumo lateral.',
      'Gastos fixos: cadastre uma vez; a linha se repete em todos os meses. O “pago?” é marcado mês a mês.',
      'Gastos do mês: digite na linha pontilhada e pressione Enter. Clique em qualquer célula para editar.',
      'Investimentos: informe quanto guardou em cada meta. O donut do resumo mostra o % do que entrou.',
    ],
  },
  {
    Icone: LineChart,
    titulo: 'Comparativo anual',
    para: '/comparativo',
    itens: [
      'Mostra os 12 meses com entrada, gastos e diferença.',
      'Meses no vermelho (gastou mais do que entrou) ficam destacados.',
      'Meses futuros aparecem como “previsto”: já contam os gastos fixos.',
      'Clique no nome do mês para abrir aquele mês no controle mensal.',
    ],
  },
  {
    Icone: Target,
    titulo: 'Metas e wishlist',
    para: '/metas',
    itens: [
      'Wishlist: nome, valor e prioridade de 1 a 5 estrelas. Marque quando conquistar.',
      'Metas: até 10, com valor-alvo definido em Configurações.',
      'A grade mostra quanto foi guardado em cada meta, mês a mês — e é editável.',
      'Editar uma célula aqui é o mesmo que editar em “Investimentos do mês”.',
    ],
  },
  {
    Icone: Settings,
    titulo: 'Configurações',
    para: '/configuracoes',
    itens: [
      'Categorias: nome, cor e limite mensal (opcional).',
      'A barra da categoria fica amarela a partir de 80% do limite e vermelha quando estoura.',
      'Formas de pagamento: crie uma linha por cartão (Crédito 1, Crédito 2…) para separar as saídas.',
      'Tema: rosa, azul, verde ou roxo — e modo escuro, que combina com qualquer um.',
    ],
  },
]

export function AjudaPage() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Ajuda" descricao="O manual de uso do app, tela por tela." />

      <div className="grid gap-4 md:grid-cols-2">
        {SECOES.map((secao) => (
          <Card key={secao.titulo}>
            <CardHeader>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <secao.Icone className="h-5 w-5" />
              </span>
              <CardTitle>
                <Link to={secao.para} className="hover:underline">
                  {secao.titulo}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {secao.itens.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Keyboard className="h-5 w-5" />
            </span>
            <CardTitle>Atalhos de teclado</CardTitle>
            <CardDescription>As tabelas funcionam como uma planilha.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Atalho tecla="Enter" texto="vai para a próxima célula (e salva o que você digitou)" />
              <Atalho tecla="Shift + Enter" texto="volta para a célula anterior" />
              <Atalho tecla="Tab" texto="anda pelos campos na ordem natural" />
              <Atalho tecla="↑ / ↓" texto="sobe ou desce mantendo a mesma coluna" />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Download className="h-5 w-5" />
            </span>
            <CardTitle>Exportar e valores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                “Exportar CSV” no controle mensal baixa o mês inteiro; no comparativo, o ano.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                O arquivo usa ponto e vírgula e abre direto no Excel em português.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Os campos de valor funcionam como em caixa eletrônico: os dígitos entram da direita para a
                esquerda (digitar “150” vira R$ 1,50).
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Atalho({ tecla, texto }: { tecla: string; texto: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt>
        <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium">{tecla}</kbd>
      </dt>
      <dd className="text-muted-foreground">{texto}</dd>
    </div>
  )
}
