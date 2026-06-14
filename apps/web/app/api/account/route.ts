import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * DELETE /api/account
 * Permanently deletes the signed-in user's auth row (cascades to all data
 * tables via ON DELETE CASCADE FKs from migration 0003).
 *
 *   204 → deleted; client should sign out and redirect to /
 *   401 → not signed in
 *   500 → admin client misconfigured or delete failed
 */
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    console.error('account DELETE: missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json({ error: 'admin client not configured' }, { status: 500 })
  }

  // Admin client bypasses RLS — required for auth.admin.deleteUser
  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } })
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('account DELETE error:', error)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }

  // Sign the user out of their current session
  await supabase.auth.signOut()

  return new NextResponse(null, { status: 204 })
}
