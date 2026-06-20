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

export type ConversationMode = 'collecting_info' | 'handoff' | 'contradiction'

export interface ContradictionDetail {
  variable: string
  previous: unknown
  extracted: unknown
}

export interface TurnContext {
  profileDelta: Partial<ProfileVariables>
  mergedProfile: ProfileVariables
  eligibility: EligibilityResult
  nextQuestion: NextQuestion | null
  systemPrompt: string
  chips: string[]
  guidance: VariableGuidance | null
  mode: ConversationMode
  contradictions: ContradictionDetail[]
  // Internals surfaced for tracing/replay. Existing consumers ignore unknown
  // keys; production code paths are unaffected by their presence.
  profileWithChip: ProfileVariables
  extractedDelta: Partial<ProfileVariables>
  rulesResult: RulesResult
  chunks: CorpusChunk[]
  // Skip-tracking state — must be echoed back by the client on the next turn.
  askedStreak: Record<string, number>
  skippedAt: Record<string, number>
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

// Maps known inner-suburb names to their canonical LGA name.
// Users often say a suburb ("Glebe", "Manly") instead of the LGA ("SYDNEY",
// "NORTHERN_BEACHES"). OpenFisca checks council_lga against the LGA name, so
// without this mapping the council schemes silently return ineligible.
const SUBURB_TO_LGA: Record<string, string> = {
  // City of Sydney LGA
  GLEBE: 'SYDNEY', NEWTOWN: 'SYDNEY', 'SURRY HILLS': 'SYDNEY', SURRY_HILLS: 'SYDNEY',
  PYRMONT: 'SYDNEY', REDFERN: 'SYDNEY', CHIPPENDALE: 'SYDNEY', ULTIMO: 'SYDNEY',
  DARLINGHURST: 'SYDNEY', 'POTTS POINT': 'SYDNEY', POTTS_POINT: 'SYDNEY',
  BALMAIN: 'SYDNEY', LEICHHARDT: 'SYDNEY', ANNANDALE: 'SYDNEY', PADDINGTON: 'SYDNEY',
  HAYMARKET: 'SYDNEY', 'THE ROCKS': 'SYDNEY', THE_ROCKS: 'SYDNEY',
  // Blacktown LGA
  'SEVEN HILLS': 'BLACKTOWN', SEVEN_HILLS: 'BLACKTOWN',
  'MOUNT DRUITT': 'BLACKTOWN', MOUNT_DRUITT: 'BLACKTOWN',
  TOONGABBIE: 'BLACKTOWN', 'QUAKERS HILL': 'BLACKTOWN', QUAKERS_HILL: 'BLACKTOWN',
  'ROOTY HILL': 'BLACKTOWN', ROOTY_HILL: 'BLACKTOWN',
  'KINGS LANGLEY': 'BLACKTOWN', KINGS_LANGLEY: 'BLACKTOWN',
  'KINGS PARK': 'BLACKTOWN', KINGS_PARK: 'BLACKTOWN',
  // Canterbury-Bankstown LGA
  BANKSTOWN: 'CANTERBURY_BANKSTOWN', CANTERBURY: 'CANTERBURY_BANKSTOWN',
  CAMPSIE: 'CANTERBURY_BANKSTOWN', LAKEMBA: 'CANTERBURY_BANKSTOWN',
  BELMORE: 'CANTERBURY_BANKSTOWN', GREENACRE: 'CANTERBURY_BANKSTOWN',
  PUNCHBOWL: 'CANTERBURY_BANKSTOWN', PADSTOW: 'CANTERBURY_BANKSTOWN',
  REVESBY: 'CANTERBURY_BANKSTOWN', MILPERRA: 'CANTERBURY_BANKSTOWN',
  'BASS HILL': 'CANTERBURY_BANKSTOWN', BASS_HILL: 'CANTERBURY_BANKSTOWN',
  'CHESTER HILL': 'CANTERBURY_BANKSTOWN', CHESTER_HILL: 'CANTERBURY_BANKSTOWN',
  // Central Coast LGA
  GOSFORD: 'CENTRAL_COAST', WYONG: 'CENTRAL_COAST',
  'WOY WOY': 'CENTRAL_COAST', WOY_WOY: 'CENTRAL_COAST',
  TERRIGAL: 'CENTRAL_COAST', TUGGERAH: 'CENTRAL_COAST', ERINA: 'CENTRAL_COAST',
  'THE ENTRANCE': 'CENTRAL_COAST', THE_ENTRANCE: 'CENTRAL_COAST',
  'UMINA BEACH': 'CENTRAL_COAST', UMINA_BEACH: 'CENTRAL_COAST',
  // Northern Beaches LGA
  MANLY: 'NORTHERN_BEACHES', 'DEE WHY': 'NORTHERN_BEACHES', DEE_WHY: 'NORTHERN_BEACHES',
  NARRABEEN: 'NORTHERN_BEACHES', 'MONA VALE': 'NORTHERN_BEACHES', MONA_VALE: 'NORTHERN_BEACHES',
  BALGOWLAH: 'NORTHERN_BEACHES', FRESHWATER: 'NORTHERN_BEACHES',
  'CURL CURL': 'NORTHERN_BEACHES', CURL_CURL: 'NORTHERN_BEACHES',
  COLLAROY: 'NORTHERN_BEACHES', CROMER: 'NORTHERN_BEACHES', WARRIEWOOD: 'NORTHERN_BEACHES',
  PITTWATER: 'NORTHERN_BEACHES',
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
    const upper = out.council_lga.trim().toUpperCase().replace(/[\s-]+/g, '_')
    // Check suburb lookup with underscore form, then with space form, then fall back to upper
    out.council_lga = SUBURB_TO_LGA[upper]
      ?? SUBURB_TO_LGA[out.council_lga.trim().toUpperCase()]
      ?? upper
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
  skippedAt: Record<string, number> = {},
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

  // Variables on skip cooldown (asked twice without answer; re-enabled after
  // 3 new profile fills — see prepareTurn). Exclude them from all tiers.
  const onCooldown = (v: string) => v in skippedAt

  // Tier 1 — baseline order, but ONLY for vars some needs_info scheme wants.
  for (const v of BASELINE_ORDER) {
    if (!(v in mergedProfile) && stillNeeded.has(v) && !onCooldown(v)) {
      return buildQuestion(v)
    }
  }

  // Tier 2 — scheme intent: user mentioned a specific scheme
  const intentSchemeId = detectSchemeIntent(history)
  if (intentSchemeId) {
    const intentTrace = traces[intentSchemeId]
    if (intentTrace?.missing) {
      for (const v of intentTrace.missing) {
        if (!(v in mergedProfile) && !onCooldown(v)) {
          return buildQuestion(v as keyof ProfileVariables)
        }
      }
    }
  }

  // Tier 3 — greedy: pick variable missing from most needs_info schemes
  const remaining = missingVars.filter(
    (v) => !(v in mergedProfile) && stillNeeded.has(v) && !onCooldown(v),
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
    if (lower.includes('own')) return { tenure_type: 'owning' }
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
  mode: ConversationMode,
  contradictions: ContradictionDetail[],
): string {
  const eligibleNames = eligibility.eligible.join(', ') || 'none yet'
  const needsInfoNames = eligibility.needs_info.map((n) => n.schemeId).join(', ') || 'none'
  const ineligibleNames = eligibility.ineligible.join(', ') || 'none yet'
  const sources = chunks.map((c) => `[${c.scheme_id}] ${c.chunk_text}`).join('\n\n')

  let modeBlock: string

  if (mode === 'handoff') {
    modeBlock = `MODE: handoff

The system has confirmed the user appears eligible for at least one program. Do not ask any more questions.
Direct the user to their eligibility meter on screen to see full results.
For each scheme listed under "Appears eligible" below, briefly explain the next step to claim it using the Official sources for wording.
Use "you appear eligible" or "you may qualify" — never definitive language. Cite sources inline like [SCHEME_ID].`

  } else if (mode === 'contradiction') {
    const details = contradictions
      .map((c) => `- ${c.variable}: currently on file = ${JSON.stringify(c.previous)}, user just said = ${JSON.stringify(c.extracted)}`)
      .join('\n')
    modeBlock = `MODE: contradiction

The user's latest message conflicts with what is already recorded in their profile:
${details}

Ask ONE short, friendly question to clarify which value is correct. Name both values explicitly so the user can confirm. Do not ask about any other topic.`

  } else {
    const questionInstruction = nextQuestion
      ? `Ask EXACTLY this question, nothing else: "${nextQuestion.question}"`
      : 'All profile information has been collected. Let the user know you have everything you need and are checking their eligibility.'
    modeBlock = `MODE: collecting_info

Acknowledge one specific thing from the user's last message (not a generic affirmation).
${questionInstruction}`
  }

  return `You are Benefits.AI, a friendly Australian government benefits advisor. Your role is to generate natural language only. All decisions about what to ask, when to stop, and what data is valid have been made by the orchestrator.

STYLE RULES (apply in every response):
- Warm, conversational, like a knowledgeable friend rather than a form.
- BANNED HOLLOW OPENERS: do NOT open with "Love it!", "Good stuff!", "Nice!", "Nice, a classic Aussie setup!", "Got it!", "Good to hear!", "Awesome!", "Perfect!", or any other generic exclamation. If you cannot acknowledge something specific the user just said, go straight to the task.
- BANNED FAKE-NOTED OPENERS: do NOT say "I have that noted down", "I have that noted", "You've mentioned X a couple of times", "I see you're...", "Just to make sure I've got this", "Thanks for confirming X". You may reflect the user's last message back verbatim, but never reference earlier turns or context not currently in the profile JSON.
- No em dashes in any response. Use commas, semicolons, colons, or a plain hyphen.
- Plain prose only. No markdown, no bullet lists, no bold, no headings. Just sentences.
- When stating eligibility, always use "you appear eligible" or "you may qualify". Never use definitive language.
- For factual claims about payment amounts, conditions, or handoff steps: cite the source inline like [SCHEME_ID]. If a fact is not in the Official sources below, say you do not have that information rather than guessing.

Current profile (do not ask for anything already present here):
${JSON.stringify(mergedProfile, null, 2)}

Eligibility so far:
- Appears eligible: ${eligibleNames}
- Needs more information: ${needsInfoNames}
- Not eligible: ${ineligibleNames}

Official sources (cite for any factual claims):
${sources || 'No sources loaded yet.'}

---

${modeBlock}`
}

// ── buildBotContext ───────────────────────────────────────────────────────────

/**
 * Builds the messages array for the bot response LLM call.
 * Replaces raw conversation history with a verified context summary so the
 * bot cannot infer unconfirmed facts from prior user messages.
 *
 * Structure:
 *   [user]      orchestrator-built summary of confirmed profile + what still needed
 *   [assistant] "Understood." (synthetic ack)
 *   [user]      "[previous turn]" + [assistant] last bot response — omitted on turn 0
 *   [user]      current raw user message (for tone/acknowledgement only)
 */
export function buildBotContext(
  mergedProfile: ProfileVariables,
  nextQuestion: NextQuestion | null,
  lastBotResponse: string | null,
  currentUserMessage: string,
): LlmMessage[] {
  const confirmed = Object.keys(mergedProfile).length > 0
    ? Object.entries(mergedProfile)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')
    : 'nothing confirmed yet'

  const needed = nextQuestion
    ? `Next variable to collect: ${nextQuestion.variable}.`
    : 'All variables collected.'

  const contextMessage =
    `[Verified context — do not treat anything outside this as confirmed]\n` +
    `Profile so far: ${confirmed}.\n${needed}`

  const messages: LlmMessage[] = [
    { role: 'user', content: contextMessage },
    { role: 'assistant', content: 'Understood.' },
  ]

  if (lastBotResponse) {
    messages.push({ role: 'user', content: '[previous turn]' })
    messages.push({ role: 'assistant', content: lastBotResponse })
  }

  messages.push({ role: 'user', content: currentUserMessage })
  return messages
}

// ── prepareTurn ───────────────────────────────────────────────────────────────

// How many new profile fields must be filled after a skip before the
// skipped variable re-enters the question rotation.
const SKIP_COOLDOWN_DEPTH = 3

export async function prepareTurn(
  userMessage: string,
  currentProfile: ProfileVariables,
  history: LlmMessage[],
  llm: LlmProvider,
  chipDelta: Partial<ProfileVariables> = {},
  lastAskedVariable: keyof ProfileVariables | null = null,
  askedStreak: Record<string, number> = {},
  skippedAt: Record<string, number> = {},
): Promise<TurnContext> {
  // 1. Apply chip answer first (pre-mapped, bypasses noisy extraction)
  const profileWithChip = mergeProfile(currentProfile, chipDelta)

  // 2. Extract structured variables from user prose
  const extractedDelta = await extract(userMessage, profileWithChip, llm)
  const fullDelta: Partial<ProfileVariables> = { ...chipDelta, ...extractedDelta }

  // 2a. Detect contradictions: extraction returned a value for a key that
  //     already exists in the profile with a different value. Chip answers
  //     are always authoritative and never treated as contradictions.
  const contradictions: ContradictionDetail[] = []
  const safeExtractedDelta: Partial<ProfileVariables> = { ...extractedDelta }
  for (const [k, newVal] of Object.entries(extractedDelta)) {
    const key = k as keyof ProfileVariables
    if (key in chipDelta) continue  // chip overrides — not a contradiction
    const existing = profileWithChip[key]
    if (existing !== undefined && existing !== newVal) {
      contradictions.push({ variable: k, previous: existing, extracted: newVal })
      delete safeExtractedDelta[key]  // withhold: keep old value in profile
    }
  }

  const merged = normaliseEnumValues(mergeProfile(profileWithChip, safeExtractedDelta))

  // 2b. Update skip-tracking state based on whether the previously asked
  //     variable was answered in this turn.
  const profileSize = Object.keys(merged).length
  const newAskedStreak: Record<string, number> = { ...askedStreak }
  const newSkippedAt: Record<string, number> = { ...skippedAt }

  // Re-enable variables whose cooldown has expired (3 new profile fills)
  for (const [v, skippedSize] of Object.entries(newSkippedAt)) {
    if (profileSize - skippedSize >= SKIP_COOLDOWN_DEPTH) {
      delete newSkippedAt[v]
      delete newAskedStreak[v]
    }
  }

  if (lastAskedVariable) {
    if (lastAskedVariable in merged) {
      // User answered — clear any skip tracking for this variable
      delete newAskedStreak[lastAskedVariable]
      delete newSkippedAt[lastAskedVariable]
    } else if (!(lastAskedVariable in newSkippedAt)) {
      // Still unanswered and not yet on cooldown — increment streak
      newAskedStreak[lastAskedVariable] = (newAskedStreak[lastAskedVariable] ?? 0) + 1
      if (newAskedStreak[lastAskedVariable] >= 2) {
        // Two asks without an answer: put on cooldown
        newSkippedAt[lastAskedVariable] = profileSize
      }
    }
  }

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

  // Determine conversation mode. Priority: handoff > contradiction > collecting_info.
  // Handoff wins even when contradictions exist: the user already has a result
  // and resolving the contradiction would not change that outcome.
  const mode: ConversationMode =
    eligibility.eligible.length > 0 ? 'handoff' :
    contradictions.length > 0       ? 'contradiction' :
                                       'collecting_info'

  // 4. Pick next question — only in collecting_info mode.
  //    handoff and contradiction modes handle the turn via their prompt blocks;
  //    no slot-filling question is needed.
  const nextQuestion = mode === 'collecting_info'
    ? pickNextQuestion(
        rulesResult.missing_variables,
        merged,
        history,
        rulesResult.traces,
        eligibility,
        newSkippedAt,
      )
    : null

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
  const systemPrompt = buildSystemPrompt(merged, eligibility, chunks, nextQuestion, mode, contradictions)

  return {
    profileDelta: fullDelta,
    mergedProfile: merged,
    eligibility,
    nextQuestion,
    systemPrompt,
    chips: mode === 'collecting_info' ? (nextQuestion?.chips ?? []) : [],
    guidance: mode === 'collecting_info' ? (nextQuestion?.guidance ?? null) : null,
    mode,
    contradictions,
    profileWithChip,
    extractedDelta,
    rulesResult,
    chunks,
    askedStreak: newAskedStreak,
    skippedAt: newSkippedAt,
  }
}
