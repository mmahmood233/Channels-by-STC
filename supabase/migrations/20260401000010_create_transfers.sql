-- ============================================================================
-- Migration: Create Transfers and Transfer Items Tables
-- Description: Stock transfer requests between locations.
--              A transfer can contain multiple devices.
-- ============================================================================

-- Transfer header
CREATE TABLE transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_store_id       UUID NOT NULL REFERENCES stores(id),
  destination_store_id  UUID NOT NULL REFERENCES stores(id),
  requested_by          UUID NOT NULL REFERENCES profiles(id),
  approved_by           UUID REFERENCES profiles(id),
  status                transfer_status NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  transfer_date         DATE,    -- set when status becomes 'completed'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_transfers_different_locations CHECK (source_store_id != destination_store_id)
);

CREATE INDEX idx_transfers_source ON transfers(source_store_id);
CREATE INDEX idx_transfers_destination ON transfers(destination_store_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Transfer line items
CREATE TABLE transfer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  device_id   UUID NOT NULL REFERENCES devices(id),
  quantity    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_transfer_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_transfer_items_transfer_id ON transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_device_id ON transfer_items(device_id);
