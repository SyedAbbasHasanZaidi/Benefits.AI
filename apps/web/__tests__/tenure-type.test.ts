import { describe, expect, test } from 'vitest'
import { mapChipToVariable } from '@/lib/orchestrator/turn'

describe('tenure_type chip mapping', () => {
  test('Own my home chip maps to owning not owner', () => {
    const result = mapChipToVariable('tenure_type', 'Own my home')
    expect(result).toEqual({ tenure_type: 'owning' })
  })

  test('Renting chip maps to renting', () => {
    const result = mapChipToVariable('tenure_type', 'Renting')
    expect(result).toEqual({ tenure_type: 'renting' })
  })

  test('Boarding chip maps to boarding', () => {
    const result = mapChipToVariable('tenure_type', 'Boarding')
    expect(result).toEqual({ tenure_type: 'boarding' })
  })
})
