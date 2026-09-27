-- ==============================================================================
-- Migration: Headcount Management Module & Designation Foreign Key Link (Part B of 4)
-- Target: Supabase Postgres SQL Editor
-- Description:
--   1. Creates 'branch_designation_headcount' table with (branch_id, designation_id) UNIQUE constraint
--   2. Configures scoped RLS policies on 'branch_designation_headcount' reusing existing zone/branch RLS helpers:
--        - Super Admin: Full read/write across all branches
--        - Zonal HR Manager & Central HR: Direct read/write for branches in their assigned zone
--        - Branch Manager: Read-only access to their own assigned branch's headcount
--   3. Ensures foreign key column 'designation_id' exists on 'candidates' and 'employees'
--      so "Active Count" is computed live from enrolled employees linked to each designation
-- ==============================================================================

-- ==============================================================================
-- 1. PREREQUISITE: DESIGNATION FOREIGN KEY ON CANDIDATES & EMPLOYEES
-- ==============================================================================

DO $$
BEGIN
  -- 1A. Add designation_id FK to candidates (links intake selection to designations table)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'designation_id'
  ) THEN
    ALTER TABLE public.candidates
      ADD COLUMN designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL;
  END IF;

  -- 1B. Add designation_id FK to employees (preserves designation link upon enrollment)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'designation_id'
  ) THEN
    ALTER TABLE public.employees
      ADD COLUMN designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill candidates.designation_id from step 1 JSON data if any existing rows have it
UPDATE public.candidates c
SET designation_id = (s.data->>'designation_id')::uuid
FROM public.applications a
JOIN public.application_steps s ON s.application_id = a.id AND s.step_number = 1
WHERE a.candidate_id = c.id
  AND c.designation_id IS NULL
  AND (s.data->>'designation_id') IS NOT NULL
  AND (s.data->>'designation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.designations d WHERE d.id = (s.data->>'designation_id')::uuid
  );

-- Backfill employees.designation_id from linked candidates.designation_id
UPDATE public.employees e
SET designation_id = c.designation_id
FROM public.applications a
JOIN public.candidates c ON c.id = a.candidate_id
WHERE e.application_id = a.id
  AND e.designation_id IS NULL
  AND c.designation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_designation_id ON public.candidates(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation_id ON public.employees(designation_id);

-- ==============================================================================
-- 2. NEW TABLE: branch_designation_headcount
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.branch_designation_headcount (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  designation_id UUID NOT NULL REFERENCES public.designations(id) ON DELETE CASCADE,
  approved_count INTEGER NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  created_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_designation_headcount UNIQUE (branch_id, designation_id)
);

CREATE INDEX IF NOT EXISTS idx_bdh_branch_id ON public.branch_designation_headcount(branch_id);
CREATE INDEX IF NOT EXISTS idx_bdh_designation_id ON public.branch_designation_headcount(designation_id);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES (REUSING EXISTING ZONE/BRANCH SCOPING)
-- ==============================================================================

ALTER TABLE public.branch_designation_headcount ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "headcount_scoped_read" ON public.branch_designation_headcount;
DROP POLICY IF EXISTS "headcount_scoped_write" ON public.branch_designation_headcount;

-- SELECT: Super Admin (all), Zonal HR & Central HR (branches in their zone), Branch Manager (own branch only)
CREATE POLICY "headcount_scoped_read" ON public.branch_designation_headcount
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_designation_headcount.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
    OR (
      is_branch_manager()
      AND branch_designation_headcount.branch_id = staff_branch_id()
    )
  );

-- INSERT / UPDATE / DELETE: Direct Edit for Super Admin (all), Zonal HR & Central HR (branches in their zone)
-- Branch Manager is strictly excluded from write policies (READ-ONLY)
CREATE POLICY "headcount_scoped_write" ON public.branch_designation_headcount
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_designation_headcount.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_designation_headcount.branch_id
          AND b.zone_id = staff_zone_id()
      )
    )
  );

-- Reload PostgREST schema cache so new table and columns are immediately recognized
NOTIFY pgrst, 'reload schema';
