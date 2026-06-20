import { describe, expect, test, vi, beforeEach } from 'vitest'
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmProvider } from '@/lib/llm/LlmProvider'

function mockLlm(extraction: Record<string, unknown> = {}): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: JSON.stringify(extraction) }),
    streamText: vi.fn().mockReturnValue(new ReadableStream()),
  }
}

function mockRules(eligible: string[] = [], missing: Record<string, string[]> = {}) {
  const traces = Object.fromEntries(
    Object.entries(missing).map(([id, vars]) => [id, { missing: vars }]),
  )
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      eligible,
      ineligible: [],
      missing_variables: Object.values(missing).flat(),
      traces,
    }),
  })
}

beforeEach(() => { vi.restoreAllMocks() })

describe('prepareTurn — mode: collecting_info', () => {
  test('returns collecting_info when no eligible schemes and no contradictions', async () => {
    mockRules([], { JOBSEEKER: ['age', 'employment_status'] })
    const ctx = await prepareTurn('hello', {}, [], mockLlm())
    expect(ctx.mode).toBe('collecting_info')
    expect(ctx.contradictions).toEqual([])
    expect(ctx.nextQuestion).not.toBeNull()
  })

  test('new field not yet in profile is not a contradiction', async () => {
    mockRules([], { JOBSEEKER: ['employment_status'] })
    const ctx = await prepareTurn('I am 28', {}, [], mockLlm({ age: 28 }))
    expect(ctx.mode).toBe('collecting_info')
    expect(ctx.contradictions).toEqual([])
  })
})

describe('prepareTurn — mode: handoff', () => {
  test('returns handoff when at least one scheme is eligible', async () => {
    mockRules(['JOBSEEKER'])
    const ctx = await prepareTurn('hello', {}, [], mockLlm())
    expect(ctx.mode).toBe('handoff')
    expect(ctx.nextQuestion).toBeNull()
    expect(ctx.chips).toEqual([])
    expect(ctx.guidance).toBeNull()
  })

  test('handoff takes priority over contradiction', async () => {
    mockRules(['AGE_PENSION'])
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.mode).toBe('handoff')
  })
})

describe('prepareTurn — mode: contradiction', () => {
  test('detects contradiction when extraction conflicts with existing profile field', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.mode).toBe('contradiction')
    expect(ctx.contradictions).toHaveLength(1)
    expect(ctx.contradictions[0]).toMatchObject({
      variable: 'age',
      previous: 30,
      extracted: 50,
    })
  })

  test('keeps old profile value — does not merge contradicting value', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.mergedProfile.age).toBe(30)
  })

  test('nextQuestion is null and chips are empty in contradiction mode', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.nextQuestion).toBeNull()
    expect(ctx.chips).toEqual([])
    expect(ctx.guidance).toBeNull()
  })

  test('chip delta is never treated as a contradiction', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    // chipDelta sets age: 45 — authoritative, not a contradiction
    const ctx = await prepareTurn('45', profile, [], mockLlm(), { age: 45 })
    expect(ctx.mode).not.toBe('contradiction')
    expect(ctx.mergedProfile.age).toBe(45)
  })
})
