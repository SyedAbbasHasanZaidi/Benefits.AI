-- RPC for pgvector cosine similarity search scoped to a set of scheme IDs.
-- Called by lib/retriever/query.ts on every chat turn.
-- filter_scheme_ids: when provided, restricts search to those schemes only.

CREATE OR REPLACE FUNCTION match_corpus_chunks(
  query_embedding   vector(1024),
  match_count       int     DEFAULT 4,
  filter_scheme_ids text[]  DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  scheme_id   text,
  chunk_text  text,
  metadata    jsonb,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    scheme_id,
    chunk_text,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM corpus_chunks
  WHERE
    filter_scheme_ids IS NULL
    OR scheme_id = ANY(filter_scheme_ids)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
