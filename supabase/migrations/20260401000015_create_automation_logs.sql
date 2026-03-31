-- ============================================================================
-- Migration: Create Automation Logs Table
-- Description: Records results of automated processes (forecast runs,
--              alert sweeps, restock suggestions). Append-only.
-- ============================================================================

CREATE TABLE automation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type   TEXT NOT NULL,       -- e.g. 'forecast_run', 'alert_sweep'
  status            TEXT NOT NULL,       -- 'success', 'partial', 'failed'
  records_processed INTEGER,
  records_created   INTEGER,
  details           JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_logs_type ON automation_logs(automation_type);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
