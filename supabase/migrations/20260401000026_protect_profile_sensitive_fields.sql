-- File purpose: Creates or updates Supabase database structure, policies, seed data, or backend logic.
-- ============================================================================
-- Migration: Protect Sensitive Profile Fields
-- Description: Users may update their own display/contact fields, but only
--              admins may change role, store assignment, status, or email.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
BEGIN
  -- Service role/admin API operations do not carry auth.uid(); allow them.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_role = 'admin'::user_role THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.store_id IS DISTINCT FROM OLD.store_id
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at
  THEN
    RAISE EXCEPTION 'Only admins can update sensitive profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON profiles;

CREATE TRIGGER trg_protect_profile_sensitive_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();
