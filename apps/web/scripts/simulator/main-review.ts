/**
 * Reviewer main loop. Walks logs/simulator/<date>/, runs deterministic
 * structural checks, writes REPORT.md and REPORT.jsonl.
 *
 * No LLM calls. Qualitative review is done by the Claude session agent
 * defined in scripts/simulator/review-agent.md — invoke it after this
 * command completes.
 *
 * Usage:
 *   pnpm --filter web run sim:review [-- --date YYYY-MM-DD]
 *                                     [--persona <id>] [--level <0-5>]
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  aggregate,
  listLogsForDate,
  loadConversation,
  renderMarkdown,
  reviewConversation,
  type ConversationReport,
} from '@/lib/orchestrator/reviewer'
import type { DisruptionLevel } from '@/lib/orchestrator/trace'

interface Cli {
  date?: string
  personaId?: string
  level?: DisruptionLevel
}

function parseCli(argv: string[]): Cli {
  const out: Cli = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--date') out.date = argv[++i]
    else if (arg === '--persona') out.personaId = argv[++i]
    else if (arg === '--level') {
      const n = parseInt(argv[++i] ?? '', 10)
      if (![0, 1, 2, 3, 4, 5].includes(n)) throw new Error(`--level must be 0-5`)
      out.level = n as DisruptionLevel
    }
  }
  return out
}

export async function run() {
  const cli = parseCli(process.argv.slice(2))
  const date = cli.date ?? new Date().toISOString().slice(0, 10)

  const logFiles = listLogsForDate(date)
  if (logFiles.length === 0) {
    console.error(`No logs found at logs/simulator/${date}/`)
    process.exit(0)
  }

  console.log(`Reviewing ${logFiles.length} log(s) for ${date}\n`)

  const reports: ConversationReport[] = []
  for (let i = 0; i < logFiles.length; i++) {
    const conv = loadConversation(logFiles[i])
    if (!conv) {
      console.log(`[${i + 1}/${logFiles.length}] SKIP malformed ${logFiles[i]}`)
      continue
    }
    if (cli.personaId && conv.start.persona_id !== cli.personaId) continue
    if (cli.level !== undefined && conv.start.disruption_level !== cli.level) continue

    const r = reviewConversation(conv)
    reports.push(r)
    console.log(`[${i + 1}/${logFiles.length}] ${r.summary_line}`)
  }

  if (reports.length === 0) {
    console.error('No conversations matched filters.')
    process.exit(0)
  }

  const report = aggregate(reports, date)
  const reportDir = path.resolve(process.cwd(), 'logs/simulator', date)
  fs.mkdirSync(reportDir, { recursive: true })

  const mdPath = path.join(reportDir, 'REPORT.md')
  fs.writeFileSync(mdPath, renderMarkdown(report))

  const jsonlPath = path.join(reportDir, 'REPORT.jsonl')
  fs.writeFileSync(jsonlPath, reports.map((r) => JSON.stringify(r)).join('\n') + '\n')

  console.log('')
  console.log(`Report:  ${path.relative(process.cwd(), mdPath)}`)
  console.log(`Data:    ${path.relative(process.cwd(), jsonlPath)}`)
  console.log('')
  console.log('Severity counts:')
  for (const [sev, count] of Object.entries(report.per_severity_count)) {
    if (count > 0) console.log(`  ${sev.padEnd(8)}: ${count}`)
  }
  console.log('')
  console.log('Next step: ask Claude to run the review agent in scripts/simulator/review-agent.md')
}
