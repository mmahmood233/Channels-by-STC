-- ============================================================================
-- Migration: Create Stock Movements Table
-- Description: Append-only audit log of every inventory change.
--              Every time inventory.quantity changes, a row is inserted here.
-- ============================================================================

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  device_id       UUID NOT NULL REFERENCES devices(id),
  movement_type   movement_type NOT NULL,
  quantity        INTEGER NOT NULL,
  reference_type  TEXT,          -- 'sale', 'transfer', 'manual', etc.
  reference_id    UUID,          -- ID of the related sale, transfer, or other record
  notes           TEXT,
  performed_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_stock_movements_quantity_not_zero CHECK (quantity != 0)
);

CREATE INDEX idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX idx_stock_movements_device_id ON stock_movements(device_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
