-- ============================================================================
-- Migration: Create Enums
-- Description: All PostgreSQL enum types used across the database
-- ============================================================================

-- User roles in the system
CREATE TYPE user_role AS ENUM (
  'admin',
  'store_manager',
  'warehouse_manager'
);

-- Profile account status
CREATE TYPE profile_status AS ENUM (
  'active',
  'inactive'
);

-- Store/warehouse location status
CREATE TYPE location_status AS ENUM (
  'active',
  'inactive'
);

-- Device/product lifecycle status
CREATE TYPE device_status AS ENUM (
  'active',
  'discontinued'
);

-- Types of stock movements for audit trail
CREATE TYPE movement_type AS ENUM (
  'sale',           -- stock out due to a sale
  'transfer_in',    -- stock in from another location
  'transfer_out',   -- stock out to another location
  'restock',        -- stock in from supplier/external source
  'adjustment',     -- manual correction (positive or negative)
  'return'          -- stock in from a customer return
);

-- Transfer workflow statuses
CREATE TYPE transfer_status AS ENUM (
  'pending',        -- transfer requested, awaiting approval
  'approved',       -- approved but not yet shipped
  'in_transit',     -- stock has left source, not yet received
  'completed',      -- stock received at destination
  'cancelled'       -- transfer was cancelled
);

-- Alert classification types
CREATE TYPE alert_type AS ENUM (
  'low_stock',            -- stock below threshold
  'out_of_stock',         -- stock at zero
  'overstock',            -- stock unusually high
  'forecast_warning',     -- forecast predicts a future shortage
  'restock_suggestion'    -- system suggests a restock action
);

-- Alert severity levels
CREATE TYPE alert_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Alert lifecycle statuses
CREATE TYPE alert_status AS ENUM (
  'active',        -- new alert, needs attention
  'acknowledged',  -- user has seen it, not resolved
  'resolved',      -- underlying issue has been fixed
  'dismissed'      -- user chose to ignore it
);

-- Chatbot interaction result statuses
CREATE TYPE chatbot_status AS ENUM (
  'success',   -- question answered successfully
  'error',     -- something went wrong
  'timeout',   -- OpenAI took too long
  'no_data'    -- query returned no matching data
);
