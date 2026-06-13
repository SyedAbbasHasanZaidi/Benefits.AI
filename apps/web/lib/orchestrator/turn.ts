import type { LlmMessage } from '@/lib/llm/LlmProvider'
import { VARIABLE_GUIDANCE, type VariableGuidance } from './guidance'
import type { ProfileVariables } from './profile'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NextQuestion {
  question: string
  variable: keyof ProfileVariables
  chips?: string[]
  guidance?: VariableGuidance
}

export interface RulesResult {
  eligible: string[]
  ineligible: string[]
  missing_variables: string[]
  traces: Record<string, { missing?: string[]; result?: boolean; error?: string }>
}

export interface EligibilityResult {
  eligible: string[]
  needs_info: Array<{ schemeId: string; missingVars: string[] }>
  ineligible: string[]
}

export interface TurnContext {
  profileDelta: Partial<ProfileVariables>
  mergedProfile: ProfileVariables
  eligibility: EligibilityResult
  nextQuestion: NextQuestion | null
  systemPrompt: string
  chips: string[]
  guidance: VariableGuidance | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BASELINE_ORDER: (keyof ProfileVariables)[] = [
  'is_australian_resident',
  'age',
  'employment_status',
  'state',
  'tenure_type',
]

const BINARY_CHIP_VARS = new Set<keyof ProfileVariables>([
  'is_australian_resident',
  'has_disability',
  'is_carer',
  'has_partner',
  'has_financial_hardship',
  'uses_life_support_equipment',
])

const ENUM_CHIPS: Partial<Record<keyof ProfileVariables, string[]>> = {
  tenure_type: ['Renting', 'Own my home', 'Boarding'],
  employment_status: ['Employed', 'Retired', 'Unemployed', 'Student'],
  state: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
}

const QUESTION_TEXT: Record<keyof ProfileVariables, string> = {
  is_australian_resident: 'Are you an Australian resident or citizen?',
  age: 'How old are you?',
  annual_income: 'What is your approximate annual income before tax (in AUD)?',
  state: 'Which Australian state or territory do you live in?',
  council_lga: 'Which local council area do you live in?',
  tenure_type: 'Do you rent, own your home, or board with someone?',
  rent_paid_fortnightly: 'How much rent do you pay per fortnight (every two weeks, in AUD)?',
  number_of_children: 'How many dependent children do you have?',
  youngest_child_age: 'How old is your youngest child?',
  has_partner: 'Do you have a partner or spouse?',
  employment_status: 'What is your current employment situation?',
  hours_worked_per_week: 'How many hours per week do you work on average?',
  has_disability: 'Do you have a disability or chronic health condition?',
  is_carer: 'Are you a carer for someone with a disability, serious illness, or frailty?',
  has_financial_hardship: 'Are you currently experiencing financial hardship?',
  uses_life_support_equipment:
    'Does anyone in your household use life support equipment (e.g. oxygen concentrator, dialysis machine)?',
}

const SCHEME_KEYWORDS: Record<string, string[]> = {
  AGE_PENSION: ['age pension', 'aged pension', 'old age pension'],
  CARER_ALLOWANCE: ['carer allowance'],
  CARER_PAYMENT: ['carer payment'],
  DSP: ['disability support pension', 'dsp', 'disability pension'],
  FTB_A: ['family tax benefit a', 'ftb a', 'family tax benefit part a'],
  FTB_B: ['family tax benefit b', 'ftb b', 'family tax benefit part b'],
  JOBSEEKER: ['jobseeker', 'job seeker', 'newstart'],
  LIHCC: ['low income health care card', 'lihcc', 'health care card'],
  NSW_EAPA: ['energy accounts payment assistance', 'eapa'],
  NSW_GAS_REBATE: ['gas rebate', 'natural gas rebate'],
  NSW_LIFE_SUPPORT_REBATE: ['life support rebate'],
  NSW_LOW_INCOME_HOUSEHOLD_REBATE: ['low income household rebate', 'electricity rebate'],
  NSW_SENIORS_CARD: ['seniors card', 'senior card'],
  PARENTING_PAYMENT: ['parenting payment'],
  RENT_ASSISTANCE: ['rent assistance', 'rental assistance'],
  YOUTH_ALLOWANCE: ['youth allowance'],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildQuestion(variable: keyof ProfileVariables): NextQuestion {
  let chips: string[] | undefined

  if (BINARY_CHIP_VARS.has(variable)) {
    chips = ['Yes', 'No']
  } else if (ENUM_CHIPS[variable]) {
    chips = [...(ENUM_CHIPS[variable] as string[])]
  }

  const guidance = VARIABLE_GUIDANCE[variable]
  if (guidance) {
    chips = chips ? [...chips, 'Not sure? →'] : ['Not sure? →']
  }

  return { question: QUESTION_TEXT[variable], variable, chips, guidance }
}

function detectSchemeIntent(history: LlmMessage[]): string | null {
  const text = history
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()
  for (const [schemeId, keywords] of Object.entries(SCHEME_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return schemeId
  }
  return null
}

function countSchemesByVariable(
  traces: RulesResult['traces'],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const trace of Object.values(traces)) {
    for (const v of trace.missing ?? []) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  return counts
}

// ── Public exports ────────────────────────────────────────────────────────────

export function pickNextQuestion(
  missingVars: string[],
  mergedProfile: ProfileVariables,
  history: LlmMessage[],
  traces: RulesResult['traces'],
): NextQuestion | null {
  // Tier 1 — baseline: ask these first in fixed order
  for (const v of BASELINE_ORDER) {
    if (!(v in mergedProfile) && missingVars.includes(v)) {
      return buildQuestion(v)
    }
  }

  // Tier 2 — scheme intent: user mentioned a specific scheme
  const intentSchemeId = detectSchemeIntent(history)
  if (intentSchemeId) {
    const intentTrace = traces[intentSchemeId]
    if (intentTrace?.missing) {
      for (const v of intentTrace.missing) {
        if (!(v in mergedProfile)) {
          return buildQuestion(v as keyof ProfileVariables)
        }
      }
    }
  }

  // Tier 3 — greedy: pick variable missing from most schemes
  const remaining = missingVars.filter((v) => !(v in mergedProfile))
  if (remaining.length === 0) return null

  const counts = countSchemesByVariable(traces)
  remaining.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  return buildQuestion(remaining[0] as keyof ProfileVariables)
}

export function mapChipToVariable(
  variable: keyof ProfileVariables,
  chipValue: string,
): Partial<ProfileVariables> {
  if (chipValue === 'Not sure? →') return {}

  const lower = chipValue.toLowerCase()

  if (BINARY_CHIP_VARS.has(variable)) {
    if (lower === 'yes') return { [variable]: true }
    if (lower === 'no') return { [variable]: false }
  }

  if (variable === 'tenure_type') {
    if (lower.includes('rent')) return { tenure_type: 'renting' }
    if (lower.includes('own')) return { tenure_type: 'owner' }
    if (lower.includes('board')) return { tenure_type: 'boarding' }
  }

  if (variable === 'employment_status') {
    const map: Record<string, 'employed' | 'retired' | 'unemployed' | 'student'> = {
      employed: 'employed',
      retired: 'retired',
      unemployed: 'unemployed',
      student: 'student',
    }
    if (map[lower]) return { employment_status: map[lower] }
  }

  if (variable === 'state') {
    return { state: chipValue.toUpperCase() }
  }

  return {}
}
