-- =============================================================================
-- Migration 11: Document & Dispatch Attachments (PDFs & Scans)
-- FinanceFlow - Digital Document & Courier Receipt Management
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add file attachment metadata columns to case_documents
-- -----------------------------------------------------------------------------
ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS file_type text;

-- -----------------------------------------------------------------------------
-- 2. Add postal/courier receipt attachment columns to dispatches
-- -----------------------------------------------------------------------------
ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS receipt_file_url text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text;

-- -----------------------------------------------------------------------------
-- 3. Update case_document_status View to expose attachment columns
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.case_document_status CASCADE;

CREATE VIEW public.case_document_status
WITH (security_invoker = true)
AS
SELECT
  -- Original columns (1..12) preserved in exact position
  cd.id AS case_document_id,
  cd.case_id,
  c.firm_id,
  cd.document_type_id,
  dt.name AS document_type_name,
  cd.is_required,
  cd.received_at,
  cd.received_by,
  cd.notes,
  cd.created_at,
  cd.updated_at,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.dispatch_items di
      JOIN public.dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = cd.id
        AND di.is_active = true
        AND d.voided_at IS NULL
    ) THEN 'Dispatched'
    WHEN cd.received_at IS NOT NULL THEN 'Received - Not Dispatched'
    ELSE 'Awaiting Receipt'
  END AS status,
  -- Appended columns (13..20) for Phase 6 Dashboard, /pending, and Search
  f.name AS firm_name,
  f.is_active AS firm_is_active,
  c.period_month,
  c.cycle,
  c.due_date,
  c.assigned_to,
  p.full_name AS assigned_to_name,
  (
    c.due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT EXISTS (
      SELECT 1
      FROM public.dispatch_items di
      JOIN public.dispatches d ON d.id = di.dispatch_id
      WHERE di.case_document_id = cd.id
        AND di.is_active = true
        AND d.voided_at IS NULL
    )
  ) AS is_overdue,
  -- New columns (21..24) for Digital Attachments
  cd.file_url,
  cd.file_name,
  cd.file_size,
  cd.file_type
FROM public.case_documents cd
JOIN public.cases c ON c.id = cd.case_id
JOIN public.firms f ON f.id = c.firm_id
JOIN public.document_types dt ON dt.id = cd.document_type_id
LEFT JOIN public.profiles p ON p.id = c.assigned_to
WHERE cd.removed_at IS NULL;

-- Permissions on updated view
GRANT SELECT ON public.case_document_status TO authenticated;
GRANT SELECT ON public.case_document_status TO service_role;

-- -----------------------------------------------------------------------------
-- 4. RPC: attach_case_document_file()
-- Attaches a PDF or image scan to a checklist item.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_case_document_file(
  p_case_document_id uuid,
  p_file_url text,
  p_file_name text,
  p_file_size integer,
  p_file_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_doc record;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user account required.';
  END IF;

  SELECT id, case_id, received_at INTO v_doc
  FROM public.case_documents
  WHERE id = p_case_document_id AND removed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or has been removed.';
  END IF;

  UPDATE public.case_documents
  SET
    file_url = trim(p_file_url),
    file_name = trim(p_file_name),
    file_size = p_file_size,
    file_type = trim(p_file_type),
    updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'ATTACH_DOCUMENT',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_doc.case_id,
      'file_name', trim(p_file_name),
      'file_size', p_file_size,
      'file_type', trim(p_file_type)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'case_document_id', p_case_document_id,
    'file_url', trim(p_file_url),
    'file_name', trim(p_file_name)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: remove_case_document_file()
-- Clears file attachment metadata from a checklist item.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_case_document_file(
  p_case_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_doc record;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: Active user account required.';
  END IF;

  SELECT id, case_id, file_name INTO v_doc
  FROM public.case_documents
  WHERE id = p_case_document_id AND removed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or has been removed.';
  END IF;

  UPDATE public.case_documents
  SET
    file_url = NULL,
    file_name = NULL,
    file_size = NULL,
    file_type = NULL,
    updated_at = now()
  WHERE id = p_case_document_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'REMOVE_ATTACHMENT',
    'case_documents',
    p_case_document_id,
    jsonb_build_object(
      'case_id', v_doc.case_id,
      'removed_file_name', v_doc.file_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'case_document_id', p_case_document_id
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Storage Bucket Configuration (Idempotent)
-- Creates 'case-attachments' bucket in storage schema if enabled.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'case-attachments',
      'case-attachments',
      true,
      15728640, -- 15MB limit
      ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = true,
      file_size_limit = 15728640,
      allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  END IF;
END $$;
