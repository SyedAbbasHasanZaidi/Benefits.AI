import type { LlmMessage, LlmProvider } from '@/lib/llm/LlmProvider'
import { VARIABLE_GUIDANCE, type VariableGuidance } from './guidance'
import type { ProfileVariables } from './profile'
import { extract } from './extract'
import { mergeProfile } from './profile'
import { queryCorpus, type CorpusChunk } from '@/lib/retriever/query'

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

// ── Eligibility result transformer ────────────────────────────────────────────

export function toEligibilityResult(rulesResult: RulesResult): EligibilityResult {
  const needs_info = Object.entries(rulesResult.traces)
    .filter(([, trace]) => Array.isArray(trace.missing) && trace.missing.length > 0)
    .map(([schemeId, trace]) => ({ schemeId, missingVars: trace.missing! }))

  return {
    eligible: rulesResult.eligible,
    needs_info,
    ineligible: rulesResult.ineligible,
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(
  mergedProfile: ProfileVariables,
  eligibility: EligibilityResult,
  chunks: CorpusChunk[],
  nextQuestion: NextQuestion | null,
): string {
  const eligibleNames = eligibility.eligible.join(', ') || 'none yet'
  const needsInfoNames = eligibility.needs_info.map((n) => n.schemeId).join(', ') || 'none'
  const ineligibleNames = eligibility.ineligible.join(', ') || 'none yet'

  const sources = chunks.map((c) => `[${c.scheme_id}] ${c.chunk_text}`).join('\n\n')

  const nextQ = nextQuestion
    ? `\nNext question to ask the user (ask this naturally, exactly once): ${nextQuestion.question}`
    : '\nAll questions have been answered. Summarise the results clearly.'

  return `You are a friendly Australian government benefits advisor called Benefits.AI. Help users discover entitlements they qualify for.

Rules:
- Ask EXACTLY ONE question per response — the specified next question below
- If eligible schemes exist, briefly acknowledge them before asking
- Every factual claim about payment amounts or eligibility conditions must come from the Official sources below
- Use plain, warm language — no jargon
- Never make definitive eligibility determinations — say "you may qualify" or "you appear eligible"
- Do NOT invent rules, amounts, or conditions not present in the Official sources

Current user profile:
${JSON.stringify(mergedProfile, null, 2)}

Eligibility results so far:
- Appears eligible: ${eligibleNames}
- Needs more information: ${needsInfoNames}
- Not eligible: ${ineligibleNames}

Official sources (cite these for any factual claims):
${sources || 'No sources loaded yet — ask the next question to gather more profile information.'}
${nextQ}`
}

// ── prepareTurn ───────────────────────────────────────────────────────────────

export async function prepareTurn(
  userMessage: string,
  currentProfile: ProfileVariables,
  history: LlmMessage[],
  llm: LlmProvider,
  chipDelta: Partial<ProfileVariables> = {},
): Promise<TurnContext> {
  // 1. Apply chip answer first (pre-mapped, bypasses noisy extraction)
  const profileWithChip = mergeProfile(currentProfile, chipDelta)

  // 2. Extract structured variables from user prose
  const extractedDelta = await extract(userMessage, profileWithChip, llm)
  const fullDelta: Partial<ProfileVariables> = { ...chipDelta, ...extractedDelta }
  const merged = mergeProfile(profileWithChip, extractedDelta)

  // 3. Call rules engine
  const rulesUrl = process.env.RULES_SERVICE_URL ?? 'http://localhost:8001'
  let rulesResult: RulesResult
  try {
    const res = await fetch(`${rulesUrl}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables: merged }),
    })
    if (!res.ok) throw new Error(`Rules service ${res.status}`)
    rulesResult = (await res.json()) as RulesResult
  } catch (err) {
    console.error('prepareTurn: rules service error', err)
    rulesResult = { eligible: [], ineligible: [], missing_variables: [], traces: {} }
  }

  const eligibility = toEligibilityResult(rulesResult)

  // 4. Pick next question
  const nextQuestion = pickNextQuestion(
    rulesResult.missing_variables,
    merged,
    history,
    rulesResult.traces,
  )

  // 5. Fetch corpus chunks scoped to eligible + needs-info schemes
  const relevantSchemeIds = [
    ...eligibility.eligible,
    ...eligibility.needs_info.map((n) => n.schemeId),
  ]
  let chunks: CorpusChunk[] = []
  try {
    chunks = await queryCorpus(merged, relevantSchemeIds, 4)
  } catch (err) {
    console.error('prepareTurn: retriever error', err)
  }

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(merged, eligibility, chunks, nextQuestion)

  return {
    profileDelta: fullDelta,
    mergedProfile: merged,
    eligibility,
    nextQuestion,
    systemPrompt,
    chips: nextQuestion?.chips ?? [],
    guidance: nextQuestion?.guidance ?? null,
  }
}
