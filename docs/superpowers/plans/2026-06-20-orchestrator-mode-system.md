# Orchestrator Mode System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all remaining decision logic out of the LLM system prompt and into the orchestrator by introducing a `ConversationMode` that the prompt consumes declaratively.

**Architecture:** `prepareTurn` gains contradiction detection (pre-merge comparison), mode determination (`contradiction > handoff > collecting_info`), and conditional question-picking. `buildSystemPrompt` is restructured from a flat rule-list into mode-driven blocks — universal style rules at the top, then one instruction block per mode. The LLM receives a clear mode and follows it; it makes no control-flow decisions.

**Tech Stack:** TypeScript, Vitest, `apps/web/lib/orchestrator/turn.ts` only.

---

## File Map

| File | Change |
|---|---|
| `apps/web/lib/orchestrator/turn.ts` | All changes — new types, updated `TurnContext`, updated `prepareTurn`, rewritten `buildSystemPrompt` |
| `apps/web/__tests__/pickNextQuestion.test.ts` | Add two tests: handoff mode skips question, contradiction mode skips question |
| `apps/web/__tests__/orchestrator-mode.test.ts` | New file — unit tests for contradiction detection and mode determination |

---

### Task 1: Add types and update TurnContext

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` (type section, lines 8–47)

- [ ] **Step 1: Add `ConversationMode` and `ContradictionDetail` types immediately after the existing `EligibilityResult` interface**

Replace this block in `turn.ts`:

```ts
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
```

Wait — `mode` and `contradictions` are NOT yet in this interface. Insert the two new types BEFORE `TurnContext` and ADD the two fields to it:

```ts
// Insert after EligibilityResult, before TurnContext:
export type ConversationMode = 'collecting_info' | 'handoff' | 'contradiction'

export interface ContradictionDetail {
  variable: string
  previous: unknown
  extracted: unknown
}
```

Then add these two fields to `TurnContext` (after `guidance`):

```ts
  mode: ConversationMode
  contradictions: ContradictionDetail[]
```

- [ ] **Step 2: Run typecheck to confirm the additions alone don't break anything (prepareTurn return will fail — expected)**

```bash
pnpm --filter web typecheck 2>&1 | head -30
```

Expected: errors on `prepareTurn` return statement (missing `mode` and `contradictions` fields). That's correct — we fix those in Task 3.

---

### Task 2: Write tests for contradiction detection and mode determination

**Files:**
- Create: `apps/web/__tests__/orchestrator-mode.test.ts`

These tests exercise logic we will add to `prepareTurn`. Write them now so they guide the implementation in Task 3.

- [ ] **Step 1: Create the test file**

```ts
// apps/web/__tests__/orchestrator-mode.test.ts
import { describe, expect, test, vi } from 'vitest'

// We test the exported helpers indirectly via prepareTurn.
// Since prepareTurn calls the rules service and the LLM, we mock both.
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmProvider } from '@/lib/llm/LlmProvider'

// Minimal mock LLM — extraction always returns empty (no new facts extracted)
function mockLlm(extraction: Record<string, unknown> = {}): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: JSON.stringify(extraction) }),
  }
}

// Stub fetch to return a canned rules result
function mockRules(eligible: string[] = [], missing: Record<string, string[]> = {}) {
  const traces = Object.fromEntries(
    Object.entries(missing).map(([id, vars]) => [id, { missing: vars }]),
  )
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      eligible,
      ineligible: [],
      missing_variables: Object.values(missing).flat(),
      traces,
    }),
  })
}

describe('prepareTurn — mode: collecting_info', () => {
  test('returns collecting_info when no eligible schemes and no contradictions', async () => {
    mockRules([], { JOBSEEKER: ['age', 'employment_status'] })
    const ctx = await prepareTurn('hello', {}, [], mockLlm())
    expect(ctx.mode).toBe('collecting_info')
    expect(ctx.contradictions).toEqual([])
    expect(ctx.nextQuestion).not.toBeNull()
  })
})

describe('prepareTurn — mode: handoff', () => {
  test('returns handoff when at least one scheme is eligible', async () => {
    mockRules(['JOBSEEKER'])
    const ctx = await prepareTurn('hello', {}, [], mockLlm())
    expect(ctx.mode).toBe('handoff')
    expect(ctx.nextQuestion).toBeNull()
    expect(ctx.chips).toEqual([])
  })

  test('handoff takes priority even when contradictions also present', async () => {
    // extraction returns age: 50 but profile already has age: 30
    mockRules(['AGE_PENSION'])
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    // handoff wins over contradiction
    expect(ctx.mode).toBe('handoff')
  })
})

describe('prepareTurn — mode: contradiction', () => {
  test('returns contradiction when extraction conflicts with existing profile field', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    // extraction returns age: 50, but profile already has age: 30
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.mode).toBe('contradiction')
    expect(ctx.contradictions).toHaveLength(1)
    expect(ctx.contradictions[0]).toMatchObject({
      variable: 'age',
      previous: 30,
      extracted: 50,
    })
  })

  test('keeps old profile value when contradiction detected (does not merge new value)', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.mergedProfile.age).toBe(30)
  })

  test('nextQuestion is null and chips are empty in contradiction mode', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    const ctx = await prepareTurn('I am 50', profile, [], mockLlm({ age: 50 }))
    expect(ctx.nextQuestion).toBeNull()
    expect(ctx.chips).toEqual([])
  })

  test('chip delta is never treated as a contradiction (chips are authoritative)', async () => {
    mockRules([], { AGE_PENSION: ['annual_income'] })
    const profile = { age: 30 }
    // chipDelta sets age: 45 — not a contradiction even if profile has age: 30
    const ctx = await prepareTurn('45', profile, [], mockLlm(), { age: 45 })
    expect(ctx.mode).not.toBe('contradiction')
    expect(ctx.mergedProfile.age).toBe(45)
  })

  test('new field (not previously in profile) is never a contradiction', async () => {
    mockRules([], { JOBSEEKER: ['employment_status'] })
    const profile = {} // age not set yet
    const ctx = await prepareTurn('I am 28', profile, [], mockLlm({ age: 28 }))
    expect(ctx.mode).toBe('collecting_info')
    expect(ctx.contradictions).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they all fail (expected — implementation not done yet)**

```bash
pnpm --filter web test __tests__/orchestrator-mode.test.ts 2>&1 | tail -20
```

Expected: all tests fail with errors like "mode is undefined" or property mismatch.

---

### Task 3: Implement contradiction detection and mode logic in `prepareTurn`

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` (`prepareTurn` function)

- [ ] **Step 1: Add contradiction detection before the merge step**

In `prepareTurn`, after `extractedDelta` is computed (step 2) and before `merged` is built, insert:

```ts
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
      delete safeExtractedDelta[key]  // withold: keep old value in profile
    }
  }
```

- [ ] **Step 2: Use `safeExtractedDelta` for the merge (not raw `extractedDelta`)**

Change the merge line from:

```ts
  const merged = normaliseEnumValues(mergeProfile(profileWithChip, extractedDelta))
```

to:

```ts
  const merged = normaliseEnumValues(mergeProfile(profileWithChip, safeExtractedDelta))
```

Note: `fullDelta` (returned as `profileDelta`) should still use the raw `extractedDelta` so the client knows what the LLM extracted, even if it was withheld from the profile:

```ts
  const fullDelta: Partial<ProfileVariables> = { ...chipDelta, ...extractedDelta }
```

This line is already correct — no change needed.

- [ ] **Step 3: Add mode determination after the rules engine call**

After `const eligibility = toEligibilityResult(rulesResult)`, add:

```ts
  // Determine conversation mode. Priority: contradiction > handoff > collecting_info.
  // The LLM receives this mode and follows mode-specific language instructions;
  // it makes no control-flow decisions of its own.
  const mode: ConversationMode =
    contradictions.length > 0 ? 'contradiction' :
    eligibility.eligible.length > 0  ? 'handoff' :
    'collecting_info'
```

- [ ] **Step 4: Gate `pickNextQuestion` on mode**

Replace the current `pickNextQuestion` call:

```ts
  // 4. Pick next question (skip-cooldown vars excluded via newSkippedAt)
  const nextQuestion = pickNextQuestion(
    rulesResult.missing_variables,
    merged,
    history,
    rulesResult.traces,
    eligibility,
    newSkippedAt,
  )
```

with:

```ts
  // 4. Pick next question — only in collecting_info mode.
  //    Handoff and contradiction modes handle the turn via the system prompt
  //    mode block; no slot-filling question is needed.
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
```

- [ ] **Step 5: Pass mode and contradictions to `buildSystemPrompt`**

Update the `buildSystemPrompt` call (step 6 inside prepareTurn):

```ts
  const systemPrompt = buildSystemPrompt(merged, eligibility, chunks, nextQuestion, mode, contradictions)
```

- [ ] **Step 6: Add mode and contradictions to the return statement**

```ts
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
```

- [ ] **Step 7: Run the new tests — they should now pass**

```bash
pnpm --filter web test __tests__/orchestrator-mode.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Run existing tests to check nothing regressed**

```bash
pnpm --filter web test 2>&1 | tail -10
```

Expected: all existing tests still pass (TurnContext additions are additive; `buildSystemPrompt` signature change will cause a type error until Task 4).

---

### Task 4: Rewrite `buildSystemPrompt` to be mode-driven

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` (`buildSystemPrompt` function)

- [ ] **Step 1: Update the function signature to accept mode and contradictions**

```ts
export function buildSystemPrompt(
  mergedProfile: ProfileVariables,
  eligibility: EligibilityResult,
  chunks: CorpusChunk[],
  nextQuestion: NextQuestion | null,
  mode: ConversationMode,
  contradictions: ContradictionDetail[],
): string {
```

- [ ] **Step 2: Replace the entire function body with the mode-driven implementation**

```ts
  const eligibleNames = eligibility.eligible.join(', ') || 'none yet'
  const needsInfoNames = eligibility.needs_info.map((n) => n.schemeId).join(', ') || 'none'
  const ineligibleNames = eligibility.ineligible.join(', ') || 'none yet'
  const sources = chunks.map((c) => `[${c.scheme_id}] ${c.chunk_text}`).join('\n\n')

  // ── Mode-specific instruction block ─────────────────────────────────────────
  let modeBlock: string

  if (mode === 'handoff') {
    modeBlock = `MODE: handoff

The system has confirmed the user appears eligible for at least one program. Do not ask any more questions.
Direct the user to their eligibility meter on screen to see full results.
For each scheme listed under "Appears eligible" below, briefly explain the next step to claim it, using the Official sources for wording.
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
    // collecting_info
    const questionInstruction = nextQuestion
      ? `Ask EXACTLY this question, nothing else: "${nextQuestion.question}"`
      : 'All information has been collected. Summarise what you know about the user naturally and let them know you are checking their eligibility.'
    modeBlock = `MODE: collecting_info

Acknowledge one specific thing from the user's last message (not a generic affirmation).
${questionInstruction}`
  }

  return `You are Benefits.AI, a friendly Australian government benefits advisor. Your role is to generate natural language only. All decisions about what to ask, when to stop, and what data is valid have been made by the orchestrator.

STYLE RULES (apply in every response):
- Warm, conversational, like a knowledgeable friend rather than a form
- BANNED HOLLOW OPENERS: do NOT open with "Love it!", "Good stuff!", "Nice!", "Got it!", "Good to hear!", "Awesome!", "Perfect!", or any generic exclamation. If you cannot acknowledge something specific the user just said, go straight to the question.
- BANNED FAKE-NOTED OPENERS: do NOT say "I have that noted down", "I have that noted", "You've mentioned X a couple of times", "I see you're...", "Just to make sure I've got this", "Thanks for confirming X". You may reflect the user's last message back verbatim, but never reference earlier turns or context that is not in the profile JSON.
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
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter web typecheck 2>&1 | tail -10
```

Expected: clean (no errors).

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter web test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/orchestrator/turn.ts apps/web/__tests__/orchestrator-mode.test.ts
git commit -m "feat(orchestrator): mode system — LLM is pure NL generator, orchestrator owns all decisions

- Add ConversationMode (collecting_info | handoff | contradiction) and ContradictionDetail types
- prepareTurn detects contradictions pre-merge, withholds conflicting values, keeps old profile state
- Mode priority: contradiction > handoff > collecting_info
- pickNextQuestion only called in collecting_info mode; null returned for handoff/contradiction
- chips and guidance cleared for non-collecting_info modes
- buildSystemPrompt restructured: universal style rules + mode-specific instruction block
- Removed from system prompt: stop-when-eligible rule, contradiction-handling rule, one-question enforcement rule"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `ConversationMode` type | Task 1 |
| `ContradictionDetail` type | Task 1 |
| `mode` + `contradictions` on `TurnContext` | Task 1 |
| Contradiction detection before merge | Task 3, Step 1 |
| Chip delta never treated as contradiction | Task 3, Step 1 + test in Task 2 |
| Old value kept on contradiction | Task 3, Step 2 + test in Task 2 |
| Mode priority (contradiction > handoff > collecting_info) | Task 3, Step 3 |
| `pickNextQuestion` gated on mode | Task 3, Step 4 |
| `chips` and `guidance` cleared outside collecting_info | Task 3, Step 6 |
| `buildSystemPrompt` signature update | Task 4, Step 1 |
| Mode-driven system prompt body | Task 4, Step 2 |
| Decision rules removed from prompt | Task 4, Step 2 (new body has no conditional rules) |
| Handoff mode: no more questions | Task 4, Step 2 (handoff block) |
| Contradiction mode: ask one clarifying question | Task 4, Step 2 (contradiction block) |

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:** `ConversationMode` and `ContradictionDetail` defined in Task 1, used identically in Tasks 3 and 4. `buildSystemPrompt` signature updated in Task 4 matches the call site updated in Task 3 Step 5.
