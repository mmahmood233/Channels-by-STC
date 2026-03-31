-- ============================================================================
-- Migration: Create Stores Table
-- Description: Retail branches and warehouse locations.
--              The warehouse is stored as a row with is_warehouse = TRUE.
-- ============================================================================

CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  region      TEXT,
  phone       TEXT,
  is_warehouse BOOLEAN NOT NULL DEFAULT FALSE,
  status      location_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_stores_name UNIQUE (name),
  CONSTRAINT uq_stores_code UNIQUE (code)
);

-- Only one warehouse can exist in the system
CREATE UNIQUE INDEX uq_stores_single_warehouse
  ON stores (is_warehouse) WHERE is_warehouse = TRUE;

-- Auto-update updated_at on modification
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
