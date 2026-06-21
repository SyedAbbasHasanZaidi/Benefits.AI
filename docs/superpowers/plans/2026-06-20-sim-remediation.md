# Simulator Findings Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 root causes found by the 2026-06-20 simulator run that produced 7 critical + 22 high findings across 60 conversations.

**Architecture:** All fixes are in the TypeScript orchestrator layer (`turn.ts`, `extract.ts`, `profile.ts`). No OpenFisca changes needed. Each task is independently testable.

**Tech Stack:** TypeScript, Vitest, Next.js 15, pnpm

**Reference spec:** `docs/superpowers/specs/2026-06-20-sim-remediation-design.md`

---

## Task 1: Fix `tenure_type` enum (`'owner'` → `'owning'`)

**Files:**
- Modify: `apps/web/lib/orchestrator/profile.ts:1`
- Modify: `apps/web/lib/orchestrator/extract.ts:35`
- Modify: `apps/web/lib/orchestrator/turn.ts:337` (chip mapper)
- Modify: `apps/web/scripts/simulator/personas.ts` (8 profiles)
- Test: `apps/web/__tests__/tenure-type.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/tenure-type.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to confirm it fails**

```
pnpm --filter web test --reporter=verbose __tests__/tenure-type
```
Expected: FAIL — `{ tenure_type: 'owner' }` ≠ `{ tenure_type: 'owning' }`

- [ ] **Step 3: Update `profile.ts` — change the type**

```ts
// apps/web/lib/orchestrator/profile.ts line 1
export type TenureType = 'renting' | 'owning' | 'boarding'
```

- [ ] **Step 4: Update `extract.ts` — fix schema string**

Find the schema line in `EXTRACTION_SYSTEM` (around line 35):
```
  tenure_type             "renting" | "owner" | "boarding"
```
Change to:
```
  tenure_type             "renting" | "owning" | "boarding"
```

- [ ] **Step 5: Update `turn.ts` chip mapper (line 337)**

```ts
if (lower.includes('own')) return { tenure_type: 'owning' }
```

- [ ] **Step 6: Update `personas.ts` — 8 profiles**

Find all `tenure_type: 'owner'` occurrences in `apps/web/scripts/simulator/personas.ts` and replace with `tenure_type: 'owning'`. There are 8: COUNCIL_SYDNEY, COUNCIL_BLACKTOWN, COUNCIL_CANTERBURY_BANKSTOWN, COUNCIL_CENTRAL_COAST, COUNCIL_NORTHERN_BEACHES, COUNCIL_SYDNEY_HARDSHIP, and the two renter negative cases (these stay as `'renting'`).

Run in editor: replace all `tenure_type: 'owner'` with `tenure_type: 'owning'`.

- [ ] **Step 7: Run full test suite**

```
pnpm --filter web test
```
Expected: all tests pass including the 3 new tenure-type tests.

- [ ] **Step 8: Typecheck**

```
pnpm --filter web typecheck
```
Expected: clean.

- [ ] **Step 9: Commit**

```
git add apps/web/lib/orchestrator/profile.ts apps/web/lib/orchestrator/extract.ts apps/web/lib/orchestrator/turn.ts apps/web/scripts/simulator/personas.ts apps/web/__tests__/tenure-type.test.ts
git commit -m "fix: tenure_type enum 'owner' → 'owning' — aligns TS layer with OpenFisca expectation"
```

---

## Task 2: Suburb-to-LGA resolution in `normaliseEnumValues`

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — `normaliseEnumValues` function (~line 184)
- Test: `apps/web/__tests__/council-lga-normalise.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/council-lga-normalise.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmProvider } from '@/lib/llm/LlmProvider'

function mockLlm(extraction: Record<string, unknown> = {}): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: JSON.stringify(extraction) }),
    streamText: vi.fn().mockReturnValue(new ReadableStream()),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ eligible: [], ineligible: [], missing_variables: [], traces: {} }),
  }))
})

describe('council_lga suburb normalisation', () => {
  test('Glebe maps to SYDNEY', async () => {
    const ctx = await prepareTurn('I live in Glebe', {}, [], mockLlm({ council_lga: 'Glebe' }))
    expect(ctx.mergedProfile.council_lga).toBe('SYDNEY')
  })

  test('Manly maps to NORTHERN_BEACHES', async () => {
    const ctx = await prepareTurn('I live in Manly', {}, [], mockLlm({ council_lga: 'Manly' }))
    expect(ctx.mergedProfile.council_lga).toBe('NORTHERN_BEACHES')
  })

  test('Bankstown maps to CANTERBURY_BANKSTOWN', async () => {
    const ctx = await prepareTurn('I live in Bankstown', {}, [], mockLlm({ council_lga: 'Bankstown' }))
    expect(ctx.mergedProfile.council_lga).toBe('CANTERBURY_BANKSTOWN')
  })

  test('Blacktown (already an LGA name) stays as BLACKTOWN', async () => {
    const ctx = await prepareTurn('I live in Blacktown', {}, [], mockLlm({ council_lga: 'Blacktown' }))
    expect(ctx.mergedProfile.council_lga).toBe('BLACKTOWN')
  })

  test('Unknown suburb stays as-is uppercased', async () => {
    const ctx = await prepareTurn('I live in Wagga Wagga', {}, [], mockLlm({ council_lga: 'Wagga Wagga' }))
    expect(ctx.mergedProfile.council_lga).toBe('WAGGA_WAGGA')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```
pnpm --filter web test --reporter=verbose __tests__/council-lga-normalise
```
Expected: FAIL — `council_lga` is `"GLEBE"` not `"SYDNEY"`.

- [ ] **Step 3: Add `SUBURB_TO_LGA` and update `normaliseEnumValues` in `turn.ts`**

Add just before `normaliseEnumValues`:

```ts
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
```

Then update the `council_lga` block inside `normaliseEnumValues`:

```ts
if (typeof out.council_lga === 'string') {
  const upper = out.council_lga.trim().toUpperCase().replace(/[\s-]+/g, '_')
  // Try as-is after normalisation (e.g. "BLACKTOWN" stays "BLACKTOWN")
  // Then try with spaces (e.g. "SEVEN_HILLS" → check "SEVEN HILLS" variant too)
  out.council_lga = SUBURB_TO_LGA[upper]
    ?? SUBURB_TO_LGA[out.council_lga.trim().toUpperCase()]
    ?? upper
}
```

- [ ] **Step 4: Run tests**

```
pnpm --filter web test
```
Expected: all passing including the 5 new suburb normalisation tests.

- [ ] **Step 5: Typecheck**

```
pnpm --filter web typecheck
```

- [ ] **Step 6: Commit**

```
git add apps/web/lib/orchestrator/turn.ts apps/web/__tests__/council-lga-normalise.test.ts
git commit -m "feat: suburb-to-LGA normalisation — maps inner-Sydney/Blacktown/etc suburbs to canonical LGA names"
```

---

## Task 3: Extraction prompt — income phrasing + super income correction

**Files:**
- Modify: `apps/web/lib/orchestrator/extract.ts` — `EXTRACTION_SYSTEM` constant

- [ ] **Step 1: Replace Example 7 (wrong super-income exclusion)**

Current Example 7:
```
Example 7:super/dividends are NOT annual_income (annual_income means employment income; investment income is out-of-model):
User: "I'm 70, retired. Super pays me $30k a year and I have $200k in shares paying dividends."
Output: {"age":70,"employment_status":"retired"}
```

Replace with:
```
Example 7:super/pension drawdowns and employment income both count as annual_income for Centrelink. Extract the total annual income from all regular sources:
User: "I'm 70, retired. Super pays me $30k a year."
Output: {"age":70,"employment_status":"retired","annual_income":30000}
```

- [ ] **Step 2: Add Example 13 — abbreviated k-suffix amounts**

After Example 12 in the prompt, add:

```
Example 13:abbreviated income amounts ("k" suffix, with or without "$"):
User: "i get bout 25k a yr frm super"
Output: {"annual_income":25000,"employment_status":"retired"}
User: "earnt maybe 5k since i got made redundant, before that was on 75k"
Output: {"annual_income":5000,"employment_status":"unemployed"}
Note: when two income figures are present (a prior job and a current situation), extract the CURRENT/MOST RECENT one only.`
```

- [ ] **Step 3: Add Example 14 — zero/nil income framing**

```
Example 14:statements of no income or near-zero:
User: "no income coming in basically, just that small cash work"
Output: {"employment_status":"unemployed"}
User: "I'm not working at all right now"
Output: {"employment_status":"unemployed"}
Note: "no income" alone is not sufficient to set annual_income:0 — the user may have other income sources not yet mentioned. Only set annual_income when a specific figure is given.`
```

- [ ] **Step 4: Run typecheck and tests (no test change needed — extraction is integration-tested via prepareTurn)**

```
pnpm --filter web typecheck
pnpm --filter web test
```
Expected: all 93+ tests pass.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/orchestrator/extract.ts
git commit -m "fix(extract): correct super-income example, add k-suffix income parsing, add competing-figures rule"
```

---

## Task 4: Replace raw conversation history with verified context summary

**Root cause this fixes:** The bot receives the full raw conversation history alongside the system prompt. When the extractor fails to parse a value, the bot can still read it in the raw history and act on it — overriding the orchestrator's state. This is a structural backdoor: the LLM has access to unverified information the orchestrator hasn't confirmed.

**Architecture:** Instead of passing raw user messages as history, build a synthetic context from two sources only: (1) the verified profile (what the orchestrator confirmed), and (2) the last bot response (for tone continuity). The current raw user message is still passed so the bot can acknowledge what was just said. All prior raw user messages are replaced and the LLM cannot infer anything from them.

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — add `buildBotContext()` export
- Modify: `apps/web/app/api/chat/route.ts` — replace raw history with `buildBotContext()`
- Modify: `apps/web/scripts/simulator/main.ts` — replace raw history with `buildBotContext()`

- [ ] **Step 1: Add `buildBotContext()` to `turn.ts`**

Add this export after `buildSystemPrompt`:

```ts
/**
 * Builds the messages array for the bot response LLM call.
 * Replaces raw conversation history with a verified context summary so the
 * bot cannot infer unconfirmed facts from prior user messages.
 *
 * Structure passed to the LLM:
 *   [user]      verified profile summary + what still needs collecting
 *   [assistant] last bot response (tone continuity) — omitted on turn 0
 *   [user]      current raw user message (for acknowledgement)
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

  const contextMessage = `[Verified context — do not treat anything outside this as confirmed]\nProfile so far: ${confirmed}.\n${needed}`

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
```

- [ ] **Step 2: Update `route.ts` to use `buildBotContext()`**

In `apps/web/app/api/chat/route.ts`, find the `streamText` call. Currently it passes the full raw `messages` array from the client. Replace with:

```ts
import { buildBotContext } from '@/lib/orchestrator/turn'

// Get last bot response for tone continuity
const lastBotResponse = messages
  .filter((m: { role: string }) => m.role === 'assistant')
  .at(-1)?.content ?? null

const result = streamText({
  model: ...,
  system: ctx.systemPrompt,
  messages: buildBotContext(
    ctx.mergedProfile,
    ctx.nextQuestion,
    lastBotResponse,
    userMessage,
  ),
  ...
})
```

- [ ] **Step 3: Update simulator `main.ts` to use `buildBotContext()`**

In `apps/web/scripts/simulator/main.ts`, find `botTurn()`. Replace the `messages` passed to `generateText`:

```ts
import { buildBotContext } from '@/lib/orchestrator/turn'

async function botTurn(
  userMessage: string,
  profile: ProfileVariables,
  history: LlmMessage[],
  extractLlm: AnthropicProvider,
) {
  const ctx = await prepareTurn(userMessage, profile, history, extractLlm, {})

  const lastBotResponse = history
    .filter((m) => m.role === 'assistant')
    .at(-1)?.content ?? null

  const { text } = await generateText({
    model: botAnthropic(MODEL),
    system: ctx.systemPrompt,
    messages: buildBotContext(
      ctx.mergedProfile,
      ctx.nextQuestion,
      lastBotResponse,
      userMessage,
    ),
    maxTokens: 384,
  })
  return { ctx, botResponse: text.trim() }
}
```

- [ ] **Step 4: Run tests + typecheck**

```
pnpm --filter web test
pnpm --filter web typecheck
```
Expected: all tests pass. The `buildBotContext` function is pure and testable but no unit test is written here — its correctness is verified by the simulator re-run.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/orchestrator/turn.ts apps/web/app/api/chat/route.ts apps/web/scripts/simulator/main.ts
git commit -m "fix: replace raw conversation history with verified context summary — closes LLM history backdoor"
```

---

## Task 5: Orchestrator-generated handoff message — remove LLM from handoff entirely

**Root cause this fixes:** When `mode === 'handoff'`, the LLM is still responsible for generating the response. This gives it the opportunity to deviate — asking questions, adding caveats, or ignoring the MODE directive. Handoff is not a language generation problem: the eligible schemes are known, the next steps are in the corpus, and the message structure is deterministic. The LLM adds no value here and only introduces risk.

**Architecture:** Add `buildHandoffMessage()` to `turn.ts` that constructs the handoff response directly from `eligibility.eligible` and the retrieved corpus chunks (which already contain the "How to apply" section for each scheme). Add `handoffMessage: string | null` to `TurnContext`. In `route.ts` and `main.ts`, if `ctx.handoffMessage` is non-null, use it as the response without calling `streamText`/`generateText` at all.

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — add `buildHandoffMessage()`, add `handoffMessage` to `TurnContext`, populate in `prepareTurn`
- Modify: `apps/web/app/api/chat/route.ts` — short-circuit to `handoffMessage` when present
- Modify: `apps/web/scripts/simulator/main.ts` — short-circuit to `handoffMessage` when present

- [ ] **Step 1: Add `buildHandoffMessage()` to `turn.ts`**

Add after `buildBotContext`:

```ts
/**
 * Builds the handoff response entirely from orchestrator data.
 * No LLM call needed — the eligible schemes and their next steps are
 * deterministic from eligibility + corpus chunks.
 */
export function buildHandoffMessage(
  eligibility: EligibilityResult,
  chunks: CorpusChunk[],
): string {
  const schemeCount = eligibility.eligible.length
  const schemeList = eligibility.eligible.join(' and ')

  const intro = schemeCount === 1
    ? `Based on everything you've shared, you appear eligible for ${schemeList}.`
    : `Based on everything you've shared, you appear eligible for ${schemeList}.`

  const chunkMap = new Map(chunks.map((c) => [c.scheme_id, c.chunk_text]))

  const steps = eligibility.eligible
    .map((schemeId) => {
      const chunk = chunkMap.get(schemeId)
      if (!chunk) return null
      const match = chunk.match(/##\s*How to apply\s*\n+([\s\S]*?)(?=\n##|$)/)
      const step = match ? match[1].trim().replace(/\r?\n+/g, ' ') : null
      return step ? `For ${schemeId}: ${step}` : null
    })
    .filter((s): s is string => s !== null)

  const body = steps.length > 0
    ? steps.join(' ')
    : 'Check your eligibility meter on screen for next steps.'

  return `${intro} Your eligibility meter on screen has your full results. ${body}`
}
```

- [ ] **Step 2: Add `handoffMessage` to `TurnContext` and populate in `prepareTurn`**

In `TurnContext` interface, add:
```ts
handoffMessage: string | null   // non-null only when mode === 'handoff'
```

In `prepareTurn` return statement, add:
```ts
handoffMessage: mode === 'handoff'
  ? buildHandoffMessage(eligibility, chunks)
  : null,
```

- [ ] **Step 3: Short-circuit in `route.ts`**

After `prepareTurn` resolves, check `ctx.handoffMessage` before calling `streamText`:

```ts
if (ctx.handoffMessage) {
  // Return handoff message directly — no LLM call
  const streamData = new StreamData()
  streamData.append({ ...streamPayload })
  streamData.close()
  return new Response(ctx.handoffMessage, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
// else: fall through to streamText as normal
```

Note: match the exact response format your route handler uses. If it uses Vercel AI SDK's `streamText`, you may need to wrap the handoff message in a compatible stream. Check the existing route handler pattern and mirror it.

- [ ] **Step 4: Short-circuit in simulator `main.ts`**

In `botTurn()`, after `prepareTurn`:

```ts
if (ctx.handoffMessage) {
  return { ctx, botResponse: ctx.handoffMessage }
}
// else: fall through to generateText
```

- [ ] **Step 5: Write a unit test for `buildHandoffMessage`**

Create `apps/web/__tests__/handoff-message.test.ts`:

```ts
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
})
```

- [ ] **Step 6: Run tests + typecheck**

```
pnpm --filter web test
pnpm --filter web typecheck
```
Expected: all tests pass including 4 new handoff-message tests.

- [ ] **Step 7: Commit**

```
git add apps/web/lib/orchestrator/turn.ts apps/web/app/api/chat/route.ts apps/web/scripts/simulator/main.ts apps/web/__tests__/handoff-message.test.ts
git commit -m "feat: orchestrator-generated handoff message — LLM no longer involved in handoff turns"
```

---

## Task 6: State-based corpus chunk pre-filtering

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — `prepareTurn` chunk query block (~line 562)

- [ ] **Step 1: Add NSW_COUNCIL_SCHEMES set and filter in `prepareTurn`**

Find the corpus query block in `prepareTurn`:
```ts
  const relevantSchemeIds = [
    ...eligibility.eligible,
    ...eligibility.needs_info.map((n) => n.schemeId),
  ]
  let chunks: CorpusChunk[] = []
  try {
    chunks = await queryCorpus(merged, relevantSchemeIds, 4)
```

Replace with:
```ts
  const NSW_COUNCIL_SCHEMES = new Set([
    'COUNCIL_SYDNEY_PENSIONER_RATES_REBATE', 'COUNCIL_SYDNEY_RATES_HARDSHIP',
    'COUNCIL_BLACKTOWN_PENSIONER_RATES_REBATE',
    'COUNCIL_CANTERBURY_BANKSTOWN_PENSIONER_RATES_REBATE',
    'COUNCIL_CENTRAL_COAST_PENSIONER_RATES_REBATE',
    'COUNCIL_NORTHERN_BEACHES_PENSIONER_RATES_REBATE',
  ])

  const relevantSchemeIds = [
    ...eligibility.eligible,
    ...eligibility.needs_info.map((n) => n.schemeId),
  ]

  // When state is confirmed non-NSW, exclude council-specific chunks so the 4
  // context slots go to schemes actually relevant to this user.
  const filteredSchemeIds = merged.state && merged.state !== 'NSW'
    ? relevantSchemeIds.filter((id) => !NSW_COUNCIL_SCHEMES.has(id))
    : relevantSchemeIds

  let chunks: CorpusChunk[] = []
  try {
    chunks = await queryCorpus(merged, filteredSchemeIds, 4)
```

- [ ] **Step 2: Run tests + typecheck**

```
pnpm --filter web test
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```
git add apps/web/lib/orchestrator/turn.ts
git commit -m "feat: exclude NSW council chunks from retrieval when user state is confirmed non-NSW"
```

---

## Task 7: Style rule — prevent echo-then-reask

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — STYLE RULES block in `buildSystemPrompt` (~line 428)

- [ ] **Step 1: Add style rule**

In `buildSystemPrompt`, find the STYLE RULES section and add after the em-dash ban:
```
- If you are about to ask for information the user appears to have stated in their most recent message, do NOT echo it back and then re-ask. Either ask for confirmation ("Just to lock in the figure — was that $25,000 a year?") or ask the question cleanly without referencing the stated value.
```

- [ ] **Step 2: Run tests + typecheck + commit**

```
pnpm --filter web test
pnpm --filter web typecheck
git add apps/web/lib/orchestrator/turn.ts
git commit -m "fix: style rule — prevent bot from acknowledging a value and then immediately re-asking for it"
```

---

## Final verification

- [ ] **Run full test suite — expect 93+ tests (new tests added in Tasks 1, 2, 4)**

```
pnpm --filter web test
```

- [ ] **Typecheck clean**

```
pnpm --filter web typecheck
```

- [ ] **Re-run simulator on council personas to verify Fix 1 + Fix 2**

```
pnpm --filter web run sim -- --persona COUNCIL_BLACKTOWN_PENSIONER_RATES-eligible --level 0
pnpm --filter web run sim -- --persona COUNCIL_SYDNEY_PENSIONER_RATES-eligible --level 0
```
Both should show `match=true` in 1-3 turns.

- [ ] **Re-run AGE_PENSION persona at L3 to verify Fix 3 + Fix 4 reduce reask loop**

```
pnpm --filter web run sim -- --persona AGE_PENSION-eligible-retiree --level 3
```
Should complete in ≤6 turns (was 9). If still looping, check income extraction example landed correctly.
