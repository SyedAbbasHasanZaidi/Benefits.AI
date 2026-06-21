# Simulator Findings — Remediation Design Spec

**Date:** 2026-06-20
**Status:** Approved for implementation
**Source:** 60-conversation curated simulator run (20 personas × L3/L4/L5)

---

## Context

A full simulator run surfaced 7 critical findings and 22 high findings across 60 conversations. This spec describes the fixes in priority order, derived from the review agent's root-cause analysis.

---

## Fix 1 — `tenure_type` enum mismatch (critical, small)

### Problem
The TypeScript type and extraction schema define `tenure_type` as `'renting' | 'owner' | 'boarding'`. OpenFisca formulas in every council scheme check `tenure_type == "owning"`. The mismatch means all council pensioner rebates return `result: false` for every owner-occupier. This accounts for all 7 critical ground-truth misses.

Evidence from review:
```json
"COUNCIL_BLACKTOWN_PENSIONER_RATES_REBATE": {
  "result": false,
  "inputs": {"council_lga":"BLACKTOWN","tenure_type":"owner","age":70}
}
```

### Fix
Change the canonical TS value from `'owner'` to `'owning'` everywhere in the TypeScript layer:

| File | Change |
|---|---|
| `apps/web/lib/orchestrator/profile.ts` | `TenureType = 'renting' \| 'owning' \| 'boarding'` |
| `apps/web/lib/orchestrator/turn.ts` (chip mapper, line 337) | `return { tenure_type: 'owning' }` |
| `apps/web/lib/orchestrator/turn.ts` (normaliseEnumValues, line 197) | update comment/value to `'owning'` |
| `apps/web/lib/orchestrator/extract.ts` (schema string) | `"renting" \| "owning" \| "boarding"` |
| `apps/web/scripts/simulator/personas.ts` | 8 persona profiles use `tenure_type: 'owner'` — change to `'owning'` |

No OpenFisca changes needed — the rules engine already expects `"owning"`.

---

## Fix 2 — Suburb-to-LGA resolution (critical, medium)

### Problem
Users say their suburb ("Glebe", "Pyrmont", "Manly") and the extractor stores that verbatim. After uppercasing it becomes `"GLEBE"`, which doesn't match any supported LGA (`"SYDNEY"`, `"BLACKTOWN"`, etc.). Council schemes silently never match because the `council_lga` field holds a suburb rather than the LGA name.

### Fix
Add a `SUBURB_TO_LGA` lookup table in `normaliseEnumValues` in `turn.ts`. After uppercasing `council_lga`, check against the table and remap to the canonical LGA name if found.

```ts
const SUBURB_TO_LGA: Record<string, string> = {
  // City of Sydney LGA
  GLEBE: 'SYDNEY', NEWTOWN: 'SYDNEY', 'SURRY HILLS': 'SYDNEY', 'SURRY_HILLS': 'SYDNEY',
  PYRMONT: 'SYDNEY', REDFERN: 'SYDNEY', CHIPPENDALE: 'SYDNEY', ULTIMO: 'SYDNEY',
  DARLINGHURST: 'SYDNEY', 'POTTS POINT': 'SYDNEY', 'POTTS_POINT': 'SYDNEY',
  BALMAIN: 'SYDNEY', LEICHHARDT: 'SYDNEY', ANNANDALE: 'SYDNEY', PADDINGTON: 'SYDNEY',
  // Blacktown LGA
  'SEVEN HILLS': 'BLACKTOWN', 'SEVEN_HILLS': 'BLACKTOWN',
  'MOUNT DRUITT': 'BLACKTOWN', 'MOUNT_DRUITT': 'BLACKTOWN',
  TOONGABBIE: 'BLACKTOWN', 'QUAKERS HILL': 'BLACKTOWN', 'QUAKERS_HILL': 'BLACKTOWN',
  'ROOTY HILL': 'BLACKTOWN', 'ROOTY_HILL': 'BLACKTOWN',
  'KINGS LANGLEY': 'BLACKTOWN', 'KINGS_LANGLEY': 'BLACKTOWN',
  // Canterbury-Bankstown LGA
  BANKSTOWN: 'CANTERBURY_BANKSTOWN', CANTERBURY: 'CANTERBURY_BANKSTOWN',
  CAMPSIE: 'CANTERBURY_BANKSTOWN', LAKEMBA: 'CANTERBURY_BANKSTOWN',
  BELMORE: 'CANTERBURY_BANKSTOWN', GREENACRE: 'CANTERBURY_BANKSTOWN',
  PUNCHBOWL: 'CANTERBURY_BANKSTOWN', PADSTOW: 'CANTERBURY_BANKSTOWN',
  REVESBY: 'CANTERBURY_BANKSTOWN', MILPERRA: 'CANTERBURY_BANKSTOWN',
  // Central Coast LGA
  GOSFORD: 'CENTRAL_COAST', WYONG: 'CENTRAL_COAST', 'WOY WOY': 'CENTRAL_COAST',
  'WOY_WOY': 'CENTRAL_COAST', TERRIGAL: 'CENTRAL_COAST', 'THE ENTRANCE': 'CENTRAL_COAST',
  TUGGERAH: 'CENTRAL_COAST', ERINA: 'CENTRAL_COAST', 'UMINA BEACH': 'CENTRAL_COAST',
  // Northern Beaches LGA
  MANLY: 'NORTHERN_BEACHES', 'DEE WHY': 'NORTHERN_BEACHES', 'DEE_WHY': 'NORTHERN_BEACHES',
  NARRABEEN: 'NORTHERN_BEACHES', 'MONA VALE': 'NORTHERN_BEACHES', 'MONA_VALE': 'NORTHERN_BEACHES',
  BALGOWLAH: 'NORTHERN_BEACHES', FRESHWATER: 'NORTHERN_BEACHES',
  'CURL CURL': 'NORTHERN_BEACHES', 'CURL_CURL': 'NORTHERN_BEACHES',
  COLLAROY: 'NORTHERN_BEACHES', CROMER: 'NORTHERN_BEACHES', WARRIEWOOD: 'NORTHERN_BEACHES',
}
```

Apply after the existing `council_lga` uppercase transform. If the suburb isn't in the table, leave as-is (the user may have already given the correct LGA name like "Blacktown").

---

## Fix 3 — Extraction prompt: informal income + super income (high, small)

### Problem
Two extraction failures observed repeatedly:

**A. Informal income phrasing:** `"25k a yr"`, `"5k total since losing my job"`, `"about 25 grand"` return `{}`. The extractor doesn't handle `k`-abbreviated or informal amounts stated without `$`.

**B. Example 7 is wrong for Centrelink purposes:** The current extraction prompt says "super pays me $30k a year → do NOT extract annual_income." This is incorrect — Centrelink income tests for Age Pension, LIHCC, and FTB include super drawdowns. The example incorrectly trains the extractor to ignore retirement income.

**C. Two competing income figures:** When a user provides a prior-job income AND a current income in one message (`"was on 75k, now just 5k total since redundancy"`), the extractor returns `{}` rather than taking the current figure.

### Fix
Update the extraction system prompt in `extract.ts`:

1. **Replace Example 7** (super income exclusion) with a correct rule: super/pension income and employment income both count as `annual_income` for Centrelink. Extract the most recent/current figure.

2. **Add Example 13**: informal `k`-abbreviated amounts:
   ```
   Example 13 — abbreviated amounts ("k" suffix, no $ sign):
   User: "i get bout 25k a yr frm super"
   Output: {"annual_income":25000,"employment_status":"retired"}
   User: "earnt maybe 5k since i got made redundant"
   Output: {"annual_income":5000}
   ```

3. **Add Example 14**: competing income figures — take the current/most recent:
   ```
   Example 14 — two income figures, take the current one (most recent job/situation):
   User: "was on 75k at the factory, since redundancy just 5k cash work total"
   Output: {"annual_income":5000,"employment_status":"unemployed"}
   ```

---

## Fix 4 — Replace raw conversation history with verified context summary (high, medium)

### Problem
The bot LLM receives two inputs every turn: the system prompt (orchestrator-controlled, verified data) and the full raw conversation history (uncontrolled, contains everything the user said including values the extractor failed to parse).

When extraction fails, the bot reads the raw history, infers the variable was answered, and acts on that inference — overriding the orchestrator's state. This is the same class of architectural violation as the ConversationMode problem. Adding prompt rules is a soft constraint the LLM can reason around. The structural fix is to remove the backdoor: stop giving the LLM raw unverified history to reason from.

### Fix
Replace the raw `messages` array passed to `generateText`/`streamText` with a synthetic context built from verified sources only via a new `buildBotContext()` export in `turn.ts`:

```
[user]      Verified context: confirmed profile fields + next variable needed
[assistant] "Understood."
[user]      "[previous turn]" placeholder
[assistant] last bot response  ← tone continuity, omitted on turn 0
[user]      current raw user message  ← acknowledgement only
```

The bot gets what the orchestrator confirmed, its own last response for tone, and the current message for acknowledgement. It does NOT get prior raw user messages to infer unverified facts from. `route.ts` and `main.ts` call `buildBotContext()` instead of passing raw history.

---

## Fix 5 — Orchestrator-generated handoff message, no LLM (medium, medium)

### Problem
When `mode === 'handoff'`, the LLM is still called to generate the response. This gives it the opportunity to deviate — asking questions, ignoring the MODE directive — as observed in 1 of 6 handoff turns. Prompt rules are a soft constraint on a fundamentally LLM-controlled surface.

Handoff is not a language generation problem. The eligible schemes are deterministic. The next steps are in the corpus chunks already retrieved. The message structure is fixed. The LLM adds zero value here and only introduces deviation risk.

### Fix
Add `buildHandoffMessage(eligibility, chunks)` to `turn.ts`. It constructs the response directly from orchestrator data:

1. Opens with "Based on what you've shared, you appear eligible for [schemes]."
2. Directs to the eligibility meter on screen.
3. For each eligible scheme, extracts the "How to apply" section from the corpus chunk.

Add `handoffMessage: string | null` to `TurnContext` — populated when `mode === 'handoff'`, null otherwise. In `route.ts` and `main.ts`, when `ctx.handoffMessage` is non-null, use it directly as the bot response. The LLM is not invoked for handoff turns at all.

---

## Fix 6 — State-based corpus pre-filtering (medium, small)

### Problem
When `profile.state` is known and is not `"NSW"`, the vector query still returns NSW council scheme chunks (e.g. `COUNCIL_NORTHERN_BEACHES_PENSIONER_RATES_REBATE` appearing as top chunk for a WA JobSeeker user). This wastes 2-3 of the 4 context slots with irrelevant content.

### Fix
In `prepareTurn` before the `queryCorpus` call, filter `relevantSchemeIds` to exclude NSW-council scheme IDs when the user's state is confirmed non-NSW.

```ts
const NSW_COUNCIL_SCHEMES = new Set([
  'COUNCIL_SYDNEY_PENSIONER_RATES_REBATE',
  'COUNCIL_SYDNEY_RATES_HARDSHIP',
  'COUNCIL_BLACKTOWN_PENSIONER_RATES_REBATE',
  'COUNCIL_CANTERBURY_BANKSTOWN_PENSIONER_RATES_REBATE',
  'COUNCIL_CENTRAL_COAST_PENSIONER_RATES_REBATE',
  'COUNCIL_NORTHERN_BEACHES_PENSIONER_RATES_REBATE',
])

const filteredSchemeIds = merged.state && merged.state !== 'NSW'
  ? relevantSchemeIds.filter((id) => !NSW_COUNCIL_SCHEMES.has(id))
  : relevantSchemeIds
```

Pass `filteredSchemeIds` to `queryCorpus` instead of `relevantSchemeIds`.

---

## Fix 7 — Prevent bot from echoing then re-asking a known value (low, small)

### Problem
When extraction fails on a variable the bot just heard, the bot acknowledges the value ("About $25,000 a year from super") and then immediately asks "What is your approximate annual income?" This confuses users.

### Fix
Add to STYLE RULES in `buildSystemPrompt`:

```
- If you are asking for a variable the user appears to have stated earlier in this response but the system still needs confirmed — do NOT echo the value back and then ask for it again. Ask the question only, or rephrase to seek confirmation: "Just to nail down the income figure — was that $25,000 a year you mentioned?"
```

---

## Files changed summary

| File | Fixes |
|---|---|
| `apps/web/lib/orchestrator/profile.ts` | Fix 1: `TenureType` |
| `apps/web/lib/orchestrator/extract.ts` | Fixes 1, 3: schema enum + income examples |
| `apps/web/lib/orchestrator/turn.ts` | Fixes 1, 2, 4, 5, 6, 7: chip mapper, normaliser, suburb lookup, skip trigger, handoff block, style rule |
| `apps/web/scripts/simulator/personas.ts` | Fix 1: persona `tenure_type` values |
| `apps/web/__tests__/` | New tests for Fix 1 (enum), Fix 2 (suburb lookup) |

---

## Priority order for implementation

1. Fix 1 (`tenure_type` enum) — critical, 30 min, unblocks 7 failing conversations
2. Fix 2 (suburb-to-LGA) — critical, 60 min, unblocks Sydney council scenarios
3. Fix 3 (income extraction) — high, 30 min, eliminates the dominant reask loop pattern
4. Fix 4 (verified context summary) — high, 60 min, structurally closes LLM history backdoor
5. Fix 5 (orchestrator handoff message) — medium, 45 min, removes LLM from handoff entirely
6. Fix 6 (state-based chunk filter) — medium, 20 min
7. Fix 7 (echo-then-ask style rule) — low, 5 min

Fixes 1-4 together eliminate all 7 critical and ~18 of the 22 high findings. Fixes 5-7 are polish.
