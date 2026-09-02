import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Category, Json } from '@/lib/database.types'
import { estadoDoGuia, marcarVisto, type EstadoDoGuia, type IdEtapa } from '@/lib/onboarding'
import { periodoAtual } from '@/lib/dates'
import { lerPreferencias, type PreferenciasLembrete } from '@/lib/lembretes'
import { useAuthStore } from '@/store/auth'
import { atualizarPerfil } from '@/services/profiles'
import * as categoriasSvc from '@/services/categories'
import * as recorrentesSvc from '@/services/recurring-incomes'
import { existeLancamento } from '@/services/transactions'

/**
 * Os dados que o guia precisa para saber o que já está feito.
 *
 * Consulta própria, e não o cache das outras telas: o guia abre logo depois do
 * login, quando nenhuma delas rodou ainda. São três leituras pequenas, uma vez
 * por conta.
 */
export function useGuia() {
  const perfil = useAuthStore((s) => s.profile)
  const definirProfile = useAuthStore((s) => s.definirProfile)

  const [categorias, setCategorias] = useState<Category[]>([])
  const [temEntradaRecorrente, setTemEntrada] = useState(false)
  const [temLancamento, setTemLancamento] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const [cats, recorrentes, temLanc] = await Promise.all([
        categoriasSvc.listarCategorias(),
        recorrentesSvc.listarEntradasRecorrentes(),
        existeLancamento(),
      ])
      setCategorias(cats)
      setTemEntrada(recorrentes.length > 0)
      setTemLancamento(temLanc)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const estado: EstadoDoGuia = estadoDoGuia({
    nome: perfil?.nome ?? '',
    orcamentoCentavos: perfil?.orcamento_centavos ?? 0,
    temEntradaRecorrente,
    temLimite: categorias.some((c) => (c.limite_centavos ?? 0) > 0),
    temLancamento,
    vistos: perfil?.onboarding_vistos ?? [],
  })

  /**
   * Toda escrita do guia passa por aqui.
   *
   * O perfil é atualizado no store com a linha que o servidor devolveu, e não
   * com o que foi enviado: é isso que faz o passo aparecer como feito na hora,
   * pela mesma derivação que o resto do guia usa — sem um segundo caminho que
   * poderia discordar.
   */
  const comPerfil = async (
    mudancas: Parameters<typeof atualizarPerfil>[0],
    erro: string,
  ): Promise<boolean> => {
    setSalvando(true)
    try {
      definirProfile(await atualizarPerfil(mudancas))
      return true
    } catch (e) {
      toast.error(erro, { description: e instanceof Error ? e.message : undefined })
      return false
    } finally {
      setSalvando(false)
    }
  }

  const salvarNome = (nome: string) => comPerfil({ nome: nome.trim() }, 'Não foi possível salvar o nome')

  const salvarOrcamento = (orcamento_centavos: number) =>
    comPerfil({ orcamento_centavos }, 'Não foi possível salvar o orçamento')

  const salvarLembretes = (preferencias: PreferenciasLembrete) =>
    // O mesmo `as unknown as Json` das Configurações: `Json` exige assinatura
    // de índice, e a preferência é um objeto de campos nomeados.
    comPerfil(
      { preferencias_lembrete: preferencias as unknown as Json },
      'Não foi possível salvar os lembretes',
    )

  /** Marca um passo como resolvido sem mudar dado — só os dois que não derivam. */
  const marcarPassoVisto = async (id: IdEtapa) => {
    const atuais = perfil?.onboarding_vistos ?? []
    const proximos = marcarVisto(atuais, id)
    // Mesma lista = já estava lá. Gravar de novo seria uma ida ao servidor
    // para escrever exatamente o que já está escrito.
    if (proximos === atuais) return true
    return comPerfil({ onboarding_vistos: proximos }, 'Não foi possível salvar o passo')
  }

  /**
   * A entrada recorrente começa a valer no MÊS CORRENTE.
   *
   * Sem vigência, um salário cadastrado hoje passaria a contar em janeiro
   * também — inventando entrada em mês que já passou e já foi conferido. É a
   * mesma regra que a tabela de entradas recorrentes do mês usa.
   */
  const criarEntrada = async (descricao: string, valor_centavos: number) => {
    const { ano, mes } = periodoAtual()
    setSalvando(true)
    try {
      await recorrentesSvc.criarEntradaRecorrente({
        descricao: descricao.trim() || 'Salário',
        valor_centavos,
        inicio_ano: ano,
        inicio_mes: mes,
      })
      setTemEntrada(true)
      return true
    } catch (e) {
      toast.error('Não foi possível salvar a entrada', {
        description: e instanceof Error ? e.message : undefined,
      })
      return false
    } finally {
      setSalvando(false)
    }
  }

  const removerCategoria = async (id: string) => {
    const antes = categorias
    setCategorias((atuais) => atuais.filter((c) => c.id !== id))
    try {
      await categoriasSvc.excluirCategoria(id)
    } catch (e) {
      setCategorias(antes)
      toast.error('Não foi possível excluir a categoria', {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  const salvarLimite = async (id: string, limite_centavos: number) => {
    const antes = categorias
    setCategorias((atuais) =>
      atuais.map((c) => (c.id === id ? { ...c, limite_centavos: limite_centavos || null } : c)),
    )
    try {
      await categoriasSvc.atualizarCategoria(id, { limite_centavos: limite_centavos || null })
    } catch (e) {
      setCategorias(antes)
      toast.error('Não foi possível salvar o limite', {
        description: e instanceof Error ? e.message : undefined,
      })
    }
  }

  /** Encerra o guia — concluído ou dispensado, é a mesma coluna. */
  const encerrar = () =>
    comPerfil({ onboarding_em: new Date().toISOString() }, 'Não foi possível encerrar o guia')

  /** Reabre o guia por vontade própria, a partir das Configurações. */
  const reabrir = () => comPerfil({ onboarding_em: null }, 'Não foi possível reabrir o guia')

  return {
    estado,
    categorias,
    carregando,
    salvando,
    preferencias: lerPreferencias(perfil?.preferencias_lembrete),
    nome: perfil?.nome ?? '',
    orcamentoCentavos: perfil?.orcamento_centavos ?? 0,
    acoes: {
      salvarNome,
      salvarOrcamento,
      salvarLembretes,
      marcarPassoVisto,
      criarEntrada,
      removerCategoria,
      salvarLimite,
      encerrar,
      reabrir,
    },
  }
}
