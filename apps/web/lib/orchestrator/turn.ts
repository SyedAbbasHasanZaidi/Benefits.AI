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
  // Internals surfaced for tracing/replay. Existing consumers ignore unknown
  // keys; production code paths are unaffected by their presence.
  profileWithChip: ProfileVariables
  extractedDelta: Partial<ProfileVariables>
  rulesResult: RulesResult
  chunks: CorpusChunk[]
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

// Bracket chips for numeric variables — gives users one-tap answers
// instead of forcing them to type a number. The LLM extracts a sensible
// midpoint when the user picks a bracket.
const BRACKET_CHIPS: Partial<Record<keyof ProfileVariables, string[]>> = {
  age:                   ['Under 18', '18–22', '23–34', '35–49', '50–66', '67+'],
  annual_income:         ['Under $25k', '$25–45k', '$45–80k', '$80–120k', '$120k+'],
  rent_paid_fortnightly: ['Under $300', '$300–500', '$500–800', '$800+'],
  number_of_children:    ['0', '1', '2', '3', '4+'],
  youngest_child_age:    ['Under 5', '5–12', '13–17', '18–21'],
  hours_worked_per_week: ['Not working', 'Under 15', '15–30', '30–38', '38+'],
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
  } else if (BRACKET_CHIPS[variable]) {
    chips = [...(BRACKET_CHIPS[variable] as string[])]
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

// Normalise enum-shaped fields so values match the OpenFisca rules engine's
// expected casing. Sonnet extraction returns natural-language values
// ("Blacktown", "nsw"); the rules engine matches enums case-sensitively
// ("BLACKTOWN", "NSW"). Without this, council/state schemes silently miss
// despite the user clearly stating the location.
function normaliseEnumValues(p: ProfileVariables): ProfileVariables {
  const out: ProfileVariables = { ...p }
  if (typeof out.state === 'string') {
    out.state = out.state.toUpperCase()
  }
  if (typeof out.council_lga === 'string') {
    // 'Canterbury-Bankstown' / 'Canterbury Bankstown' → 'CANTERBURY_BANKSTOWN'
    out.council_lga = out.council_lga
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
  }
  if (typeof out.tenure_type === 'string') {
    out.tenure_type = out.tenure_type.toLowerCase() as ProfileVariables['tenure_type']
  }
  if (typeof out.employment_status === 'string') {
    out.employment_status = out.employment_status.toLowerCase() as ProfileVariables['employment_status']
  }
  return out
}

// ── Public exports ────────────────────────────────────────────────────────────

export function pickNextQuestion(
  missingVars: string[],
  mergedProfile: ProfileVariables,
  history: LlmMessage[],
  traces: RulesResult['traces'],
  eligibility: EligibilityResult,
): NextQuestion | null {
  // Scheme-aware gating: only ask for variables that would unlock at least
  // one scheme still in needs_info. If there's nothing left to unlock,
  // intake is complete — the bot should deliver handoff for any eligible
  // schemes and await the user's next message, not invent more questions.
  const stillNeeded = new Set<string>()
  for (const ni of eligibility.needs_info) {
    for (const v of ni.missingVars) stillNeeded.add(v)
  }
  if (stillNeeded.size === 0) return null

  // Tier 1 — baseline order, but ONLY for vars some needs_info scheme wants.
  for (const v of BASELINE_ORDER) {
    if (!(v in mergedProfile) && stillNeeded.has(v)) {
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

  // Tier 3 — greedy: pick variable missing from most needs_info schemes
  const remaining = missingVars.filter(
    (v) => !(v in mergedProfile) && stillNeeded.has(v),
  )
  if (remaining.length === 0) return null

  const counts = countSchemesByVariable(traces)
  remaining.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  return buildQuestion(remaining[0] as keyof ProfileVariables)
}

/**
 * Parses a bracket chip text ("Under 18", "23–34", "67+", "$25–45k", "0",
 * "Not working") into a single representative number. Returns null when the
 * text doesn't look like a numeric bracket — caller falls back to text extraction.
 */
function parseBracketChip(text: string): number | null {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  // Symbolic zero-work answers — must check before normalisation, otherwise
  // `replace(/k/gi, '000')` would munge "working" into "wor000ing".
  if (lower === 'not working' || lower === 'none') return 0

  // "$25–45k" implies BOTH numbers are in thousands. Detect once, then apply
  // uniformly. \b prevents matching 'k' inside English words.
  const hasKSuffix = /\d+k\b/i.test(trimmed)
  const mult = hasKSuffix ? 1000 : 1

  const cleaned = trimmed
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/(\d+)k\b/gi, '$1')   // strip 'k' only when it's a number suffix
    .toLowerCase()
    .trim()

  if (cleaned === '0') return 0

  if (cleaned.startsWith('under ')) {
    const n = parseInt(cleaned.slice(6), 10)
    if (!Number.isNaN(n)) return Math.max(0, n * mult - 1)
  }

  if (cleaned.endsWith('+')) {
    const n = parseInt(cleaned.slice(0, -1), 10)
    if (!Number.isNaN(n)) return n * mult
  }

  const range = cleaned.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (range) {
    const lo = parseInt(range[1], 10)
    const hi = parseInt(range[2], 10)
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
      // Multiply BEFORE averaging so "$45–80k" gives 62500 not 63000
      return Math.round(((lo + hi) / 2) * mult)
    }
  }

  const single = parseInt(cleaned, 10)
  if (!Number.isNaN(single)) return single * mult

  return null
}

const NUMERIC_BRACKET_VARS = new Set<keyof ProfileVariables>([
  'age',
  'annual_income',
  'rent_paid_fortnightly',
  'number_of_children',
  'youngest_child_age',
  'hours_worked_per_week',
])

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

  // Numeric brackets — deterministic mapping so we never rely on the LLM
  // extracting a number from a chip text it produced itself.
  if (NUMERIC_BRACKET_VARS.has(variable)) {
    const n = parseBracketChip(chipValue)
    if (n !== null) return { [variable]: n }
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
    ? `\nNext question to ask the user (ask EXACTLY this question — do not substitute a different topic; phrasing may be lightly softened but the subject must match): "${nextQuestion.question}"`
    : '\nAll questions have been answered. Summarise the results clearly.'

  return `You are a friendly Australian government benefits advisor called Benefits.AI. Help users discover entitlements they qualify for.

Rules:
- The Current user profile JSON below is AUTHORITATIVE. If a field is present in that JSON, treat it as confirmed — do NOT re-ask the user for it, even if their literal message looks vague or ambiguous (e.g. "18-22" means a chip mapping was applied and the value is already in your profile JSON; trust that and move on). Only ask about fields that are absent from the profile JSON.
- Tone: warm, conversational, human — like a knowledgeable friend, not a form. Briefly acknowledge what the user JUST said by reflecting a SPECIFIC piece of what they said back (e.g. "A teacher in Sydney — got that" / "Two kids under 5, that's a handful"). Do NOT use generic positive interjections.
- BANNED HOLLOW OPENERS — these are templated affirmations that add no information and feel performative. Do NOT open with: "Love it!", "Good stuff!", "Nice!", "Nice, a classic Aussie setup!", "Got it!", "Good to hear!", "Ha, the [empty nest / single life / etc.]!", "Awesome!", "Perfect!", or any other generic exclamation. If you can't acknowledge something specific the user just said, just ask the next question directly with no opener at all.
- BANNED FAKE-NOTED OPENERS (these are hallucinations unless the named fact is in the profile JSON): "I have that noted down", "I have that noted", "You've mentioned X a couple of times", "I see you're...", "Just to make sure I've got this", "Thanks for confirming X". You may reflect back what the user wrote in their LAST message verbatim, but you may never reference earlier turns or hypothetical context that isn't currently in the profile JSON.
- Ask AT MOST ONE question per response — the specified next question below, when one is given. Do NOT swap it for a different topic. If no next question is given, do not invent one.
- Stop the question loop the moment a scheme is eligible. When the Eligibility results below show any scheme in "Appears eligible", direct the user to that scheme on the eligibility meter and explain the next step to claim it (the handoff). Use the Official sources below for handoff wording. Then await their next message rather than asking another slot-filling question.
- Treat OpenFisca as the source of truth. Never decide eligibility yourself; only repeat what the Eligibility results below say. Use phrases like "you appear eligible" or "you may qualify" — never definitive.
- Every factual claim about payment amounts, eligibility conditions, or handoff steps must come from the Official sources below. Cite the scheme tag inline like [SCHEME_ID]. If a fact isn't in the sources, refuse rather than guess — say you don't have that information yet.
- If the user's reply is random or contradicts something in the profile JSON, gently flag it and ask one precise clarifying question. Offer a couple of safe example answers when that would help.
- Plain prose only. NO markdown formatting — no **bold**, *italic*, bullet lists, or headings. Just sentences.

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
  const merged = normaliseEnumValues(mergeProfile(profileWithChip, extractedDelta))

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
    eligibility,
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
    profileWithChip,
    extractedDelta,
    rulesResult,
    chunks,
  }
}
