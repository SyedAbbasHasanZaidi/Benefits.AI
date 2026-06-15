import path from 'path'
import { defineConfig } from 'vitest/config'

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
