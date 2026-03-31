-- ============================================================================
-- Migration: Create Sales and Sale Items Tables
-- Description: Sales header + line items (normalized design).
--              A sale can contain multiple devices.
-- ============================================================================

-- Sales header - one row per transaction
CREATE TABLE sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id),
  sold_by      UUID REFERENCES profiles(id),
  sale_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sales_total_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_sold_by ON sales(sold_by);
CREATE INDEX idx_sales_store_date ON sales(store_id, sale_date);

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sale line items - one row per device per sale
CREATE TABLE sale_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  device_id  UUID NOT NULL REFERENCES devices(id),
  quantity   INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sale_items_quantity_positive    CHECK (quantity > 0),
  CONSTRAINT chk_sale_items_unit_price_non_neg   CHECK (unit_price >= 0),
  CONSTRAINT chk_sale_items_line_total_non_neg   CHECK (line_total >= 0)
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_device_id ON sale_items(device_id);
