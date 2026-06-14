import { createAnthropic } from '@ai-sdk/anthropic'
import { StreamData, streamText } from 'ai'
import { NextResponse } from 'next/server'
import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'
import { mapChipToVariable, prepareTurn } from '@/lib/orchestrator/turn'
import type { ProfileVariables } from '@/lib/orchestrator/profile'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const MODEL_ID = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6'

export async function POST(req: Request) {
  let body: {
    messages: Array<{ role: string; content: string; id?: string }>
    profile?: ProfileVariables
    lastAskedVariable?: keyof ProfileVariables
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { messages, profile = {}, lastAskedVariable } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const userMessage = lastUserMsg?.content ?? ''

  const chipDelta =
    lastAskedVariable && userMessage
      ? mapChipToVariable(lastAskedVariable, userMessage)
      : {}

  const history = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Haiku for extraction (cheap structured JSON) — Sonnet handles the user-facing stream below.
  const llm = new AnthropicProvider('claude-haiku-4-5-20251001')
  const ctx = await prepareTurn(userMessage, profile, history, llm, chipDelta)

  const data = new StreamData()
  data.append({
    profileDelta: ctx.profileDelta,
    eligibility: ctx.eligibility,
    chips: ctx.chips,
    guidance: ctx.guidance,
    guidanceVariable: ctx.nextQuestion?.variable ?? null,
  } as unknown as import('ai').JSONValue)

  const coreMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const result = streamText({
    model: anthropic(MODEL_ID),
    system: ctx.systemPrompt,
    messages: coreMessages,
    maxTokens: 512,
    onFinish: () => {
      data.close()
    },
  })

  return result.toDataStreamResponse({ data })
}
