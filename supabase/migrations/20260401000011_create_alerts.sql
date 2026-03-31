-- ============================================================================
-- Migration: Create Alerts Table
-- Description: System-generated alerts for low stock, forecast warnings,
--              and restock suggestions
-- ============================================================================

CREATE TABLE alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id),
  device_id        UUID REFERENCES devices(id),
  alert_type       alert_type NOT NULL,
  severity         alert_severity NOT NULL DEFAULT 'medium',
  status           alert_status NOT NULL DEFAULT 'active',
  title            TEXT NOT NULL,
  message          TEXT,
  current_quantity INTEGER,
  threshold        INTEGER,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_store_id ON alerts(store_id);
CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
