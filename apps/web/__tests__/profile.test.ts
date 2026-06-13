import { describe, expect, test } from 'vitest'
import { mergeProfile, type ProfileVariables } from '@/lib/orchestrator/profile'

describe('mergeProfile', () => {
  test('merges delta into empty profile', () => {
    const result = mergeProfile({}, { age: 68, employment_status: 'retired' })
    expect(result).toEqual({ age: 68, employment_status: 'retired' })
  })

  test('new delta keys are added to existing profile', () => {
    const current: ProfileVariables = { age: 68 }
    const result = mergeProfile(current, { state: 'NSW' })
    expect(result).toEqual({ age: 68, state: 'NSW' })
  })

  test('delta overwrites existing keys', () => {
    const current: ProfileVariables = { age: 68, state: 'VIC' }
    const result = mergeProfile(current, { state: 'NSW' })
    expect(result.state).toBe('NSW')
  })

  test('does not mutate current profile', () => {
    const current: ProfileVariables = { age: 68 }
    mergeProfile(current, { state: 'NSW' })
    expect(current).toEqual({ age: 68 })
  })

  test('empty delta returns copy of current', () => {
    const current: ProfileVariables = { age: 68 }
    const result = mergeProfile(current, {})
    expect(result).toEqual({ age: 68 })
    expect(result).not.toBe(current)
  })
})
