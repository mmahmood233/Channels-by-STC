-- ============================================================================
-- Migration: Create Helper Functions
-- Description: Utility functions used by triggers across all tables
-- ============================================================================

-- Automatically sets updated_at to current timestamp on row update.
-- Applied via BEFORE UPDATE trigger on every table that has an updated_at column.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
