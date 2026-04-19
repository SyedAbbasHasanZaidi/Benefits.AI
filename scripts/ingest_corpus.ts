/**
 * Reads Markdown files from corpus/, splits them into 500–800 token chunks
 * (heading-aware), embeds each chunk with Voyage voyage-3, and upserts into
 * the corpus_chunks table on Supabase. Idempotent — chunks are keyed by a
 * hash of (scheme_id + chunk_index + content).
 *
 * Every corpus file must have this frontmatter:
 *   ---
 *   scheme_id: FTB_A
 *   source_url: https://www.servicesaustralia.gov.au/...
 *   last_verified: 2025-07-01
 *   ---
 *
 * Run after adding or editing any corpus/*.md file:
 *   pnpm --filter scripts run ingest-corpus
 */

// TODO: Milestone 6 — implement once the first corpus files are added.
console.log('[ingest-corpus] Not yet implemented. Revisit in Milestone 6.');
process.exit(0);
