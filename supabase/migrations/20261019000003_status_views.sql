-- =============================================================================
-- Migration 3: Status Views
-- Phase 2: Database Design for FinanceFlow
--
-- Real-time calculated status views using WITH (security_invoker = true)
-- so Row Level Security is automatically enforced for the querying user.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. case_document_status View
-- Exposes document-level receipt and dispatch progress.
-- Excludes soft-deleted rows (removed_at IS NULL).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.case_document_status
WITH (security_invoker = true)
AS
SELECT
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
  END AS status
FROM public.case_documents cd
JOIN public.cases c ON c.id = cd.case_id
JOIN public.document_types dt ON dt.id = cd.document_type_id
WHERE cd.removed_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. case_status View
-- Exposes case-level counts, status string, and overdue flag.
-- Rules:
-- - Uses ONLY documents where is_required = true AND removed_at IS NULL.
-- - Optional documents NEVER affect completion.
-- - Voided dispatches NEVER count as sent.
-- - 0 required documents -> 'No Required Documents' (never 'Completed').
-- - Any required missing -> 'Awaiting Documents'.
-- - All required received, but some undispatched -> 'Pending Dispatch'.
-- - All required received and dispatched -> 'Completed'.
-- - is_overdue evaluated against Asia/Kolkata timezone.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.case_status
WITH (security_invoker = true)
AS
WITH required_doc_metrics AS (
  SELECT
    c.id AS case_id,
    COUNT(cd.id) AS required_count,
    COUNT(cd.id) FILTER (WHERE cd.received_at IS NOT NULL) AS received_count,
    COUNT(cd.id) FILTER (
      WHERE cd.received_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.dispatch_items di
          JOIN public.dispatches d ON d.id = di.dispatch_id
          WHERE di.case_document_id = cd.id
            AND di.is_active = true
            AND d.voided_at IS NULL
        )
    ) AS dispatched_count
  FROM public.cases c
  LEFT JOIN public.case_documents cd
    ON cd.case_id = c.id
   AND cd.is_required = true
   AND cd.removed_at IS NULL
  GROUP BY c.id
),
calculated_cases AS (
  SELECT
    c.id AS case_id,
    c.firm_id,
    f.name AS firm_name,
    f.is_active AS firm_is_active,
    c.period_month,
    c.cycle,
    c.due_date,
    c.assigned_to,
    c.version,
    c.created_at,
    c.updated_at,
    COALESCE(m.required_count, 0) AS required_count,
    COALESCE(m.received_count, 0) AS received_count,
    COALESCE(m.dispatched_count, 0) AS dispatched_count,
    (COALESCE(m.required_count, 0) - COALESCE(m.received_count, 0)) AS missing_count,
    (COALESCE(m.received_count, 0) - COALESCE(m.dispatched_count, 0)) AS undispatched_count,
    CASE
      WHEN COALESCE(m.required_count, 0) = 0 THEN 'No Required Documents'
      WHEN (COALESCE(m.required_count, 0) - COALESCE(m.received_count, 0)) > 0 THEN 'Awaiting Documents'
      WHEN (COALESCE(m.received_count, 0) - COALESCE(m.dispatched_count, 0)) > 0 THEN 'Pending Dispatch'
      ELSE 'Completed'
    END AS status
  FROM public.cases c
  JOIN public.firms f ON f.id = c.firm_id
  JOIN required_doc_metrics m ON m.case_id = c.id
)
SELECT
  cc.case_id,
  cc.firm_id,
  cc.firm_name,
  cc.firm_is_active,
  cc.period_month,
  cc.cycle,
  cc.due_date,
  cc.assigned_to,
  cc.version,
  cc.created_at,
  cc.updated_at,
  cc.required_count,
  cc.received_count,
  cc.dispatched_count,
  cc.missing_count,
  cc.undispatched_count,
  cc.status,
  (cc.due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date AND cc.status <> 'Completed') AS is_overdue
FROM calculated_cases cc;
