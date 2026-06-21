/**
 * Simulator-trace reviewer — deterministic checks only.
 *
 * Reads JSONL conversations from logs/simulator/<date>/, runs structural
 * checks against the trace schema, writes REPORT.md + REPORT.jsonl.
 *
 * No LLM calls. Qualitative review (tone, citation discipline,
 * contradiction handling, adversarial resistance) is done by the Claude
 * session agent defined in scripts/simulator/review-agent.md.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { TraceEvent, DisruptionLevel } from './trace'

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  check_id: string
  severity: Severity
  message: string
  evidence?: string
  turn_indices?: number[]
}

export interface ConversationReport {
  persona_id: string
  disruption_level: DisruptionLevel
  log_path: string
  ground_truth_match: boolean
  final_eligible: string[]
  missed_schemes: string[]
  unexpected_schemes: string[]
  turn_count: number
  end_reason: 'intake_complete' | 'max_turns' | 'error' | 'unknown'
  findings: Finding[]
  summary_line: string
}

export interface ReviewReport {
  date: string
  generated_at: string
  conversations: ConversationReport[]
  per_severity_count: Record<Severity, number>
  per_tier_match_rate: Record<number, { total: number; matched: number }>
  per_scheme_summary: Array<{
    scheme: string
    total: number
    matched: number
    findings: number
  }>
}

interface LoadedConversation {
  start: Extract<TraceEvent, { event: 'conversation_start' }>
  turns: Array<Extract<TraceEvent, { event: 'turn' }>>
  end: Extract<TraceEvent, { event: 'conversation_end' }> | null
  log_path: string
}

// ─────────────────────────────────────────────────────────────────────────
// Trace loading
// ─────────────────────────────────────────────────────────────────────────

export function loadConversation(filePath: string): LoadedConversation | null {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  const lines = raw.trim().split('\n').filter((l) => l.length > 0)
  const events: TraceEvent[] = []
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as TraceEvent)
    } catch {
      // Skip malformed lines
    }
  }
  const start = events.find((e) => e.event === 'conversation_start') as
    | LoadedConversation['start']
    | undefined
  const turns = events.filter((e) => e.event === 'turn') as LoadedConversation['turns']
  const end = (events.find((e) => e.event === 'conversation_end') ?? null) as LoadedConversation['end']
  if (!start) return null
  return { start, turns, end, log_path: filePath }
}

export function listLogsForDate(date: string): string[] {
  const dir = path.resolve(process.cwd(), 'logs/simulator', date)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl') && !f.startsWith('REPORT'))
    .map((f) => path.join(dir, f))
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic checks
// ─────────────────────────────────────────────────────────────────────────

function checkGroundTruth(conv: LoadedConversation): Finding | null {
  if (!conv.end || conv.end.ground_truth_match) return null
  return {
    check_id: 'ground_truth_miss',
    severity: 'critical',
    message: `Final eligibility does not match ground truth. Missed: [${conv.end.missed_schemes.join(', ')}]. Unexpected: [${conv.end.unexpected_schemes.join(', ')}].`,
  }
}

function checkMaxTurns(conv: LoadedConversation): Finding | null {
  if (conv.end?.reason !== 'max_turns') return null
  return {
    check_id: 'max_turns_loop',
    severity: 'high',
    message: `Hit ${conv.turns.length}-turn cap without completing intake. ground_truth_match=${conv.end.ground_truth_match}.`,
  }
}

function checkReaskLoop(conv: LoadedConversation): Finding | null {
  let lastVar: string | null = null
  let runLength = 0
  let worstRun = 0
  let worstVar: string | null = null
  const turnIndices: number[] = []
  for (const t of conv.turns) {
    const v = t.next_question?.variable ?? null
    if (v && v === lastVar) {
      runLength += 1
      turnIndices.push(t.turn_index)
      if (runLength > worstRun) { worstRun = runLength; worstVar = v }
    } else {
      runLength = 1
      turnIndices.length = 0
      lastVar = v
    }
  }
  if (worstRun >= 2 && worstVar) {
    return {
      check_id: 'reask_loop',
      severity: 'high',
      message: `Orchestrator asked "${worstVar}" on ${worstRun + 1} consecutive turns without the user answering.`,
      turn_indices: [...turnIndices],
    }
  }
  return null
}

function checkExtractionStall(conv: LoadedConversation): Finding | null {
  const stalls: number[] = []
  for (const t of conv.turns) {
    if (
      t.simulated_user_message.length >= 30 &&
      Object.keys(t.extracted_delta).length === 0 &&
      Object.keys(t.full_delta).length === 0
    ) {
      stalls.push(t.turn_index)
    }
  }
  if (stalls.length === 0) return null
  return {
    check_id: 'extraction_stall',
    severity: 'medium',
    message: `${stalls.length} turn(s) had substantive user input (≥30 chars) but extraction returned nothing.`,
    turn_indices: stalls,
  }
}

function checkStopLoopViolation(conv: LoadedConversation): Finding | null {
  const violations: number[] = []
  for (let i = 0; i < conv.turns.length - 1; i++) {
    const t = conv.turns[i]
    if (t.eligibility.eligible.length > 0 && t.next_question !== null) {
      violations.push(t.turn_index)
    }
  }
  if (violations.length === 0) return null
  return {
    check_id: 'stop_loop_violation',
    severity: 'high',
    message: `Orchestrator emitted a next_question on ${violations.length} turn(s) after at least one scheme was already eligible (mode should be handoff).`,
    turn_indices: violations,
  }
}

function checkRetrieverDegraded(conv: LoadedConversation): Finding | null {
  if (conv.turns.length === 0) return null
  const allEmpty = conv.turns.every((t) => t.chunk_count === 0)
  if (!allEmpty) return null
  return {
    check_id: 'retriever_degraded',
    severity: 'medium',
    message: `chunk_count=0 on every turn — corpus retrieval failed throughout. Citation discipline cannot be verified from bot responses.`,
  }
}

function checkContradictionModeCorrectness(conv: LoadedConversation): Finding | null {
  // Any turn where contradictions[] is non-empty but mode !== 'contradiction'
  // (and mode !== 'handoff', which legitimately takes priority).
  const wrong: number[] = []
  for (const t of conv.turns) {
    if (
      t.contradictions?.length > 0 &&
      t.mode !== 'contradiction' &&
      t.mode !== 'handoff'
    ) {
      wrong.push(t.turn_index)
    }
  }
  if (wrong.length === 0) return null
  return {
    check_id: 'contradiction_mode_missed',
    severity: 'high',
    message: `${wrong.length} turn(s) had detected contradictions but mode was not 'contradiction' or 'handoff'.`,
    turn_indices: wrong,
  }
}

function checkBonusEligible(conv: LoadedConversation): Finding | null {
  if (!conv.end) return null
  const truthSet = new Set(conv.start.ground_truth.eligible)
  const extras = conv.end.final_eligible.filter((s) => !truthSet.has(s))
  if (extras.length === 0) return null
  return {
    check_id: 'bonus_eligible',
    severity: 'info',
    message: `Final eligibility included ${extras.length} scheme(s) not in ground truth: [${extras.join(', ')}]. May be legitimate co-eligibility.`,
  }
}

function checkProfileGrowthStall(conv: LoadedConversation): Finding | null {
  // If profile_size doesn't grow for 4+ consecutive turns (excluding last turn),
  // extraction is failing to pull facts from the user's messages.
  if (conv.turns.length < 5) return null
  let stallStart = -1
  let maxStallLen = 0
  let stallStartIdx = -1
  for (let i = 1; i < conv.turns.length - 1; i++) {
    const grew = conv.turns[i].profile_size > conv.turns[i - 1].profile_size
    if (!grew) {
      if (stallStart === -1) stallStart = i - 1
      const len = i - stallStart + 1
      if (len > maxStallLen) { maxStallLen = len; stallStartIdx = stallStart }
    } else {
      stallStart = -1
    }
  }
  if (maxStallLen < 4) return null
  return {
    check_id: 'profile_growth_stall',
    severity: 'medium',
    message: `Profile size did not grow for ${maxStallLen} consecutive turns starting at turn ${stallStartIdx}. Extraction may be failing to read user facts.`,
    turn_indices: Array.from({ length: maxStallLen }, (_, k) => stallStartIdx + k),
  }
}

const DETERMINISTIC_CHECKS = [
  checkGroundTruth,
  checkMaxTurns,
  checkReaskLoop,
  checkExtractionStall,
  checkStopLoopViolation,
  checkRetrieverDegraded,
  checkContradictionModeCorrectness,
  checkBonusEligible,
  checkProfileGrowthStall,
]

// ─────────────────────────────────────────────────────────────────────────
// Per-conversation review
// ─────────────────────────────────────────────────────────────────────────

export function reviewConversation(conv: LoadedConversation): ConversationReport {
  const findings: Finding[] = []
  for (const check of DETERMINISTIC_CHECKS) {
    const f = check(conv)
    if (f) findings.push(f)
  }

  const matchStr = conv.end?.ground_truth_match ? 'MATCH' : 'MISS'
  const findingTags =
    findings.length === 0
      ? 'clean'
      : findings.map((f) => `${f.severity}:${f.check_id}`).join(' ')

  return {
    persona_id: conv.start.persona_id,
    disruption_level: conv.start.disruption_level,
    log_path: conv.log_path,
    ground_truth_match: conv.end?.ground_truth_match ?? false,
    final_eligible: conv.end?.final_eligible ?? [],
    missed_schemes: conv.end?.missed_schemes ?? [],
    unexpected_schemes: conv.end?.unexpected_schemes ?? [],
    turn_count: conv.turns.length,
    end_reason: conv.end?.reason ?? 'unknown',
    findings,
    summary_line: `${conv.start.persona_id} L${conv.start.disruption_level} ${conv.turns.length}t ${matchStr} — ${findingTags}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Aggregate
// ─────────────────────────────────────────────────────────────────────────

export function aggregate(
  conversations: ConversationReport[],
  date: string,
): ReviewReport {
  const perSeverity: Record<Severity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  const perTier: Record<number, { total: number; matched: number }> = {}
  const perSchemeMap = new Map<string, { total: number; matched: number; findings: number }>()

  for (const c of conversations) {
    for (const f of c.findings) perSeverity[f.severity] += 1
    if (!perTier[c.disruption_level]) perTier[c.disruption_level] = { total: 0, matched: 0 }
    perTier[c.disruption_level].total += 1
    if (c.ground_truth_match) perTier[c.disruption_level].matched += 1

    const primaryScheme = c.persona_id.split('-')[0]
    const entry = perSchemeMap.get(primaryScheme) ?? { total: 0, matched: 0, findings: 0 }
    entry.total += 1
    if (c.ground_truth_match) entry.matched += 1
    entry.findings += c.findings.filter((f) => f.severity !== 'info' && f.severity !== 'low').length
    perSchemeMap.set(primaryScheme, entry)
  }

  return {
    date,
    generated_at: new Date().toISOString(),
    conversations,
    per_severity_count: perSeverity,
    per_tier_match_rate: perTier,
    per_scheme_summary: Array.from(perSchemeMap.entries())
      .map(([scheme, v]) => ({ scheme, ...v }))
      .sort((a, b) => b.findings - a.findings),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Markdown rendering
// ─────────────────────────────────────────────────────────────────────────

const TIER_NAMES: Record<number, string> = {
  0: 'cooperative',
  1: 'casual',
  2: 'sparse-cagey',
  3: 'typo-grammar',
  4: 'noisy-tangential',
  5: 'adversarial',
}

export function renderMarkdown(report: ReviewReport): string {
  const lines: string[] = []
  lines.push(`# Simulator Review Report — ${report.date}`)
  lines.push('')
  lines.push(`Generated: ${report.generated_at}`)
  lines.push(`Conversations: **${report.conversations.length}**`)
  lines.push('')

  lines.push('## Per-tier match rate')
  lines.push('')
  lines.push('| Tier | Name | Total | Matched | Rate |')
  lines.push('|---|---|---|---|---|')
  for (const tier of Object.keys(report.per_tier_match_rate).map(Number).sort((a, b) => a - b)) {
    const v = report.per_tier_match_rate[tier]
    const rate = v.total === 0 ? '—' : `${((v.matched / v.total) * 100).toFixed(0)}%`
    lines.push(`| ${tier} | ${TIER_NAMES[tier] ?? '?'} | ${v.total} | ${v.matched} | ${rate} |`)
  }
  lines.push('')

  lines.push('## Findings by severity')
  lines.push('')
  lines.push('| Severity | Count |')
  lines.push('|---|---|')
  for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as Severity[]) {
    lines.push(`| ${sev} | ${report.per_severity_count[sev]} |`)
  }
  lines.push('')

  lines.push('## Per-scheme summary')
  lines.push('')
  lines.push('| Scheme | Total | Matched | Findings (non-info) |')
  lines.push('|---|---|---|---|')
  for (const s of report.per_scheme_summary) {
    lines.push(`| ${s.scheme} | ${s.total} | ${s.matched} | ${s.findings} |`)
  }
  lines.push('')

  const ranked = [...report.conversations].sort((a, b) => scoreWeight(b) - scoreWeight(a))

  lines.push('## Worst conversations (ranked by severity)')
  lines.push('')
  for (const c of ranked.slice(0, 20)) {
    if (c.findings.length === 0 && c.ground_truth_match) continue
    lines.push(`### ${c.persona_id} L${c.disruption_level} (${TIER_NAMES[c.disruption_level] ?? '?'})`)
    lines.push('')
    lines.push(`- Match: ${c.ground_truth_match ? 'yes' : 'NO'}`)
    lines.push(`- Turns: ${c.turn_count}  End: ${c.end_reason}`)
    if (c.missed_schemes.length > 0) lines.push(`- Missed: ${c.missed_schemes.join(', ')}`)
    if (c.unexpected_schemes.length > 0) lines.push(`- Unexpected: ${c.unexpected_schemes.join(', ')}`)
    lines.push(`- Log: \`${path.relative(process.cwd(), c.log_path)}\``)
    if (c.findings.length > 0) {
      lines.push('')
      for (const f of c.findings) {
        lines.push(`- **${f.severity.toUpperCase()}** \`${f.check_id}\`: ${f.message}`)
        if (f.turn_indices?.length) lines.push(`  turns: ${f.turn_indices.join(', ')}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function scoreWeight(c: ConversationReport): number {
  const w: Record<Severity, number> = { critical: 100, high: 10, medium: 3, low: 1, info: 0 }
  let total = 0
  for (const f of c.findings) total += w[f.severity]
  if (!c.ground_truth_match) total += 50
  return total
}
