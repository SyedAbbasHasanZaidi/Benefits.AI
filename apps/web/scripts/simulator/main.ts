/**
 * Conversation simulator main loop. Drives each (persona × disruption-level)
 * combination through prepareTurn, streams the trace to JSONL, and reports
 * pass/fail against the persona's ground truth.
 *
 * See run.ts for env loading (must precede this module's imports).
 */

import * as path from 'path'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { AnthropicProvider } from '@/lib/llm/AnthropicProvider'
import { prepareTurn } from '@/lib/orchestrator/turn'
import { mergeProfile, type ProfileVariables } from '@/lib/orchestrator/profile'
import type { LlmMessage } from '@/lib/llm/LlmProvider'
import {
  TraceWriter,
  computeMatch,
  type DisruptionLevel,
} from '@/lib/orchestrator/trace'
import { PERSONAS, DISRUPTION_LEVELS, type Persona } from './personas'

const MAX_TURNS = 15
const MODEL = process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6'
const EXTRACT_MODEL = MODEL // share model with prod /api/chat
const SIM_TEMPERATURE = 0.7

// ─────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────

interface Cli {
  personaId?: string
  level?: DisruptionLevel
}

function parseCli(argv: string[]): Cli {
  const out: Cli = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--persona') out.personaId = argv[++i]
    else if (arg === '--level') {
      const n = parseInt(argv[++i] ?? '', 10)
      if (![0, 1, 2, 3, 4, 5].includes(n)) {
        throw new Error(`--level must be 0-5, got "${argv[i]}"`)
      }
      out.level = n as DisruptionLevel
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Simulator agent — generates a user message in-persona at the given level
// ─────────────────────────────────────────────────────────────────────────

const simAnthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSimulatorSystem(persona: Persona, level: DisruptionLevel): string {
  const def = DISRUPTION_LEVELS[level]
  return `You are roleplaying as a real person seeking advice on Australian government benefits.

Your persona:
${persona.backstory}

Your goal: find out what entitlements you might qualify for.

How to behave (disruption level: ${def.name}):
${def.prompt}

Critical rules:
- Stay in character. Do NOT break the fourth wall or mention you are an AI.
- Reveal information about yourself only as fits the disruption style above.
- If asked something the persona wouldn't realistically know exactly (e.g. precise assets), hedge or say you're unsure.
- Keep responses short (1-3 sentences usually). Like a real chat user, not an essay.
- The advisor will end the conversation when they have enough information. You don't need to wrap up — just respond naturally to whatever they ask or say.

Output ONLY your next message as the user. No prefix, no quotation marks, no stage directions.`
}

async function simulatorTurn(
  persona: Persona,
  level: DisruptionLevel,
  history: LlmMessage[],
  isFirstTurn: boolean,
): Promise<string> {
  // For the first turn we seed with a natural opener.
  const messages: LlmMessage[] = isFirstTurn
    ? [
        {
          role: 'user',
          content:
            'The benefits advisor has just opened the chat. Send your first message — describe your situation in your own words and ask what you might qualify for.',
        },
      ]
    : // For subsequent turns we flip the roles: the user-side simulator reads
      // the actual bot's last message as a "user" prompt from its perspective.
      history.map((m) =>
        m.role === 'assistant'
          ? { role: 'user' as const, content: m.content }
          : { role: 'assistant' as const, content: m.content },
      )

  const { text } = await generateText({
    model: simAnthropic(MODEL),
    system: buildSimulatorSystem(persona, level),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: 256,
    temperature: SIM_TEMPERATURE,
  })
  return text.trim()
}

// ─────────────────────────────────────────────────────────────────────────
// Bot turn — drives prepareTurn + generateText with the system prompt
// ─────────────────────────────────────────────────────────────────────────

const botAnthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function botTurn(
  userMessage: string,
  profile: ProfileVariables,
  history: LlmMessage[],
  extractLlm: AnthropicProvider,
) {
  const ctx = await prepareTurn(userMessage, profile, history, extractLlm, {})
  const { text } = await generateText({
    model: botAnthropic(MODEL),
    system: ctx.systemPrompt,
    messages: history
      .concat({ role: 'user', content: userMessage })
      .map((m) => ({ role: m.role, content: m.content })),
    maxTokens: 384,
  })
  return { ctx, botResponse: text.trim() }
}

// ─────────────────────────────────────────────────────────────────────────
// Drive one conversation
// ─────────────────────────────────────────────────────────────────────────

async function runConversation(
  persona: Persona,
  level: DisruptionLevel,
  index: number,
  total: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const tracePath = path.resolve(
    process.cwd(),
    `logs/simulator/${today}/${persona.id}_L${level}.jsonl`,
  )
  const writer = new TraceWriter(tracePath)
  const extractLlm = new AnthropicProvider(EXTRACT_MODEL)

  writer.write({
    event: 'conversation_start',
    persona_id: persona.id,
    disruption_level: level,
    ground_truth: persona.groundTruth,
    timestamp: new Date().toISOString(),
  })

  let profile: ProfileVariables = {}
  const history: LlmMessage[] = []
  let latestEligible: string[] = []
  const t0 = Date.now()
  let endReason: 'intake_complete' | 'max_turns' | 'error' = 'max_turns'
  let errorMessage: string | undefined

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const isFirstTurn = turn === 0
      const userMsg = await simulatorTurn(persona, level, history, isFirstTurn)

      const turnStart = Date.now()
      const { ctx, botResponse } = await botTurn(
        userMsg,
        profile,
        history,
        extractLlm,
      )
      const latency = Date.now() - turnStart

      profile = ctx.mergedProfile
      latestEligible = ctx.eligibility.eligible

      writer.write({
        event: 'turn',
        turn_index: turn,
        simulated_user_message: userMsg,
        profile_with_chip: ctx.profileWithChip,
        extracted_delta: ctx.extractedDelta,
        full_delta: ctx.profileDelta,
        merged_profile: ctx.mergedProfile,
        rules_result: ctx.rulesResult,
        eligibility: ctx.eligibility,
        next_question: ctx.nextQuestion,
        chunks_used: ctx.chunks,
        system_prompt: ctx.systemPrompt,
        bot_response: botResponse,
        latency_ms: latency,
      })

      history.push({ role: 'user', content: userMsg })
      history.push({ role: 'assistant', content: botResponse })

      // Termination: intake complete AND at least one scheme matched (so the
      // bot has had a chance to deliver handoff copy in this final turn).
      if (
        ctx.nextQuestion === null &&
        ctx.eligibility.eligible.length > 0
      ) {
        endReason = 'intake_complete'
        break
      }
    }
  } catch (err) {
    endReason = 'error'
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`  ERROR in ${persona.id} L${level}:`, errorMessage)
  }

  const match = computeMatch(latestEligible, persona.groundTruth)
  const totalMs = Date.now() - t0

  writer.write({
    event: 'conversation_end',
    reason: endReason,
    final_profile: profile,
    final_eligible: latestEligible,
    ground_truth_match: match.match,
    missed_schemes: match.missed,
    unexpected_schemes: match.unexpected,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  })

  await writer.close()

  const turns = history.length / 2
  const matchStr = match.match ? 'true' : 'false'
  console.log(
    `[${index + 1}/${total}] ${persona.id} L${level} → ${turns} turns, match=${matchStr} (${(totalMs / 1000).toFixed(1)}s)`,
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Top-level: build job list from CLI flags and run sequentially
// ─────────────────────────────────────────────────────────────────────────

export async function run() {
  const cli = parseCli(process.argv.slice(2))

  const personas = cli.personaId
    ? PERSONAS.filter((p) => p.id === cli.personaId)
    : PERSONAS
  if (cli.personaId && personas.length === 0) {
    throw new Error(`Unknown persona id: ${cli.personaId}`)
  }
  const levels: DisruptionLevel[] = cli.level !== undefined
    ? [cli.level]
    : [0, 1, 2, 3, 4, 5]

  const jobs: Array<{ persona: Persona; level: DisruptionLevel }> = []
  for (const persona of personas) {
    for (const level of levels) {
      jobs.push({ persona, level })
    }
  }

  console.log(
    `Running ${jobs.length} conversation${jobs.length === 1 ? '' : 's'} ` +
      `(${personas.length} personas × ${levels.length} levels)\n`,
  )

  for (let i = 0; i < jobs.length; i++) {
    const { persona, level } = jobs[i]
    await runConversation(persona, level, i, jobs.length)
  }

  console.log(`\nDone. Logs in logs/simulator/${new Date().toISOString().slice(0, 10)}/`)
}
