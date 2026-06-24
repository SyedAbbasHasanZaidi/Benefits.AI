import { describe, expect, test } from 'vitest'
import { buildHandoffMessage } from '@/lib/orchestrator/turn'
import type { EligibilityResult } from '@/lib/orchestrator/turn'
import type { CorpusChunk } from '@/lib/retriever/query'

const mockEligibility: EligibilityResult = {
  eligible: ['JOBSEEKER'],
  needs_info: [],
  ineligible: [],
}

const mockChunks: CorpusChunk[] = [
  {
    id: '1',
    scheme_id: 'JOBSEEKER',
    chunk_text: '# JobSeeker\n\n## Who can get it\n\nYou must be...\n\n## How to apply\n\nApply online through myGov at my.gov.au or call 132 850.',
    metadata: {},
    similarity: 0.9,
  },
]

describe('buildHandoffMessage', () => {
  test('includes a friendly scheme name in the intro', () => {
    const msg = buildHandoffMessage(mockEligibility, mockChunks)
    // scheme IDs are mapped to friendly names; JOBSEEKER → JobSeeker Payment
    expect(msg).toContain('JobSeeker')
  })

  test('references the on-screen results summary', () => {
    const msg = buildHandoffMessage(mockEligibility, mockChunks)
    expect(msg).toContain('eligibility summary')
  })

  test('works without corpus chunks', () => {
    const msg = buildHandoffMessage(mockEligibility, [])
    expect(msg).toContain('JobSeeker')
    expect(msg).toContain('eligibility summary')
  })

  test('formats two schemes with "and"', () => {
    const msg = buildHandoffMessage(
      { eligible: ['JOBSEEKER', 'RENT_ASSISTANCE'], needs_info: [], ineligible: [] },
      [],
    )
    expect(msg).toMatch(/eligible for .+ and .+/)
  })

  test('formats three or more schemes with Oxford comma', () => {
    const msg = buildHandoffMessage(
      { eligible: ['JOBSEEKER', 'RENT_ASSISTANCE', 'LIHCC'], needs_info: [], ineligible: [] },
      [],
    )
    expect(msg).toContain(', and ')
  })

  test('unknown scheme ID falls back to raw ID', () => {
    const msg = buildHandoffMessage(
      { eligible: ['UNKNOWN_SCHEME'], needs_info: [], ineligible: [] },
      [],
    )
    expect(msg).toContain('UNKNOWN_SCHEME')
  })
})
