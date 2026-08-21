import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchTrack } from '@/components/ui/switch'
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { Campo, Cabecalho, Linha } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { cn } from '@/lib/utils'
import type { TemaCor, TipoPagamento } from '@/lib/database.types'
import { useTemaStore } from '@/store/tema'
import { useAuthStore } from '@/store/auth'
import { atualizarPerfil } from '@/services/profiles'
import { MAX_METAS } from '@/services/goals'
import { useConfiguracoes } from './use-configuracoes'

const TIPOS: Array<{ valor: TipoPagamento; rotulo: string }> = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'boleto', rotulo: 'Boleto' },
]

/** Aba estreita no celular para os quatro rótulos caberem lado a lado. */
const ABA = 'w-full px-1.5 text-xs sm:w-auto sm:px-4 sm:text-sm'

const TEMAS: Array<{ valor: TemaCor; rotulo: string; amostra: string }> = [
  { valor: 'rosa', rotulo: 'Rosa', amostra: 'hsl(340 65% 62%)' },
  { valor: 'azul', rotulo: 'Azul', amostra: 'hsl(212 70% 55%)' },
  { valor: 'verde', rotulo: 'Verde', amostra: 'hsl(158 55% 42%)' },
  { valor: 'roxo', rotulo: 'Roxo', amostra: 'hsl(270 55% 60%)' },
]

export function ConfiguracoesPage() {
  const { dados, carregando, erro, recarregar, acoes } = useConfiguracoes()

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Personalize formas de pagamento, categorias, metas e a cara do app."
      />

      {erro && <EstadoErro mensagem={erro} onTentarNovamente={() => void recarregar()} />}

      {carregando && !dados ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : dados ? (
        <Tabs defaultValue="aparencia">
          {/* Quatro colunas iguais numa linha só. O que não deixava caber era
              "Formas de pagamento": no celular ele vira "Pagamento", e assim
              some a segunda fileira. */}
          <TabsList className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto">
            <TabsTrigger value="aparencia" className={ABA}>
              Aparência
            </TabsTrigger>
            <TabsTrigger value="categorias" className={ABA}>
              Categorias
            </TabsTrigger>
            <TabsTrigger value="pagamento" className={ABA}>
              <span className="sm:hidden">Pagamento</span>
              <span className="hidden sm:inline">Formas de pagamento</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className={ABA}>
              Metas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="aparencia">
            <AbaAparencia />
          </TabsContent>

          <TabsContent value="categorias">
            <AbaCategorias dados={dados} acoes={acoes} />
          </TabsContent>

          <TabsContent value="pagamento">
            <AbaFormasPagamento dados={dados} acoes={acoes} />
          </TabsContent>

          <TabsContent value="metas">
            <AbaMetas dados={dados} acoes={acoes} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- Aparência
function AbaAparencia() {
  const { tema, definirTema, escuro, alternarEscuro } = useTemaStore()
  const perfil = useAuthStore((s) => s.profile)
  const definirProfile = useAuthStore((s) => s.definirProfile)
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [salvando, setSalvando] = useState(false)

  const salvarNome = async () => {
    setSalvando(true)
    try {
      const atualizado = await atualizarPerfil({ nome })
      definirProfile(atualizado)
      toast.success('Nome atualizado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o nome.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tema de cor</CardTitle>
          <CardDescription>A cor vale para o app inteiro, inclusive gráficos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quatro numa fileira só: as opções cabem sem rolar e a comparação
              entre as cores fica imediata. */}
          <div className="grid grid-cols-4 gap-2">
            {TEMAS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => definirTema(opcao.valor)}
                aria-pressed={tema === opcao.valor}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-2 text-xs transition-colors sm:text-sm',
                  tema === opcao.valor
                    ? 'border-primary bg-primary-soft/60 font-medium'
                    : 'border-border hover:bg-accent/50',
                )}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full sm:h-10 sm:w-10"
                  style={{ backgroundColor: opcao.amostra }}
                >
                  {tema === opcao.valor && <Check className="h-4 w-4 text-white" />}
                </span>
                {opcao.rotulo}
              </button>
            ))}
          </div>

          {/* A linha toda alterna — no celular um alvo de 44px de altura é
              bem mais fácil de acertar que só o trilho do interruptor. */}
          <button
            type="button"
            role="switch"
            aria-checked={escuro}
            onClick={alternarEscuro}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/50"
          >
            <span>
              <span className="block text-sm font-medium">Modo escuro</span>
              <span className="block text-xs text-muted-foreground">Combina com qualquer tema de cor.</span>
            </span>
            <SwitchTrack checked={escuro} />
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seu perfil</CardTitle>
          <CardDescription>Como você quer ser chamado no app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome-perfil">Nome</Label>
            <Input id="nome-perfil" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Button
            onClick={salvarNome}
            disabled={salvando || !nome.trim() || nome.trim() === (perfil?.nome ?? '')}
          >
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------- Categorias
type Acoes = ReturnType<typeof useConfiguracoes>['acoes']
type Dados = NonNullable<ReturnType<typeof useConfiguracoes>['dados']>

const TEMPLATE_CATEGORIA = 'md:grid-cols-[1fr,10rem,4rem,2.5rem]'

function AbaCategorias({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [limiteCentavos, setLimiteCentavos] = useState(0)

  const adicionar = () => {
    if (!nome.trim()) return
    void acoes.criarCategoria(nome.trim(), limiteCentavos === 0 ? null : limiteCentavos, '#f6a5c0')
    setNome('')
    setLimiteCentavos(0)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorias</CardTitle>
        <CardDescription>
          O limite mensal é opcional — quando existe, a barra fica amarela a partir de 80% e vermelha ao estourar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {dados.categorias.length === 0 ? (
          <EstadoVazio titulo="Nenhuma categoria" descricao="Crie a primeira categoria abaixo." />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE_CATEGORIA}>
              <span>Nome</span>
              <span className="text-right">Limite mensal</span>
              <span className="text-center">Cor</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>
            {dados.categorias.map((categoria) => (
              <Linha key={categoria.id} template={TEMPLATE_CATEGORIA}>
                <Campo rotulo="Nome">
                  <Input
                    data-celula
                    aria-label="Nome da categoria"
                    defaultValue={categoria.nome}
                    onBlur={(e) => {
                      if (e.target.value !== categoria.nome) void acoes.editarCategoria(categoria.id, { nome: e.target.value })
                    }}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <Campo rotulo="Limite mensal">
                  <MoneyInput
                    data-celula
                    aria-label="Limite mensal da categoria"
                    value={categoria.limite_centavos ?? 0}
                    onValueChange={(valor) =>
                      void acoes.editarCategoria(categoria.id, { limite_centavos: valor === 0 ? null : valor })
                    }
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <Campo rotulo="Cor" className="md:flex md:justify-center">
                  <input
                    type="color"
                    aria-label="Cor da categoria"
                    value={categoria.cor}
                    onChange={(e) => void acoes.editarCategoria(categoria.id, { cor: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded-md border border-input bg-card p-1"
                  />
                </Campo>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void acoes.excluirCategoria(categoria.id)}
                    aria-label={`Excluir categoria ${categoria.nome}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-[1fr,10rem,2.5rem]">
          <Input
            placeholder="Nova categoria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome da nova categoria"
          />
          <MoneyInput
            value={limiteCentavos}
            onValueChange={setLimiteCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Limite da nova categoria"
          />
          <Button size="icon" onClick={adicionar} aria-label="Adicionar categoria">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// -------------------------------------------------------- Formas de pagamento
const TEMPLATE_FORMA = 'md:grid-cols-[1fr,10rem,2.5rem]'

function AbaFormasPagamento({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoPagamento>('credito')

  const adicionar = () => {
    if (!nome.trim()) return
    void acoes.criarForma(nome.trim(), tipo)
    setNome('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formas de pagamento</CardTitle>
        <CardDescription>
          Crie uma linha por cartão (ex.: “Crédito 1”, “Crédito 2”) para separar as saídas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <GradeEditavel className="space-y-2 md:space-y-0">
          <Cabecalho template={TEMPLATE_FORMA}>
            <span>Nome</span>
            <span>Tipo</span>
            <span className="sr-only">Ações</span>
          </Cabecalho>
          {dados.formasPagamento.map((forma) => (
            <Linha key={forma.id} template={TEMPLATE_FORMA}>
              <Campo rotulo="Nome">
                <Input
                  data-celula
                  aria-label="Nome da forma de pagamento"
                  defaultValue={forma.nome}
                  onBlur={(e) => {
                    if (e.target.value !== forma.nome) void acoes.editarForma(forma.id, { nome: e.target.value })
                  }}
                  className="border-transparent bg-transparent hover:border-input focus:bg-card"
                />
              </Campo>
              <Campo rotulo="Tipo">
                <Select
                  value={forma.tipo}
                  onValueChange={(valor) => void acoes.editarForma(forma.id, { tipo: valor as TipoPagamento })}
                >
                  <SelectTrigger data-celula aria-label="Tipo da forma de pagamento" className="border-transparent bg-transparent hover:border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void acoes.excluirForma(forma.id)}
                  aria-label={`Excluir forma de pagamento ${forma.nome}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </Linha>
          ))}
        </GradeEditavel>

        <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-[1fr,10rem,2.5rem]">
          <Input
            placeholder="Nova forma (ex.: Crédito 2)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            aria-label="Nome da nova forma de pagamento"
          />
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPagamento)}>
            <SelectTrigger aria-label="Tipo da nova forma de pagamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" onClick={adicionar} aria-label="Adicionar forma de pagamento">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// -------------------------------------------------------------------- Metas
const TEMPLATE_META = 'md:grid-cols-[1fr,10rem,2.5rem]'

function AbaMetas({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)
  const noLimite = dados.metas.length >= MAX_METAS

  const adicionar = () => {
    if (!nome.trim()) return
    if (noLimite) {
      toast.error(`Você já tem ${MAX_METAS} metas. Exclua uma antes de criar outra.`)
      return
    }
    void acoes.criarMeta(nome.trim(), valorCentavos)
    setNome('')
    setValorCentavos(0)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas</CardTitle>
        <CardDescription>
          Até {MAX_METAS} metas. O quanto você guarda em cada uma é lançado no controle mensal.
          ({dados.metas.length}/{MAX_METAS})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {dados.metas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma meta" descricao="Ex.: Reserva de emergência, Viagem, Carro." />
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE_META}>
              <span>Meta</span>
              <span className="text-right">Valor-alvo</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>
            {dados.metas.map((meta) => (
              <Linha key={meta.id} template={TEMPLATE_META}>
                <Campo rotulo="Meta">
                  <Input
                    data-celula
                    aria-label="Nome da meta"
                    defaultValue={meta.nome}
                    onBlur={(e) => {
                      if (e.target.value !== meta.nome) void acoes.editarMeta(meta.id, { nome: e.target.value })
                    }}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <Campo rotulo="Valor-alvo">
                  <MoneyInput
                    data-celula
                    aria-label="Valor-alvo da meta"
                    value={meta.valor_meta_centavos}
                    onValueChange={(v) => void acoes.editarMeta(meta.id, { valor_meta_centavos: v })}
                    className="border-transparent bg-transparent hover:border-input focus:bg-card"
                  />
                </Campo>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void acoes.excluirMeta(meta.id)}
                    aria-label={`Excluir meta ${meta.nome}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </Linha>
            ))}
          </GradeEditavel>
        )}

        <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-[1fr,10rem,2.5rem]">
          <Input
            placeholder="Nova meta"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            disabled={noLimite}
            aria-label="Nome da nova meta"
          />
          <MoneyInput
            value={valorCentavos}
            onValueChange={setValorCentavos}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            disabled={noLimite}
            aria-label="Valor-alvo da nova meta"
          />
          <Button size="icon" onClick={adicionar} disabled={noLimite} aria-label="Adicionar meta">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
