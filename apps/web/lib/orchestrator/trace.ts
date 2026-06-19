/**
 * Structured trace events for the conversation simulator.
 *
 * One JSONL file per conversation; one event per line. Schema is shared with
 * the (future) reviewer agent and a possible dev-mode /api/chat instrumentation.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CorpusChunk } from '@/lib/retriever/query'
import type { ProfileVariables } from './profile'
import type {
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
      ground_truth: GroundTruth
      timestamp: string
    }
  | {
      event: 'turn'
      turn_index: number
      simulated_user_message: string
      profile_with_chip: ProfileVariables
      extracted_delta: Partial<ProfileVariables>
      full_delta: Partial<ProfileVariables>
      merged_profile: ProfileVariables
      rules_result: RulesResult
      eligibility: EligibilityResult
      next_question: NextQuestion | null
      chunks_used: CorpusChunk[]
      system_prompt: string
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
      error_message?: string
    }

export class TraceWriter {
  private stream: fs.WriteStream

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    // 'w' truncates — re-running the same (persona × level) overwrites
    // the prior trace rather than stacking multiple conversations into one
    // file (which would confuse the reviewer's loadConversation logic).
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
 * Match requires every ground-truth-eligible scheme appears in eligible AND
 * no ground-truth-ineligible scheme appears in eligible.
 */
export function computeMatch(
  finalEligible: string[],
  groundTruth: GroundTruth,
): { match: boolean; missed: string[]; unexpected: string[] } {
  const finalSet = new Set(finalEligible)
  const truthSet = new Set(groundTruth.eligible)

  const missed = groundTruth.eligible.filter((s) => !finalSet.has(s))
  const forbiddenHit = (groundTruth.ineligible ?? []).filter((s) =>
    finalSet.has(s),
  )
  // Unexpected = anything in final that's neither expected-eligible nor a
  // bonus/related scheme. For now we keep it permissive: only flag schemes
  // that are explicitly in ground_truth.ineligible.
  const unexpected = forbiddenHit

  return {
    match: missed.length === 0 && unexpected.length === 0,
    missed,
    unexpected,
  }
}
