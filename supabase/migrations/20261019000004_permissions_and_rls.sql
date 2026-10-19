-- =============================================================================
-- Migration 4: Permissions Hardening & Row Level Security (RLS)
-- Phase 2: Database Design for FinanceFlow
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Revoke Permissions from anon and PUBLIC (Default Deny)
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, PUBLIC;

-- Grant access to authenticated users only
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enable Row Level Security (RLS) on all 9 tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. RLS Policies: profiles
-- Read: active users can read all active team profiles
-- Insert/Update: admin only (and auth trigger)
-- Users cannot modify their own or others' roles or active status
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_select_active_user ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. RLS Policies: firms
-- Read: all active users
-- Insert/Update: admin only
-- -----------------------------------------------------------------------------
CREATE POLICY firms_select_active_user ON public.firms
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY firms_insert_admin ON public.firms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY firms_update_admin ON public.firms
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. RLS Policies: document_types
-- Read: all active users
-- Insert/Update: admin only
-- -----------------------------------------------------------------------------
CREATE POLICY document_types_select_active_user ON public.document_types
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY document_types_insert_admin ON public.document_types
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY document_types_update_admin ON public.document_types
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. RLS Policies: firm_template_items
-- Read: all active users
-- Insert/Update/Delete: admin only
-- -----------------------------------------------------------------------------
CREATE POLICY firm_template_items_select_active_user ON public.firm_template_items
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY firm_template_items_insert_admin ON public.firm_template_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY firm_template_items_update_admin ON public.firm_template_items
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY firm_template_items_delete_admin ON public.firm_template_items
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 7. RLS Policies: cases
-- Read: all active users
-- Insert/Update: admin only
-- -----------------------------------------------------------------------------
CREATE POLICY cases_select_active_user ON public.cases
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY cases_insert_admin ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY cases_update_admin ON public.cases
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 8. RLS Policies: case_documents
-- Read: all active users
-- Insert: admin only (adding documents to a case)
-- Update: active users (trigger trg_case_documents_guard restricts staff to
--         received_at, received_by, notes and blocks un-receiving dispatched docs)
-- -----------------------------------------------------------------------------
CREATE POLICY case_documents_select_active_user ON public.case_documents
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY case_documents_insert_admin ON public.case_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY case_documents_update_active_user ON public.case_documents
  FOR UPDATE TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

-- -----------------------------------------------------------------------------
-- 9. RLS Policies: dispatches
-- Read: all active users
-- Insert: admin only (staff dispatches created via create_dispatch() in Phase 5)
-- Update: NO policy (corrections happen solely via void_dispatch() SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE POLICY dispatches_select_active_user ON public.dispatches
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY dispatches_insert_admin ON public.dispatches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 10. RLS Policies: dispatch_items
-- Read: all active users
-- Insert: admin only (staff items created via create_dispatch() in Phase 5)
-- Update: NO policy (items deactivated solely via void_dispatch() SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE POLICY dispatch_items_select_active_user ON public.dispatch_items
  FOR SELECT TO authenticated
  USING (public.is_active_user());

CREATE POLICY dispatch_items_insert_admin ON public.dispatch_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 11. RLS Policies: activity_logs
-- Read: all active users
-- Insert/Update/Delete: NO user policy. Written exclusively via database triggers
--                       and SECURITY DEFINER functions.
-- -----------------------------------------------------------------------------
CREATE POLICY activity_logs_select_active_user ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_active_user());
