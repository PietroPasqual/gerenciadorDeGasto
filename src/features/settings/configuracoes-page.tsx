import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
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
import { Cabecalho, Linha } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { CampoSheet, CartaoConfig, SheetConfig } from './components/sheet-config'
import { formatCentavos } from '@/lib/money'
import { useEhMobile } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import type { TemaCor, TipoPagamento } from '@/lib/database.types'
import { useTemaStore } from '@/store/tema'
import { useDensidadeStore, type Densidade } from '@/store/densidade'
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

const DENSIDADES: Array<{ valor: Densidade; rotulo: string; dica: string }> = [
  { valor: 'confortavel', rotulo: 'Confortável', dica: 'Linhas mais altas, mais respiro.' },
  { valor: 'compacto', rotulo: 'Compacto', dica: 'Cabem mais linhas na tela.' },
]

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
  const densidade = useDensidadeStore((e) => e.densidade)
  const definirDensidade = useDensidadeStore((e) => e.definirDensidade)
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

          {/* Só em tela grande: a densidade mexe nas alturas de md para cima, e
              um controle que não faz nada no celular é pior que não existir. */}
          <div className="hidden md:block">
            <p className="mb-1.5 text-sm font-medium">Densidade</p>
            <div className="grid grid-cols-2 gap-2">
              {DENSIDADES.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => definirDensidade(opcao.valor)}
                  aria-pressed={densidade === opcao.valor}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    densidade === opcao.valor
                      ? 'border-primary bg-primary-soft/60'
                      : 'border-border hover:bg-accent/50',
                  )}
                >
                  <span className="block text-sm font-medium">{opcao.rotulo}</span>
                  <span className="block text-xs text-muted-foreground">{opcao.dica}</span>
                </button>
              ))}
            </div>
          </div>
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

const TEMPLATE_CATEGORIA = 'md:grid-cols-[1fr,10rem,4rem,7rem]'

/**
 * Rascunho da sheet: `null` = fechada, `{ id: null }` = criando.
 * Guardar os campos aqui (e não ler direto do item) é o que permite cancelar
 * fechando a sheet sem ter escrito nada no banco.
 */
type Rascunho<T> = (T & { id: string | null }) | null

function AbaCategorias({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [limiteCentavos, setLimiteCentavos] = useState(0)
  const ehCelular = useEhMobile(768)
  const [rascunho, setRascunho] = useState<Rascunho<{ nome: string; limite: number; cor: string }>>(null)

  const adicionar = () => {
    if (!nome.trim()) return
    void acoes.criarCategoria(nome.trim(), limiteCentavos === 0 ? null : limiteCentavos, '#f6a5c0')
    setNome('')
    setLimiteCentavos(0)
  }

  const indiceDe = (id: string) => dados.categorias.findIndex((x) => x.id === id)
  const indice = rascunho?.id ? dados.categorias.findIndex((c) => c.id === rascunho.id) : -1

  const salvarSheet = () => {
    if (!rascunho || !rascunho.nome.trim()) return
    const limite = rascunho.limite === 0 ? null : rascunho.limite
    if (rascunho.id) {
      void acoes.editarCategoria(rascunho.id, { nome: rascunho.nome.trim(), limite_centavos: limite, cor: rascunho.cor })
    } else {
      void acoes.criarCategoria(rascunho.nome.trim(), limite, rascunho.cor)
    }
    setRascunho(null)
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
          <EstadoVazio
            titulo="Nenhuma categoria"
            descricao={ehCelular ? 'Toque em “Nova categoria” para criar a primeira.' : 'Crie a primeira categoria abaixo.'}
          />
        ) : ehCelular ? (
          <ul className="space-y-2">
            {dados.categorias.map((categoria) => (
              <li key={categoria.id}>
                <CartaoConfig
                  onClick={() =>
                    setRascunho({
                      id: categoria.id,
                      nome: categoria.nome,
                      limite: categoria.limite_centavos ?? 0,
                      cor: categoria.cor,
                    })
                  }
                  enfeite={
                    <span
                      aria-hidden
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: categoria.cor }}
                    />
                  }
                  titulo={categoria.nome}
                  detalhe={
                    <span className="tabular">
                      {categoria.limite_centavos ? formatCentavos(categoria.limite_centavos) : 'sem limite'}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
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
                <Input
                  data-celula
                  aria-label="Nome da categoria"
                  defaultValue={categoria.nome}
                  onBlur={(e) => {
                    if (e.target.value !== categoria.nome) void acoes.editarCategoria(categoria.id, { nome: e.target.value })
                  }}
                  className="min-w-0 border-transparent bg-transparent hover:border-input focus:bg-card"
                />
                <MoneyInput
                  data-celula
                  aria-label="Limite mensal da categoria"
                  value={categoria.limite_centavos ?? 0}
                  onValueChange={(valor) =>
                    void acoes.editarCategoria(categoria.id, { limite_centavos: valor === 0 ? null : valor })
                  }
                  className="border-transparent bg-transparent hover:border-input focus:bg-card"
                />
                <input
                  type="color"
                  aria-label="Cor da categoria"
                  value={categoria.cor}
                  onChange={(e) => void acoes.editarCategoria(categoria.id, { cor: e.target.value })}
                  className="mx-auto h-8 w-12 cursor-pointer rounded-md border border-input bg-card p-1"
                />
                <AcoesLinha
                  indice={indiceDe(categoria.id)}
                  total={dados.categorias.length}
                  onMover={(direcao) => void acoes.moverCategoria(categoria.id, direcao)}
                  onExcluir={() => void acoes.excluirCategoria(categoria.id)}
                  rotuloExcluir={`Excluir categoria ${categoria.nome}`}
                  nome={categoria.nome}
                />
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {ehCelular ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setRascunho({ id: null, nome: '', limite: 0, cor: '#f6a5c0' })}
          >
            <Plus className="h-4 w-4" />
            Nova categoria
          </Button>
        ) : (
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
        )}

        <SheetConfig
          aberta={rascunho !== null}
          onOpenChange={(aberta) => !aberta && setRascunho(null)}
          titulo={rascunho?.id ? 'Editar categoria' : 'Nova categoria'}
          onSalvar={salvarSheet}
          rotuloSalvar={rascunho?.id ? 'Salvar' : 'Criar categoria'}
          salvarDesabilitado={!rascunho?.nome.trim()}
          onExcluir={
            rascunho?.id
              ? () => {
                  void acoes.excluirCategoria(rascunho.id as string)
                  setRascunho(null)
                }
              : undefined
          }
          avisoExclusao="Os gastos já lançados nesta categoria continuam existindo, mas ficam sem categoria."
          onMover={rascunho?.id ? (direcao) => void acoes.moverCategoria(rascunho.id as string, direcao) : undefined}
          podeSubir={indice > 0}
          podeDescer={indice >= 0 && indice < dados.categorias.length - 1}
        >
          <CampoSheet rotulo="Nome">
            <Input
              value={rascunho?.nome ?? ''}
              onChange={(e) => setRascunho((r) => r && { ...r, nome: e.target.value })}
              placeholder="Ex.: Mercado"
            />
          </CampoSheet>
          <CampoSheet rotulo="Limite mensal" dica="Deixe em 0,00 para não ter limite.">
            <MoneyInput
              value={rascunho?.limite ?? 0}
              onValueChange={(v) => setRascunho((r) => r && { ...r, limite: v })}
            />
          </CampoSheet>
          <CampoSheet rotulo="Cor">
            <input
              type="color"
              value={rascunho?.cor ?? '#f6a5c0'}
              onChange={(e) => setRascunho((r) => r && { ...r, cor: e.target.value })}
              className="h-11 w-full cursor-pointer rounded-lg border border-input bg-card p-1"
            />
          </CampoSheet>
        </SheetConfig>
      </CardContent>
    </Card>
  )
}

/**
 * Subir / descer / excluir da linha no desktop.
 *
 * A reordenação nasceu na sheet do celular (M11); sem isto ela seria uma
 * função que só existe no telefone. O D5 ainda vai levar estas ações para o
 * hover — por ora ficam à mostra.
 */
function AcoesLinha({
  indice,
  total,
  onMover,
  onExcluir,
  rotuloExcluir,
  nome,
}: {
  indice: number
  total: number
  onMover: (direcao: -1 | 1) => void
  onExcluir: () => void
  rotuloExcluir: string
  nome: string
}) {
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        disabled={indice === 0}
        onClick={() => onMover(-1)}
        aria-label={`Subir ${nome}`}
      >
        <ArrowUp className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={indice === total - 1}
        onClick={() => onMover(1)}
        aria-label={`Descer ${nome}`}
      >
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onExcluir} aria-label={rotuloExcluir}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

// -------------------------------------------------------- Formas de pagamento
const TEMPLATE_FORMA = 'md:grid-cols-[1fr,10rem,7rem]'

const ROTULO_TIPO = (tipo: TipoPagamento) => TIPOS.find((t) => t.valor === tipo)?.rotulo ?? tipo

function AbaFormasPagamento({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoPagamento>('credito')
  const ehCelular = useEhMobile(768)
  const [rascunho, setRascunho] = useState<Rascunho<{ nome: string; tipo: TipoPagamento }>>(null)

  const adicionar = () => {
    if (!nome.trim()) return
    void acoes.criarForma(nome.trim(), tipo)
    setNome('')
  }

  const indiceDe = (id: string) => dados.formasPagamento.findIndex((x) => x.id === id)
  const indice = rascunho?.id ? dados.formasPagamento.findIndex((f) => f.id === rascunho.id) : -1

  const salvarSheet = () => {
    if (!rascunho || !rascunho.nome.trim()) return
    if (rascunho.id) void acoes.editarForma(rascunho.id, { nome: rascunho.nome.trim(), tipo: rascunho.tipo })
    else void acoes.criarForma(rascunho.nome.trim(), rascunho.tipo)
    setRascunho(null)
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
        {ehCelular ? (
          <ul className="space-y-2">
            {dados.formasPagamento.map((forma) => (
              <li key={forma.id}>
                <CartaoConfig
                  onClick={() => setRascunho({ id: forma.id, nome: forma.nome, tipo: forma.tipo })}
                  titulo={forma.nome}
                  detalhe={ROTULO_TIPO(forma.tipo)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE_FORMA}>
              <span>Nome</span>
              <span>Tipo</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>
            {dados.formasPagamento.map((forma) => (
              <Linha key={forma.id} template={TEMPLATE_FORMA}>
                <Input
                  data-celula
                  aria-label="Nome da forma de pagamento"
                  defaultValue={forma.nome}
                  onBlur={(e) => {
                    if (e.target.value !== forma.nome) void acoes.editarForma(forma.id, { nome: e.target.value })
                  }}
                  className="min-w-0 border-transparent bg-transparent hover:border-input focus:bg-card"
                />
                <Select
                  value={forma.tipo}
                  onValueChange={(valor) => void acoes.editarForma(forma.id, { tipo: valor as TipoPagamento })}
                >
                  <SelectTrigger
                    data-celula
                    aria-label="Tipo da forma de pagamento"
                    className="border-transparent bg-transparent hover:border-input"
                  >
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
                <AcoesLinha
                  indice={indiceDe(forma.id)}
                  total={dados.formasPagamento.length}
                  onMover={(direcao) => void acoes.moverForma(forma.id, direcao)}
                  onExcluir={() => void acoes.excluirForma(forma.id)}
                  rotuloExcluir={`Excluir forma de pagamento ${forma.nome}`}
                  nome={forma.nome}
                />
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {ehCelular ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setRascunho({ id: null, nome: '', tipo: 'credito' })}
          >
            <Plus className="h-4 w-4" />
            Nova forma de pagamento
          </Button>
        ) : (
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
        )}

        <SheetConfig
          aberta={rascunho !== null}
          onOpenChange={(aberta) => !aberta && setRascunho(null)}
          titulo={rascunho?.id ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
          onSalvar={salvarSheet}
          rotuloSalvar={rascunho?.id ? 'Salvar' : 'Criar forma'}
          salvarDesabilitado={!rascunho?.nome.trim()}
          onExcluir={
            rascunho?.id
              ? () => {
                  void acoes.excluirForma(rascunho.id as string)
                  setRascunho(null)
                }
              : undefined
          }
          avisoExclusao="Os gastos já lançados nesta forma continuam existindo, mas ficam sem forma de pagamento."
          onMover={rascunho?.id ? (direcao) => void acoes.moverForma(rascunho.id as string, direcao) : undefined}
          podeSubir={indice > 0}
          podeDescer={indice >= 0 && indice < dados.formasPagamento.length - 1}
        >
          <CampoSheet rotulo="Nome">
            <Input
              value={rascunho?.nome ?? ''}
              onChange={(e) => setRascunho((r) => r && { ...r, nome: e.target.value })}
              placeholder="Ex.: Crédito 2"
            />
          </CampoSheet>
          <CampoSheet rotulo="Tipo">
            <Select
              value={rascunho?.tipo ?? 'credito'}
              onValueChange={(v) => setRascunho((r) => r && { ...r, tipo: v as TipoPagamento })}
            >
              <SelectTrigger aria-label="Tipo">
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
          </CampoSheet>
        </SheetConfig>
      </CardContent>
    </Card>
  )
}

// -------------------------------------------------------------------- Metas
const TEMPLATE_META = 'md:grid-cols-[1fr,10rem,7rem]'

function AbaMetas({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [nome, setNome] = useState('')
  const [valorCentavos, setValorCentavos] = useState(0)
  const ehCelular = useEhMobile(768)
  const [rascunho, setRascunho] = useState<Rascunho<{ nome: string; alvo: number }>>(null)
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

  const indiceDe = (id: string) => dados.metas.findIndex((x) => x.id === id)
  const indice = rascunho?.id ? dados.metas.findIndex((m) => m.id === rascunho.id) : -1

  const salvarSheet = () => {
    if (!rascunho || !rascunho.nome.trim()) return
    if (rascunho.id) void acoes.editarMeta(rascunho.id, { nome: rascunho.nome.trim(), valor_meta_centavos: rascunho.alvo })
    else void acoes.criarMeta(rascunho.nome.trim(), rascunho.alvo)
    setRascunho(null)
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
          <EstadoVazio
            ilustracao="meta"
            titulo="Nenhuma meta"
            descricao="Ex.: Reserva de emergência, Viagem, Carro."
          />
        ) : ehCelular ? (
          <ul className="space-y-2">
            {dados.metas.map((meta) => (
              <li key={meta.id}>
                <CartaoConfig
                  onClick={() => setRascunho({ id: meta.id, nome: meta.nome, alvo: meta.valor_meta_centavos })}
                  titulo={meta.nome}
                  detalhe={<span className="tabular">{formatCentavos(meta.valor_meta_centavos)}</span>}
                />
              </li>
            ))}
          </ul>
        ) : (
          <GradeEditavel className="space-y-2 md:space-y-0">
            <Cabecalho template={TEMPLATE_META}>
              <span>Meta</span>
              <span className="text-right">Valor-alvo</span>
              <span className="sr-only">Ações</span>
            </Cabecalho>
            {dados.metas.map((meta) => (
              <Linha key={meta.id} template={TEMPLATE_META}>
                <Input
                  data-celula
                  aria-label="Nome da meta"
                  defaultValue={meta.nome}
                  onBlur={(e) => {
                    if (e.target.value !== meta.nome) void acoes.editarMeta(meta.id, { nome: e.target.value })
                  }}
                  className="min-w-0 border-transparent bg-transparent hover:border-input focus:bg-card"
                />
                <MoneyInput
                  data-celula
                  aria-label="Valor-alvo da meta"
                  value={meta.valor_meta_centavos}
                  onValueChange={(v) => void acoes.editarMeta(meta.id, { valor_meta_centavos: v })}
                  className="border-transparent bg-transparent hover:border-input focus:bg-card"
                />
                <AcoesLinha
                  indice={indiceDe(meta.id)}
                  total={dados.metas.length}
                  onMover={(direcao) => void acoes.moverMeta(meta.id, direcao)}
                  onExcluir={() => void acoes.excluirMeta(meta.id)}
                  rotuloExcluir={`Excluir meta ${meta.nome}`}
                  nome={meta.nome}
                />
              </Linha>
            ))}
          </GradeEditavel>
        )}

        {ehCelular ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={noLimite}
            onClick={() => setRascunho({ id: null, nome: '', alvo: 0 })}
          >
            <Plus className="h-4 w-4" />
            {noLimite ? `Limite de ${MAX_METAS} metas` : 'Nova meta'}
          </Button>
        ) : (
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
        )}

        <SheetConfig
          aberta={rascunho !== null}
          onOpenChange={(aberta) => !aberta && setRascunho(null)}
          titulo={rascunho?.id ? 'Editar meta' : 'Nova meta'}
          onSalvar={salvarSheet}
          rotuloSalvar={rascunho?.id ? 'Salvar' : 'Criar meta'}
          salvarDesabilitado={!rascunho?.nome.trim()}
          onExcluir={
            rascunho?.id
              ? () => {
                  void acoes.excluirMeta(rascunho.id as string)
                  setRascunho(null)
                }
              : undefined
          }
          avisoExclusao="Tudo o que você já guardou nesta meta some junto com ela."
          onMover={rascunho?.id ? (direcao) => void acoes.moverMeta(rascunho.id as string, direcao) : undefined}
          podeSubir={indice > 0}
          podeDescer={indice >= 0 && indice < dados.metas.length - 1}
        >
          <CampoSheet rotulo="Nome">
            <Input
              value={rascunho?.nome ?? ''}
              onChange={(e) => setRascunho((r) => r && { ...r, nome: e.target.value })}
              placeholder="Ex.: Reserva de emergência"
            />
          </CampoSheet>
          <CampoSheet rotulo="Valor-alvo">
            <MoneyInput
              value={rascunho?.alvo ?? 0}
              onValueChange={(v) => setRascunho((r) => r && { ...r, alvo: v })}
            />
          </CampoSheet>
        </SheetConfig>
      </CardContent>
    </Card>
  )
}
