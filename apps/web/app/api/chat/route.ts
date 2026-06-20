import { createAnthropic } from '@ai-sdk/anthropic'
import { StreamData, streamText } from 'ai'
import { NextResponse } from 'next/server'
import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'
import { buildBotContext, mapChipToVariable, prepareTurn } from '@/lib/orchestrator/turn'
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
    askedStreak?: Record<string, number>
    skippedAt?: Record<string, number>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { messages, profile = {}, lastAskedVariable, askedStreak = {}, skippedAt = {} } = body

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

  // Sonnet for extraction — Haiku silently returned {} on natural-language
  // inferences like "I was 17 but just had my birthday" → age 18. The cost
  // delta (~$0.003 vs $0.0005 per turn) is acceptable at MVP scale.
  const llm = new AnthropicProvider('claude-sonnet-4-6')
  const ctx = await prepareTurn(
    userMessage, profile, history, llm, chipDelta,
    lastAskedVariable ?? null, askedStreak, skippedAt,
  )

  const data = new StreamData()
  data.append({
    profileDelta: ctx.profileDelta,
    eligibility: ctx.eligibility,
    chips: ctx.chips,
    guidance: ctx.guidance,
    guidanceVariable: ctx.nextQuestion?.variable ?? null,
    askedStreak: ctx.askedStreak,
    skippedAt: ctx.skippedAt,
  } as unknown as import('ai').JSONValue)

  const lastBotResponse = messages
    .filter((m) => m.role === 'assistant')
    .at(-1)?.content ?? null

  const result = streamText({
    model: anthropic(MODEL_ID),
    system: ctx.systemPrompt,
    messages: buildBotContext(ctx.mergedProfile, ctx.nextQuestion, lastBotResponse, userMessage),
    maxTokens: 512,
    onFinish: () => {
      data.close()
    },
  })

  return result.toDataStreamResponse({ data })
}
