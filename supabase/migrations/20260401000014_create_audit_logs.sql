-- ============================================================================
-- Migration: Create Audit Logs Table
-- Description: Records significant actions for accountability and traceability.
--              Append-only - never updated or deleted.
-- ============================================================================

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id),   -- NULL for system-generated actions
  action     TEXT NOT NULL,                   -- e.g. 'device.created', 'transfer.approved'
  table_name TEXT,
  record_id  UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
