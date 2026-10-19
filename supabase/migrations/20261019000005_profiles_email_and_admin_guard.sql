-- =============================================================================
-- Migration 5: Profiles Email, Last-Admin Protection & Administrative Audit Logging
-- Phase 3: Firms, Document Types, Templates & User Admin
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add email column to public.profiles and backfill from auth.users
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- -----------------------------------------------------------------------------
-- 2. Update trg_handle_new_auth_user() to populate email
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'staff',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Last-Admin Protection Trigger
-- Prohibits demoting or deactivating the last remaining active administrator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_protect_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining_admins int;
BEGIN
  -- If deleting an active admin, or updating an active admin away from admin or active=false
  IF (TG_OP = 'DELETE' AND OLD.role = 'admin' AND OLD.is_active = true) OR
     (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND OLD.is_active = true AND
      (NEW.role <> 'admin' OR NEW.is_active = false)) THEN

    SELECT COUNT(*) INTO v_remaining_admins
    FROM public.profiles
    WHERE role = 'admin' AND is_active = true AND id <> OLD.id;

    IF v_remaining_admins = 0 THEN
      RAISE EXCEPTION 'Operation prohibited: Cannot deactivate or demote the last remaining active administrator.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_last_admin_guard ON public.profiles;
CREATE TRIGGER trg_profiles_last_admin_guard
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_last_admin();

-- -----------------------------------------------------------------------------
-- 4. Audit Logging Trigger: firms
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE_FIRM';
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_action,
      'firms',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'contact_person', NEW.contact_person,
        'default_employee', NEW.default_employee,
        'is_active', NEW.is_active
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'ARCHIVE_FIRM';
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action := 'RESTORE_FIRM';
    ELSE
      v_action := 'UPDATE_FIRM';
    END IF;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_action,
      'firms',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'old_name', OLD.name,
        'contact_person', NEW.contact_person,
        'default_employee', NEW.default_employee,
        'is_active', NEW.is_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_firms_activity_logger ON public.firms;
CREATE TRIGGER trg_firms_activity_logger
  AFTER INSERT OR UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_firm_activity();

-- -----------------------------------------------------------------------------
-- 5. Audit Logging Trigger: document_types
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_document_type_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE_DOCUMENT_TYPE';
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_action,
      'document_types',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'is_active', NEW.is_active
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active <> NEW.is_active THEN
      v_action := 'TOGGLE_DOCUMENT_TYPE_ACTIVE';
    ELSE
      v_action := 'UPDATE_DOCUMENT_TYPE';
    END IF;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_action,
      'document_types',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'old_name', OLD.name,
        'is_active', NEW.is_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_types_activity_logger ON public.document_types;
CREATE TRIGGER trg_document_types_activity_logger
  AFTER INSERT OR UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_document_type_activity();

-- -----------------------------------------------------------------------------
-- 6. Audit Logging Trigger: firm_template_items
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_template_item_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'ADD_TEMPLATE_ITEM',
      'firm_template_items',
      NEW.id,
      jsonb_build_object(
        'firm_id', NEW.firm_id,
        'document_type_id', NEW.document_type_id,
        'is_required', NEW.is_required
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'UPDATE_TEMPLATE_ITEM',
      'firm_template_items',
      NEW.id,
      jsonb_build_object(
        'firm_id', NEW.firm_id,
        'document_type_id', NEW.document_type_id,
        'is_required', NEW.is_required,
        'old_is_required', OLD.is_required
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'REMOVE_TEMPLATE_ITEM',
      'firm_template_items',
      OLD.id,
      jsonb_build_object(
        'firm_id', OLD.firm_id,
        'document_type_id', OLD.document_type_id
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_firm_template_items_activity_logger ON public.firm_template_items;
CREATE TRIGGER trg_firm_template_items_activity_logger
  AFTER INSERT OR UPDATE OR DELETE ON public.firm_template_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_template_item_activity();

-- -----------------------------------------------------------------------------
-- 7. Audit Logging Trigger: profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_profile_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role <> NEW.role THEN
      v_action := 'UPDATE_PROFILE_ROLE';
    ELSIF OLD.is_active <> NEW.is_active THEN
      v_action := 'TOGGLE_USER_ACTIVE';
    ELSE
      v_action := 'UPDATE_PROFILE';
    END IF;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      v_action,
      'profiles',
      NEW.id,
      jsonb_build_object(
        'full_name', NEW.full_name,
        'old_role', OLD.role,
        'new_role', NEW.role,
        'old_is_active', OLD.is_active,
        'new_is_active', NEW.is_active
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_activity_logger ON public.profiles;
CREATE TRIGGER trg_profiles_activity_logger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_profile_activity();

-- -----------------------------------------------------------------------------
-- 8. Hardening: Revoke ALL from anon and PUBLIC, Grant EXECUTE to authenticated
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.trg_protect_last_admin() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.trg_log_firm_activity() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.trg_log_document_type_activity() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.trg_log_template_item_activity() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.trg_log_profile_activity() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.trg_protect_last_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_log_firm_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_log_document_type_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_log_template_item_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_log_profile_activity() TO authenticated;
