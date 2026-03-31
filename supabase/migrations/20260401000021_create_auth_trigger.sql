-- ============================================================================
-- Migration: Create Auth Trigger and Inventory Safety Trigger
-- Description:
--   1. Auto-create profile when a new user signs up via Supabase Auth
--   2. Descriptive error on negative inventory
-- ============================================================================

-- ── Auth user created → auto-create profile ────────────────────────────────
CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Inventory safety trigger ───────────────────────────────────────────────
-- Provides a human-readable error instead of a raw CHECK constraint violation
CREATE TRIGGER trg_inventory_check_quantity
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION public.check_inventory_quantity();
