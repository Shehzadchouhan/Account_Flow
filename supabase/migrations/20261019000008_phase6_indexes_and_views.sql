-- =============================================================================
-- Migration 8: Performance Indexes and Enhanced Views
-- Phase 6: Dashboard, Pending Work & Search
--
-- Adds performance indexes specifically justified by Phase 6 queries:
-- 1. cases(period_month) for month-filtered dashboard and case listings.
-- 2. cases(period_month, due_date) for month + urgency range lookups.
-- 3. cases(period_month, assigned_to) for employee workload aggregations.
-- 4. firms(is_active) for active-only firm filtering and distinct firm counts.
-- 5. case_documents(case_id, received_at) WHERE (removed_at IS NULL) for status calculations.
-- 6. dispatch_items(case_document_id, is_active) for dispatch status subqueries.
-- 7. dispatches(id) WHERE (voided_at IS NULL) for non-voided dispatch lookups.
-- 8. pg_trgm GIN indexes on firms(name) and document_types(name) for global search.
--
-- Upgrades case_document_status view to expose case and firm metadata so
-- Dashboard, /pending, and case detail all read from the same view.
-- =============================================================================

-- Enable pg_trgm extension if available (standard in Supabase / PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 1. Performance Indexes
-- -----------------------------------------------------------------------------

-- Dashboard month filtering & case status
CREATE INDEX IF NOT EXISTS cases_period_month_idx 
  ON public.cases (period_month);

-- Dashboard overdue & due-today queries within selected month
CREATE INDEX IF NOT EXISTS cases_period_month_due_date_idx 
  ON public.cases (period_month, due_date);

-- Workload by employee aggregation
CREATE INDEX IF NOT EXISTS cases_period_month_assigned_idx 
  ON public.cases (period_month, assigned_to);

-- Active firm filtering
CREATE INDEX IF NOT EXISTS firms_is_active_idx 
  ON public.firms (is_active);

-- Fast receipt checking for active documents
CREATE INDEX IF NOT EXISTS case_documents_receipt_idx 
  ON public.case_documents (case_id, received_at) 
  WHERE (removed_at IS NULL);

-- Subquery index for dispatch checks in views
CREATE INDEX IF NOT EXISTS dispatch_items_case_doc_active_idx 
  ON public.dispatch_items (case_document_id, is_active);

-- Partial index for active non-voided dispatches
CREATE INDEX IF NOT EXISTS dispatches_unvoided_idx 
  ON public.dispatches (id) 
  WHERE (voided_at IS NULL);

-- Trigram indexes for fast global search (firm and document type names)
CREATE INDEX IF NOT EXISTS firms_name_trgm_idx 
  ON public.firms USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS document_types_name_trgm_idx 
  ON public.document_types USING gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 2. Enhanced case_document_status View
-- Exposes full document, case, firm, and assignee details with security_invoker = true.
-- Used consistently across Dashboard (/), Pending Work (/pending), and Case Detail (/cases/[id]).
-- 
-- Drops view first and preserves original column order (1..12) with new columns (13..20)
-- appended, preventing PostgreSQL column renaming conflict error 42P16.
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
  ) AS is_overdue
FROM public.case_documents cd
JOIN public.cases c ON c.id = cd.case_id
JOIN public.firms f ON f.id = c.firm_id
JOIN public.document_types dt ON dt.id = cd.document_type_id
LEFT JOIN public.profiles p ON p.id = c.assigned_to
WHERE cd.removed_at IS NULL;

-- Ensure authenticated role and service role have permissions on the view
GRANT SELECT ON public.case_document_status TO authenticated;
GRANT SELECT ON public.case_document_status TO service_role;
