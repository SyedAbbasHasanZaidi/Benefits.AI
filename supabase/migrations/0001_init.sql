-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- gen_random_uuid() fallback


-- ── Sessions ─────────────────────────────────────────────────────────────────
-- Anonymous session tracking. No PII stored — only extracted variables (e.g.
-- income, state) needed to run the eligibility engine.

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    variables   JSONB NOT NULL DEFAULT '{}',   -- accumulated OpenFisca variables
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);


-- ── Events ───────────────────────────────────────────────────────────────────
-- PII-scrubbed audit trail. Raw prompts are never stored here.
-- event_type examples: 'extraction', 'calculate', 'explain', 'feedback'

CREATE TABLE IF NOT EXISTS events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX events_session_id_idx ON events(session_id);
CREATE INDEX events_event_type_idx ON events(event_type);


-- ── Corpus chunks ─────────────────────────────────────────────────────────────
-- RAG vector store. All content is authoritative public-domain government text.
-- Voyage voyage-3 produces 1024-dimension embeddings.

CREATE TABLE IF NOT EXISTS corpus_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id       TEXT NOT NULL,
    tier            TEXT NOT NULL CHECK (tier IN ('federal', 'state', 'council')),
    source_url      TEXT NOT NULL,
    last_verified   DATE NOT NULL,
    chunk_index     INTEGER NOT NULL,
    chunk_text      TEXT NOT NULL,
    embedding       vector(1024),
    metadata        JSONB NOT NULL DEFAULT '{}'
);

-- HNSW index — sub-linear cosine similarity search
CREATE INDEX corpus_chunks_embedding_idx
    ON corpus_chunks USING hnsw (embedding vector_cosine_ops);

-- Metadata pre-filters: applied before vector search to dramatically reduce
-- the candidate set and improve answer faithfulness.
CREATE INDEX corpus_chunks_scheme_id_idx ON corpus_chunks(scheme_id);
CREATE INDEX corpus_chunks_tier_idx      ON corpus_chunks(tier);

COMMENT ON TABLE corpus_chunks IS
    'RAG corpus. Filter by scheme_id before vector search to constrain '
    'retrieved passages to the schemes the engine actually returned eligible.';


-- ── Feedback ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    scheme_ids  TEXT[] NOT NULL DEFAULT '{}'
);


-- ── Session context helper ────────────────────────────────────────────────────
-- The server Supabase client calls this before any DML so RLS can scope access
-- to the current anonymous session without requiring auth tokens.

CREATE OR REPLACE FUNCTION set_session_id(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('app.session_id', p_session_id::text, true);
END;
$$;


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE corpus_chunks ENABLE ROW LEVEL SECURITY;

-- Sessions: only the session that set the config can read/write its own row
CREATE POLICY sessions_own ON sessions
    FOR ALL
    USING (id::text = current_setting('app.session_id', true));

-- Events: scoped to the current session
CREATE POLICY events_own ON events
    FOR ALL
    USING (session_id::text = current_setting('app.session_id', true));

-- Feedback: insert-only (users cannot read other sessions' feedback)
CREATE POLICY feedback_insert ON feedback
    FOR INSERT
    WITH CHECK (session_id::text = current_setting('app.session_id', true));

-- Corpus chunks: publicly readable — this is authoritative public-domain text
CREATE POLICY corpus_chunks_read ON corpus_chunks
    FOR SELECT
    USING (true);
