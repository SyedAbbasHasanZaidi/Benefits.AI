# Project Context

status: active

## Overview
Benefits.AI — conversational web app that helps Australians discover unclaimed government entitlements (~$10B–$18B unclaimed annually). Citizens chat in plain English; the rules engine surfaces what they likely qualify for; the AI explains it and hands them off to the official agency.

**Core invariant: the LLM never decides eligibility. OpenFisca is the source of truth.**

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK v4 |
| Rules engine | Python 3.12, FastAPI, OpenFisca-core |
| Orchestrator | Next.js Route Handlers (TypeScript) |
| LLM | Anthropic Claude via AWS Bedrock (ap-southeast-2) |
| Embeddings | Voyage voyage-3 |
| Vector store | pgvector on Supabase |
| Database | Supabase (Postgres, Sydney region) |
| Package manager | pnpm (workspaces) |
| Monorepo | Turborepo |
| Deploy (web) | Vercel Sydney edge |
| Deploy (rules) | Fly.io `syd` region |

## Jurisdictional scope (MVP)
- **Federal:** ~10 Centrelink schemes — evaluated for ALL Australian users
- **NSW state:** ~5 concession schemes
- **NSW councils:** top-5 by population (Sydney, Blacktown, Canterbury-Bankstown, Central Coast, Northern Beaches)
- Users outside NSW get federal results + scope banner

## Commands

```bash
# Web app only
pnpm --filter web dev           # Next.js dev server (port 3000)
pnpm --filter web typecheck     # TypeScript check
pnpm --filter web lint          # ESLint

# Rules service only (separate terminal)
cd apps/rules
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn main:app --reload --port 8001

# Run tests
pytest apps/rules/tests -v

# Scripts
pnpm --filter scripts run build-registry    # regenerate TS enum from OpenFisca registry
pnpm --filter scripts run ingest-corpus     # embed + upsert corpus chunks
pnpm --filter scripts run corpus-change-check  # check for source URL changes
```

## Repository layout

```
Benefits.AI/
├── apps/
│   ├── web/                  # Next.js 15 app
│   │   ├── app/              # App Router pages + API routes
│   │   ├── components/       # React components
│   │   └── lib/
│   │       ├── llm/          # LlmProvider interface + BedrockClaudeProvider
│   │       ├── orchestrator/ # Turn loop, slot-filling state machine
│   │       ├── retriever/    # Voyage embed + pgvector query
│   │       └── supabase/     # Browser + server Supabase clients
│   └── rules/                # FastAPI rules service
│       ├── main.py           # App + routes
│       ├── openfisca_au/     # Country package (entities, variables, parameters)
│       │   └── variables/
│       │       ├── federal/  # Centrelink schemes
│       │       ├── nsw/      # NSW state concessions
│       │       └── councils/ # Per-LGA council schemes
│       └── schemes/          # *.yaml metadata per scheme
├── corpus/                   # Curated Markdown (authoritative source text)
│   ├── federal/
│   ├── nsw/
│   └── councils/{sydney,blacktown,...}/
├── scripts/                  # build_registry, ingest_corpus, corpus_change_check
├── supabase/                 # Migrations + config
└── .github/workflows/        # CI
```

## Adding a new scheme (checklist)
1. Add OpenFisca variable(s) in `apps/rules/openfisca_au/variables/{tier}/`
2. Add `apps/rules/schemes/{scheme_id}.yaml` with `delivery_channel` field
3. Add `corpus/{tier}/{scheme_id}.md` with `scheme_id`, `source_url`, `last_verified` frontmatter
4. Write a pytest case in `apps/rules/tests/` against a known worked example
5. Run `pnpm --filter scripts run ingest-corpus` to embed the new doc
6. Run `pnpm --filter scripts run build-registry` to regenerate the TS enum

## Key design patterns
- **Strategy** — `LlmProvider` interface; `BedrockClaudeProvider` is the impl; swap without touching orchestration
- **Adapter** — `EligibilityCoordinator` (TS) translates LLM tool calls into OpenFisca payloads
- **Schema-locked tool use** — `set_variable` tool enum is generated from OpenFisca registry; LLM cannot invent variables
- **Slot-filling loop** — engine returns `missing_variables` → orchestrator asks LLM → loop until complete
- **Citation-or-refuse** — every explanation sentence carries a `[src:chunk_id]` citation; uncited sentences are stripped
- **`delivery_channel`** — field on every scheme controlling hand-off copy; values: `federal_direct`, `federal_via_retailer`, `federal_via_state`, `state_direct`, `state_via_community`, `council_direct`
- **Cross-tier stacking** — NSW/council OpenFisca formulas reference federal variables (e.g. `has_pensioner_concession_card`) as preconditions
