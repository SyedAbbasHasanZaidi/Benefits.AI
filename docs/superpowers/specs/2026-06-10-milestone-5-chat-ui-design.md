# Milestone 5: Chat UI Design Spec

**Date:** 2026-06-10  
**Status:** Approved  
**Milestone:** 5 — Conversational Front-End + Orchestrator + Retriever

---

## Context

The rules engine (Milestones 3–4) can evaluate 27 schemes across federal, NSW state, and 5 council tiers. Nothing surfaces those results to a user yet. The landing page has a "Check my entitlements" CTA pointing to `/chat` — a route that doesn't exist.

Milestone 5 wires the front-end to the engine: a ChatGPT-style chat page where users describe their situation in plain English, the system builds a profile, calls the eligibility engine, and presents actionable results — including inline how-to-apply steps so users can immediately act on what they find.

The core product insight driving this design: **awareness alone is not enough**. The information gap between "you might qualify" and "here is exactly how to claim it" is where most Australians fall through. Every eligible scheme card must close that gap.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Page layout | Chat + collapsible results drawer | Chat stays primary; results always accessible without a separate page |
| Conversation style | Open intake → LLM extraction → targeted follow-ups | Fastest path to results; mirrors how people naturally describe themselves |
| Follow-up questions | Quick-reply chips for binary/closed questions | Reduces friction for yes/no and enum inputs (state, tenure type, etc.) |
| Results presentation | Count summary row + rich scheme cards | Eligible/needs-info/not-eligible counts at a glance, actionable details on demand |
| Scheme card depth | Inline "How to Claim" steps + "Ask me more" | Closes the awareness → action gap in-page |
| "Needs info" cards | Hook back to chat with pre-loaded question | Dead-end labels replaced by conversational action |
| Explanations | RAG corpus via Voyage + pgvector | Accurate, citation-backed answers from curated authoritative docs |
| Session | In-memory React state, fresh each visit | Auth + DB persistence deferred to a later milestone |
| Theme | Dark (consistent with mockups) | Established in brainstorm; can be revisited |

---

## System Overview

```
+---------------------------+          +---------------------------+
|      /chat  (browser)     |          |   Rules Service (Python)  |
|                           |          |   localhost:8001          |
|  ChatPage                 |          |                           |
|  ├── ResultsDrawer        |          |  POST /calculate          |
|  ├── MessageList          |          |  GET  /schemes            |
|  ├── QuickReplyChips      |          +---------------------------+
|  └── ChatInput            |                     ▲
|            │ POST stream  |                     │
+---------------------------+                     │
             │                                    │
             ▼                                    │
+---------------------------+          +---------------------------+
|   /api/chat  (Next.js)    |          |   Supabase pgvector       |
|   Route Handler           |   embed  |   corpus_chunks table     |
|                           |────────▶|                           |
|  orchestrator/turn.ts     |◀────────|   (Voyage voyage-3)       |
|  ├── extract.ts  (LLM)    |  chunks  +---------------------------+
|  ├── profile.ts  (state)  |
|  └── retriever/query.ts   |
+---------------------------+
```

---

## Components

### `app/chat/page.tsx`
The `/chat` route. Client component. Holds all in-memory state:
- `messages: Message[]` — chat history
- `profile: Partial<ProfileVariables>` — accumulated variable values
- `eligibility: EligibilityResult | null` — latest `/calculate` response
- `drawerOpen: boolean`

Uses the Vercel AI SDK `useChat` hook for streaming. On each AI response, parses any embedded `[PROFILE_UPDATE]` and `[ELIGIBILITY]` JSON blocks out of the stream to update local state.

### `components/ResultsDrawer`
Sticky bar pinned below the nav. Shows `"✅ N schemes found"` when collapsed. On expand:
- **Count row**: Eligible (green) · Needs info (amber) · Not eligible (grey)
- **Scheme cards** (eligible first, then needs-info, ineligible hidden by default)

### `components/SchemeCard`
Each card renders differently by status:
- **Eligible**: green left border, scheme name + agency, collapsible "How to Claim" steps (2–3 steps from RAG corpus), "Go to [agency] →" external link, "Ask me more" button
- **Needs info**: amber left border, plain-English statement of the missing variable, "Answer in chat →" button that scrolls to input and injects a targeted follow-up message
- **Not eligible**: grey, collapsed, scheme name only

### `components/QuickReplyChips`
Rendered below the last AI message when the response includes a `[CHIPS]` block. Each chip is a button that submits its value as a user message. Always includes a "I'll type it" escape chip. Chips disappear after selection.

### `components/MessageBubble`
User messages: right-aligned blue bubble.  
AI messages: left-aligned dark bubble with AI avatar.  
Result inline cards: special styled card injected by the AI when first results arrive (summary only — full detail in the drawer).

---

## Orchestrator (`lib/orchestrator/`)

### `profile.ts`
```typescript
type ProfileVariables = {
  is_australian_resident?: boolean
  age?: number
  annual_income?: number
  state?: string
  council_lga?: string
  tenure_type?: string
  rent_paid_fortnightly?: number
  number_of_children?: number
  youngest_child_age?: number
  has_partner?: boolean
  employment_status?: string
  hours_worked_per_week?: number
  has_disability?: boolean
  is_carer?: boolean
  has_financial_hardship?: boolean
  uses_life_support_equipment?: boolean
}
```
Simple typed record. Merged incrementally as the LLM extracts values. Persisted in React state client-side.

### `extract.ts`
Single LLM call (non-streaming, `generate()` from `BedrockClaudeProvider`) with a structured extraction prompt. Input: raw user message + current profile. Output: JSON diff of newly extracted variables. The extraction prompt enumerates all 16 variable names and their types so the LLM cannot invent new ones (schema-locked, consistent with the existing design pattern).

### `turn.ts` — the core orchestration loop

```
turn(userMessage, currentProfile, conversationHistory):
  1. extract(userMessage, currentProfile) → profileDelta
  2. mergedProfile = merge(currentProfile, profileDelta)
  3. rulesResult = POST /api/rules/calculate { variables: mergedProfile }
  4. missingVars = rulesResult.missing_variables
  5. nextQuestion = pickNextQuestion(missingVars, mergedProfile)
  6. corpusChunks = retriever.query(userMessage + nextQuestion, topK=4)
  7. stream LLM response(
       system: buildSystemPrompt(mergedProfile, rulesResult, corpusChunks),
       history: conversationHistory,
       chips: chipHintsFor(nextQuestion)   // null if not a binary question
     )
  8. Return profileDelta + eligibilityResult as Vercel AI SDK StreamData
     alongside the text stream so the client can update React state
```

`pickNextQuestion` prioritises variables that would unlock the most schemes still in `missing_variables`. It returns a natural-language question string + optional chip hints.

**Binary chip triggers** (always render chips): `is_australian_resident`, `has_disability`, `is_carer`, `has_partner`, `has_financial_hardship`, `uses_life_support_equipment`  
**Enum chip triggers** (render chips): `tenure_type`, `employment_status`, `state`  
**Numeric inputs** (no chips, free text): `age`, `annual_income`, `rent_paid_fortnightly`, `number_of_children`, `youngest_child_age`, `hours_worked_per_week`

---

## Retriever (`lib/retriever/`)

### `embed.ts`
Wraps the `voyageai` SDK. Exports `embedText(text: string): Promise<number[]>`. Uses `voyage-3` model. Called once per turn for the query vector.

### `query.ts`
Queries Supabase `corpus_chunks` table via pgvector cosine similarity. Returns top-K chunks (default 4) filtered optionally by `scheme_id`. Used in two contexts:
1. **Turn context** — broad query over all schemes to inform the LLM's response
2. **"Ask me more"** — scheme-scoped query for deep-dive answers about a specific scheme

The `corpus_chunks` table must exist in Supabase with columns: `id`, `scheme_id`, `content`, `embedding vector(1024)`, `metadata jsonb`. The ingest script (`scripts/ingest_corpus.py`) already populates it.

---

## API Route (`app/api/chat/route.ts`)

`POST /api/chat`  
Body: `{ messages: Message[], profile: ProfileVariables }`  
Response: `text/event-stream` (Vercel AI SDK streaming format)

The route:
1. Reconstructs conversation context from `messages`
2. Calls `turn()` from the orchestrator
3. Streams the text response using Vercel AI SDK `streamText`
4. Sends structured side-channel data (profileDelta, eligibility) via Vercel AI SDK `StreamData` so the client updates React state without parsing magic tokens from the prose stream. Chip hints are communicated via `StreamData` as well — the client renders `QuickReplyChips` when the latest data message contains a `chips` field.

---

## Data Flow: Full Turn Lifecycle

```
User types "I'm 68, retired, renting in Sydney for $400/fn"
         │
         ▼
/api/chat receives { messages, profile:{} }
         │
         ▼
extract.ts ──LLM──▶ { age:68, employment_status:"retired",
                       tenure_type:"renting", state:"NSW",
                       rent_paid_fortnightly:400 }
         │
         ▼
POST /api/rules/calculate
  ──▶ { eligible:["AGE_PENSION","NSW_SENIORS_CARD","NSW_LOW_INCOME_HOUSEHOLD_REBATE",
                  "NSW_GAS_REBATE","RENT_ASSISTANCE"],
        missing_variables:["is_australian_resident","has_disability",...] }
         │
         ▼
pickNextQuestion(missing) ──▶ "Are you an Australian resident?"
                               chips: ["Yes","No"]
         │
         ▼
retriever.query("68 retired renting Sydney Are you an Australian resident?", topK=4)
  ──▶ [corpus chunks about Age Pension, Rent Assistance, Seniors Card...]
         │
         ▼
LLM stream (text) ──▶ "Found 5 possible schemes for you!
                       One quick question — are you an Australian resident?"

StreamData (side-channel) ──▶ {
  profileDelta: { age:68, employment_status:"retired", ... },
  eligibility: { eligible:[...], ineligible:[...], missing_variables:[...] },
  chips: ["Yes", "No", "I'll type it"]
}
         │
         ▼
Client merges StreamData:
  - Renders AI message bubble (prose only, no tokens)
  - profileDelta → merges into profile React state
  - eligibility → updates ResultsDrawer (5 cards appear)
  - chips → renders QuickReplyChips below message
```

---

## File Map

**New files:**
- `apps/web/app/chat/page.tsx`
- `apps/web/app/api/chat/route.ts`
- `apps/web/components/ChatPage.tsx`
- `apps/web/components/MessageList.tsx`
- `apps/web/components/MessageBubble.tsx`
- `apps/web/components/QuickReplyChips.tsx`
- `apps/web/components/ResultsDrawer.tsx`
- `apps/web/components/SchemeCard.tsx`
- `apps/web/lib/orchestrator/profile.ts`
- `apps/web/lib/orchestrator/extract.ts`
- `apps/web/lib/orchestrator/turn.ts`
- `apps/web/lib/retriever/embed.ts`
- `apps/web/lib/retriever/query.ts`

**Modified files:**
- `apps/web/lib/llm/BedrockClaudeProvider.ts` — no functional changes needed; `generate()` handles extraction (already implemented), `streamText()` handles chat responses (already implemented)

---

## Verification

1. `pnpm --filter web dev` — dev server starts on port 3000
2. Navigate to `http://localhost:3000` — landing page loads, CTA links to `/chat`
3. Navigate to `/chat` — chat page renders, welcome message appears
4. Type: *"I'm 68, retired, renting in Sydney for $400 a fortnight"*
   - AI extracts: age, employment_status, tenure_type, state, rent_paid_fortnightly
   - ResultsDrawer bar appears: "✅ 5 schemes found"
   - Follow-up question appears with Yes/No chips
5. Click "Yes" chip for Australian resident
   - Profile updates, eligibility re-runs
   - Drawer updates counts
6. Open drawer — verify: count row, scheme cards with green/amber borders, "How to Claim" steps on Age Pension card, "Answer in chat →" on any needs-info card
7. Click "Ask me more" on Age Pension — AI responds with corpus-backed detail
8. Click "Answer in chat →" on a needs-info card — input scrolls into view with targeted question

**TypeScript check:** `pnpm --filter web typecheck` — no errors  
**Lint:** `pnpm --filter web lint` — no errors
