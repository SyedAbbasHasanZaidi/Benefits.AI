import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { titleFromFirstMessage } from '@/lib/conversations/types'

/**
 * GET /api/conversations
 * Returns the current user's conversations, newest first.
 *   200 → ConversationSummary[]
 *   401 → not signed in
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, status, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('conversations GET error:', error)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }

  const summaries = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    ts: new Date(c.updated_at).getTime(),
  }))
  return NextResponse.json(summaries)
}

/**
 * POST /api/conversations
 * Body: { firstMessage: string }
 * Creates a new conversation, returns its id + title.
 *   201 → { id, title }
 *   400 → missing firstMessage
 *   401 → not signed in
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { firstMessage?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const firstMessage = body?.firstMessage?.trim()
  if (!firstMessage) {
    return NextResponse.json({ error: 'firstMessage required' }, { status: 400 })
  }

  const title = titleFromFirstMessage(firstMessage)

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title })
    .select('id, title')
    .single()

  if (error) {
    console.error('conversations POST error:', error)
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, title: data.title }, { status: 201 })
}
