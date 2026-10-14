-- ==============================================================================
-- PostEx HR Portal: Employee Assets Redesign Migration
-- Adds fields for TimeTrax, PostEx credentials, 3 operational statuses,
-- optional attachment references, and child table for multiple emails.
-- Existing records and legacy asset fields are completely preserved.
-- ==============================================================================

-- 1. Create Enums for the 3 dropdowns with exact reference values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_enrollment_status') THEN
    CREATE TYPE public.machine_enrollment_status AS ENUM (
      'Enrolled',
      'Not Enrolled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'id_card_status') THEN
    CREATE TYPE public.id_card_status AS ENUM (
      'Provided',
      'Not Provided'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documents_dispatch_status') THEN
    CREATE TYPE public.documents_dispatch_status AS ENUM (
      'Dispatched',
      'Not Dispatched'
    );
  END IF;
END $$;

-- 2. Extend public.employees with the new asset columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS timetrax_username TEXT,
  ADD COLUMN IF NOT EXISTS timetrax_password TEXT,
  ADD COLUMN IF NOT EXISTS postex_username TEXT,
  ADD COLUMN IF NOT EXISTS postex_password TEXT,
  ADD COLUMN IF NOT EXISTS machine_enrollment public.machine_enrollment_status NOT NULL DEFAULT 'Not Enrolled',
  ADD COLUMN IF NOT EXISTS id_card public.id_card_status NOT NULL DEFAULT 'Not Provided',
  ADD COLUMN IF NOT EXISTS documents_dispatch public.documents_dispatch_status NOT NULL DEFAULT 'Not Dispatched',
  ADD COLUMN IF NOT EXISTS machine_enrollment_image TEXT,
  ADD COLUMN IF NOT EXISTS id_card_image TEXT,
  ADD COLUMN IF NOT EXISTS documents_dispatch_image TEXT;

-- 3. Child table for multiple emails
CREATE TABLE IF NOT EXISTS public.employee_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_emails_employee_id ON public.employee_emails(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_emails_sort ON public.employee_emails(employee_id, sort_order);

-- 4. Enable Row Level Security and Policies
ALTER TABLE public.employee_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ee_scoped_select" ON public.employee_emails;
CREATE POLICY "ee_scoped_select" ON public.employee_emails
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "ee_scoped_write" ON public.employee_emails;
CREATE POLICY "ee_scoped_write" ON public.employee_emails
  FOR ALL
  USING (true)
  WITH CHECK (true);
