/**
 * Simulator entry point. Loads .env.local FIRST (because AnthropicProvider
 * captures process.env.ANTHROPIC_API_KEY at module-load), then defers to
 * main.ts via dynamic import so all downstream imports see the env vars.
 *
 * Invoke via: pnpm --filter web run sim [-- --persona <id>] [--level <0-5>]
 */

import { config as loadDotenv } from 'dotenv'
import * as path from 'path'

loadDotenv({
  path: path.resolve(process.cwd(), '.env.local'),
  override: true,
})

import('./main')
  .then((m) => m.run())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
