-- ==============================================================================
-- PostEx HR Portal — Employee Onboarding Module Migration (Additive Only)
-- ==============================================================================
-- SAFETY GUARANTEES:
-- 1. NEVER drops, alters, truncates, or renames any existing table, column, enum, or index.
-- 2. Purely additive (CREATE ... IF NOT EXISTS).
-- 3. Every new object is strictly prefixed with "onboarding_".
-- 4. References existing project tables (branches, designations, employees) safely.
-- 5. Zero modifications to employee_workflow_tasks or other existing tables.
-- ==============================================================================

-- 1. Create Onboarding Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_stage') THEN
    CREATE TYPE onboarding_stage AS ENUM (
      'Invited',
      'Draft',
      'BM_Review',
      'HR_Review',
      'Need_Correction',
      'Joining_Tasks',
      'Onboarded',
      'Rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_reviewer_role') THEN
    CREATE TYPE onboarding_reviewer_role AS ENUM ('BM', 'HR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_actor_role') THEN
    CREATE TYPE onboarding_actor_role AS ENUM ('candidate', 'branch_manager', 'central_hr', 'system');
  END IF;
END $$;

-- 2. Create onboarding_candidates Table
CREATE TABLE IF NOT EXISTS public.onboarding_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id VARCHAR(50) NOT NULL UNIQUE,       -- Format: PX-EMP-<number>
  full_name VARCHAR(150) NOT NULL,
  cnic VARCHAR(20) NOT NULL,                -- Format: XXXXX-XXXXXXX-X
  mobile VARCHAR(30) NOT NULL,              -- Pakistan mobile number
  email VARCHAR(150),
  designation_id VARCHAR(50) NOT NULL,      -- References existing designations(id)
  branch_id VARCHAR(50) NOT NULL,           -- References existing branches(id)
  stage onboarding_stage NOT NULL DEFAULT 'Invited',
  returned_by onboarding_reviewer_role,
  rejected_by onboarding_reviewer_role,
  return_reason TEXT,
  reject_reason TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  employee_id VARCHAR(50),                  -- Links to existing employees(id) when Onboarded
  reminders_count INTEGER NOT NULL DEFAULT 0,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create onboarding_timeline_events Table (6-step audit log)
CREATE TABLE IF NOT EXISTS public.onboarding_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.onboarding_candidates(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 6),
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,              -- 'completed' | 'current' | 'returned' | 'rejected' | 'pending'
  details TEXT,
  actor_name VARCHAR(150),
  actor_role VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create onboarding_reminder_logs Table
CREATE TABLE IF NOT EXISTS public.onboarding_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.onboarding_candidates(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  message TEXT NOT NULL,
  reminded_by VARCHAR(150) NOT NULL DEFAULT 'HR Automated Workflow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create Performance & Lookup Indexes (All prefixed onboarding_)
CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_emp_id ON public.onboarding_candidates(emp_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_stage ON public.onboarding_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_branch ON public.onboarding_candidates(branch_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_cnic ON public.onboarding_candidates(cnic);
CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_stage_entered ON public.onboarding_candidates(stage_entered_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_timeline_events_candidate_step ON public.onboarding_timeline_events(candidate_id, step_number);
CREATE INDEX IF NOT EXISTS idx_onboarding_reminder_logs_candidate ON public.onboarding_reminder_logs(candidate_id);
