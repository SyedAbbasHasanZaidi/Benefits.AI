/**
 * Structured trace events for the conversation simulator.
 *
 * One JSONL file per conversation; one event per line. Every internal
 * orchestrator state is captured so conversations can be fully replayed
 * and reviewed without re-running the LLM.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CorpusChunk } from '@/lib/retriever/query'
import type { ProfileVariables } from './profile'
import type {
  ConversationMode,
  ContradictionDetail,
  EligibilityResult,
  NextQuestion,
  RulesResult,
} from './turn'

export type DisruptionLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface GroundTruth {
  eligible: string[]
  ineligible?: string[]
}

export type TraceEvent =
  | {
      event: 'conversation_start'
      persona_id: string
      disruption_level: DisruptionLevel
      disruption_name: string
      ground_truth: GroundTruth
      timestamp: string
    }
  | {
      event: 'turn'
      turn_index: number

      // ── Simulator side ───────────────────────────────────────────────────
      simulated_user_message: string

      // ── Extraction layer ─────────────────────────────────────────────────
      profile_with_chip: ProfileVariables          // after chip merge, before extraction
      extracted_delta: Partial<ProfileVariables>   // LLM extraction output alone
      full_delta: Partial<ProfileVariables>        // chip delta + extraction combined

      // ── Contradiction detection ──────────────────────────────────────────
      contradictions: ContradictionDetail[]        // conflicts withheld from profile
      merged_profile: ProfileVariables             // final profile after safe merge
      profile_size: number                         // # of filled fields

      // ── Skip-tracking ────────────────────────────────────────────────────
      asked_streak: Record<string, number>         // consecutive unanswered asks per var
      skipped_at: Record<string, number>           // profile_size at skip time per var

      // ── Rules engine ─────────────────────────────────────────────────────
      rules_result: RulesResult                    // raw /calculate response
      eligibility: EligibilityResult               // parsed eligible/needs_info/ineligible
      missing_variables: string[]                  // flat list of all missing vars

      // ── Orchestrator decisions ───────────────────────────────────────────
      mode: ConversationMode                       // collecting_info | handoff | contradiction
      next_question: NextQuestion | null           // null in handoff + contradiction modes

      // ── Retrieval ────────────────────────────────────────────────────────
      chunks_used: CorpusChunk[]                   // corpus chunks fed to system prompt
      chunk_count: number                          // convenience field for quick scanning

      // ── Bot turn ─────────────────────────────────────────────────────────
      system_prompt: string                        // full system prompt sent to bot LLM
      bot_response: string
      latency_ms: number
    }
  | {
      event: 'conversation_end'
      reason: 'intake_complete' | 'max_turns' | 'error'
      final_profile: ProfileVariables
      final_eligible: string[]
      ground_truth_match: boolean
      missed_schemes: string[]
      unexpected_schemes: string[]
      total_turns: number
      total_latency_ms: number
      error_message?: string
    }

export class TraceWriter {
  private stream: fs.WriteStream

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    this.stream = fs.createWriteStream(filePath, { flags: 'w' })
  }

  write(event: TraceEvent): void {
    this.stream.write(JSON.stringify(event) + '\n')
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(() => resolve())
    })
  }
}

/**
 * Compute set-equality match between final eligible set and ground truth.
 */
export function computeMatch(
  finalEligible: string[],
  groundTruth: GroundTruth,
): { match: boolean; missed: string[]; unexpected: string[] } {
  const finalSet = new Set(finalEligible)

  const missed = groundTruth.eligible.filter((s) => !finalSet.has(s))
  const forbiddenHit = (groundTruth.ineligible ?? []).filter((s) =>
    finalSet.has(s),
  )

  return {
    match: missed.length === 0 && forbiddenHit.length === 0,
    missed,
    unexpected: forbiddenHit,
  }
}
