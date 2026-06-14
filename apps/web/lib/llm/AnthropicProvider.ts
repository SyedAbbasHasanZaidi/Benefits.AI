import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText as aiStreamText, type CoreMessage } from 'ai'
import type { GenerateOptions, LlmProvider, LlmResponse } from './LlmProvider'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6'

function toCoreMessages(messages: GenerateOptions['messages']): CoreMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

export class AnthropicProvider implements LlmProvider {
  private model

  constructor(modelId = DEFAULT_MODEL) {
    this.model = anthropic(modelId)
  }

  async generate(opts: GenerateOptions): Promise<LlmResponse> {
    const { text } = await generateText({
      model: this.model,
      system: opts.system,
      messages: toCoreMessages(opts.messages),
      maxTokens: opts.maxTokens ?? 2048,
    })
    return { text, toolCalls: [] }
  }

  streamText(opts: GenerateOptions): ReadableStream<string> {
    const result = aiStreamText({
      model: this.model,
      system: opts.system,
      messages: toCoreMessages(opts.messages),
      maxTokens: opts.maxTokens ?? 2048,
    })
    return result.textStream
  }
}
