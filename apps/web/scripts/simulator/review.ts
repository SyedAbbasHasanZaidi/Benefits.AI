/**
 * Reviewer CLI. Loads dotenv FIRST then defers to main-review.ts so all
 * downstream imports see env vars.
 *
 * Usage: pnpm --filter web run sim:review [-- --date YYYY-MM-DD] [--no-llm-judge]
 *                                          [--persona <id>] [--level <0-5>]
 */

import { config as loadDotenv } from 'dotenv'
import * as path from 'path'

loadDotenv({
  path: path.resolve(process.cwd(), '.env.local'),
  override: true,
})

import('./main-review')
  .then((m) => m.run())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
