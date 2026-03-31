-- ============================================================================
-- Migration: Create Devices Table
-- Description: Product catalog - every device the company sells
-- ============================================================================

CREATE TABLE devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 TEXT NOT NULL,
  name                TEXT NOT NULL,
  brand               TEXT NOT NULL,
  category_id         UUID NOT NULL REFERENCES categories(id),
  unit_price          NUMERIC(12,2) NOT NULL,
  cost_price          NUMERIC(12,2),
  description         TEXT,
  image_url           TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  status              device_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_devices_sku UNIQUE (sku),
  CONSTRAINT chk_devices_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT chk_devices_cost_price_non_negative CHECK (cost_price >= 0),
  CONSTRAINT chk_devices_threshold_non_negative  CHECK (low_stock_threshold >= 0)
);

CREATE INDEX idx_devices_category_id ON devices(category_id);
CREATE INDEX idx_devices_brand ON devices(brand);
CREATE INDEX idx_devices_status ON devices(status);

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
