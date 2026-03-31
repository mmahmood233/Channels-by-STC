-- ============================================================================
-- Migration: Create Inventory Table
-- Description: Current stock quantity of each device at each location.
--              One row per (store, device) combination.
-- ============================================================================

CREATE TABLE inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id),
  device_id  UUID NOT NULL REFERENCES devices(id),
  quantity   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_inventory_store_device UNIQUE (store_id, device_id),
  CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0)
);

CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_device_id ON inventory(device_id);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
