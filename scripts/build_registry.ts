/**
 * Fetches the OpenFisca variable registry from the running rules service and
 * generates apps/web/lib/llm/variables.generated.ts — a TypeScript enum of
 * every valid variable name.
 *
 * WHY: The LLM's set_variable tool is schema-locked to this enum at runtime.
 * The LLM cannot call set_variable with a name not in this list, which prevents
 * hallucinated variable names from reaching the rules engine.
 *
 * Run after any change to apps/rules/openfisca_au/variables/:
 *   pnpm --filter scripts run build-registry
 *
 * Also runs automatically in CI via .github/workflows/ci.yml.
 */

// TODO: Milestone 4 — implement after the first variables are added in Milestone 2.
console.log('[build-registry] Not yet implemented. Revisit in Milestone 4.');
process.exit(0);
