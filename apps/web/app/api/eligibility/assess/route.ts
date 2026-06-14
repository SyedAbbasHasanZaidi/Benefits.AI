import { NextResponse } from 'next/server'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import type { RulesResult } from '@/lib/orchestrator/turn'
import { toEligibilityResult } from '@/lib/orchestrator/turn'
import type { SchemeMetadata } from '@/components/SchemeCard'
import { transformToResults } from '@/lib/eligibility/transform'
import { createClient } from '@/lib/supabase/server'

const RULES_URL = process.env.RULES_SERVICE_URL ?? 'http://localhost:8001'

interface AssessRequest {
  profile: ProfileVariables
  conversationId?: string
}

/**
 * POST /api/eligibility/assess
 * Body:    { profile, conversationId? }
 * Returns: ResultsData (programs[], total, claimable) — matches design contract
 *
 * Pipeline:
 *  1. Validate profile payload
 *  2. Concurrently call rules service /calculate + /schemes
 *  3. Convert rules result → EligibilityResult
 *  4. Map to design's ResultsData shape via transformToResults
 *  5. Return JSON
 *
 * Errors:
 *  - 400 invalid JSON / missing profile
 *  - 502 rules service unreachable or non-2xx
 */
export async function POST(req: Request) {
  let body: AssessRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const profile = body?.profile
  if (!profile || typeof profile !== 'object') {
    return NextResponse.json({ error: 'profile required' }, { status: 400 })
  }

  try {
    const [calcRes, schemesRes] = await Promise.all([
      fetch(`${RULES_URL}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: profile }),
      }),
      fetch(`${RULES_URL}/schemes`, { next: { revalidate: 300 } }),
    ])

    if (!calcRes.ok) {
      console.error('eligibility/assess: rules /calculate failed', calcRes.status)
      return NextResponse.json({ error: 'rules service unavailable' }, { status: 502 })
    }
    if (!schemesRes.ok) {
      console.error('eligibility/assess: rules /schemes failed', schemesRes.status)
      return NextResponse.json({ error: 'rules service unavailable' }, { status: 502 })
    }

    const rulesResult = (await calcRes.json()) as RulesResult
    const schemesData = (await schemesRes.json()) as { schemes?: SchemeMetadata[] }
    const schemes = schemesData.schemes ?? []

    const eligibility = toEligibilityResult(rulesResult)
    const results = transformToResults(eligibility, schemes, profile)

    // Persist to conversation if signed-in user provided a conversationId
    if (body.conversationId) {
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('assessments').insert({
            conversation_id: body.conversationId,
            programs: results.programs,
            total: results.total,
            claimable: results.claimable,
          })
          const status = results.claimable > 0
            ? `${results.claimable} match${results.claimable === 1 ? '' : 'es'}`
            : null
          await supabase
            .from('conversations')
            .update({ status, variables: profile })
            .eq('id', body.conversationId)
        }
      } catch (persistErr) {
        // Non-fatal — results are still returned even if persistence fails
        console.error('assess persistence failed', persistErr)
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('eligibility/assess: unexpected error', err)
    return NextResponse.json({ error: 'assessment failed' }, { status: 500 })
  }
}
