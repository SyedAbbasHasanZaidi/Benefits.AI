# Simulator Run 2 — Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 root causes found in the 63-conversation untested-persona simulator run (Run 2). Primarily OpenFisca formula bugs plus orchestrator priority and extraction prompt fixes.

**Architecture:** Fixes span two layers — Python/OpenFisca rules engine (`apps/rules/`) and TypeScript orchestrator (`apps/web/lib/orchestrator/`). Each task is independently testable.

**Tech Stack:** Python 3.12, OpenFisca-core, pytest; TypeScript, Vitest

**Reference spec:** `docs/superpowers/specs/2026-06-21-sim-run2-remediation-design.md`

---

## Task 1: Fix RENT_ASSISTANCE formula — add `boarding` as valid tenure

**Files:**
- Modify: `apps/rules/openfisca_au/variables/federal/rent_assistance.py`
- Modify: `apps/rules/tests/test_federal_schemes.py`

- [ ] **Step 1: Find the formula**

Read `apps/rules/openfisca_au/variables/federal/rent_assistance.py` and locate the `is_renting` or `tenure_type` check.

- [ ] **Step 2: Write the failing pytest**

In `apps/rules/tests/test_federal_schemes.py`, add:

```python
def test_rent_assistance_boarding_eligible(client):
    """Boarders who pay regular rent qualify for Rent Assistance."""
    result = client.post("/calculate", json={"variables": {
        "is_australian_resident": True,
        "tenure_type": "boarding",
        "rent_paid_fortnightly": 400,
    }}).json()
    assert "RENT_ASSISTANCE" in result["eligible"]
```

Run: `pytest apps/rules/tests/test_federal_schemes.py::test_rent_assistance_boarding_eligible -v`
Expected: FAIL — RENT_ASSISTANCE not in eligible.

- [ ] **Step 3: Fix the formula**

Find the line checking `tenure_type == "renting"` and extend it:

```python
is_renting = (
    (person("tenure_type", period) == "renting") |
    (person("tenure_type", period) == "boarding")
)
```

- [ ] **Step 4: Run the test**

```
pytest apps/rules/tests/test_federal_schemes.py::test_rent_assistance_boarding_eligible -v
```
Expected: PASS.

- [ ] **Step 5: Run full pytest suite**

```
pytest apps/rules/tests -v
```
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```
git add apps/rules/openfisca_au/variables/federal/rent_assistance.py apps/rules/tests/test_federal_schemes.py
git commit -m "fix(rules): RENT_ASSISTANCE — add boarding as valid tenure type alongside renting"
```

---

## Task 2: Fix JOBSEEKER extraction — underemployed maps to `part_time`

**Files:**
- Modify: `apps/web/lib/orchestrator/extract.ts` — add Example 15
- Modify: `apps/rules/tests/test_federal_schemes.py` — add part_time test

- [ ] **Step 1: Add pytest to confirm part_time is already eligible**

```python
def test_jobseeker_part_time_eligible(client):
    """Underemployed part-time workers qualify for JobSeeker."""
    result = client.post("/calculate", json={"variables": {
        "is_australian_resident": True,
        "age": 45,
        "employment_status": "part_time",
        "hours_worked_per_week": 10,
        "annual_income": 15000,
    }}).json()
    assert "JOBSEEKER" in result["eligible"]
```

Run: `pytest apps/rules/tests/test_federal_schemes.py::test_jobseeker_part_time_eligible -v`
Expected: PASS (confirming formula handles part_time correctly already).

- [ ] **Step 2: Add Example 15 to `extract.ts`**

After Example 14, add:

```
Example 15 — underemployed: employed but working fewer than ~20 hours/week AND seeking more work. Use 'part_time' not 'employed':
User: "I work about 10 hours a week at the petrol station, looking for more."
Output: {"employment_status":"part_time","hours_worked_per_week":10}
User: "Got a casual gig, maybe 8 hours, nowhere near enough to live on."
Output: {"employment_status":"part_time","hours_worked_per_week":8}
User: "Just casual shifts here and there, maybe 12 hours, really need full time work."
Output: {"employment_status":"part_time","hours_worked_per_week":12}
Note: only set 'part_time' when user indicates they want or need more work. If content with low hours (e.g. a retiree doing 10hrs for company), set 'employed'.`
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter web typecheck
```
Expected: clean.

- [ ] **Step 4: Run TS test suite**

```
pnpm --filter web test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/orchestrator/extract.ts apps/rules/tests/test_federal_schemes.py
git commit -m "fix(extract): underemployed persons map to employment_status 'part_time' not 'employed'"
```

---

## Task 3: Fix NSW_LOW_INCOME_HOUSEHOLD_REBATE — OpenFisca OR-branch guard

**Files:**
- Modify: `apps/rules/openfisca_au/variables/nsw/low_income_rebate.py`
- Modify: `apps/rules/tests/test_nsw_schemes.py`

- [ ] **Step 1: Read the formula**

Read `apps/rules/openfisca_au/variables/nsw/low_income_rebate.py` to understand the current `has_qualifying_card` computation.

- [ ] **Step 2: Write the failing pytest**

```python
def test_nsw_low_income_rebate_pensioner_no_children(client):
    """Age pensioner qualifies for NSW Low Income Rebate without needing number_of_children."""
    result = client.post("/calculate", json={"variables": {
        "is_australian_resident": True,
        "state": "NSW",
        "age": 72,
        "employment_status": "retired",
        "annual_income": 22000,
    }}).json()
    assert "NSW_LOW_INCOME_HOUSEHOLD_REBATE" in result["eligible"]
```

Run: `pytest apps/rules/tests/test_nsw_schemes.py::test_nsw_low_income_rebate_pensioner_no_children -v`
Expected: FAIL — NSW_LOW_INCOME_HOUSEHOLD_REBATE not in eligible (blocked by number_of_children).

- [ ] **Step 3: Fix the formula**

In `low_income_rebate.py`, replace the inline OR with a guard using numpy `where`:

```python
from openfisca_core.periods import ETERNITY
import numpy as np

# Guard: only evaluate LIHCC branch if PCC is not satisfied
has_pcc = person("has_pensioner_concession_card", period)
has_lihcc = np.where(has_pcc, False, person("low_income_health_care_card", period))
has_qualifying_card = has_pcc | has_lihcc
```

If the file uses a different approach (e.g. a separate variable), adapt to match the existing pattern while achieving the same short-circuit effect.

- [ ] **Step 4: Run the test**

```
pytest apps/rules/tests/test_nsw_schemes.py::test_nsw_low_income_rebate_pensioner_no_children -v
```
Expected: PASS.

- [ ] **Step 5: Run full pytest suite**

```
pytest apps/rules/tests -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add apps/rules/openfisca_au/variables/nsw/low_income_rebate.py apps/rules/tests/test_nsw_schemes.py
git commit -m "fix(rules): NSW_LOW_INCOME_REBATE — guard LIHCC OR-branch so pensioners don't require number_of_children"
```

---

## Task 4: Fix NSW_SENIORS_CARD + zero-income — two extraction examples

**Files:**
- Modify: `apps/web/lib/orchestrator/extract.ts` — add Examples 16 and update Example 14

- [ ] **Step 1: Add Example 16 — retired implies zero hours**

After Example 15, add:

```
Example 16 — retired persons work 0 hours per week implicitly:
User: "I'm fully retired, haven't worked since 2019."
Output: {"employment_status":"retired","hours_worked_per_week":0}
User: "Retired four years ago, not working at all."
Output: {"employment_status":"retired","hours_worked_per_week":0}
User: "Stopped working completely last year."
Output: {"employment_status":"retired","hours_worked_per_week":0}
Note: set hours_worked_per_week:0 whenever employment_status is 'retired', unless the user mentions occasional paid work.`
```

- [ ] **Step 2: Extend Example 14 — informal zero-income expressions**

Find Example 14 (zero/nil income framing). Extend it to include informal zero expressions:

```
Example 14 (extended):
User: "no income coming in basically, just that small cash work"
Output: {"employment_status":"unemployed"}
User: "got nothin comin in atm"
Output: {"annual_income":0,"employment_status":"unemployed"}
User: "zero basically, like nothing at all"
Output: {"annual_income":0,"employment_status":"unemployed"}
User: "nil, nada, nothing"
Output: {"annual_income":0,"employment_status":"unemployed"}
User: "I'm not working at all right now"
Output: {"employment_status":"unemployed"}
Note: informal zero expressions ("nothin", "nil", "nada") map to annual_income:0 only when user clearly has no income at all. "Small cash work" without a figure is not sufficient — omit annual_income.`
```

- [ ] **Step 3: Typecheck + tests**

```
pnpm --filter web typecheck
pnpm --filter web test
```
Expected: clean, all pass.

- [ ] **Step 4: Commit**

```
git add apps/web/lib/orchestrator/extract.ts
git commit -m "fix(extract): infer hours_worked_per_week:0 from retirement; add informal zero-income expressions"
```

---

## Task 5: Orchestrator — one-variable-away priority tier

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — `pickNextQuestion` function

- [ ] **Step 1: Read the current pickNextQuestion tiers**

Read `apps/web/lib/orchestrator/turn.ts` from line 207 to ~260 to understand the current tier structure (Tier 1 baseline, Tier 2 scheme intent, Tier 3 greedy).

- [ ] **Step 2: Add Tier 1.5 between baseline and scheme-intent**

After the Tier 1 loop and before the Tier 2 block, add:

```ts
// Tier 1.5 — one-variable-away: if any needs_info scheme has exactly one
// missing variable, ask for it immediately. Prevents situations where a
// high-value scheme (e.g. RENT_ASSISTANCE) is perpetually deprioritised
// behind lower-priority variables with higher counts.
for (const ni of eligibility.needs_info) {
  if (ni.missingVars.length === 1) {
    const v = ni.missingVars[0] as keyof ProfileVariables
    if (!(v in mergedProfile) && stillNeeded.has(v) && !onCooldown(v)) {
      return buildQuestion(v)
    }
  }
}
```

- [ ] **Step 3: Write a unit test**

Add to `apps/web/__tests__/orchestrator-mode.test.ts` (or create `apps/web/__tests__/pick-next-question.test.ts`):

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmProvider } from '@/lib/llm/LlmProvider'

function mockLlm(extraction = {}): LlmProvider {
  return {
    generate: vi.fn().mockResolvedValue({ text: JSON.stringify(extraction) }),
    streamText: vi.fn().mockReturnValue(new ReadableStream()),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      eligible: [],
      ineligible: [],
      missing_variables: ['annual_income', 'rent_paid_fortnightly'],
      traces: {
        RENT_ASSISTANCE: { missing: ['rent_paid_fortnightly'] },  // one away
        JOBSEEKER:       { missing: ['annual_income'] },          // one away
        FTB_A:           { missing: ['annual_income', 'number_of_children'] }, // two away
      },
    }),
  }))
})

describe('pickNextQuestion — one-variable-away tier', () => {
  test('asks the single blocking variable before multi-missing schemes', async () => {
    // tenure_type already in profile so RENT_ASSISTANCE is one variable away
    const ctx = await prepareTurn(
      'I rent',
      { is_australian_resident: true, age: 30, employment_status: 'unemployed', tenure_type: 'renting' },
      [],
      mockLlm({ tenure_type: 'renting' }),
    )
    // rent_paid_fortnightly is the single variable blocking RENT_ASSISTANCE —
    // should be asked before annual_income (which blocks multiple schemes)
    expect(ctx.nextQuestion?.variable).toBe('rent_paid_fortnightly')
  })
})
```

- [ ] **Step 4: Run test to confirm it fails first**

```
pnpm --filter web test -- __tests__/pick-next-question
```
Expected: FAIL (before the tier is added).

After adding the tier, run again — Expected: PASS.

- [ ] **Step 5: Run full test suite**

```
pnpm --filter web test
pnpm --filter web typecheck
```
Expected: all pass, clean.

- [ ] **Step 6: Commit**

```
git add apps/web/lib/orchestrator/turn.ts apps/web/__tests__/pick-next-question.test.ts
git commit -m "feat(orchestrator): one-variable-away priority tier — ask single blocking variable immediately"
```

---

## Task 6: Handoff message — improve corpus heading regex

**Files:**
- Modify: `apps/web/lib/orchestrator/turn.ts` — `buildHandoffMessage()`

- [ ] **Step 1: Update the regex in `buildHandoffMessage`**

Find:
```ts
const match = chunk.match(/##\s*How to apply\s*\r?\n+([\s\S]*?)(?=\r?\n##|$)/)
```

Replace with a multi-pattern regex that covers common heading variations:
```ts
const match = chunk.match(
  /##\s*(?:How to apply|Applying|How to claim|Next steps?|What to do)\s*\r?\n+([\s\S]*?)(?=\r?\n##|$)/i
)
```

- [ ] **Step 2: Update handoff-message test to cover the fallback**

In `apps/web/__tests__/handoff-message.test.ts`, add a test for the alternative heading:

```ts
test('extracts apply step from alternative heading "How to claim"', () => {
  const chunk: CorpusChunk = {
    id: '2',
    scheme_id: 'LIHCC',
    chunk_text: '# LIHCC\n\n## Who can get it\n\n...\n\n## How to claim\n\nApply via myGov or call 132 490.',
    metadata: {},
    similarity: 0.85,
  }
  const msg = buildHandoffMessage(
    { eligible: ['LIHCC'], needs_info: [], ineligible: [] },
    [chunk],
  )
  expect(msg).toContain('myGov')
})
```

- [ ] **Step 3: Run tests + typecheck**

```
pnpm --filter web test
pnpm --filter web typecheck
```

- [ ] **Step 4: Commit**

```
git add apps/web/lib/orchestrator/turn.ts apps/web/__tests__/handoff-message.test.ts
git commit -m "fix: handoff message — broaden corpus heading regex to match 'How to claim', 'Next steps' variants"
```

---

## Final verification

- [ ] **Full TS test suite**

```
pnpm --filter web test
```

- [ ] **Full Python test suite**

```
cd apps/rules && pytest tests -v
```

- [ ] **Spot-run boarding-house persona**

```
pnpm --filter web run sim -- --persona RENT_ASSISTANCE-eligible-boarding-house --level 0
```
Expected: `match=true` in 1-2 turns.

- [ ] **Spot-run part-time JobSeeker persona**

```
pnpm --filter web run sim -- --persona JOBSEEKER-eligible-part-time-low-hours --level 0
```
Expected: `match=true`.

- [ ] **Spot-run NSW Seniors Card fully retired**

```
pnpm --filter web run sim -- --persona NSW_SENIORS_CARD-eligible-fully-retired --level 0
```
Expected: `match=true`.

- [ ] **Spot-run NSW Low Income pensioner**

```
pnpm --filter web run sim -- --persona NSW_LOW_INCOME_REBATE-eligible-pensioner --level 0
```
Expected: `match=true`.
