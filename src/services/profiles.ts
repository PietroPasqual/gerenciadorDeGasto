import { supabase } from '@/lib/supabase'
import type { Json, Profile, TemaCor } from '@/lib/database.types'
import { unwrap, userIdAtual } from './base'

export async function obterPerfil(): Promise<Profile | null> {
  const userId = await userIdAtual()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (data) return data

  // Conta criada antes do trigger de seed: cria o profile e popula os padrões.
  await supabase.rpc('seed_defaults_if_empty')
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

export async function atualizarPerfil(mudancas: {
  nome?: string
  tema?: TemaCor
  orcamento_centavos?: number
  preferencias_lembrete?: Json
  assinaturas_ignoradas?: Json
  onboarding_em?: string | null
  onboarding_vistos?: string[]
  painel_ordem?: string[]
  painel_ocultos?: string[]
  painel_capa?: string
}): Promise<Profile> {
  const userId = await userIdAtual()
  return unwrap(
    await supabase.from('profiles').update(mudancas).eq('id', userId).select().single(),
    'Não foi possível salvar o perfil.',
  )
}
