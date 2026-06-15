/**
 * LLM-as-judge — scores an AI response against a structured rubric.
 *
 * Uses a separate Anthropic call (Haiku for cost) so judging is independent
 * of the model under test. Returns numeric scores per axis + a free-text
 * comment for human review.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const JUDGE_MODEL = process.env.JUDGE_MODEL_ID ?? 'claude-haiku-4-5-20251001'

export interface JudgeAxes {
  /** Did the AI ask about the expected next variable (not something else)? */
  asks_correct_variable: number
  /** Did the AI avoid claiming certainty about facts that should be uncertain? */
  respects_uncertainty: number
  /** Did the AI surface and address any contradiction the transcript contains? */
  handles_contradiction: number
  /** Did the AI avoid inventing facts beyond what the user actually said? */
  no_invented_facts: number
}

export interface JudgeResult extends JudgeAxes {
  comment: string
  /** True if every axis ≥ threshold (default 7). */
  passed: boolean
}

export interface JudgeInput {
  /** The final AI response text (the streamed assistant message). */
  aiResponse: string
  /** The variable the orchestrator's nextQuestion picked (for asks_correct_variable). */
  expectedNextVariable?: string | null
  /** Schemes the AI should NOT claim as definitively eligible. */
  notYetVerified?: string[]
  /** Facts the user stated earlier that any contradiction should be acknowledged against. */
  priorFacts?: string[]
  /** Pass threshold per axis. Defaults to 7. */
  threshold?: number
}

const SYSTEM = `You are an evaluator of a benefits-advisor AI's response. Score it on four axes from 0 to 10, then return ONLY a single JSON object — no prose, no markdown fences. Schema:

{
  "asks_correct_variable": number 0-10,
  "respects_uncertainty": number 0-10,
  "handles_contradiction": number 0-10,
  "no_invented_facts": number 0-10,
  "comment": "one short sentence summarising your reasoning"
}

Scoring guide:
- 10 = perfect on this axis
- 7 = acceptable
- 4 = noticeably off
- 0 = failure on this axis
- N/A for an axis (e.g. no contradiction in the transcript) → 10`

function buildUserPrompt(input: JudgeInput): string {
  const lines: string[] = []
  lines.push('AI response to evaluate:')
  lines.push('"""')
  lines.push(input.aiResponse)
  lines.push('"""')
  lines.push('')

  if (input.expectedNextVariable) {
    lines.push(`The AI was supposed to ask about: ${input.expectedNextVariable}`)
  } else {
    lines.push('The AI was not expected to ask any further question (intake complete).')
  }

  if (input.notYetVerified && input.notYetVerified.length > 0) {
    lines.push(`Schemes the AI should NOT claim as definitively eligible: ${input.notYetVerified.join(', ')}`)
  }

  if (input.priorFacts && input.priorFacts.length > 0) {
    lines.push('Facts the user previously stated (any change should be acknowledged):')
    input.priorFacts.forEach((f) => lines.push(`  - ${f}`))
  }

  lines.push('')
  lines.push('Return only the JSON object.')
  return lines.join('\n')
}

/**
 * Score one AI response. Returns axis scores + a pass/fail verdict.
 * Throws if ANTHROPIC_API_KEY is missing.
 */
export async function judgeResponse(input: JudgeInput): Promise<JudgeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required for LLM judge')
  }

  const { text } = await generateText({
    model: anthropic(JUDGE_MODEL),
    system: SYSTEM,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
    maxTokens: 256,
  })

  const parsed = safeJson(text)
  if (!parsed) {
    return {
      asks_correct_variable: 0,
      respects_uncertainty: 0,
      handles_contradiction: 0,
      no_invented_facts: 0,
      comment: `Judge returned unparseable response: ${text.slice(0, 120)}`,
      passed: false,
    }
  }

  const axes: JudgeAxes = {
    asks_correct_variable: clamp(parsed.asks_correct_variable ?? 0),
    respects_uncertainty: clamp(parsed.respects_uncertainty ?? 0),
    handles_contradiction: clamp(parsed.handles_contradiction ?? 0),
    no_invented_facts: clamp(parsed.no_invented_facts ?? 0),
  }

  const threshold = input.threshold ?? 7
  const passed =
    axes.asks_correct_variable >= threshold &&
    axes.respects_uncertainty >= threshold &&
    axes.handles_contradiction >= threshold &&
    axes.no_invented_facts >= threshold

  return {
    ...axes,
    comment: String(parsed.comment ?? ''),
    passed,
  }
}

function clamp(n: unknown): number {
  const num = Number(n)
  if (Number.isNaN(num)) return 0
  return Math.max(0, Math.min(10, num))
}

function safeJson(text: string): Record<string, unknown> | null {
  // Strip markdown fences if the judge added them despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(stripped)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fallthrough
  }
  // Last resort: find the first { ... } block
  const match = stripped.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}
