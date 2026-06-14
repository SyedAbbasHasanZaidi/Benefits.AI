import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface AppendBody {
  role: 'user' | 'assistant'
  content: string
  variables?: Record<string, unknown>   // optional profile snapshot
}

/**
 * POST /api/conversations/:id/messages
 * Body: { role, content, variables? }
 * Appends a message to a conversation. Updates conversation.variables if given.
 *   201 → { id }
 *   400 → invalid body
 *   401 → not signed in
 *   500 → DB error
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: AppendBody
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (body.role !== 'user' && body.role !== 'assistant') {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  }
  if (!body.content || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: body.role, content: body.content })
    .select('id')
    .single()
  if (error) {
    console.error('messages POST error:', error)
    return NextResponse.json({ error: 'append failed' }, { status: 500 })
  }

  // Optionally update conversation.variables (the rolling profile snapshot)
  if (body.variables) {
    await supabase
      .from('conversations')
      .update({ variables: body.variables })
      .eq('id', conversationId)
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
