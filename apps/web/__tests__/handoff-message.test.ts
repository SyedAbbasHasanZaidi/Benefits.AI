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
  test('includes scheme name in intro', () => {
    const msg = buildHandoffMessage(mockEligibility, mockChunks)
    expect(msg).toContain('JOBSEEKER')
  })

  test('includes how-to-apply step from corpus chunk', () => {
    const msg = buildHandoffMessage(mockEligibility, mockChunks)
    expect(msg).toContain('myGov')
  })

  test('includes eligibility meter reference', () => {
    const msg = buildHandoffMessage(mockEligibility, mockChunks)
    expect(msg).toContain('eligibility meter')
  })

  test('falls back gracefully when no chunk available', () => {
    const msg = buildHandoffMessage(mockEligibility, [])
    expect(msg).toContain('JOBSEEKER')
    expect(msg).toContain('eligibility meter')
  })

  test('extracts apply step from alternate heading "How to claim"', () => {
    const chunk: CorpusChunk = {
      id: '2',
      scheme_id: 'LIHCC',
      chunk_text: '# LIHCC\n\n## Who can get it\n\n...\n\n## How to claim\n\nApply via myGov or call 132 490.',
      metadata: {},
      similarity: 0.85,
    }
    const msg = buildHandoffMessage(
      { eligible: ['LIHCC'], needs_info: [], ineligible: [] },
      [chunk],
    )
    expect(msg).toContain('132 490')
  })
})
