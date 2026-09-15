-- ==============================================================================
-- PostEx HR Onboarding Portal — Database Schema & RLS Foundations (Step 2)
-- Migration: 20260914000000_schema_and_rls.sql
-- ==============================================================================

-- Enable standard UUID generation extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUM TYPES
-- ==============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
    CREATE TYPE application_status AS ENUM (
      'draft',
      'submitted',
      'bm_verification',
      'needs_correction',
      'hr_review',
      'approved',
      'rejected'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_verification_status') THEN
    CREATE TYPE document_verification_status AS ENUM (
      'pending',
      'verified',
      'rejected',
      'correction_required'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_decision_type') THEN
    CREATE TYPE hr_decision_type AS ENUM (
      'approved',
      'rejected',
      'returned_for_correction'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM (
      'sms',
      'email',
      'in_app'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM (
      'pending',
      'sent',
      'failed'
    );
  END IF;
END $$;

-- ==============================================================================
-- 2. ORGANIZATIONAL HIERARCHY & ROLES
-- ==============================================================================

-- zones (id, name)
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- branches (id, zone_id FK, name, address)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- departments (id, name)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- designations (id, name, department_id FK)
CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- roles (id, name — super_admin, zonal_hr_manager, central_hr, branch_manager, candidate)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- permissions (id, key, description)
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- role_permissions (role_id FK, permission_id FK)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ==============================================================================
-- 3. STAFF & ACCESS CONTROL
-- ==============================================================================

-- staff_profiles (id, references auth.users, name, role_id FK, must_change_password boolean, created_by FK, is_active boolean, zone_id FK nullable, branch_id FK nullable, created_at)
CREATE TABLE IF NOT EXISTS staff_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_permission_overrides (id, staff_profile_id FK, permission_id FK, granted boolean, reason text NOT NULL, created_by FK, created_at)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_staff_permission_override UNIQUE (staff_profile_id, permission_id)
);

-- ==============================================================================
-- 4. CANDIDATES & CUSTOM AUTH
-- ==============================================================================

-- candidates (id, full_name, cnic UNIQUE, mobile, email, joining_id UNIQUE, zone_id FK, branch_id FK, created_by FK, created_at)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cnic TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL,
  email TEXT,
  joining_id TEXT NOT NULL UNIQUE,
  zone_id UUID REFERENCES zones(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- candidate_otps (id, candidate_id FK, otp_hash, expires_at, attempt_count, created_at)
CREATE TABLE IF NOT EXISTS candidate_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. APPLICATIONS & ONBOARDING WORKFLOW
-- ==============================================================================

-- applications (id, candidate_id FK, status enum, current_step, assigned_branch_manager_id FK, assigned_central_hr_id FK, locked boolean, submitted_at, decided_at, decision_reason)
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'draft',
  current_step INTEGER NOT NULL DEFAULT 1,
  assigned_branch_manager_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  assigned_central_hr_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- application_steps (id, application_id FK, step_number, step_name, data JSONB, completed boolean, updated_at)
CREATE TABLE IF NOT EXISTS application_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_app_step UNIQUE (application_id, step_number)
);

-- documents (id, application_id FK, type, storage_path, uploaded_at, verification_status enum, verified_by FK, remark)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status document_verification_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  remark TEXT
);

-- verification_remarks (id, application_id FK, document_id FK nullable, remark, created_by FK, created_at)
CREATE TABLE IF NOT EXISTS verification_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  remark TEXT NOT NULL,
  created_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- hr_decisions (id, application_id FK, decided_by FK, decision enum, reason, created_at)
CREATE TABLE IF NOT EXISTS hr_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  decided_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  decision hr_decision_type NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- employees (id, application_id FK, employee_id UNIQUE, pdf_dossier_storage_path, created_at)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE,
  pdf_dossier_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. AUDIT LOGGING & NOTIFICATIONS
-- ==============================================================================

-- audit_logs (id, actor_id, actor_type, action, entity_type, entity_id, metadata JSONB, created_at)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications (id, recipient_type, recipient_id, channel enum, message, sent_at, status)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL,
  recipient_id UUID NOT NULL,
  channel notification_channel NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  status notification_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================

-- Critical requested indexes
CREATE INDEX IF NOT EXISTS idx_candidates_cnic ON candidates(cnic);
CREATE INDEX IF NOT EXISTS idx_candidates_joining_id ON candidates(joining_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Relational & workflow performance indexes
CREATE INDEX IF NOT EXISTS idx_branches_zone_id ON branches(zone_id);
CREATE INDEX IF NOT EXISTS idx_designations_department_id ON designations(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role_id ON staff_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_zone_id ON staff_profiles(zone_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON staff_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_candidates_zone_id ON candidates(zone_id);
CREATE INDEX IF NOT EXISTS idx_candidates_branch_id ON candidates(branch_id);
CREATE INDEX IF NOT EXISTS idx_candidate_otps_candidate_id ON candidate_otps(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_otps_expires_at ON candidate_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_bm ON applications(assigned_branch_manager_id);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_hr ON applications(assigned_central_hr_id);
CREATE INDEX IF NOT EXISTS idx_application_steps_application_id ON application_steps(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_verification_status ON documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_verification_remarks_application_id ON verification_remarks(application_id);
CREATE INDEX IF NOT EXISTS idx_hr_decisions_application_id ON hr_decisions(application_id);
CREATE INDEX IF NOT EXISTS idx_employees_application_id ON employees(application_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) — [HARD RULE]
-- ==============================================================================
-- Enable RLS on all 19 tables with explicit default "deny all" policies.
-- In Step 4, role-based and candidate-scoped permissive policies will be attached.

-- 1. zones
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON zones;
CREATE POLICY "deny_all" ON zones FOR ALL TO public USING (false) WITH CHECK (false);

-- 2. branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON branches;
CREATE POLICY "deny_all" ON branches FOR ALL TO public USING (false) WITH CHECK (false);

-- 3. departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON departments;
CREATE POLICY "deny_all" ON departments FOR ALL TO public USING (false) WITH CHECK (false);

-- 4. designations
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON designations;
CREATE POLICY "deny_all" ON designations FOR ALL TO public USING (false) WITH CHECK (false);

-- 5. roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON roles;
CREATE POLICY "deny_all" ON roles FOR ALL TO public USING (false) WITH CHECK (false);

-- 6. permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON permissions;
CREATE POLICY "deny_all" ON permissions FOR ALL TO public USING (false) WITH CHECK (false);

-- 7. role_permissions
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON role_permissions;
CREATE POLICY "deny_all" ON role_permissions FOR ALL TO public USING (false) WITH CHECK (false);

-- 8. staff_profiles
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON staff_profiles;
CREATE POLICY "deny_all" ON staff_profiles FOR ALL TO public USING (false) WITH CHECK (false);

-- 9. user_permission_overrides
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON user_permission_overrides;
CREATE POLICY "deny_all" ON user_permission_overrides FOR ALL TO public USING (false) WITH CHECK (false);

-- 10. candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON candidates;
CREATE POLICY "deny_all" ON candidates FOR ALL TO public USING (false) WITH CHECK (false);

-- 11. candidate_otps
ALTER TABLE candidate_otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON candidate_otps;
CREATE POLICY "deny_all" ON candidate_otps FOR ALL TO public USING (false) WITH CHECK (false);

-- 12. applications
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON applications;
CREATE POLICY "deny_all" ON applications FOR ALL TO public USING (false) WITH CHECK (false);

-- 13. application_steps
ALTER TABLE application_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON application_steps;
CREATE POLICY "deny_all" ON application_steps FOR ALL TO public USING (false) WITH CHECK (false);

-- 14. documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON documents;
CREATE POLICY "deny_all" ON documents FOR ALL TO public USING (false) WITH CHECK (false);

-- 15. verification_remarks
ALTER TABLE verification_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON verification_remarks;
CREATE POLICY "deny_all" ON verification_remarks FOR ALL TO public USING (false) WITH CHECK (false);

-- 16. hr_decisions
ALTER TABLE hr_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON hr_decisions;
CREATE POLICY "deny_all" ON hr_decisions FOR ALL TO public USING (false) WITH CHECK (false);

-- 17. employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON employees;
CREATE POLICY "deny_all" ON employees FOR ALL TO public USING (false) WITH CHECK (false);

-- 18. audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON audit_logs;
CREATE POLICY "deny_all" ON audit_logs FOR ALL TO public USING (false) WITH CHECK (false);

-- 19. notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all" ON notifications;
CREATE POLICY "deny_all" ON notifications FOR ALL TO public USING (false) WITH CHECK (false);

-- ==============================================================================
-- 9. DEFAULT SYSTEM SEED DATA (ROLES)
-- ==============================================================================

INSERT INTO roles (name)
VALUES
  ('super_admin'),
  ('zonal_hr_manager'),
  ('central_hr'),
  ('branch_manager'),
  ('candidate')
ON CONFLICT (name) DO NOTHING;
