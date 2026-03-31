-- ============================================================================
-- Migration: Create Profiles Table
-- Description: Application-level user data linked to Supabase auth.users.
--              Every auth user gets a corresponding profile row.
-- ============================================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'store_manager',
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  phone           TEXT,
  avatar_url      TEXT,
  status          profile_status NOT NULL DEFAULT 'active',
  last_sign_in_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_profiles_email UNIQUE (email)
);

CREATE INDEX idx_profiles_store_id ON profiles(store_id);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
