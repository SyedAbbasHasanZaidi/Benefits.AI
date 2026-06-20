# Orchestrator Mode System — Design Spec

**Date:** 2026-06-20
**Status:** Approved for implementation

---

## Context

The guiding architectural principle of Benefits.AI is:

> **The LLM is a natural language generator only. The orchestrator owns all decisions.**

An audit of `buildSystemPrompt` in `apps/web/lib/orchestrator/turn.ts` found three remaining decision leaks — instructions that ask the LLM to make control-flow decisions rather than just generate language:

| Leak | Current location | Problem |
|---|---|---|
| "Stop asking when a scheme is eligible" | LLM system prompt rule | LLM reads eligibility JSON and decides to pivot behaviour |
| "Handle contradictions — ask clarifying question" | LLM system prompt rule | LLM decides whether a contradiction exists and what to do |
| "Ask at most one question, don't swap the topic" | LLM system prompt rule | Defensive rule against LLM deviation; redundant if orchestrator is trusted |

This spec describes the Mode System that eliminates all three leaks.

---

## Design

### Core Idea: Modes

The orchestrator computes a `ConversationMode` each turn and injects it into the system prompt. The LLM does not choose its mode — it reads it and follows the corresponding language block.

```
type ConversationMode = 'collecting_info' | 'handoff' | 'contradiction'
```

| Mode | Trigger (orchestrator decides) | LLM instruction |
|---|---|---|
| `collecting_info` | Default — no eligible schemes, no contradictions | Ask exactly this question: [nextQuestion] |
| `handoff` | `eligible.length > 0` | Explain results, direct to meter, no more questions |
| `contradiction` | Extraction conflicts with existing profile field | Ask which value is correct, name both, nothing else |

### System Prompt Structure (after)

```
[IDENTITY]
You are Benefits.AI. Your role is to generate natural language only.
All decisions have been made by the orchestrator.

[UNIVERSAL STYLE RULES — apply in every mode]
- Warm, conversational, knowledgeable friend
- Acknowledge one specific thing from the user's last message
- BANNED HOLLOW OPENERS: [list]
- BANNED FAKE-NOTED OPENERS: [list]
- No em dashes
- Plain prose, no markdown
- Use "you appear eligible" / "you may qualify" — never definitive
- Cite [SCHEME_ID] for factual claims; refuse to guess if not in sources

[PROFILE + ELIGIBILITY + SOURCES]
(same as current — always injected)

[MODE: <mode>]

collecting_info →
  Acknowledge what the user just said. Ask EXACTLY this question, nothing else:
  "<nextQuestion.question>"

handoff →
  The system has confirmed eligibility for at least one program. Do not ask
  any more questions. Direct the user to the eligibility meter on screen.
  For each eligible scheme, explain the next step using the official sources.

contradiction →
  The user's latest message conflicts with what is on file:
  <contradiction details — variable, old value, new value>
  Ask one short, friendly question to clarify which is correct.
  Name both values explicitly. No other questions.
```

### Orchestrator Changes (prepareTurn)

#### 1. Contradiction Detection

Run before merging `extractedDelta` into the profile. A contradiction exists when the extractor returned a value for a key that **already exists in the profile** with a **different value**, and the key was **not set by a chip** (chips are always authoritative).

```
contradictions = []
for each (key, newValue) in extractedDelta:
  if key was set by chipDelta → skip (chip overrides, no conflict)
  if key exists in profileWithChip AND profileWithChip[key] !== newValue:
    contradictions.push({ variable: key, previous: profileWithChip[key], extracted: newValue })
```

**When contradiction detected:**
- Remove contradicted keys from `extractedDelta` before merging (keep old values in profile)
- Set `mode = 'contradiction'`
- `nextQuestion = null` (LLM handles the turn via mode block, not a slot question)
- `chips = []` (no chips in contradiction turns — user types their clarification)

#### 2. Stop-When-Eligible (handoff)

After calling the rules engine and getting `eligibility`:

```
if eligibility.eligible.length > 0:
  mode = 'handoff'
  nextQuestion = null   ← skip pickNextQuestion entirely
```

This replaces the system prompt rule "stop the question loop the moment a scheme is eligible."

#### 3. Mode priority

```
if contradictions.length > 0  → mode = 'contradiction'
else if eligible.length > 0   → mode = 'handoff'
else                           → mode = 'collecting_info'
```

Contradictions take highest priority because an unresolved contradiction makes further slot-filling unreliable.

#### 4. Remove from system prompt

The following rules are removed from `buildSystemPrompt` because the orchestrator now owns them:

- `"Ask AT MOST ONE question per response... Do NOT swap it for a different topic"`
- `"Stop the question loop the moment a scheme is eligible..."`
- `"If the user's reply is random or contradicts something in the profile JSON, gently flag it..."`
- The generic `"All questions have been answered. Summarise the results clearly."` fallback (replaced by explicit mode blocks)

### New Types

```ts
// in turn.ts
export type ConversationMode = 'collecting_info' | 'handoff' | 'contradiction'

export interface ContradictionDetail {
  variable: string
  previous: unknown
  extracted: unknown
}

// added to TurnContext
mode: ConversationMode
contradictions: ContradictionDetail[]
```

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/lib/orchestrator/turn.ts` | Add `ConversationMode`, `ContradictionDetail` types; add contradiction detection logic in `prepareTurn`; add mode determination; update `buildSystemPrompt` signature and body; add `mode` + `contradictions` to `TurnContext` return |
| `apps/web/lib/orchestrator/turn.ts` | `pickNextQuestion` call is now skipped (returns null) when mode is handoff or contradiction |

No changes required to `route.ts`, `ChatPage.tsx`, or any test files — `TurnContext` additions are additive.

---

## What the LLM Retains

After this change the LLM is responsible for:

- Phrasing the question naturally (not just reading it verbatim)
- Acknowledging one specific thing from the user's last message
- Generating handoff copy using official sources
- Generating the contradiction clarification question
- Tone, style, citation discipline

All of these are language generation tasks. No control-flow decisions remain.

---

## Verification

1. **Typecheck**: `pnpm --filter web typecheck` — clean
2. **Unit tests**: `pnpm --filter web test` — all pass (TurnContext additions are additive)
3. **Eligible scenario**: chat to eligibility, verify LLM pivots to handoff copy and stops asking questions without any prompt instruction to do so
4. **Contradiction scenario**: provide a value (e.g. age 45), then later say 60 — verify profile keeps 45, LLM asks "you mentioned 45 earlier but just said 60, which is correct?", chips empty
5. **Collecting-info scenario**: normal conversation flow — verify question progression unchanged
