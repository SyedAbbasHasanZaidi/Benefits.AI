import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Message } from 'ai'
import type { ConversationDetail } from '@/lib/conversations/types'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import type { ResultsData } from '@/lib/eligibility/types'

/**
 * GET /api/conversations/:id
 * Returns the conversation, its messages (chronological), and the most
 * recent assessment if one exists.
 *
 *   200 → ConversationDetail
 *   401 → not signed in
 *   404 → not found (RLS or non-existent)
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [convRes, msgsRes, asmtRes] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', id).maybeSingle(),
    supabase.from('messages').select('id, role, content, created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
    supabase.from('assessments').select('programs, total, claimable, created_at').eq('conversation_id', id).order('created_at', { ascending: false }).limit(1),
  ])

  if (convRes.error || !convRes.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const conv = convRes.data
  const messages: Message[] = (msgsRes.data ?? []).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const asmt = asmtRes.data?.[0]
  const latestAssessment: ResultsData | null = asmt
    ? { programs: asmt.programs as ResultsData['programs'], total: asmt.total, claimable: asmt.claimable }
    : null

  const detail: ConversationDetail = {
    id: conv.id,
    title: conv.title,
    status: conv.status,
    variables: (conv.variables ?? {}) as ProfileVariables,
    messages,
    latestAssessment,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  }
  return NextResponse.json(detail)
}

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation (cascades to messages + assessments via FK).
 *
 *   204 → deleted
 *   401 → not signed in
 *   500 → DB error (RLS-protected — non-owners get a silent no-op)
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) {
    console.error('conversation DELETE error:', error)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
