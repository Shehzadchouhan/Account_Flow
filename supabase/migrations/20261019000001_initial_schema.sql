-- =============================================================================
-- Migration 1: Initial Schema (Tables, Constraints, Indexes)
-- Phase 2: Database Design for FinanceFlow
-- =============================================================================

-- Ensure pgcrypto extension is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. profiles
-- User profile extension mapped to auth.users.
-- Inactive by default; activated explicitly by administrators.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. firms
-- Client business entities.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  contact_person text,
  contact_email text,
  contact_phone text,
  default_employee uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique name for firms
CREATE UNIQUE INDEX IF NOT EXISTS firms_name_ci_idx
  ON public.firms (LOWER(TRIM(name)));

-- -----------------------------------------------------------------------------
-- 3. document_types
-- Master catalog of document categories.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique name for document types
CREATE UNIQUE INDEX IF NOT EXISTS document_types_name_ci_idx
  ON public.document_types (LOWER(TRIM(name)));

-- -----------------------------------------------------------------------------
-- 4. firm_template_items
-- Standard document checklist configured per firm.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firm_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_template_items_uniq UNIQUE (firm_id, document_type_id)
);

-- -----------------------------------------------------------------------------
-- 5. cases
-- Operational period work docket (Firm + Month + Deadline Cycle).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  period_month date NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  cycle text NOT NULL CHECK (cycle IN ('A_11th', 'B_20th')),
  due_date date NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cases_firm_period_cycle_uniq UNIQUE (firm_id, period_month, cycle)
);

-- Indexes on cases
CREATE INDEX IF NOT EXISTS cases_due_date_idx ON public.cases (due_date);
CREATE INDEX IF NOT EXISTS cases_assigned_to_idx ON public.cases (assigned_to);
CREATE INDEX IF NOT EXISTS cases_firm_period_idx ON public.cases (firm_id, period_month);

-- -----------------------------------------------------------------------------
-- 6. case_documents
-- Document checklist entries for a specific case.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  is_required boolean NOT NULL DEFAULT true,
  received_at timestamptz,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_docs_received_check CHECK (
    (received_at IS NULL AND received_by IS NULL) OR (received_at IS NOT NULL)
  )
);

-- Indexes on case_documents
CREATE INDEX IF NOT EXISTS case_documents_case_id_idx ON public.case_documents (case_id);
CREATE INDEX IF NOT EXISTS case_documents_doc_type_idx ON public.case_documents (document_type_id);

-- Partial unique index: A document type may only appear once per case among unremoved documents
CREATE UNIQUE INDEX IF NOT EXISTS case_documents_active_idx
  ON public.case_documents (case_id, document_type_id)
  WHERE (removed_at IS NULL);

-- -----------------------------------------------------------------------------
-- 7. dispatches
-- Outward transmissions sent to CAs, auditors, or authorities.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  recipient text NOT NULL CHECK (length(trim(recipient)) > 0),
  sent_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  email_reference text,
  voided_at timestamptz,
  voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatches_void_check CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR
    (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND length(trim(void_reason)) > 0)
  )
);

-- Index on dispatches
CREATE INDEX IF NOT EXISTS dispatches_case_id_idx ON public.dispatches (case_id);

-- -----------------------------------------------------------------------------
-- 8. dispatch_items
-- Links case_documents to dispatches.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.dispatches(id) ON DELETE RESTRICT,
  case_document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes on dispatch_items
CREATE INDEX IF NOT EXISTS dispatch_items_dispatch_id_idx ON public.dispatch_items (dispatch_id);
CREATE INDEX IF NOT EXISTS dispatch_items_case_doc_id_idx ON public.dispatch_items (case_document_id);

-- Partial unique index: A document may be in only ONE active dispatch item at any given time
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_items_active_doc_idx
  ON public.dispatch_items (case_document_id)
  WHERE (is_active = true);

-- -----------------------------------------------------------------------------
-- 9. activity_logs
-- Append-only audit trail for tracking system events.
-- user_id ON DELETE RESTRICT ensures audit integrity (users are deactivated, never deleted).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(trim(action)) > 0),
  entity_type text NOT NULL CHECK (length(trim(entity_type)) > 0),
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes on activity_logs
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
