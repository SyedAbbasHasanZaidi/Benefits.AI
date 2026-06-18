/**
 * LLM-judge runner.
 * Drives every fixture in `fixtures.ts` through `prepareTurn()` in-process,
 * then judges the resulting AI response with a separate LLM call.
 *
 *   pnpm test:llm-judge        # run all
 *   pnpm test:llm-judge -t 8.1 # run a single case by id
 *
 * Skips automatically when ANTHROPIC_API_KEY is missing — so CI stays green
 * even without secrets. Requires RULES_SERVICE_URL to point at the FastAPI
 * service (the same URL used by /api/chat in prod).
 */

import { describe, it, expect } from 'vitest'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'
import { mergeProfile, type ProfileVariables } from '@/lib/orchestrator/profile'
import { prepareTurn } from '@/lib/orchestrator/turn'
import type { LlmMessage } from '@/lib/llm/LlmProvider'
import { ALL_CASES, type TestCase } from './fixtures'
import { judgeResponse } from './judge'

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY
const HAS_RULES = !!process.env.RULES_SERVICE_URL || true // defaults to localhost

const RESPONSE_MODEL = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6'
const EXTRACT_MODEL = 'claude-sonnet-4-6'

const responseAnthropic = HAS_KEY ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

/**
 * Drive a single test case through the orchestrator and return everything
 * needed for assertions + LLM judging.
 */
async function runCase(tc: TestCase) {
  const extractLlm = new AnthropicProvider(EXTRACT_MODEL)
  let profile: ProfileVariables = { ...(tc.initialProfile ?? {}) }
  const history: LlmMessage[] = []
  let lastTurn: Awaited<ReturnType<typeof prepareTurn>> | null = null

  for (const userMsg of tc.userMessages) {
    const turn = await prepareTurn(userMsg, profile, history, extractLlm, {})
    profile = mergeProfile(profile, turn.profileDelta)
    history.push({ role: 'user', content: userMsg })
    // We synthesise the assistant reply via the system prompt for judging
    lastTurn = turn
  }

  // Generate the actual assistant response using Sonnet — same model + prompt
  // path /api/chat uses, just without streaming.
  let aiResponse = ''
  if (HAS_KEY && responseAnthropic && lastTurn) {
    const { text } = await generateText({
      model: responseAnthropic(RESPONSE_MODEL),
      system: lastTurn.systemPrompt,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 384,
    })
    aiResponse = text
  }

  return {
    profile,
    lastTurn,
    aiResponse,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_KEY)('LLM-judge — full suite (40+ cases)', () => {
  for (const tc of ALL_CASES) {
    const fn = tc.expected === 'todo' ? it.todo : it
    fn(
      `[${tc.id}] ${tc.category}: ${tc.name}${tc.todoReason ? ` (todo: ${tc.todoReason})` : ''}`,
      async () => {
        const { profile, lastTurn, aiResponse } = await runCase(tc)
        expect(lastTurn).not.toBeNull()

        // ── 1. Expected facts must be extracted exactly ──────────────────────
        if (tc.expectedFacts) {
          for (const [key, expectedValue] of Object.entries(tc.expectedFacts)) {
            const actual = (profile as Record<string, unknown>)[key]
            expect(actual, `expected ${key}=${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`)
              .toEqual(expectedValue)
          }
        }

        // ── 2. Forbidden keys must NOT be set ────────────────────────────────
        if (tc.forbiddenKeys) {
          for (const key of tc.forbiddenKeys) {
            const actual = (profile as Record<string, unknown>)[key]
            expect(actual, `forbidden key ${key} should be undefined, got ${JSON.stringify(actual)}`)
              .toBeUndefined()
          }
        }

        // ── 3. nextQuestion.variable ─────────────────────────────────────────
        if (tc.expectedNextVariable !== undefined) {
          if (tc.expectedNextVariable === null) {
            expect(lastTurn?.nextQuestion).toBeNull()
          } else {
            expect(lastTurn?.nextQuestion?.variable).toBe(tc.expectedNextVariable)
          }
        }

        // ── 4. Schemes that should be eligible ───────────────────────────────
        if (tc.expectedEligible) {
          for (const schemeId of tc.expectedEligible) {
            expect(lastTurn?.eligibility.eligible, `expected ${schemeId} in eligible[]`)
              .toContain(schemeId)
          }
        }

        // ── 5. Schemes that should NOT appear in eligible[] ──────────────────
        if (tc.forbiddenEligible) {
          for (const schemeId of tc.forbiddenEligible) {
            expect(lastTurn?.eligibility.eligible, `${schemeId} should not be eligible`)
              .not.toContain(schemeId)
          }
        }

        // ── 6. LLM-judge the AI text ─────────────────────────────────────────
        if (tc.judge && aiResponse) {
          const result = await judgeResponse({
            aiResponse,
            expectedNextVariable: lastTurn?.nextQuestion?.variable,
            notYetVerified: tc.judge.notYetVerified,
            priorFacts: tc.judge.priorFacts,
            threshold: tc.judge.threshold,
          })
          if (!result.passed) {
            const detail = `Judge said: "${result.comment}" — scores: ` +
              `asks=${result.asks_correct_variable}, ` +
              `uncert=${result.respects_uncertainty}, ` +
              `contra=${result.handles_contradiction}, ` +
              `noinvent=${result.no_invented_facts}\n\n` +
              `AI response:\n${aiResponse}`
            throw new Error(detail)
          }
        }
      },
      60_000, // per-case timeout
    )
  }
})

describe.skipIf(HAS_KEY)('LLM-judge — skipped (set ANTHROPIC_API_KEY to enable)', () => {
  it('environment check', () => {
    expect(HAS_KEY).toBe(false)
  })
})

// Suppress "lint says HAS_RULES unused" by referencing it once
void HAS_RULES
