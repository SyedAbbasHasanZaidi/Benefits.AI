-- ── Profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  preferred_name   TEXT,
  dob              DATE,
  language         TEXT DEFAULT 'English',
  relationship     TEXT,
  dependents       INT DEFAULT 0,
  living           TEXT,
  state            TEXT,
  employment       TEXT,
  occupation       TEXT,
  study            TEXT,
  email_notif      BOOLEAN DEFAULT TRUE,
  assessment_upd   BOOLEAN DEFAULT TRUE,
  program_alerts   BOOLEAN DEFAULT FALSE,
  improve_data     BOOLEAN DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Conversations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  variables   JSONB NOT NULL DEFAULT '{}',
  status      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX conversations_user_idx ON conversations(user_id, updated_at DESC);

-- ── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at);

-- ── Assessments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  programs        JSONB NOT NULL,
  total           INTEGER NOT NULL DEFAULT 0,
  claimable       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX assessments_conv_idx ON assessments(conversation_id, created_at DESC);

-- ── Account export requests ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  delivered_to    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── updated_at auto-touch trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER conversations_touch_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_exports  ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_own ON profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY conversations_own ON conversations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY messages_own ON messages
  FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))
  WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY assessments_own ON assessments
  FOR ALL USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))
  WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY account_exports_own ON account_exports
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
