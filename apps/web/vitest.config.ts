import path from 'path'
import { defineConfig } from 'vitest/config'
import { config as loadDotEnv } from 'dotenv'

// Load .env.local before vitest starts so the LLM-judge suite picks up
// ANTHROPIC_API_KEY without needing it exported in the shell.
// override: true so .env.local wins over any stale shell/User-scope env vars
// (we hit this with a revoked ANTHROPIC_API_KEY lingering in Windows User env).
loadDotEnv({ path: path.resolve(__dirname, '.env.local'), override: true })

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // The LLM-judge suite makes live Anthropic calls and needs a long timeout
    // + secrets. Keep it out of the default `test` run; invoke explicitly via
    // `pnpm test:llm-judge`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/llm-judge/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
