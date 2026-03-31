-- ============================================================================
-- Migration: Create RLS Helper Functions and Business Logic Functions
-- Description: Functions used by RLS policies and triggers.
--              SECURITY DEFINER so they can read profiles even when RLS is on.
-- ============================================================================

-- ── Role lookup ────────────────────────────────────────────────────────────
-- Returns the current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the current authenticated user's assigned store ID
CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── Auth trigger function ──────────────────────────────────────────────────
-- Automatically creates a profile row when a new user signs up via Supabase Auth.
-- Reads full_name and role from raw_user_meta_data if provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'store_manager'
    ),
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Inventory safety trigger function ──────────────────────────────────────
-- Provides a descriptive error message when stock would go negative.
-- The CHECK constraint on inventory.quantity >= 0 is the hard enforcement;
-- this trigger gives a human-readable error instead of a raw constraint violation.
CREATE OR REPLACE FUNCTION public.check_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: "%" has only % units at "%", cannot reduce by %',
      (SELECT name FROM devices WHERE id = NEW.device_id),
      OLD.quantity,
      (SELECT name FROM stores WHERE id = NEW.store_id),
      (OLD.quantity - NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
