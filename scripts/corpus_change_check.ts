/**
 * Fetches the canonical source URL recorded in each corpus file's frontmatter,
 * hashes the response body, and compares against the hash stored in
 * corpus/.hashes.json. Exits non-zero when any source page has changed,
 * causing the GitHub Actions job to fail and alert the team.
 *
 * Runs on a weekly schedule so stale rules are flagged before they mislead
 * users. When alerted, a developer updates the relevant corpus/*.md file and
 * runs ingest-corpus to refresh the vector store.
 *
 * Usage:
 *   pnpm --filter scripts run corpus-change-check
 */

// TODO: Milestone 10 — implement after the corpus pipeline is in place.
console.log('[corpus-change-check] Not yet implemented. Revisit in Milestone 10.');
process.exit(0);
