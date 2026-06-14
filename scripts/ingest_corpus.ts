/**
 * Reads Markdown files from corpus/, splits them into chunks,
 * embeds each chunk with Voyage voyage-3, and upserts into
 * the corpus_chunks table on Supabase. Idempotent — safe to re-run.
 *
 * Requires in scripts/.env (or environment):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (bypasses RLS for inserts)
 *   VOYAGE_API_KEY
 *
 * Run:
 *   pnpm --filter scripts run ingest-corpus
 */

import { createClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import { VoyageAIClient } from 'voyageai'
import { createHash } from 'crypto'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { config } from 'dotenv'

// Load .env from the scripts directory
config({ path: resolve(import.meta.dirname, '.env') })

// ── Clients ───────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const voyageApiKey = process.env.VOYAGE_API_KEY

if (!supabaseUrl || !serviceRoleKey || !voyageApiKey) {
  console.error('Missing required env vars. Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const voyage = new VoyageAIClient({ apiKey: voyageApiKey })

// ── Corpus file discovery ─────────────────────────────────────────────────────

const CORPUS_ROOT = resolve(import.meta.dirname, '../corpus')

interface CorpusFile {
  path: string
  schemeId: string
  tier: string
  sourceUrl: string
  lastVerified: string
  body: string
}

function walkDir(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

function loadCorpusFile(path: string): CorpusFile | null {
  const raw = readFileSync(path, 'utf-8')
  const { data, content } = matter(raw)

  if (!data.scheme_id || !data.source_url || !data.last_verified) {
    console.warn(`  ⚠ Skipping ${path} — missing required frontmatter`)
    return null
  }

  // Infer tier from path: corpus/federal/... → federal, corpus/nsw/... → state, councils → council
  const rel = path.replace(CORPUS_ROOT, '').replace(/\\/g, '/')
  let tier = 'federal'
  if (rel.startsWith('/nsw/')) tier = 'state'
  else if (rel.startsWith('/councils/')) tier = 'council'

  return {
    path,
    schemeId: String(data.scheme_id),
    tier,
    sourceUrl: String(data.source_url),
    lastVerified: String(data.last_verified),
    body: content.trim(),
  }
}

// ── Chunking ──────────────────────────────────────────────────────────────────

// Target ~600 tokens ≈ 2400 chars. Split on H2/H3 headings first.
const TARGET_CHARS = 2400
const MAX_CHARS = 3200

function splitIntoChunks(body: string): string[] {
  // Split on heading lines (## or ###)
  const sections = body.split(/(?=\n#{2,3} )/).map((s) => s.trim()).filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const section of sections) {
    if (current.length + section.length > MAX_CHARS && current.length > 0) {
      chunks.push(current.trim())
      current = section
    } else {
      current = current ? `${current}\n\n${section}` : section
    }

    // If a single section exceeds MAX_CHARS, split by paragraph
    if (current.length > MAX_CHARS) {
      const paras = current.split(/\n\n+/)
      let sub = ''
      for (const para of paras) {
        if (sub.length + para.length > TARGET_CHARS && sub.length > 0) {
          chunks.push(sub.trim())
          sub = para
        } else {
          sub = sub ? `${sub}\n\n${para}` : para
        }
      }
      if (sub.trim()) chunks.push(sub.trim())
      current = ''
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length > 30)
}

// ── Embedding with rate-limit handling ───────────────────────────────────────

const BATCH_SIZE = 8 // Voyage allows up to 128; stay conservative
const DELAY_MS = 300 // Pause between batches to respect rate limits

async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await voyage.embed({ input: texts, model: 'voyage-3' })
  return (result.data ?? []).map((d) => d.embedding ?? [])
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// ── Upsert ────────────────────────────────────────────────────────────────────

function chunkId(schemeId: string, index: number, text: string): string {
  return createHash('sha256')
    .update(`${schemeId}:${index}:${text}`)
    .digest('hex')
    .slice(0, 16)
}

async function upsertChunks(file: CorpusFile, chunks: string[], embeddings: number[][]) {
  const rows = chunks.map((text, i) => ({
    id: chunkId(file.schemeId, i, text),
    scheme_id: file.schemeId,
    tier: file.tier,
    source_url: file.sourceUrl,
    last_verified: file.lastVerified,
    chunk_index: i,
    chunk_text: text,
    embedding: embeddings[i],
    metadata: {},
  }))

  const { error } = await supabase
    .from('corpus_chunks')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📚 Benefits.AI — corpus ingestion\n')

  const paths = walkDir(CORPUS_ROOT)
  console.log(`Found ${paths.length} corpus files\n`)

  const files = paths.map(loadCorpusFile).filter((f): f is CorpusFile => f !== null)

  // Collect all chunks across all files
  const allChunks: { file: CorpusFile; text: string; index: number }[] = []
  for (const file of files) {
    const chunks = splitIntoChunks(file.body)
    chunks.forEach((text, index) => allChunks.push({ file, text, index }))
  }

  console.log(`Total chunks to embed: ${allChunks.length}\n`)

  // Embed in batches
  const embeddings: number[][] = new Array(allChunks.length)
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE)
    process.stdout.write(`  Embedding batch ${batchNum}/${totalBatches}...`)

    const vecs = await embedBatch(batch.map((c) => c.text))
    vecs.forEach((vec, j) => { embeddings[i + j] = vec })

    console.log(` ✓`)
    if (i + BATCH_SIZE < allChunks.length) await sleep(DELAY_MS)
  }

  // Upsert per file
  console.log('\nUpserting to Supabase...')
  for (const file of files) {
    const fileChunks = allChunks.filter((c) => c.file === file)
    const fileEmbeddings = fileChunks.map((c) => embeddings[allChunks.indexOf(c)])
    await upsertChunks(file, fileChunks.map((c) => c.text), fileEmbeddings)
    console.log(`  ✓ ${file.schemeId} (${fileChunks.length} chunks)`)
  }

  console.log(`\n✅ Done — ${allChunks.length} chunks upserted across ${files.length} schemes.`)
}

main().catch((err) => {
  console.error('\n❌ Ingestion failed:', err)
  process.exit(1)
})
