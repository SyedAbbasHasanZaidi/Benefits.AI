import { describe, expect, test } from 'vitest'
import { pickNextQuestion, type EligibilityResult } from '@/lib/orchestrator/turn'
import type { ProfileVariables } from '@/lib/orchestrator/profile'

const emptyTraces = {}

const tracesWithMissing = {
  AGE_PENSION: { missing: ['is_australian_resident', 'annual_income'] },
  JOBSEEKER: { missing: ['employment_status', 'annual_income'] },
  NSW_SENIORS_CARD: { missing: ['is_australian_resident', 'age'] },
}

// Synthetic eligibility that lists the union of vars across the traces above,
// so pickNextQuestion's new scheme-aware gate (return null if no needs_info
// scheme requires the variable) doesn't short-circuit.
function eligibilityNeeding(...vars: string[]): EligibilityResult {
  return {
    eligible: [],
    needs_info: vars.length > 0 ? [{ schemeId: 'TEST_SCHEME', missingVars: vars }] : [],
    ineligible: [],
  }
}

describe('pickNextQuestion — Tier 1 baseline', () => {
  test('asks is_australian_resident first when profile is empty', () => {
    const q = pickNextQuestion(
      ['is_australian_resident', 'age'], {}, [], tracesWithMissing,
      eligibilityNeeding('is_australian_resident', 'age'),
    )
    expect(q?.variable).toBe('is_australian_resident')
  })

  test('skips baseline variables already in profile', () => {
    const profile: ProfileVariables = { is_australian_resident: true }
    const q = pickNextQuestion(
      ['age', 'employment_status'], profile, [], tracesWithMissing,
      eligibilityNeeding('age', 'employment_status'),
    )
    expect(q?.variable).toBe('age')
  })

  test('returns null when no missing variables', () => {
    const q = pickNextQuestion([], {}, [], emptyTraces, eligibilityNeeding())
    expect(q).toBeNull()
  })
})

describe('pickNextQuestion — Tier 2 scheme intent', () => {
  test('targets Age Pension variables when user mentions age pension', () => {
    const history = [{ role: 'user' as const, content: 'tell me about the age pension' }]
    const profile: ProfileVariables = {
      is_australian_resident: true,
      age: 68,
      employment_status: 'retired',
      state: 'NSW',
      tenure_type: 'renting',
    }
    const traces = { AGE_PENSION: { missing: ['annual_income'] } }
    const q = pickNextQuestion(
      ['annual_income'], profile, history, traces,
      eligibilityNeeding('annual_income'),
    )
    expect(q?.variable).toBe('annual_income')
  })
})

describe('pickNextQuestion — Tier 3 greedy', () => {
  test('picks variable that appears in most missing schemes', () => {
    const profile: ProfileVariables = {
      is_australian_resident: true,
      age: 68,
      employment_status: 'retired',
      state: 'NSW',
      tenure_type: 'renting',
    }
    const q = pickNextQuestion(
      ['annual_income', 'has_disability'],
      profile,
      [],
      tracesWithMissing,
      eligibilityNeeding('annual_income', 'has_disability'),
    )
    expect(q?.variable).toBe('annual_income')
  })
})

describe('pickNextQuestion — chips', () => {
  test('binary variable gets Yes/No chips plus Not sure? when guidance exists', () => {
    const q = pickNextQuestion(
      ['is_australian_resident'], {}, [], tracesWithMissing,
      eligibilityNeeding('is_australian_resident'),
    )
    expect(q?.chips).toContain('Yes')
    expect(q?.chips).toContain('No')
    expect(q?.chips).toContain('Not sure? →')
  })

  test('enum variable gets enum chips', () => {
    const profile: ProfileVariables = { is_australian_resident: true, age: 68 }
    const q = pickNextQuestion(
      ['employment_status'], profile, [],
      { JOBSEEKER: { missing: ['employment_status'] } },
      eligibilityNeeding('employment_status'),
    )
    expect(q?.chips).toContain('Employed')
    expect(q?.chips).toContain('Retired')
  })

  test('numeric variable gets no chips (only guidance chip if guidance exists)', () => {
    const profile: ProfileVariables = {
      is_australian_resident: true,
      age: 68,
      employment_status: 'retired',
      state: 'NSW',
      tenure_type: 'renting',
    }
    const q = pickNextQuestion(
      ['annual_income'], profile, [],
      { AGE_PENSION: { missing: ['annual_income'] } },
      eligibilityNeeding('annual_income'),
    )
    // annual_income has guidance so gets 'Not sure? →' but no Yes/No/enum chips
    expect(q?.chips).not.toContain('Yes')
    expect(q?.chips).not.toContain('No')
  })
})
