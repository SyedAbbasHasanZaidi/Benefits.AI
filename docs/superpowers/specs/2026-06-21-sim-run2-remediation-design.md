# Simulator Run 2 — Remediation Design Spec

**Date:** 2026-06-21
**Status:** Approved for implementation
**Source:** 63-conversation untested-persona run (21 personas × L3/L4/L5)

---

## Context

Run 2 tested 21 personas not covered in Run 1. Run 1 fixes (tenure_type enum, suburb-to-LGA lookup, verified context summary, orchestrator handoff) resolved the structural issues. Run 2 exposed a different failure category: **OpenFisca formula gaps** — rules that are either factually wrong or incomplete for edge cases — plus one orchestrator priority failure and two extraction gaps.

---

## Fix 1 — RENT_ASSISTANCE formula: add `boarding` as valid tenure (critical, small)

### Problem
The `RENT_ASSISTANCE` OpenFisca formula evaluates:
```python
is_renting = person("tenure_type", period) == "renting"
```
`tenure_type: "boarding"` always evaluates to `False`. All 3 boarding-house conversations failed at every disruption level with the same trace: `{result: false, inputs: {tenure_type: "boarding"}}`. The ground truth is correct — Services Australia does provide Rent Assistance to approved boarders who pay regular rent to a private landlord.

### Fix
In `apps/rules/openfisca_au/variables/federal/rent_assistance.py`, extend the renting check:
```python
is_renting = (
    (person("tenure_type", period) == "renting") |
    (person("tenure_type", period) == "boarding")
)
```

Add a pytest case to `apps/rules/tests/test_federal_schemes.py` confirming a boarding-house persona at $400/fortnight qualifies.

---

## Fix 2 — JOBSEEKER formula: handle underemployed `employed` status (critical, medium)

### Problem
The JOBSEEKER formula checks `employment_status in ['unemployed', 'part_time']`. The `JOBSEEKER-eligible-part-time-low-hours` persona has `employment_status: 'employed'` and `hours_worked_per_week: 10`. The extractor correctly sets `'employed'` (the user IS employed, just at low hours). The formula has no branch for `employed AND hours < threshold`, so it returns ineligible.

Two valid approaches:

**Option A — Fix the extractor:** When the user is employed but works fewer than 20 hours/week AND is actively seeking more work, extract `employment_status: 'part_time'` instead of `'employed'`. This is the correct Centrelink classification — underemployed workers are categorised as part-time for payment purposes.

**Option B — Fix the formula:** Add `(status == 'employed') & (hours_worked_per_week < parameters.jobseeker.max_hours)` branch.

**Recommended: Option A.** The TypeScript extraction layer is the right place to apply Centrelink's classification rules. The formula should remain clean. The extractor already has examples for `employment_status` — adding a rule for the underemployed case is the minimal change.

### Fix
In `apps/web/lib/orchestrator/extract.ts`, add Example 15:
```
Example 15 — underemployed: employed but working fewer than 20 hours/week AND seeking more work:
User: "I work about 10 hours a week at the petrol station, looking for more."
Output: {"employment_status":"part_time","hours_worked_per_week":10}
User: "Got a casual gig, maybe 8 hours, nowhere near enough to live on."
Output: {"employment_status":"part_time","hours_worked_per_week":8}
Note: only set 'part_time' when user indicates they want or need more work. If they are content with low hours (e.g. semi-retired), set 'employed'.
```

Add a pytest case with `employment_status: 'part_time'` and `hours_worked_per_week: 10` confirming JOBSEEKER eligibility.

---

## Fix 3 — NSW_LOW_INCOME_HOUSEHOLD_REBATE: fix OpenFisca OR-branch evaluation (high, medium)

### Problem
The rebate formula uses:
```python
has_qualifying_card = has_pcc | has_lihcc
```
OpenFisca evaluates both branches of `|` simultaneously (vectorised computation). `has_pcc` depends only on `age_pension_eligible` (true for retired 72-year-old). `has_lihcc` requires `number_of_children`. OpenFisca cannot short-circuit — it reports `number_of_children` as missing even when `has_pcc` already satisfies the OR condition. Result: AGE_PENSION triggers handoff at turn 1 for a pensioner persona, but NSW_LOW_INCOME remains stuck on `number_of_children` and is never resolved.

### Fix
Pre-compute `has_qualifying_card` as an explicit intermediate variable in the OpenFisca system that guards the LIHCC branch:

```python
# apps/rules/openfisca_au/variables/nsw/low_income_rebate.py
# Replace the inline OR with a pre-computed guard

class nsw_has_qualifying_concession_card(Variable):
    """True if person holds any qualifying concession card for NSW rebates."""
    ...
    def formula(person, period, parameters):
        has_pcc = person("has_pensioner_concession_card", period)
        # Only evaluate LIHCC if PCC is not already satisfied
        has_lihcc = where(has_pcc, False, person("low_income_health_care_card", period))
        return has_pcc | has_lihcc
```

Using `where(condition, true_val, false_val)` prevents OpenFisca from evaluating the LIHCC branch (and its `number_of_children` dependency) when PCC is already true.

---

## Fix 4 — NSW_SENIORS_CARD: infer `hours_worked_per_week: 0` from retirement (high, small)

### Problem
The NSW Seniors Card formula requires `hours_worked_per_week <= max_hours`. For a fully retired person, the correct value is `0`, which satisfies the condition. But the extractor never infers `hours_worked_per_week` from `employment_status: 'retired'` — it only extracts explicit numeric values. The fully-retired persona never provides a number because retired people don't think in terms of "hours worked per week." Result: `hours_worked_per_week` stays missing, the card is never evaluated, and the conversation ends on AGE_PENSION handoff.

### Fix
In `apps/web/lib/orchestrator/extract.ts`, add to the extraction rules:

```
Example 16 — retired persons implicitly work 0 hours:
User: "I'm fully retired, haven't worked since 2019."
Output: {"employment_status":"retired","hours_worked_per_week":0}
User: "Retired four years ago, not working at all."
Output: {"employment_status":"retired","hours_worked_per_week":0}
Note: when employment_status is 'retired', hours_worked_per_week is implicitly 0 unless the user mentions occasional paid work.
```

---

## Fix 5 — Orchestrator: elevate `rent_paid_fortnightly` priority when renting (medium, small)

### Problem
When `tenure_type: 'renting'` is already in the profile, `rent_paid_fortnightly` is the single variable needed to unlock RENT_ASSISTANCE. The current question-priority algorithm picks the variable missing from the most `needs_info` schemes (greedy). `rent_paid_fortnightly` only blocks one scheme (RENT_ASSISTANCE), so it scores low and is perpetually deprioritised behind income, age, residency, and partner questions. In the `single-mum-renting` L4/L5 cases, 7 turns passed without `rent_paid_fortnightly` ever being asked.

### Fix
In `apps/web/lib/orchestrator/turn.ts`, add a **Tier 1.5** between the baseline order and scheme-intent tiers in `pickNextQuestion`:

```ts
// Tier 1.5 — one-variable-away: if a single variable would unlock a scheme
// that is otherwise fully satisfied, ask it immediately.
for (const ni of eligibility.needs_info) {
  if (ni.missingVars.length === 1) {
    const v = ni.missingVars[0] as keyof ProfileVariables
    if (!(v in mergedProfile) && !onCooldown(v)) {
      return buildQuestion(v)
    }
  }
}
```

This fires before the greedy tier. When a scheme is one variable away, that variable becomes the next question regardless of how many other schemes it unlocks.

---

## Fix 6 — Zero-income: revise the rule + add `$0` chip (medium, small)

### Problem
The extraction prompt's Example 14 note says "Only set `annual_income` when a specific figure is given." This is the wrong rule — zero IS a specific figure. The LLM already understands "got nothing coming in" means zero; the rule was blocking what the model would naturally do correctly. Adding phrase examples would be brittle (whack-a-mole against every informal zero expression). The rule itself needs revisiting.

### Fix

**Part A — Revise the rule in Example 14 (`extract.ts`):**

Replace the note with a principle that draws the correct boundary:

```
Note: Zero is a specific figure. Set annual_income:0 when the user CLEARLY states they
have no income at all. Do NOT set it when the amount is vague or uncertain.
Boundary: CLEAR ZERO ("nothing at all", "zero", "nil") → annual_income:0.
          VAGUE LOW AMOUNT ("not much", "a little", "some casual work") → omit.
          When in doubt, omit.
```

The LLM generalises from this principle — no phrase list needed.

**Part B — Add `$0` chip to `annual_income` (`turn.ts`):**

```ts
annual_income: ['$0', 'Under $25k', '$25–45k', '$45–80k', '$80–120k', '$120k+'],
```

`parseBracketChip` already handles `'$0'` correctly (strips `$` → `'0'` → returns `0`). Gives users an explicit zero-income confirmation path without relying on the extractor at all.

---

## Fix 7 — Handoff response: include corpus action step (low, small)

### Problem
The orchestrator-built handoff message is thin when corpus chunks are available. Example: "Based on everything you've shared, you appear eligible for NSW_EAPA. Your eligibility meter on screen has your full results. For NSW_EAPA: [full How-to-apply corpus text]" — this works when the regex extracts the section, but for schemes with no match (LIHCC corpus uses different heading format), the body falls back to "Check your eligibility meter on screen for next steps" with zero scheme-specific information.

### Fix
In `apps/web/lib/orchestrator/turn.ts`, `buildHandoffMessage()`: improve the regex to handle multiple heading formats, and add a fallback that at minimum states the scheme name and delivery channel:

```ts
// Try multiple heading patterns for How to apply
const match = chunk.match(
  /(?:##\s*How to apply|##\s*Applying|##\s*Next steps?)\s*\r?\n+([\s\S]*?)(?=\r?\n##|$)/i
)
```

---

## Files changed

| File | Fixes |
|---|---|
| `apps/rules/openfisca_au/variables/federal/rent_assistance.py` | Fix 1: add boarding |
| `apps/rules/tests/test_federal_schemes.py` | Fix 1: boarding test case |
| `apps/web/lib/orchestrator/extract.ts` | Fixes 2, 4, 6: three new examples |
| `apps/rules/openfisca_au/variables/nsw/low_income_rebate.py` | Fix 3: OR-branch guard |
| `apps/web/lib/orchestrator/turn.ts` | Fixes 5, 7: one-variable-away tier + handoff regex |
| `apps/rules/tests/test_federal_schemes.py` | Fix 2: part_time jobseeker case |
| `apps/rules/tests/test_nsw_schemes.py` | Fix 3: pensioner rebate case |

---

## Priority order

1. Fix 1 (RENT_ASSISTANCE boarding) — critical, 20 min, rules engine
2. Fix 2 (JOBSEEKER part-time extraction) — critical, 20 min, extraction prompt
3. Fix 3 (NSW_LOW_INCOME OR-branch) — high, 45 min, OpenFisca restructure
4. Fix 4 (NSW_SENIORS_CARD retirement inference) — high, 15 min, extraction prompt
5. Fix 5 (one-variable-away priority tier) — medium, 30 min, orchestrator
6. Fix 6 (zero-income extraction) — medium, 15 min, extraction prompt
7. Fix 7 (handoff corpus regex) — low, 10 min, turn.ts
