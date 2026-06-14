import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PROFILE, PATCHABLE_FIELDS, type UserProfile } from '@/lib/profile/types'

/**
 * GET /api/profile
 * Returns the current user's profile, creating one with defaults if it
 * doesn't exist yet. Requires an authenticated session.
 *
 *   200 → UserProfile
 *   401 → not signed in
 *   500 → DB error
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('profile GET error:', error)
    return NextResponse.json({ error: 'profile fetch failed' }, { status: 500 })
  }

  if (!data) {
    // First time — seed with defaults so subsequent PATCHes update an existing row
    const seed = {
      ...DEFAULT_PROFILE,
      user_id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? null,
      preferred_name: ((user.user_metadata?.full_name as string)?.split(' ')[0]) ?? null,
    }
    const { error: insertError } = await supabase.from('profiles').insert(seed)
    if (insertError) {
      console.error('profile seed error:', insertError)
      return NextResponse.json({ error: 'profile seed failed' }, { status: 500 })
    }
    return NextResponse.json({ ...DEFAULT_PROFILE, full_name: seed.full_name, preferred_name: seed.preferred_name })
  }

  // Strip user_id + updated_at before returning
  const { user_id: _u, updated_at: _t, ...rest } = data
  return NextResponse.json(rest as UserProfile)
}

/**
 * PATCH /api/profile
 * Body: partial UserProfile — only PATCHABLE_FIELDS are accepted; others ignored.
 *
 *   200 → updated UserProfile
 *   400 → empty/invalid body
 *   401 → not signed in
 *   500 → DB error
 */
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Partial<UserProfile>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }

  // Whitelist the fields — drop anything not in PATCHABLE_FIELDS
  const updates: Record<string, unknown> = {}
  for (const key of PATCHABLE_FIELDS) {
    if (key in body) updates[key] = (body as Record<string, unknown>)[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  }

  // Upsert keyed by user_id (covers first-touch case if user PATCHes before GET)
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('profile PATCH error:', error)
    return NextResponse.json({ error: 'profile update failed' }, { status: 500 })
  }

  const { user_id: _u, updated_at: _t, ...rest } = data
  return NextResponse.json(rest as UserProfile)
}
