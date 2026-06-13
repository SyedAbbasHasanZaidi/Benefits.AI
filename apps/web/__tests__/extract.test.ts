import { describe, expect, test, vi } from 'vitest'
import type { LlmProvider } from '@/lib/llm/LlmProvider'
import { extract } from '@/lib/orchestrator/extract'

function makeLlm(responseText: string): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: responseText, toolCalls: [] }),
    streamText: vi.fn(),
  }
}

describe('extract', () => {
  test('parses valid JSON delta from LLM response', async () => {
    const llm = makeLlm('{"age":68,"employment_status":"retired"}')
    const result = await extract('I am 68 and retired', {}, llm)
    expect(result).toEqual({ age: 68, employment_status: 'retired' })
  })

  test('strips keys not in ProfileVariables schema', async () => {
    const llm = makeLlm('{"age":68,"favourite_colour":"blue"}')
    const result = await extract('I am 68', {}, llm)
    expect(result).toEqual({ age: 68 })
    expect(result).not.toHaveProperty('favourite_colour')
  })

  test('returns empty object when LLM returns empty JSON', async () => {
    const llm = makeLlm('{}')
    const result = await extract('What can I get?', {}, llm)
    expect(result).toEqual({})
  })

  test('returns empty object when LLM returns invalid JSON', async () => {
    const llm = makeLlm('sorry I cannot help')
    const result = await extract('hello', {}, llm)
    expect(result).toEqual({})
  })

  test('does not re-extract variables already in current profile', async () => {
    const llm = makeLlm('{"state":"NSW"}')
    const result = await extract('I live in NSW', { age: 68 }, llm)
    const callArgs = (llm.generate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('"age": 68')
    expect(result).toEqual({ state: 'NSW' })
  })

  test('parses boolean values correctly', async () => {
    const llm = makeLlm('{"is_australian_resident":true,"has_partner":false}')
    const result = await extract('I am a resident, no partner', {}, llm)
    expect(result.is_australian_resident).toBe(true)
    expect(result.has_partner).toBe(false)
  })
})
