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

The prompt includes **four few-shot examples** chosen to cover the critical edge cases: noisy messages, implicit signals, chip responses, and the nothing-to-extract case. Examples are placed before the live input so the model sees the pattern before it has to apply it.

```
System:
You extract eligibility variables from a user message. Return ONLY a JSON object
containing variables you can extract with confidence. Omit variables that are not
clearly stated or strongly implied. Do not guess. Do not add keys outside this schema.

Schema (extract only these keys):
  is_australian_resident  boolean
  age                     number
  annual_income           number          (annual AUD)
  state                   string          (e.g. "NSW", "VIC")
  council_lga             string          (e.g. "Blacktown", "Sydney")
  tenure_type             "renting" | "owner" | "boarding"
  rent_paid_fortnightly   number          (AUD per fortnight)
  number_of_children      number
  youngest_child_age      number
  has_partner             boolean
  employment_status       "employed" | "retired" | "unemployed" | "student"
  hours_worked_per_week   number
  has_disability          boolean
  is_carer                boolean
  has_financial_hardship  boolean
  uses_life_support_equipment boolean

Current profile (already known — do NOT re-extract these):
{currentProfile}

---

Example 1 — explicit info mixed with irrelevant noise:
User: "I'm 68, retired, renting in Blacktown for $400 a fortnight. I love gardening."
Output: {"age":68,"employment_status":"retired","tenure_type":"renting","council_lga":"Blacktown","state":"NSW","rent_paid_fortnightly":400}

Example 2 — implicit signal ("on the pension" implies retired + likely age):
User: "I've been on the age pension for two years, I live alone in Victoria."
Output: {"employment_status":"retired","has_partner":false,"state":"VIC"}
Note: age is NOT extracted — "on the age pension" implies 67+ but the exact age is unconfirmed.

Example 3 — chip/short answer with no prose context (user clicked "Yes"):
User: "Yes"
Output: {}
Note: "Yes" has no extractable meaning without knowing which question it answers.
      The orchestrator handles chip answers separately before calling extract.

Example 4 — nothing extractable:
User: "What kind of help can I get?"
Output: {}

---

Now extract from:
User: {userMessage}
Output:
```

**Why these four examples:**
- Example 1 establishes the noise-filtering behaviour — irrelevant prose ("I love gardening") produces no keys.
- Example 2 establishes the implicit-but-not-certain rule — "on the pension" implies `employment_status` but not a specific `age` value, so age is withheld.
- Example 3 prevents the model from hallucinating meaning into chip responses; the orchestrator maps chip values to profile variables directly before calling `extract`.
- Example 4 sets the floor — an empty object is a valid and expected output.

### `turn.ts` — the core orchestration loop

```
turn(userMessage, currentProfile, conversationHistory):
  1. extract(userMessage, currentProfile) → profileDelta
  2. mergedProfile = merge(currentProfile, profileDelta)
  3. rulesResult = POST /api/rules/calculate { variables: mergedProfile }
  4. missingVars = rulesResult.missing_variables
  5. nextQuestion = pickNextQuestion(missingVars, mergedProfile, conversationHistory)
  6. corpusChunks = retriever.query(
       query: synthesiseQuery(mergedProfile, rulesResult.eligible + rulesResult.missing_variables),
       scheme_ids: rulesResult.eligible + rulesResult.missing_variables,
       topK=4
     )
     // synthesiseQuery builds a clean string from extracted variables + scheme IDs only.
     // Raw userMessage is never used as the query — noisy user prose degrades embedding quality.
  7. stream LLM response(
       system: buildSystemPrompt(mergedProfile, rulesResult, corpusChunks),
       history: conversationHistory,
       chips: chipHintsFor(nextQuestion)   // null if not a binary question
     )
  8. Return profileDelta + eligibilityResult as Vercel AI SDK StreamData
     alongside the text stream so the client can update React state
```

`pickNextQuestion` selects the next variable to ask about using a **three-tier priority order**:

**Tier 1 — Baseline variables (always asked first, in order)**
These are collected before any scheme-specific questions because they gate the largest number of schemes and define the user's fundamental eligibility surface. Asked in this fixed sequence regardless of what schemes are in play:
```
1. is_australian_resident   (gates almost everything)
2. age                      (gates Age Pension, Youth Allowance, many others)
3. employment_status        (gates JobSeeker, Carer Payment, etc.)
4. state                    (determines which state + council tier applies)
5. tenure_type              (gates Rent Assistance, housing concessions)
```
A baseline variable is skipped if already present in `mergedProfile`.

**Tier 2 — Scheme-intent mode (greedy suppressed)**
If the conversation history contains a user message that names or clearly refers to a specific scheme (e.g. "tell me about Age Pension", "am I eligible for the seniors card"), `pickNextQuestion` enters scheme-intent mode:
- Identifies the referenced scheme from a keyword/scheme-ID lookup against the conversation history
- Asks only the `missing_variables` for that scheme, in the order the rules engine returns them
- Does NOT greedily jump to variables that would unlock other schemes
- Exits scheme-intent mode once all that scheme's variables are filled or the user changes topic

**Tier 3 — Greedy (default)**
Once all baseline variables are collected and no scheme-intent is active, pick the missing variable that appears in the most schemes still in `missing_variables` (i.e. maximises schemes that could move from needs-info → eligible). Ties broken by the fixed baseline order above.

`pickNextQuestion` returns:
```typescript
{
  question: string
  variable: keyof ProfileVariables
  chips?: string[]           // includes "Not sure?" chip for any variable that has guidance
  guidance?: {
    explanation: string      // plain-English definition of what this variable means
    links: { label: string, url: string }[]  // official sources where user can find this info
  }
}
```

**Binary chip triggers** (always render chips): `is_australian_resident`, `has_disability`, `is_carer`, `has_partner`, `has_financial_hardship`, `uses_life_support_equipment`  
**Enum chip triggers** (render chips): `tenure_type`, `employment_status`, `state`  
**Numeric inputs** (no chips, free text): `age`, `annual_income`, `rent_paid_fortnightly`, `number_of_children`, `youngest_child_age`, `hours_worked_per_week`

**"Not sure?" chip**: Every question that has a `guidance` entry appends a "Not sure? →" chip alongside the normal chips (or alone for numeric inputs). Selecting it renders a `GuidanceCard` inline in the chat — NOT a new AI message — with the explanation and links. The profile variable remains unset; the same question is re-asked after the user reads the guidance.

### `VARIABLE_GUIDANCE` — static lookup map

Defined in `lib/orchestrator/guidance.ts`. Maps each variable to plain-English context and authoritative links. Variables the user is universally expected to know (`age`, `has_partner`, `number_of_children`) have no guidance entry and therefore no "Not sure?" chip.

```typescript
const VARIABLE_GUIDANCE: Partial<Record<keyof ProfileVariables, VariableGuidance>> = {

  is_australian_resident: {
    explanation: "This means you hold Australian citizenship, a permanent visa, or certain protected visas. Temporary visa holders generally don't qualify for Centrelink payments.",
    links: [
      { label: "Check your visa type — Home Affairs", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing" },
      { label: "Residence rules for payments — Services Australia", url: "https://www.servicesaustralia.gov.au/residence-descriptions" },
    ]
  },

  annual_income: {
    explanation: "Your total income before tax for the current financial year — including wages, investment income, and government payments. Centrelink uses your combined household income if you have a partner.",
    links: [
      { label: "View your income statement — myGov / ATO", url: "https://my.gov.au" },
      { label: "What counts as income — Services Australia", url: "https://www.servicesaustralia.gov.au/income-and-assets" },
    ]
  },

  council_lga: {
    explanation: "Your Local Government Area — the council responsible for where you live. This determines which council concession schemes you may qualify for.",
    links: [
      { label: "Find your LGA — Local Government Directory", url: "https://www.localgovernment.nsw.gov.au/find-your-council" },
      { label: "Find your council — NSW Government", url: "https://www.nsw.gov.au/find-your-council" },
    ]
    // GAP: links are NSW-specific. If scope expands beyond NSW, guidance.ts must branch on
    // profile.state to serve the correct state's council finder URL. Currently safe because
    // council schemes are NSW-only in MVP.
  },

  rent_paid_fortnightly: {
    explanation: "The rent you pay every two weeks (fortnightly). Check your lease agreement or rental receipts. If you pay weekly, multiply by 2.",
    links: [
      { label: "Understanding your lease — NSW Fair Trading", url: "https://www.fairtrading.nsw.gov.au/housing-and-property/renting" },
    ]
  },

  has_disability: {
    explanation: "Whether you have a physical, intellectual, or psychiatric condition that substantially reduces your ability to work or participate in daily life. You don't need a formal diagnosis — self-assessment is the starting point.",
    links: [
      { label: "Disability Support Pension eligibility — Services Australia", url: "https://www.servicesaustralia.gov.au/disability-support-pension" },
      { label: "What counts as a disability — NDIS", url: "https://www.ndis.gov.au/applying-access-ndis/am-i-eligible" },
    ]
  },

  is_carer: {
    explanation: "Whether you provide regular, ongoing care to someone with a disability, serious illness, or frailty due to age. This includes caring for a family member or friend — formal registration is not required.",
    links: [
      { label: "Carer recognition — Carer Gateway", url: "https://www.carergateway.gov.au/am-i-a-carer" },
      { label: "Carer Payment eligibility — Services Australia", url: "https://www.servicesaustralia.gov.au/carer-payment" },
    ]
  },

  has_financial_hardship: {
    explanation: "Whether you're struggling to meet basic living costs — for example, difficulty paying rent, utilities, or food. There's no formal threshold; it's based on your circumstances.",
    links: [
      { label: "Financial hardship assistance — Services Australia", url: "https://www.servicesaustralia.gov.au/if-you-are-in-financial-crisis-or-emergency" },
      { label: "National Debt Helpline", url: "https://ndh.org.au" },
    ]
  },

  uses_life_support_equipment: {
    explanation: "Whether anyone in your household depends on electrically powered medical equipment — such as a ventilator, oxygen concentrator, or dialysis machine. Your energy retailer needs to be notified separately.",
    links: [
      { label: "Life support registration — AER", url: "https://www.aer.gov.au/consumers/my-energy-contract/life-support-protections" },
      { label: "Medical Energy Rebate — NSW Government", url: "https://www.service.nsw.gov.au/transaction/apply-for-the-medical-energy-rebate" },
    ]
  },

  hours_worked_per_week: {
    explanation: "The average number of hours you work each week across all jobs. Check your employment contract or recent payslips.",
    links: [
      { label: "Fair Work — understanding your hours", url: "https://www.fairwork.gov.au/employee-entitlements/hours-of-work-breaks-and-rosters" },
    ]
  },

  employment_status: {
    explanation: "Your current work situation: employed (working for pay), retired (stopped working, typically at pension age), unemployed (looking for work), or student (studying full-time).",
    links: [
      { label: "Job seeker payments — Services Australia", url: "https://www.servicesaustralia.gov.au/payments-while-looking-for-work" },
    ]
  },

  tenure_type: {
    explanation: "Whether you rent your home, own it (with or without a mortgage), or board with someone else. Check your lease or property title if unsure.",
    links: [
      { label: "Renting vs owning — MoneySmart", url: "https://moneysmart.gov.au/living-costs/renting-vs-buying" },
    ]
  },
}
```

### `components/GuidanceCard`

Inline component rendered in the chat when the user clicks "Not sure? →". Sits between the AI question bubble and the input — not a new AI message turn.

```
+------------------------------------------------+
|  ℹ️  What is "annual income"?                  |
|                                                |
|  Your total income before tax for the current  |
|  financial year — including wages, investment  |
|  income, and government payments.              |
|                                                |
|  Where to find this:                           |
|  → View your income statement — myGov / ATO   |
|  → What counts as income — Services Australia |
|                                                |
|  [ Got it — I'll answer now ]                  |
+------------------------------------------------+
```

"Got it — I'll answer now" dismisses the card and re-focuses the chat input. The question remains active.

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
retriever.query(
  query: "age:68 employment_status:retired tenure_type:renting state:NSW rent_paid_fortnightly:400 — AGE_PENSION RENT_ASSISTANCE NSW_SENIORS_CARD",
  scheme_ids: ["AGE_PENSION", "RENT_ASSISTANCE", "NSW_SENIORS_CARD", ...],
  topK: 4
)
  ──▶ [corpus chunks scoped to eligible/needs-info schemes only]
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
- `apps/web/components/GuidanceCard.tsx`
- `apps/web/lib/orchestrator/profile.ts`
- `apps/web/lib/orchestrator/extract.ts`
- `apps/web/lib/orchestrator/turn.ts`
- `apps/web/lib/orchestrator/guidance.ts`
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
