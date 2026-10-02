-- ==============================================================================
-- Migration: Employee Operational Onboarding Workflow Tasks & Verification
-- File: supabase/migrations/20261001000000_employee_workflow_tasks.sql
-- Target: Supabase Postgres SQL Editor (Run Manually)
--
-- Schema Inspection & Reuse Summary:
--   1. REUSED: public.employees, public.candidates, public.applications,
--      public.documents, public.staff_profiles, public.roles,
--      public.branches, public.zones, public.designations.
--   2. REUSED & EXTENDED: public.audit_logs — all workflow task transitions
--      (submitted, resubmitted, verified, returned) are written to the existing
--      public.audit_logs table with entity_type = 'workflow_task'.
--   3. NEW TABLE: public.employee_workflow_tasks — stores the 6 HR-owned
--      post-joining operational tasks per joiner/employee with anti-false-completion
--      states ('pending', 'submitted', 'verified', 'returned', 'not_needed'),
--      evidence metadata, completion notes, return reasons, and authoritative
--      server-resolved timestamps and actor foreign keys.
-- ==============================================================================

-- 1. ENUM TYPE FOR WORKFLOW TASK STATUS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_task_status') THEN
    CREATE TYPE public.workflow_task_status AS ENUM (
      'pending',
      'submitted',
      'verified',
      'returned',
      'not_needed'
    );
  END IF;
END $$;

-- 2. TABLE: public.employee_workflow_tasks
CREATE TABLE IF NOT EXISTS public.employee_workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joiner_id TEXT NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL,
  joiner_name TEXT NOT NULL,
  designation_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  assigned_hr_name TEXT NOT NULL,
  assigned_hr_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  task_index INTEGER NOT NULL CHECK (task_index >= 0),
  task_key TEXT NOT NULL,
  task_name TEXT NOT NULL,
  short_label TEXT NOT NULL,
  target_day INTEGER NOT NULL DEFAULT 0,
  status public.workflow_task_status NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  submitted_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  submitted_by_role TEXT,
  verified_at TIMESTAMPTZ,
  verified_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  verified_by_name TEXT,
  verified_by_role TEXT,
  returned_at TIMESTAMPTZ,
  returned_by_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  returned_by_name TEXT,
  returned_by_role TEXT,
  return_reason TEXT,
  completion_note TEXT,
  evidence_reference TEXT,
  evidence_file_name TEXT,
  evidence_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_joiner_workflow_task UNIQUE (joiner_id, task_key)
);

-- 3. INDEXES FOR PERFORMANCE & DRILL-DOWN QUERIES
CREATE INDEX IF NOT EXISTS idx_ewt_joiner_id ON public.employee_workflow_tasks(joiner_id);
CREATE INDEX IF NOT EXISTS idx_ewt_employee_code ON public.employee_workflow_tasks(employee_code);
CREATE INDEX IF NOT EXISTS idx_ewt_status ON public.employee_workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ewt_zone_branch ON public.employee_workflow_tasks(zone_name, branch_name);
CREATE INDEX IF NOT EXISTS idx_ewt_assigned_hr ON public.employee_workflow_tasks(assigned_hr_name);
CREATE INDEX IF NOT EXISTS idx_ewt_due_at ON public.employee_workflow_tasks(due_at);

-- 4. ROW LEVEL SECURITY (RLS) — STRICT STAFF RBAC, NEVER EXPOSED TO CANDIDATES
ALTER TABLE public.employee_workflow_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ewt_staff_scoped_select" ON public.employee_workflow_tasks;
DROP POLICY IF EXISTS "ewt_staff_scoped_insert" ON public.employee_workflow_tasks;
DROP POLICY IF EXISTS "ewt_staff_scoped_update" ON public.employee_workflow_tasks;

-- SELECT: Authenticated staff only (Super Admin: all; Zonal HR & Central HR: their zone; Branch Manager: their branch)
-- Candidates have zero access to internal HR workflow tasks.
CREATE POLICY "ewt_staff_scoped_select" ON public.employee_workflow_tasks
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.zones z
        WHERE z.id = staff_zone_id()
          AND lower(z.name) = lower(employee_workflow_tasks.zone_name)
      )
    )
    OR (
      is_branch_manager()
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = staff_branch_id()
          AND lower(b.name) = lower(employee_workflow_tasks.branch_name)
      )
    )
  );

-- INSERT: Authenticated HR / Staff within scope
CREATE POLICY "ewt_staff_scoped_insert" ON public.employee_workflow_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR is_zonal_hr_manager()
    OR is_central_hr()
    OR is_branch_manager()
  );

-- UPDATE: Authenticated HR / Staff within scope
CREATE POLICY "ewt_staff_scoped_update" ON public.employee_workflow_tasks
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (
      (is_zonal_hr_manager() OR is_central_hr())
      AND EXISTS (
        SELECT 1 FROM public.zones z
        WHERE z.id = staff_zone_id()
          AND lower(z.name) = lower(employee_workflow_tasks.zone_name)
      )
    )
    OR (
      is_branch_manager()
      AND EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = staff_branch_id()
          AND lower(b.name) = lower(employee_workflow_tasks.branch_name)
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR is_zonal_hr_manager()
    OR is_central_hr()
    OR is_branch_manager()
  );

-- 5. EXTEND EXISTING public.audit_logs RLS FOR WORKFLOW TASK HISTORY
-- Allow authenticated staff to read workflow_task audit entries while keeping
-- audit_logs strictly append-only (no UPDATE or DELETE policies exist).
DROP POLICY IF EXISTS "audit_logs_workflow_task_read" ON public.audit_logs;
CREATE POLICY "audit_logs_workflow_task_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    entity_type = 'workflow_task'
    AND (
      is_super_admin()
      OR is_zonal_hr_manager()
      OR is_central_hr()
      OR is_branch_manager()
    )
  );

NOTIFY pgrst, 'reload schema';
