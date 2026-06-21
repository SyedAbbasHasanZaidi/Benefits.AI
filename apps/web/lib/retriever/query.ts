import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import { embedText } from './embed'

// Lazy-import the Next.js server client so this module can be loaded in CLI
// scripts (simulator, ingest) without triggering the `cookies()` call, which
// panics outside a Next.js request scope.
async function getSupabaseClient() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    return await createClient()
  } catch {
    // Fallback for CLI / script contexts where Next.js cookies() isn't available.
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
}

export interface CorpusChunk {
  id: string
  scheme_id: string
  chunk_text: string
  metadata: Record<string, unknown>
  similarity: number
}

export function synthesiseQuery(
  profile: ProfileVariables,
  schemeIds: string[],
): string {
  const parts: string[] = []

  if (profile.age !== undefined) parts.push(`age:${profile.age}`)
  if (profile.employment_status) parts.push(`employment_status:${profile.employment_status}`)
  if (profile.tenure_type) parts.push(`tenure_type:${profile.tenure_type}`)
  if (profile.state) parts.push(`state:${profile.state}`)
  if (profile.council_lga) parts.push(`council_lga:${profile.council_lga}`)
  if (profile.annual_income !== undefined) parts.push(`annual_income:${profile.annual_income}`)
  if (profile.rent_paid_fortnightly !== undefined)
    parts.push(`rent_paid_fortnightly:${profile.rent_paid_fortnightly}`)
  if (profile.has_disability) parts.push('has_disability:true')
  if (profile.is_carer) parts.push('is_carer:true')
  if (profile.has_financial_hardship) parts.push('has_financial_hardship:true')
  if (schemeIds.length > 0) parts.push(`— ${schemeIds.join(' ')}`)

  return parts.length > 0 ? parts.join(' ') : 'australian government benefits eligibility'
}

export async function queryCorpus(
  profile: ProfileVariables,
  schemeIds: string[],
  topK = 4,
): Promise<CorpusChunk[]> {
  const queryText = synthesiseQuery(profile, schemeIds)
  const embedding = await embedText(queryText)

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.rpc('match_corpus_chunks', {
    query_embedding: embedding,
    match_count: topK,
    filter_scheme_ids: schemeIds.length > 0 ? schemeIds : null,
  })

  if (error) {
    console.error('queryCorpus error:', error.message)
    return []
  }

  return (data ?? []) as CorpusChunk[]
}
