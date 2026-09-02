import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MoneyInput } from '@/components/common/money-input'
import { PreferenciasLembreteConfig } from '@/features/settings/components/preferencias-lembrete'
import { formatCentavos } from '@/lib/money'
import type { EtapaDoGuia, IdEtapa } from '@/lib/onboarding'
import { cn } from '@/lib/utils'
import { useGuia } from './use-guia'

/**
 * O primeiro acesso guiado.
 *
 * Ele NÃO é um trilho: é uma lista de sete coisas, cada uma com o seu estado
 * lido do dado real. Abre na primeira pendente, mas dá para ir a qualquer
 * passo, em qualquer ordem, e fechar no meio sem perder nada — o que foi salvo
 * está salvo, porque cada passo escreve pelos mesmos serviços que as
 * Configurações usam.
 *
 * É isso que faz "retomável" e "idempotente" saírem de graça: não existe um
 * ponteiro de progresso para ficar desatualizado. Quem configurou o orçamento
 * pelas Configurações volta aqui e encontra o passo pronto, sem ninguém ter
 * avisado o guia.
 *
 * NUNCA GRAVA DADO DE EXEMPLO. Campo em branco fica em branco; "pular" não
 * escreve valor nenhum, só registra que a pessoa resolveu aquele passo.
 */
export function GuiaPrimeiroAcesso({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const guia = useGuia()
  const { estado, acoes } = guia
  const [atual, setAtual] = React.useState<IdEtapa>('nome')
  const [escolheu, setEscolheu] = React.useState(false)

  // Abre na primeira pendente — mas só uma vez. Depois disso quem manda é a
  // pessoa: recalcular a cada gravação a arrastaria para outro passo no meio
  // de uma frase.
  React.useEffect(() => {
    if (!aberto || escolheu || guia.carregando) return
    setAtual(estado.proxima ?? 'nome')
    setEscolheu(true)
  }, [aberto, escolheu, guia.carregando, estado.proxima])

  React.useEffect(() => {
    if (!aberto) setEscolheu(false)
  }, [aberto])

  const etapa = estado.etapas.find((e) => e.id === atual) ?? estado.etapas[0]
  const indice = estado.etapas.findIndex((e) => e.id === etapa.id)
  const proxima = estado.etapas[indice + 1]

  const avancar = () => {
    if (proxima) setAtual(proxima.id)
    else void encerrar()
  }

  const encerrar = async () => {
    await acoes.encerrar()
    onFechar()
  }

  return (
    <Sheet open={aberto} onOpenChange={(a) => !a && void encerrar()}>
      <SheetContent aria-describedby={undefined} className="flex flex-col overflow-y-auto">
        <SheetTitle className="mb-1">Deixe o app com a sua cara</SheetTitle>
        <p className="text-sm text-muted-foreground">
          Sete coisas rápidas. Dá para pular qualquer uma e voltar depois — nada aqui é obrigatório.
        </p>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {estado.feitas} de {estado.total}
            </span>
            <span className="tabular font-medium">{estado.percentual}%</span>
          </div>
          <Progress
            value={estado.percentual}
            aria-label={`Progresso do primeiro acesso: ${estado.feitas} de ${estado.total}`}
          />
        </div>

        {/* A trilha de passos rola de lado no celular. Ela é navegação, e não
            decoração: dá para voltar a um passo já resolvido sem desfazê-lo. */}
        <nav
          aria-label="Passos do primeiro acesso"
          className="sem-barra-rolagem -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {estado.etapas.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setAtual(e.id)}
              aria-current={e.id === etapa.id ? 'step' : undefined}
              aria-label={`Passo ${i + 1}: ${e.titulo}${e.feita ? ', feito' : ''}`}
              className={cn(
                'alvo-toque flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                e.id === etapa.id
                  ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                  : e.feita
                    ? 'border-success/40 bg-success/10'
                    : 'border-border hover:bg-accent',
              )}
            >
              {e.feita ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              ) : (
                <span aria-hidden className="tabular text-xs text-muted-foreground">
                  {i + 1}
                </span>
              )}
              {e.titulo}
            </button>
          ))}
        </nav>

        <div className="mt-5 flex-1 space-y-4">
          <div>
            <h3 className="text-secao font-semibold">{etapa.titulo}</h3>
            <p className="text-sm text-muted-foreground">{etapa.descricao}</p>
          </div>

          <CorpoDoPasso guia={guia} etapa={etapa} onPronto={avancar} onFechar={onFechar} />
        </div>

        <div className="sticky bottom-0 -mx-5 mt-4 space-y-2 border-t border-border bg-card px-5 pb-1 pt-3">
          <Button variant="outline" className="h-11 w-full" onClick={avancar}>
            {proxima ? 'Pular este passo' : 'Terminar'}
            {proxima && <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />}
          </Button>
          <Button variant="ghost" className="h-11 w-full" onClick={() => void encerrar()}>
            Fazer isto depois
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CorpoDoPasso({
  guia,
  etapa,
  onPronto,
  onFechar,
}: {
  guia: ReturnType<typeof useGuia>
  etapa: EtapaDoGuia
  onPronto: () => void
  onFechar: () => void
}) {
  const { acoes, salvando } = guia
  const [nome, setNome] = React.useState(guia.nome)
  const [orcamento, setOrcamento] = React.useState(guia.orcamentoCentavos)
  const [entradaNome, setEntradaNome] = React.useState('Salário')
  const [entradaValor, setEntradaValor] = React.useState(0)

  const salvarE = async (executar: () => Promise<boolean>) => {
    if (await executar()) onPronto()
  }

  switch (etapa.id) {
    case 'nome':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guia-nome">Seu nome</Label>
            <Input
              id="guia-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como podemos te chamar?"
              className="h-12 text-base"
            />
          </div>
          <Button
            className="h-11 w-full"
            disabled={salvando || !nome.trim()}
            onClick={() => void salvarE(() => acoes.salvarNome(nome))}
          >
            Salvar nome
          </Button>
        </div>
      )

    case 'orcamento':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guia-orcamento">Teto de gastos do mês</Label>
            <MoneyInput
              id="guia-orcamento"
              value={orcamento}
              onValueChange={setOrcamento}
              aria-label="Teto de gastos do mês"
              className="h-12 text-base"
            />
          </div>
          <Button
            className="h-11 w-full"
            disabled={salvando || orcamento === 0}
            onClick={() => void salvarE(() => acoes.salvarOrcamento(orcamento))}
          >
            Salvar orçamento
          </Button>
        </div>
      )

    case 'entrada':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guia-entrada-nome">O que é</Label>
            <Input
              id="guia-entrada-nome"
              value={entradaNome}
              onChange={(e) => setEntradaNome(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guia-entrada-valor">Quanto entra por mês</Label>
            <MoneyInput
              id="guia-entrada-valor"
              value={entradaValor}
              onValueChange={setEntradaValor}
              aria-label="Quanto entra por mês"
              className="h-12 text-base"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ela passa a contar a partir deste mês — não em meses que já passaram.
          </p>
          <Button
            className="h-11 w-full"
            disabled={salvando || entradaValor === 0}
            onClick={() => void salvarE(() => acoes.criarEntrada(entradaNome, entradaValor))}
          >
            Salvar entrada
          </Button>
        </div>
      )

    case 'categorias':
      return (
        <div className="space-y-3">
          <ul className="space-y-2">
            {guia.categorias.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.cor }}
                />
                <span className="min-w-0 flex-1 truncate text-corpo">{c.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => void acoes.removerCategoria(c.id)}
                  aria-label={`Não uso ${c.nome}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Criar e renomear ficam nas Configurações — aqui a ideia é só tirar o que atrapalha.
          </p>
          <Button
            className="h-11 w-full"
            disabled={salvando}
            onClick={() => void salvarE(() => acoes.marcarPassoVisto('categorias'))}
          >
            Está bom assim
          </Button>
        </div>
      )

    case 'limites':
      return (
        <div className="space-y-3">
          <ul className="space-y-2">
            {guia.categorias.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Label htmlFor={`guia-limite-${c.id}`} className="min-w-0 flex-1 truncate">
                  {c.nome}
                </Label>
                <MoneyInput
                  id={`guia-limite-${c.id}`}
                  value={c.limite_centavos ?? 0}
                  onValueChange={(v) => void acoes.salvarLimite(c.id, v)}
                  aria-label={`Limite mensal de ${c.nome}`}
                  className="h-11 w-32 shrink-0"
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Zero quer dizer sem limite. Nada aqui bloqueia gasto — a barra só avisa.
          </p>
        </div>
      )

    case 'lembretes':
      return (
        <div className="space-y-3">
          <PreferenciasLembreteConfig
            preferencias={guia.preferencias}
            onMudar={(p) => void acoes.salvarLembretes(p)}
          />
          <Button
            className="h-11 w-full"
            disabled={salvando}
            onClick={() => void salvarE(() => acoes.marcarPassoVisto('lembretes'))}
          >
            Está bom assim
          </Button>
        </div>
      )

    case 'primeiro-gasto':
      return (
        <div className="space-y-3">
          <p className="rounded-lg bg-superficie px-3 py-2 text-sm text-muted-foreground">
            {guia.estado.etapas.find((e) => e.id === 'primeiro-gasto')?.feita
              ? 'Você já tem lançamentos — este passo está pronto.'
              : `O botão abaixo leva à folha de lançamento de verdade, a mesma de todo dia. Se preferir, o orçamento que você definiu foi de ${formatCentavos(guia.orcamentoCentavos)}.`}
          </p>
          {/* Sai do guia para a tela real, em vez de repetir o formulário aqui:
              a folha de lançamento tem parcelas, fatura e as consequências, e
              uma cópia menor dela ensinaria o app errado. */}
          <Button asChild className="h-11 w-full">
            <Link to="/mes?aba=gastos&novo=1" onClick={onFechar}>
              Lançar meu primeiro gasto
            </Link>
          </Button>
        </div>
      )
  }
}
