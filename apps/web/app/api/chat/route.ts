import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { StreamData, streamText } from 'ai'
import { NextResponse } from 'next/server'
import { BedrockClaudeProvider } from '@/lib/llm/BedrockClaudeProvider'
import { mapChipToVariable, prepareTurn } from '@/lib/orchestrator/turn'
import type { ProfileVariables } from '@/lib/orchestrator/profile'

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
})

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250514-v1:0'

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

  const llm = new BedrockClaudeProvider()
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
    model: bedrock(MODEL_ID),
    system: ctx.systemPrompt,
    messages: coreMessages,
    maxTokens: 512,
    onFinish: () => {
      data.close()
    },
  })

  return result.toDataStreamResponse({ data })
}
