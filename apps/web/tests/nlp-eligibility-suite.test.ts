/**
 * NLP + Eligibility Reasoning — executable test harness.
 * See nlp-eligibility-suite.md for the full test plan and the eight categories.
 *
 * This file covers the DETERMINISTIC parts only:
 *   - mapChipToVariable     — chip text → variable delta
 *   - parseBracketChip      — bracket text → number  (tested indirectly via mapChipToVariable)
 *   - pickNextQuestion      — given a profile, what to ask next
 *   - toEligibilityResult   — rules result → eligibility tier
 *   - transformToResults    — eligibility → ResultsData
 *
 * NLP + LLM-judge tests live in a separate suite (`extract.test.ts`) because
 * they require ANTHROPIC_API_KEY and a longer timeout.
 *
 * No Supabase. No corpus. No persistence.
 */

import { describe, it, expect } from 'vitest'
import {
  mapChipToVariable,
  pickNextQuestion,
  toEligibilityResult,
  type RulesResult,
} from '@/lib/orchestrator/turn'
import { transformToResults } from '@/lib/eligibility/transform'
import type { ProfileVariables } from '@/lib/orchestrator/profile'
import type { SchemeMetadata } from '@/components/SchemeCard'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SCHEMES: SchemeMetadata[] = [
  {
    id: 'JOBSEEKER', name: 'JobSeeker Payment', tier: 'federal',
    agency: 'Services Australia', apply_url: 'https://example/jobseeker',
    delivery_channel: 'federal_direct', plain_description: 'Income support.',
    required_inputs: ['is_australian_resident', 'age', 'employment_status', 'annual_income'],
  },
  {
    id: 'FTB_A', name: 'Family Tax Benefit Part A', tier: 'federal',
    agency: 'Services Australia', apply_url: 'https://example/ftba',
    delivery_channel: 'federal_direct', plain_description: 'Per-child payment.',
    required_inputs: ['is_australian_resident', 'number_of_children', 'youngest_child_age', 'annual_income'],
  },
  {
    id: 'RENT_ASSISTANCE', name: 'Rent Assistance', tier: 'federal',
    agency: 'Services Australia', apply_url: 'https://example/ra',
    delivery_channel: 'federal_direct', plain_description: 'Fortnightly rent help.',
    required_inputs: ['is_australian_resident', 'tenure_type', 'rent_paid_fortnightly'],
  },
]

const emptyTraces: RulesResult['traces'] = {}

// Helper: build an EligibilityResult that says "one scheme needs these vars".
// pickNextQuestion is now scheme-aware — it returns null unless some
// needs_info scheme requires the variable. Tests of baseline/greedy ordering
// need a synthetic eligibility object that lists the vars under test.
function eligibilityNeeding(...vars: string[]): import('@/lib/orchestrator/turn').EligibilityResult {
  return {
    eligible: [],
    needs_info: vars.length > 0 ? [{ schemeId: 'TEST_SCHEME', missingVars: vars }] : [],
    ineligible: [],
  }
}
const emptyEligibility = eligibilityNeeding()

// ─────────────────────────────────────────────────────────────────────────────
// Chip mapping — covers every BRACKET_CHIPS, ENUM_CHIPS, and BINARY_CHIP_VARS
// pattern the UI can produce.
// ─────────────────────────────────────────────────────────────────────────────

describe('mapChipToVariable — binary chips', () => {
  it.each([
    ['is_australian_resident', 'Yes', { is_australian_resident: true }],
    ['is_australian_resident', 'No', { is_australian_resident: false }],
    ['has_disability', 'Yes', { has_disability: true }],
    ['is_carer', 'No', { is_carer: false }],
    ['has_partner', 'Yes', { has_partner: true }],
    ['has_financial_hardship', 'No', { has_financial_hardship: false }],
  ] as const)('%s ← %s → %o', (variable, chip, expected) => {
    expect(mapChipToVariable(variable, chip)).toEqual(expected)
  })
})

describe('mapChipToVariable — enum chips', () => {
  it.each([
    ['tenure_type', 'Renting', { tenure_type: 'renting' }],
    ['tenure_type', 'Own my home', { tenure_type: 'owning' }],
    ['tenure_type', 'Boarding', { tenure_type: 'boarding' }],
    ['employment_status', 'Full-time', { employment_status: 'full_time' }],
    ['employment_status', 'Part-time', { employment_status: 'part_time' }],
    ['employment_status', 'Retired', { employment_status: 'retired' }],
    ['employment_status', 'Unemployed', { employment_status: 'unemployed' }],
    ['employment_status', 'Student', { employment_status: 'student' }],
    ['state', 'NSW', { state: 'NSW' }],
    ['state', 'vic', { state: 'VIC' }],
  ] as const)('%s ← %s → %o', (variable, chip, expected) => {
    expect(mapChipToVariable(variable, chip)).toEqual(expected)
  })
})

describe('mapChipToVariable — bracket chips (age)', () => {
  it.each([
    ['Under 18', 17],
    ['18–22', 20],
    ['18-22', 20],   // hyphen instead of en-dash
    ['23–34', 29],   // (23+34)/2 = 28.5 → 29
    ['35–49', 42],
    ['50–66', 58],
    ['67+', 67],
  ])('age ← %s → age=%i', (chip, expected) => {
    expect(mapChipToVariable('age', chip)).toEqual({ age: expected })
  })
})

describe('mapChipToVariable — bracket chips (annual_income)', () => {
  it.each([
    ['Under $25k', 24999],   // 25000 - 1
    ['$25–45k', 35000],
    ['$45–80k', 62500],      // (45000 + 80000) / 2 = 62500
    ['$80–120k', 100000],
    ['$120k+', 120000],
  ])('annual_income ← %s → %i', (chip, expected) => {
    expect(mapChipToVariable('annual_income', chip)).toEqual({ annual_income: expected })
  })
})

describe('mapChipToVariable — bracket chips (rent_paid_fortnightly)', () => {
  it.each([
    ['Under $300', 299],
    ['$300–500', 400],
    ['$500–800', 650],
    ['$800+', 800],
  ])('rent_paid_fortnightly ← %s → %i', (chip, expected) => {
    expect(mapChipToVariable('rent_paid_fortnightly', chip)).toEqual({ rent_paid_fortnightly: expected })
  })
})

describe('mapChipToVariable — bracket chips (number_of_children)', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4+', 4],
  ])('number_of_children ← %s → %i', (chip, expected) => {
    expect(mapChipToVariable('number_of_children', chip)).toEqual({ number_of_children: expected })
  })
})

describe('mapChipToVariable — bracket chips (youngest_child_age)', () => {
  it.each([
    ['Under 5', 4],
    ['5–12', 9],     // (5+12)/2 = 8.5 → 9
    ['13–17', 15],
    ['18–21', 20],   // (18+21)/2 = 19.5 → 20
  ])('youngest_child_age ← %s → %i', (chip, expected) => {
    expect(mapChipToVariable('youngest_child_age', chip)).toEqual({ youngest_child_age: expected })
  })
})

describe('mapChipToVariable — bracket chips (hours_worked_per_week)', () => {
  it.each([
    ['Not working', 0],
    ['Under 15', 14],
    ['15–30', 23],   // (15+30)/2 = 22.5 → 23
    ['30–38', 34],
    ['38+', 38],
  ])('hours_worked_per_week ← %s → %i', (chip, expected) => {
    expect(mapChipToVariable('hours_worked_per_week', chip)).toEqual({ hours_worked_per_week: expected })
  })
})

describe('mapChipToVariable — special markers', () => {
  it('Not sure? → returns empty delta', () => {
    expect(mapChipToVariable('age', 'Not sure? →')).toEqual({})
  })

  it('unrecognised chip returns empty delta', () => {
    expect(mapChipToVariable('age', 'whatever')).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Next-question logic — baseline order, scheme intent, greedy fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('pickNextQuestion — baseline order', () => {
  it('asks is_australian_resident first when nothing known', () => {
    const q = pickNextQuestion(
      ['is_australian_resident', 'age', 'employment_status', 'state', 'tenure_type'],
      {},
      [],
      emptyTraces,
      eligibilityNeeding('is_australian_resident', 'age', 'employment_status', 'state', 'tenure_type'),
    )
    expect(q?.variable).toBe('is_australian_resident')
  })

  it('skips already-known baseline vars', () => {
    const q = pickNextQuestion(
      ['age', 'employment_status', 'state'],
      { is_australian_resident: true },
      [],
      emptyTraces,
      eligibilityNeeding('age', 'employment_status', 'state'),
    )
    expect(q?.variable).toBe('age')
  })

  it('produces Yes/No chips for binary variables', () => {
    const q = pickNextQuestion(
      ['is_australian_resident'], {}, [], emptyTraces,
      eligibilityNeeding('is_australian_resident'),
    )
    expect(q?.chips).toEqual(['Yes', 'No', 'Not sure? →'])
  })

  it('produces bracket chips for numeric variables', () => {
    const q = pickNextQuestion(
      ['age'], { is_australian_resident: true }, [], emptyTraces,
      eligibilityNeeding('age'),
    )
    expect(q?.chips).toEqual(expect.arrayContaining(['18–22', '67+']))
  })

  it('returns null when no needs_info schemes', () => {
    const q = pickNextQuestion([], {}, [], emptyTraces, emptyEligibility)
    expect(q).toBeNull()
  })

  it('returns null even with missing baseline vars if no scheme needs them (new scheme-aware behaviour)', () => {
    const q = pickNextQuestion(
      ['is_australian_resident', 'age'],
      {},
      [],
      emptyTraces,
      emptyEligibility,
    )
    expect(q).toBeNull()
  })
})

describe('pickNextQuestion — scheme intent detection', () => {
  it('prioritises JobSeeker-required variable when user mentions it', () => {
    const traces: RulesResult['traces'] = {
      JOBSEEKER: { missing: ['annual_income'] },
    }
    const q = pickNextQuestion(
      ['annual_income', 'has_partner', 'has_disability'],
      { is_australian_resident: true, age: 30, employment_status: 'unemployed', state: 'NSW', tenure_type: 'renting' },
      [{ role: 'user', content: 'I just lost my job and applied for JobSeeker' }],
      traces,
      eligibilityNeeding('annual_income', 'has_partner', 'has_disability'),
    )
    expect(q?.variable).toBe('annual_income')
  })
})

describe('pickNextQuestion — greedy fallback', () => {
  it('picks the variable that unlocks the most schemes', () => {
    const traces: RulesResult['traces'] = {
      A: { missing: ['has_disability', 'is_carer'] },
      B: { missing: ['has_disability'] },
      C: { missing: ['has_disability'] },
    }
    const q = pickNextQuestion(
      ['has_disability', 'is_carer'],
      {
        is_australian_resident: true, age: 30, employment_status: 'full_time',
        state: 'NSW', tenure_type: 'renting',
      },
      [],
      traces,
      eligibilityNeeding('has_disability', 'is_carer'),
    )
    expect(q?.variable).toBe('has_disability')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility tier mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('toEligibilityResult', () => {
  it('partitions eligible / needs_info / ineligible correctly', () => {
    const rulesResult: RulesResult = {
      eligible: ['JOBSEEKER'],
      ineligible: ['AGE_PENSION'],
      missing_variables: ['number_of_children'],
      traces: {
        JOBSEEKER: { result: true },
        AGE_PENSION: { result: false },
        FTB_A: { missing: ['number_of_children'] },
      },
    }
    const r = toEligibilityResult(rulesResult)
    expect(r.eligible).toEqual(['JOBSEEKER'])
    expect(r.ineligible).toEqual(['AGE_PENSION'])
    expect(r.needs_info).toEqual([{ schemeId: 'FTB_A', missingVars: ['number_of_children'] }])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Results transformer — design contract: strong / likely / info, total, claimable
// ─────────────────────────────────────────────────────────────────────────────

describe('transformToResults', () => {
  const profile: ProfileVariables = {
    is_australian_resident: true,
    age: 35,
    employment_status: 'unemployed',
    state: 'NSW',
    annual_income: 12000,
  }

  it('maps eligible[] → strong + populates value from scheme map', () => {
    const r = transformToResults(
      { eligible: ['JOBSEEKER'], needs_info: [], ineligible: [] },
      SCHEMES,
      profile,
    )
    expect(r.programs).toHaveLength(1)
    expect(r.programs[0].conf).toBe('strong')
    expect(r.programs[0].name).toBe('JobSeeker Payment')
    expect(r.programs[0].value).toBeGreaterThan(0)
    expect(r.claimable).toBe(1)
    expect(r.total).toBe(r.programs[0].value)
  })

  it('maps needs_info[] → info with value 0', () => {
    const r = transformToResults(
      {
        eligible: [],
        needs_info: [{ schemeId: 'FTB_A', missingVars: ['number_of_children'] }],
        ineligible: [],
      },
      SCHEMES,
      profile,
    )
    expect(r.programs[0].conf).toBe('info')
    expect(r.programs[0].value).toBe(0)
    expect(r.claimable).toBe(0)
    expect(r.total).toBe(0)
  })

  it('excludes ineligible schemes entirely', () => {
    const r = transformToResults(
      { eligible: [], needs_info: [], ineligible: ['JOBSEEKER'] },
      SCHEMES,
      profile,
    )
    expect(r.programs).toHaveLength(0)
  })

  it('sorts strong before info', () => {
    const r = transformToResults(
      {
        eligible: ['JOBSEEKER'],
        needs_info: [{ schemeId: 'FTB_A', missingVars: ['number_of_children'] }],
        ineligible: [],
      },
      SCHEMES,
      profile,
    )
    expect(r.programs[0].conf).toBe('strong')
    expect(r.programs[1].conf).toBe('info')
  })

  it('builds matchedCriteria from the profile', () => {
    const r = transformToResults(
      { eligible: ['JOBSEEKER'], needs_info: [], ineligible: [] },
      SCHEMES,
      profile,
    )
    const criteria = r.programs[0].matchedCriteria ?? []
    expect(criteria).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Australian resident/),
        expect.stringMatching(/35 years old/),
        expect.stringMatching(/looking for work/),
      ]),
    )
  })

  it('threads claimUrl through from scheme metadata', () => {
    const r = transformToResults(
      { eligible: ['JOBSEEKER'], needs_info: [], ineligible: [] },
      SCHEMES,
      profile,
    )
    expect(r.programs[0].claimUrl).toBe('https://example/jobseeker')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Boundary cases — single fact changes eligibility tier
// ─────────────────────────────────────────────────────────────────────────────

describe('Boundary — JobSeeker eligible ↔ ineligible by employment_status', () => {
  it('strong when unemployed', () => {
    const r = transformToResults(
      { eligible: ['JOBSEEKER'], needs_info: [], ineligible: [] },
      SCHEMES,
      { is_australian_resident: true, age: 35, employment_status: 'unemployed', annual_income: 12000 },
    )
    expect(r.programs[0].conf).toBe('strong')
  })

  it('disappears when employed', () => {
    const r = transformToResults(
      { eligible: [], needs_info: [], ineligible: ['JOBSEEKER'] },
      SCHEMES,
      { is_australian_resident: true, age: 35, employment_status: 'full_time', annual_income: 60000 },
    )
    expect(r.programs).toHaveLength(0)
  })
})

describe('Boundary — Rent Assistance by tenure_type', () => {
  it('strong when renting', () => {
    const r = transformToResults(
      { eligible: ['RENT_ASSISTANCE'], needs_info: [], ineligible: [] },
      SCHEMES,
      { is_australian_resident: true, tenure_type: 'renting', rent_paid_fortnightly: 400 },
    )
    expect(r.programs[0].conf).toBe('strong')
  })

  it('ineligible when owner', () => {
    const r = transformToResults(
      { eligible: [], needs_info: [], ineligible: ['RENT_ASSISTANCE'] },
      SCHEMES,
      { is_australian_resident: true, tenure_type: 'owning' },
    )
    expect(r.programs).toHaveLength(0)
  })
})
