import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

/**
 * POST /api/account/export
 * Builds a JSON snapshot of the user's data and emails it as an attachment.
 * Records the request in `account_exports` so the UI can show "pending → sent".
 *
 *   202 → { exportId } (async — email arrives within seconds)
 *   401 → not signed in
 *   500 → DB or email error
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Queue the export record
  const { data: exportRow, error: insertErr } = await supabase
    .from('account_exports')
    .insert({ user_id: user.id, delivered_to: user.email })
    .select('id')
    .single()
  if (insertErr) {
    console.error('account/export insert error:', insertErr)
    return NextResponse.json({ error: 'queue failed' }, { status: 500 })
  }
  const exportId = exportRow.id

  // Gather the user's data
  const [profileRes, conversationsRes, messagesRes, assessmentsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('conversations').select('*').eq('user_id', user.id),
    supabase.from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', [
        ...((await supabase.from('conversations').select('id').eq('user_id', user.id)).data ?? []).map((c) => c.id),
      ]),
    supabase.from('assessments')
      .select('id, conversation_id, programs, total, claimable, created_at')
      .in('conversation_id', [
        ...((await supabase.from('conversations').select('id').eq('user_id', user.id)).data ?? []).map((c) => c.id),
      ]),
  ])

  const snapshot = {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profileRes.data ?? null,
    conversations: conversationsRes.data ?? [],
    messages: messagesRes.data ?? [],
    assessments: assessmentsRes.data ?? [],
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Mark failed but don't 500 — UI will see the toast we surface from the
    // catch path below. In dev without Resend keys, we still want the endpoint
    // to respond so the UI flow can be tested end-to-end.
    await supabase
      .from('account_exports')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', exportId)
    return NextResponse.json(
      { error: 'email service not configured', exportId },
      { status: 500 },
    )
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Benefits.AI <noreply@benefits.ai>',
      to: user.email,
      subject: 'Your Benefits.AI data export',
      text:
        'Hi,\n\n' +
        'As requested, here is a copy of all the data Benefits.AI holds about your account.\n\n' +
        "It's attached as a JSON file. If you have questions, reply to this email.\n\n" +
        '— Benefits.AI',
      attachments: [
        {
          filename: `benefits-ai-export-${new Date().toISOString().slice(0, 10)}.json`,
          content: Buffer.from(JSON.stringify(snapshot, null, 2)).toString('base64'),
        },
      ],
    })

    await supabase
      .from('account_exports')
      .update({ status: 'sent', completed_at: new Date().toISOString() })
      .eq('id', exportId)

    return NextResponse.json({ exportId }, { status: 202 })
  } catch (err) {
    console.error('account/export email error:', err)
    await supabase
      .from('account_exports')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', exportId)
    return NextResponse.json({ error: 'email send failed' }, { status: 500 })
  }
}
