-- ==============================================================================
-- Migration: Staff Creation Form Restructure & Branch Tagging (Part C of 4)
-- Target: Supabase Postgres SQL Editor
-- Description:
--   1. Adds Section A (personal_email, phone_number) and Section B
--      (staff_employee_id, department_id, designation_id) columns to staff_profiles.
--   2. Enforces a database-level UNIQUE constraint on staff_profiles.staff_employee_id.
--   3. Creates 'staff_branch_assignments' junction table to support Section D
--      multi-branch checklist tagging while keeping staff_profiles.branch_id
--      intact for primary/single-branch compatibility.
-- ==============================================================================

-- ==============================================================================
-- 1. ADD NEW COLUMNS TO public.staff_profiles
-- ==============================================================================

DO $$
BEGIN
  -- Section A: Personal Contact Email (optional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'personal_email'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN personal_email TEXT;
  END IF;

  -- Section A: Phone Number (optional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN phone_number TEXT;
  END IF;

  -- Section B: Staff Employee ID (e.g. PX-STAFF-1001, unique)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'staff_employee_id'
  ) THEN
    ALTER TABLE public.staff_profiles ADD COLUMN staff_employee_id TEXT;
  END IF;

  -- Section B: Department FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.staff_profiles
      ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;

  -- Section B: Designation FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'designation_id'
  ) THEN
    ALTER TABLE public.staff_profiles
      ADD COLUMN designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill staff_employee_id for any existing staff rows (such as Super Admin)
WITH numbered_staff AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.staff_profiles
  WHERE staff_employee_id IS NULL OR btrim(staff_employee_id) = ''
)
UPDATE public.staff_profiles sp
SET staff_employee_id = 'PX-STAFF-' || (999 + numbered_staff.rn)::text
FROM numbered_staff
WHERE sp.id = numbered_staff.id;

-- Add UNIQUE constraint on staff_employee_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_profiles_staff_employee_id_key'
  ) THEN
    ALTER TABLE public.staff_profiles
      ADD CONSTRAINT staff_profiles_staff_employee_id_key UNIQUE (staff_employee_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_department_id ON public.staff_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_designation_id ON public.staff_profiles(designation_id);

-- ==============================================================================
-- 2. MULTI-BRANCH TAGGING JUNCTION TABLE: public.staff_branch_assignments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.staff_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_staff_branch_assignment UNIQUE (staff_profile_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_sba_staff_profile_id ON public.staff_branch_assignments(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_sba_branch_id ON public.staff_branch_assignments(branch_id);

-- Backfill existing single branch_id assignments into staff_branch_assignments
INSERT INTO public.staff_branch_assignments (staff_profile_id, branch_id)
SELECT id, branch_id
FROM public.staff_profiles
WHERE branch_id IS NOT NULL
ON CONFLICT (staff_profile_id, branch_id) DO NOTHING;

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) ON public.staff_branch_assignments
-- ==============================================================================

ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_branch_assignments_read" ON public.staff_branch_assignments;
DROP POLICY IF EXISTS "staff_branch_assignments_write" ON public.staff_branch_assignments;

-- SELECT: Super Admin (all), Zonal HR & Central HR (branches in their zone), or own assignments
CREATE POLICY "staff_branch_assignments_read" ON public.staff_branch_assignments
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR staff_profile_id = auth.uid()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = staff_branch_assignments.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
  );

-- ALL (INSERT/UPDATE/DELETE): Super Admin (all), Zonal HR Manager (branches in their zone)
CREATE POLICY "staff_branch_assignments_write" ON public.staff_branch_assignments
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      is_zonal_hr_manager()
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = staff_branch_assignments.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      is_zonal_hr_manager()
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = staff_branch_assignments.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
  );

-- Reload PostgREST schema cache so new columns and table are immediately recognized
NOTIFY pgrst, 'reload schema';
