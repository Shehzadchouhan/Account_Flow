-- =============================================================================
-- Migration 2: Integrity Functions, Triggers & Business Logic
-- Phase 2: Database Design for FinanceFlow
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper Functions: is_active_user() and is_admin()
-- Evaluates caller identity and permissions with safe search_path
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true AND role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. set_updated_at Trigger Function
-- Automatically updates updated_at column to current timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Attach set_updated_at to all tables with updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_firms_updated_at
  BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_document_types_updated_at
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_firm_template_items_updated_at
  BEFORE UPDATE ON public.firm_template_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_case_documents_updated_at
  BEFORE UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_dispatches_updated_at
  BEFORE UPDATE ON public.dispatches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_dispatch_items_updated_at
  BEFORE UPDATE ON public.dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Append-Only Protection for activity_logs
-- Blocks UPDATE and DELETE operations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_block_activity_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is an append-only audit table. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

CREATE TRIGGER trg_activity_logs_append_only
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_activity_log_mutation();

-- -----------------------------------------------------------------------------
-- 3. Prevent Hard Delete on dispatches and dispatch_items
-- Corrections happen only by voiding or deactivating
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_prevent_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion is strictly prohibited on %. Corrections happen only by voiding or soft deletion.', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_dispatches_prevent_delete
  BEFORE DELETE ON public.dispatches
  FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_hard_delete();

CREATE TRIGGER trg_dispatch_items_prevent_delete
  BEFORE DELETE ON public.dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_hard_delete();

-- -----------------------------------------------------------------------------
-- 4. Column Protection & Receipt Validation on case_documents
-- - Non-admins can only update received_at, received_by, notes, updated_at
-- - Forces received_by to auth.uid() when receiving
-- - Blocks clearing received_at if the document is part of an active dispatch item
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_case_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_in_active_dispatch boolean;
BEGIN
  v_is_admin := public.is_admin();

  -- 1. Restrict columns for non-admin users
  IF NOT v_is_admin THEN
    IF OLD.case_id <> NEW.case_id
       OR OLD.document_type_id <> NEW.document_type_id
       OR OLD.is_required <> NEW.is_required
       OR OLD.removed_at IS DISTINCT FROM NEW.removed_at THEN
      RAISE EXCEPTION 'Permission denied: Staff members can only update receipt status and notes.';
    END IF;
  END IF;

  -- 2. Force received_by to current authenticated user when document is marked received
  IF NEW.received_at IS NOT NULL AND OLD.received_at IS NULL THEN
    NEW.received_by := auth.uid();
  END IF;

  -- 3. Block un-receiving a document if it is currently in an active dispatch
  IF OLD.received_at IS NOT NULL AND NEW.received_at IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.dispatch_items
      WHERE case_document_id = OLD.id AND is_active = true
    ) INTO v_in_active_dispatch;

    IF v_in_active_dispatch THEN
      RAISE EXCEPTION 'Cannot un-receive document %: it is currently part of an active dispatch. Void the dispatch first.', OLD.id;
    END IF;

    NEW.received_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_documents_column_protection
  BEFORE UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_documents_guard();

-- -----------------------------------------------------------------------------
-- 5. Dispatch Item Validation Trigger
-- - Item must belong to the exact same case as the dispatch
-- - Cannot add items to a voided dispatch
-- - Document must be received and not soft-deleted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_validate_dispatch_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_dispatch_case_id uuid;
  v_dispatch_voided_at timestamptz;
  v_doc_case_id uuid;
  v_received_at timestamptz;
  v_removed_at timestamptz;
BEGIN
  -- When an existing item is simply being deactivated (e.g. during void_dispatch), allow it through
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT case_id, voided_at INTO v_dispatch_case_id, v_dispatch_voided_at
  FROM public.dispatches WHERE id = NEW.dispatch_id;

  SELECT case_id, received_at, removed_at INTO v_doc_case_id, v_received_at, v_removed_at
  FROM public.case_documents WHERE id = NEW.case_document_id;

  IF v_dispatch_case_id IS NULL OR v_doc_case_id IS NULL THEN
    RAISE EXCEPTION 'Referenced dispatch or case document does not exist.';
  END IF;

  -- Reject adding or reactivating items for a voided dispatch
  IF v_dispatch_voided_at IS NOT NULL AND NEW.is_active = true THEN
    RAISE EXCEPTION 'Cannot add dispatch item: Dispatch % is voided.', NEW.dispatch_id;
  END IF;

  -- Case cross-check
  IF v_dispatch_case_id <> v_doc_case_id THEN
    RAISE EXCEPTION 'Case mismatch: Document % belongs to case %, but dispatch % belongs to case %',
      NEW.case_document_id, v_doc_case_id, NEW.dispatch_id, v_dispatch_case_id;
  END IF;

  -- Document eligibility when active
  IF NEW.is_active = true THEN
    IF v_received_at IS NULL THEN
      RAISE EXCEPTION 'Document % cannot be dispatched because it has not been received yet.', NEW.case_document_id;
    END IF;
    IF v_removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Document % cannot be dispatched because it has been soft-deleted/removed.', NEW.case_document_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispatch_items_validate
  BEFORE INSERT OR UPDATE ON public.dispatch_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_dispatch_item();

-- -----------------------------------------------------------------------------
-- 6. Activity Log Triggers for Document Receipt & Dispatch Creation
-- Automatically records audit events
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_case_document_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF OLD.received_at IS NULL AND NEW.received_at IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'RECEIVE_DOCUMENT',
      'case_documents',
      NEW.id,
      jsonb_build_object('case_id', NEW.case_id, 'document_type_id', NEW.document_type_id)
    );
  ELSIF OLD.received_at IS NOT NULL AND NEW.received_at IS NULL THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'UNRECEIVE_DOCUMENT',
      'case_documents',
      NEW.id,
      jsonb_build_object('case_id', NEW.case_id, 'document_type_id', NEW.document_type_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_documents_log_activity
  AFTER UPDATE OF received_at ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_case_document_activity();

CREATE OR REPLACE FUNCTION public.trg_log_dispatch_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    NEW.recorded_by,
    'CREATE_DISPATCH',
    'dispatches',
    NEW.id,
    jsonb_build_object('case_id', NEW.case_id, 'recipient', NEW.recipient)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispatches_log_creation
  AFTER INSERT ON public.dispatches
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_dispatch_creation();

-- -----------------------------------------------------------------------------
-- 7. Optimistic Locking Trigger on cases
-- Automatically increments version on every successful update.
-- App checks affected rows = 0 when using WHERE id = ? AND version = ?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_case_increment_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_optimistic_lock
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_case_increment_version();

-- -----------------------------------------------------------------------------
-- 8. Atomic void_dispatch() Function
-- Callable ONLY by administrators.
-- Voids dispatch, deactivates items, logs activity atomically.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_dispatch(p_dispatch_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_case_id uuid;
  v_voided_at timestamptz;
BEGIN
  -- 1. Security Check: Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can void dispatches.';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A non-empty void reason is required.';
  END IF;

  -- 3. Retrieve and lock dispatch
  SELECT case_id, voided_at INTO v_case_id, v_voided_at
  FROM public.dispatches
  WHERE id = p_dispatch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch % not found.', p_dispatch_id;
  END IF;

  IF v_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Dispatch % has already been voided.', p_dispatch_id;
  END IF;

  -- 4. Mark dispatch voided
  UPDATE public.dispatches
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_dispatch_id;

  -- 5. Deactivate associated dispatch items
  UPDATE public.dispatch_items
  SET is_active = false,
      updated_at = now()
  WHERE dispatch_id = p_dispatch_id;

  -- 6. Record append-only activity log
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'VOID_DISPATCH',
    'dispatches',
    p_dispatch_id,
    jsonb_build_object(
      'case_id', v_case_id,
      'reason', trim(p_reason)
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Auto-create Inactive Profile Trigger on auth.users insert
-- Newly signed-up users are is_active = false until approved by an administrator
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger on auth.users if exists, then attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_handle_new_auth_user();
