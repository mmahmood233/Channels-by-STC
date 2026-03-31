-- ============================================================================
-- Migration: Additional Indexes
-- Description: Any composite or specialized indexes not already created
--              in individual table migrations. Currently all indexes have
--              been included in their respective migrations, so this file
--              serves as a placeholder for future index additions.
-- ============================================================================

-- All primary indexes have been created in their respective table migrations.
-- Add future performance-related indexes here as the application grows.

-- Example of a future index:
-- CREATE INDEX idx_sale_items_device_sale_date
--   ON sale_items(device_id)
--   INCLUDE (quantity, line_total);
