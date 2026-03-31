-- ============================================================================
-- Migration: Create Chatbot Logs Table
-- Description: Logs every AI chatbot interaction for auditing, debugging,
--              and usage analysis. Append-only - never updated or deleted.
-- ============================================================================

CREATE TABLE chatbot_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id),
  user_role         user_role NOT NULL,         -- snapshot of role at time of query
  store_id          UUID REFERENCES stores(id), -- store context if store manager
  question          TEXT NOT NULL,
  interpreted_intent TEXT,
  query_context     JSONB,                      -- data sent to OpenAI as context
  answer            TEXT,
  status            chatbot_status NOT NULL DEFAULT 'success',
  error_message     TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  response_time_ms  INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatbot_logs_user_id ON chatbot_logs(user_id);
CREATE INDEX idx_chatbot_logs_created_at ON chatbot_logs(created_at);
