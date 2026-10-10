-- ==============================================================================
-- PostEx HR Onboarding Portal — Migration
-- Migration: 20261003000000_employee_lifecycle_exit_clearance.sql
-- Description:
--   1. Extends public.employees with full employee identity, organization link,
--      joining date, and lifecycle status ('active', 'exit_in_progress', 'exited').
--   2. Creates public.employee_asset_status for the 6 onboarding operational items.
--   3. Creates public.joiner_asset_emails to log asset notification dispatches.
--   4. Creates public.employee_exits for exit lifecycle tracking with partial
--      unique index (only one in_progress exit per employee).
--   5. Creates public.exit_clearance_items for the 6 ECF clearance checkpoints.
--   6. Creates public.ecf_templates and configures the private 'ecf-templates'
--      Storage bucket with role-scoped policies.
--   7. Configures strict Staff RLS on all tables mirroring employee_workflow_tasks
--      (Candidates have ZERO access).
--   8. Idempotent backfill for existing approved applications & asset status rows.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ------------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_lifecycle_status') THEN
    CREATE TYPE public.employee_lifecycle_status AS ENUM (
      'active',
      'exit_in_progress',
      'exited'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_asset_state') THEN
    CREATE TYPE public.employee_asset_state AS ENUM (
      'provided',
      'not_provided'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_exit_type') THEN
    CREATE TYPE public.employee_exit_type AS ENUM (
      'resignation',
      'termination',
      'absconding'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_exit_status') THEN
    CREATE TYPE public.employee_exit_status AS ENUM (
      'in_progress',
      'completed'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exit_item_status') THEN
    CREATE TYPE public.exit_item_status AS ENUM (
      'pending',
      'received',
      'not_received',
      'not_applicable'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. EXTEND public.employees TABLE
-- ------------------------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS cnic TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS designation_name TEXT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joining_date DATE,
  ADD COLUMN IF NOT EXISTS status public.employee_lifecycle_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_zone_id ON public.employees(zone_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_cnic ON public.employees(cnic);
CREATE INDEX IF NOT EXISTS idx_employees_full_name ON public.employees(full_name);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.employee_asset_status (6 Onboarding Items)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_asset_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL CHECK (item_key IN ('code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho')),
  state public.employee_asset_state NOT NULL DEFAULT 'not_provided',
  updated_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_asset_status UNIQUE (employee_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_eas_employee_id ON public.employee_asset_status(employee_id);
CREATE INDEX IF NOT EXISTS idx_eas_item_key ON public.employee_asset_status(item_key);
CREATE INDEX IF NOT EXISTS idx_eas_state ON public.employee_asset_status(state);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.joiner_asset_emails (Asset Notification Dispatches)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.joiner_asset_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jae_employee_id ON public.joiner_asset_emails(employee_id);
CREATE INDEX IF NOT EXISTS idx_jae_sent_at ON public.joiner_asset_emails(sent_at DESC);

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.employee_exits (Exit Lifecycle Tracker)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exit_type public.employee_exit_type NOT NULL,
  last_working_date DATE NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status public.employee_exit_status NOT NULL DEFAULT 'in_progress',
  initiated_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  initiated_by_name TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_generated_at TIMESTAMPTZ,
  pdf_generated_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ee_employee_id ON public.employee_exits(employee_id);
CREATE INDEX IF NOT EXISTS idx_ee_status ON public.employee_exits(status);
CREATE INDEX IF NOT EXISTS idx_ee_initiated_at ON public.employee_exits(initiated_at DESC);

-- Constraint: Only ONE in_progress exit per employee
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_active_exit
  ON public.employee_exits (employee_id)
  WHERE status = 'in_progress';

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.exit_clearance_items (6 ECF Clearance Checkpoints)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exit_clearance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id UUID NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL CHECK (item_key IN ('office_files', 'keys', 'mobile_sim', 'id_card', 'company_car', 'others')),
  status public.exit_item_status NOT NULL DEFAULT 'pending',
  detail TEXT,
  updated_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_exit_clearance_item UNIQUE (exit_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_eci_exit_id ON public.exit_clearance_items(exit_id);
CREATE INDEX IF NOT EXISTS idx_eci_item_key ON public.exit_clearance_items(item_key);
CREATE INDEX IF NOT EXISTS idx_eci_status ON public.exit_clearance_items(status);

-- ------------------------------------------------------------------------------
-- 7. TABLE: public.ecf_templates & STORAGE BUCKET: ecf-templates
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ecf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint: Only ONE active template row
CREATE UNIQUE INDEX IF NOT EXISTS uq_ecf_template_single_active
  ON public.ecf_templates (is_active)
  WHERE is_active = true;

-- Ensure storage bucket 'ecf-templates' exists and is PRIVATE
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecf-templates', 'ecf-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'ecf-templates' bucket
DROP POLICY IF EXISTS "ecf_templates_admin_write" ON storage.objects;
CREATE POLICY "ecf_templates_admin_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ecf-templates' AND is_super_admin())
  WITH CHECK (bucket_id = 'ecf-templates' AND is_super_admin());

DROP POLICY IF EXISTS "ecf_templates_staff_read" ON storage.objects;
CREATE POLICY "ecf_templates_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ecf-templates'
    AND (
      is_super_admin()
      OR is_zonal_hr_manager()
      OR is_central_hr()
      OR is_branch_manager()
    )
  );

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES — STRICT STAFF RBAC (ZERO CANDIDATE ACCESS)
-- ------------------------------------------------------------------------------

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_asset_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.joiner_asset_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_clearance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecf_templates ENABLE ROW LEVEL SECURITY;

-- 8A. public.employees Policies
DROP POLICY IF EXISTS "employees_scoped_select" ON public.employees;
DROP POLICY IF EXISTS "employees_scoped_write" ON public.employees;

CREATE POLICY "employees_scoped_select" ON public.employees
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND zone_id = staff_zone_id()
    )
    OR (
      is_branch_manager()
      AND branch_id = staff_branch_id()
    )
  );

CREATE POLICY "employees_scoped_write" ON public.employees
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND zone_id = staff_zone_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND zone_id = staff_zone_id()
    )
  );

-- 8B. public.employee_asset_status Policies
DROP POLICY IF EXISTS "eas_scoped_select" ON public.employee_asset_status;
DROP POLICY IF EXISTS "eas_scoped_write" ON public.employee_asset_status;

CREATE POLICY "eas_scoped_select" ON public.employee_asset_status
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_asset_status.employee_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  );

CREATE POLICY "eas_scoped_write" ON public.employee_asset_status
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_asset_status.employee_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_asset_status.employee_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  );

-- 8C. public.joiner_asset_emails Policies
DROP POLICY IF EXISTS "jae_scoped_select" ON public.joiner_asset_emails;
DROP POLICY IF EXISTS "jae_scoped_insert" ON public.joiner_asset_emails;

CREATE POLICY "jae_scoped_select" ON public.joiner_asset_emails
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = joiner_asset_emails.employee_id
        AND (is_zonal_hr_manager() OR is_central_hr())
        AND e.zone_id = staff_zone_id()
    )
  );

CREATE POLICY "jae_scoped_insert" ON public.joiner_asset_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = joiner_asset_emails.employee_id
        AND (is_zonal_hr_manager() OR is_central_hr())
        AND e.zone_id = staff_zone_id()
    )
  );

-- 8D. public.employee_exits Policies
DROP POLICY IF EXISTS "ee_scoped_select" ON public.employee_exits;
DROP POLICY IF EXISTS "ee_scoped_write" ON public.employee_exits;

CREATE POLICY "ee_scoped_select" ON public.employee_exits
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_exits.employee_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  );

CREATE POLICY "ee_scoped_write" ON public.employee_exits
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_exits.employee_id
        AND (is_zonal_hr_manager() OR is_central_hr())
        AND e.zone_id = staff_zone_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_exits.employee_id
        AND (is_zonal_hr_manager() OR is_central_hr())
        AND e.zone_id = staff_zone_id()
    )
  );

-- 8E. public.exit_clearance_items Policies
DROP POLICY IF EXISTS "eci_scoped_select" ON public.exit_clearance_items;
DROP POLICY IF EXISTS "eci_scoped_write" ON public.exit_clearance_items;

CREATE POLICY "eci_scoped_select" ON public.exit_clearance_items
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employee_exits ex
      JOIN public.employees e ON ex.employee_id = e.id
      WHERE ex.id = exit_clearance_items.exit_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  );

CREATE POLICY "eci_scoped_write" ON public.exit_clearance_items
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employee_exits ex
      JOIN public.employees e ON ex.employee_id = e.id
      WHERE ex.id = exit_clearance_items.exit_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.employee_exits ex
      JOIN public.employees e ON ex.employee_id = e.id
      WHERE ex.id = exit_clearance_items.exit_id
        AND (
          ((is_zonal_hr_manager() OR is_central_hr()) AND e.zone_id = staff_zone_id())
          OR (is_branch_manager() AND e.branch_id = staff_branch_id())
        )
    )
  );

-- 8F. public.ecf_templates Policies
DROP POLICY IF EXISTS "ecf_templates_select" ON public.ecf_templates;
DROP POLICY IF EXISTS "ecf_templates_write" ON public.ecf_templates;

CREATE POLICY "ecf_templates_select" ON public.ecf_templates
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR is_zonal_hr_manager()
    OR is_central_hr()
    OR is_branch_manager()
  );

CREATE POLICY "ecf_templates_write" ON public.ecf_templates
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ------------------------------------------------------------------------------
-- 9. IDEMPOTENT BACKFILL
-- ------------------------------------------------------------------------------

-- 9A. Backfill missing employees rows for approved applications
INSERT INTO public.employees (
  application_id,
  employee_id,
  full_name,
  cnic,
  contact_number,
  personal_email,
  designation_id,
  designation_name,
  branch_id,
  zone_id,
  joining_date,
  status
)
SELECT
  a.id,
  'EMP-' || UPPER(SUBSTRING(COALESCE(b.name, 'HQ'), 1, 3)) || '-' || LPAD(SUBSTRING(ABS(HASHTEXT(a.id::text))::text, 1, 5), 5, '0'),
  c.full_name,
  c.cnic,
  c.mobile,
  c.email,
  c.designation_id,
  d.name,
  c.branch_id,
  c.zone_id,
  COALESCE(a.decided_at::date, a.created_at::date, CURRENT_DATE),
  'active'::public.employee_lifecycle_status
FROM public.applications a
JOIN public.candidates c ON a.candidate_id = c.id
LEFT JOIN public.branches b ON c.branch_id = b.id
LEFT JOIN public.designations d ON c.designation_id = d.id
WHERE a.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.application_id = a.id
  )
ON CONFLICT (employee_id) DO NOTHING;

-- 9B. Backfill empty columns on existing employee records
UPDATE public.employees e
SET
  full_name = COALESCE(e.full_name, c.full_name),
  cnic = COALESCE(e.cnic, c.cnic),
  contact_number = COALESCE(e.contact_number, c.mobile),
  personal_email = COALESCE(e.personal_email, c.email),
  designation_id = COALESCE(e.designation_id, c.designation_id),
  designation_name = COALESCE(e.designation_name, d.name),
  branch_id = COALESCE(e.branch_id, c.branch_id),
  zone_id = COALESCE(e.zone_id, c.zone_id),
  joining_date = COALESCE(e.joining_date, a.decided_at::date, a.created_at::date, CURRENT_DATE),
  status = COALESCE(e.status, 'active'::public.employee_lifecycle_status)
FROM public.applications a
JOIN public.candidates c ON a.candidate_id = c.id
LEFT JOIN public.designations d ON c.designation_id = d.id
WHERE e.application_id = a.id
  AND (e.full_name IS NULL OR e.cnic IS NULL);

-- 9C. Backfill default asset-status rows (all 'not_provided') for every active employee
INSERT INTO public.employee_asset_status (employee_id, item_key, state)
SELECT e.id, k.item_key, 'not_provided'::public.employee_asset_state
FROM public.employees e
CROSS JOIN (
  VALUES
    ('code'),
    ('machine'),
    ('login'),
    ('sim'),
    ('idcard'),
    ('docs_to_ho')
) AS k(item_key)
WHERE e.status = 'active'
ON CONFLICT (employee_id, item_key) DO NOTHING;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS (FOR REFERENCE ONLY — DO NOT EXECUTE UNLESS ROLLING BACK)
-- ==============================================================================
/*
  DROP TABLE IF EXISTS public.exit_clearance_items CASCADE;
  DROP TABLE IF EXISTS public.employee_exits CASCADE;
  DROP TABLE IF EXISTS public.joiner_asset_emails CASCADE;
  DROP TABLE IF EXISTS public.employee_asset_status CASCADE;
  DROP TABLE IF EXISTS public.ecf_templates CASCADE;
  
  ALTER TABLE public.employees
    DROP COLUMN IF EXISTS full_name,
    DROP COLUMN IF EXISTS cnic,
    DROP COLUMN IF EXISTS contact_number,
    DROP COLUMN IF EXISTS personal_email,
    DROP COLUMN IF EXISTS designation_name,
    DROP COLUMN IF EXISTS branch_id,
    DROP COLUMN IF EXISTS zone_id,
    DROP COLUMN IF EXISTS joining_date,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS updated_at;

  DROP TYPE IF EXISTS public.exit_item_status;
  DROP TYPE IF EXISTS public.employee_exit_status;
  DROP TYPE IF EXISTS public.employee_exit_type;
  DROP TYPE IF EXISTS public.employee_asset_state;
  DROP TYPE IF EXISTS public.employee_lifecycle_status;

  DELETE FROM storage.buckets WHERE id = 'ecf-templates';
*/
