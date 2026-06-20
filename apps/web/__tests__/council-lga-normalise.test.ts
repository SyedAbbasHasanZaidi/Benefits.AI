import { describe, expect, test, vi, beforeEach } from 'vitest'
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmProvider } from '@/lib/llm/LlmProvider'

function mockLlm(extraction: Record<string, unknown> = {}): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: JSON.stringify(extraction) }),
    streamText: vi.fn().mockReturnValue(new ReadableStream()),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ eligible: [], ineligible: [], missing_variables: [], traces: {} }),
  }))
})

describe('council_lga suburb normalisation', () => {
  test('Glebe maps to SYDNEY', async () => {
    const ctx = await prepareTurn('I live in Glebe', {}, [], mockLlm({ council_lga: 'Glebe' }))
    expect(ctx.mergedProfile.council_lga).toBe('SYDNEY')
  })

  test('Manly maps to NORTHERN_BEACHES', async () => {
    const ctx = await prepareTurn('I live in Manly', {}, [], mockLlm({ council_lga: 'Manly' }))
    expect(ctx.mergedProfile.council_lga).toBe('NORTHERN_BEACHES')
  })

  test('Bankstown maps to CANTERBURY_BANKSTOWN', async () => {
    const ctx = await prepareTurn('I live in Bankstown', {}, [], mockLlm({ council_lga: 'Bankstown' }))
    expect(ctx.mergedProfile.council_lga).toBe('CANTERBURY_BANKSTOWN')
  })

  test('Blacktown (already an LGA name) stays as BLACKTOWN', async () => {
    const ctx = await prepareTurn('I live in Blacktown', {}, [], mockLlm({ council_lga: 'Blacktown' }))
    expect(ctx.mergedProfile.council_lga).toBe('BLACKTOWN')
  })

  test('Unknown suburb stays as-is uppercased', async () => {
    const ctx = await prepareTurn('I live in Wagga Wagga', {}, [], mockLlm({ council_lga: 'Wagga Wagga' }))
    expect(ctx.mergedProfile.council_lga).toBe('WAGGA_WAGGA')
  })
})
