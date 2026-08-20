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
import { CabecalhoPagina } from '@/components/common/cabecalho-pagina'
import { Campo, Cabecalho, Linha } from '@/components/common/linha-planilha'
import { GradeEditavel } from '@/components/common/grade-editavel'
import { MoneyInput } from '@/components/common/money-input'
import { EstadoErro, EstadoVazio } from '@/components/common/estados'
import { parseParaCentavos } from '@/lib/money'
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
          <TabsList className="flex-wrap">
            <TabsTrigger value="aparencia">Aparência</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="pagamento">Formas de pagamento</TabsTrigger>
            <TabsTrigger value="metas">Metas</TabsTrigger>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEMAS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => definirTema(opcao.valor)}
                aria-pressed={tema === opcao.valor}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-all hover:scale-[1.02]',
                  tema === opcao.valor ? 'border-primary ring-2 ring-primary/40' : 'border-border',
                )}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full"
                  style={{ backgroundColor: opcao.amostra }}
                >
                  {tema === opcao.valor && <Check className="h-4 w-4 text-white" />}
                </span>
                {opcao.rotulo}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Modo escuro</p>
              <p className="text-xs text-muted-foreground">Combina com qualquer tema de cor.</p>
            </div>
            <Button variant={escuro ? 'default' : 'outline'} size="sm" onClick={alternarEscuro}>
              {escuro ? 'Ativado' : 'Desativado'}
            </Button>
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
          <Button onClick={salvarNome} disabled={salvando || !nome.trim()}>
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
  const [limite, setLimite] = useState('')

  const adicionar = () => {
    if (!nome.trim()) return
    void acoes.criarCategoria(nome.trim(), parseParaCentavos(limite), '#f6a5c0')
    setNome('')
    setLimite('')
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
          <Input
            placeholder="Limite (opcional)"
            inputMode="decimal"
            className="tabular text-right"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
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
  const [valor, setValor] = useState('')
  const noLimite = dados.metas.length >= MAX_METAS

  const adicionar = () => {
    if (!nome.trim()) return
    if (noLimite) {
      toast.error(`Você já tem ${MAX_METAS} metas. Exclua uma antes de criar outra.`)
      return
    }
    void acoes.criarMeta(nome.trim(), parseParaCentavos(valor) ?? 0)
    setNome('')
    setValor('')
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
          <Input
            placeholder="Valor-alvo"
            inputMode="decimal"
            className="tabular text-right"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
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
