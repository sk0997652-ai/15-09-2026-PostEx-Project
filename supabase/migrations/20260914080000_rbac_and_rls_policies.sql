-- ==============================================================================
-- PostEx HR Onboarding Portal — Migration: 20260914080000_rbac_and_rls_policies.sql
-- STEP 4 of 13: Role-Based Access Control (RLS Policies & Access Functions)
-- ==============================================================================
-- Roles:
-- 1. super_admin: Full access company-wide
-- 2. zonal_hr_manager: Scoped to their assigned zone_id
-- 3. central_hr: Scoped to their assigned zone's candidates
-- 4. branch_manager: Scoped to their assigned branch_id
-- 5. candidate: Only their own application & documents (via custom candidate session / JWT)
--
-- Overrides:
-- Checked via user_permission_overrides (staff_profile_id, permission_id, granted, reason)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions for RLS
-- ------------------------------------------------------------------------------

-- Helper: Get current authenticated staff profile
CREATE OR REPLACE FUNCTION current_staff_profile()
RETURNS staff_profiles AS $$
  SELECT * FROM staff_profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Check if caller is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp
    JOIN roles r ON sp.role_id = r.id
    WHERE sp.id = auth.uid() AND sp.is_active = true AND r.name = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Check if caller is zonal_hr_manager
CREATE OR REPLACE FUNCTION is_zonal_hr_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp
    JOIN roles r ON sp.role_id = r.id
    WHERE sp.id = auth.uid() AND sp.is_active = true AND r.name = 'zonal_hr_manager'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Check if caller is central_hr
CREATE OR REPLACE FUNCTION is_central_hr()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp
    JOIN roles r ON sp.role_id = r.id
    WHERE sp.id = auth.uid() AND sp.is_active = true AND r.name = 'central_hr'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Check if caller is branch_manager
CREATE OR REPLACE FUNCTION is_branch_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles sp
    JOIN roles r ON sp.role_id = r.id
    WHERE sp.id = auth.uid() AND sp.is_active = true AND r.name = 'branch_manager'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Get staff assigned zone_id
CREATE OR REPLACE FUNCTION staff_zone_id()
RETURNS UUID AS $$
  SELECT zone_id FROM staff_profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Get staff assigned branch_id
CREATE OR REPLACE FUNCTION staff_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM staff_profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: Check if staff has specific permission (checking overrides then role permissions)
CREATE OR REPLACE FUNCTION staff_has_permission(p_permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_role_id UUID;
  v_override_granted BOOLEAN;
  v_perm_id UUID;
BEGIN
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT id INTO v_perm_id FROM permissions WHERE key = p_permission_key;
  IF v_perm_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check user_permission_overrides first (explicit grant or deny)
  SELECT granted INTO v_override_granted
  FROM user_permission_overrides
  WHERE staff_profile_id = v_staff_id AND permission_id = v_perm_id;

  IF v_override_granted IS NOT NULL THEN
    RETURN v_override_granted;
  END IF;

  -- 2. Fall back to role_permissions
  SELECT role_id INTO v_role_id FROM staff_profiles WHERE id = v_staff_id AND is_active = true;
  IF v_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM role_permissions WHERE role_id = v_role_id AND permission_id = v_perm_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 2. Drop "deny_all" Policies and Implement Role & Scope Policies
-- ------------------------------------------------------------------------------

-- Table: zones
DROP POLICY IF EXISTS "deny_all" ON zones;
CREATE POLICY "zones_read_all" ON zones
  FOR SELECT TO authenticated
  USING (true);

-- Table: branches
DROP POLICY IF EXISTS "deny_all" ON branches;
CREATE POLICY "branches_read_all" ON branches
  FOR SELECT TO authenticated
  USING (true);

-- Table: departments
DROP POLICY IF EXISTS "deny_all" ON departments;
CREATE POLICY "departments_read_all" ON departments
  FOR SELECT TO authenticated
  USING (true);

-- Table: designations
DROP POLICY IF EXISTS "deny_all" ON designations;
CREATE POLICY "designations_read_all" ON designations
  FOR SELECT TO authenticated
  USING (true);

-- Table: roles
DROP POLICY IF EXISTS "deny_all" ON roles;
CREATE POLICY "roles_read_all" ON roles
  FOR SELECT TO authenticated
  USING (true);

-- Table: permissions
DROP POLICY IF EXISTS "deny_all" ON permissions;
CREATE POLICY "permissions_read_all" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- Table: role_permissions
DROP POLICY IF EXISTS "deny_all" ON role_permissions;
CREATE POLICY "role_permissions_read_all" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- Table: staff_profiles
DROP POLICY IF EXISTS "deny_all" ON staff_profiles;
CREATE POLICY "staff_profiles_read" ON staff_profiles
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR id = auth.uid()
    OR (is_zonal_hr_manager() AND (zone_id = staff_zone_id() OR zone_id IS NULL))
  );

CREATE POLICY "staff_profiles_update_own" ON staff_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_super_admin())
  WITH CHECK (id = auth.uid() OR is_super_admin());

-- Table: user_permission_overrides
DROP POLICY IF EXISTS "deny_all" ON user_permission_overrides;
CREATE POLICY "overrides_super_admin" ON user_permission_overrides
  FOR ALL TO authenticated
  USING (is_super_admin() OR staff_profile_id = auth.uid())
  WITH CHECK (is_super_admin());

-- Table: candidates (Scoped by Zone & Branch)
DROP POLICY IF EXISTS "deny_all" ON candidates;
CREATE POLICY "candidates_scoped_read" ON candidates
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (is_zonal_hr_manager() AND zone_id = staff_zone_id())
    OR (is_central_hr() AND zone_id = staff_zone_id())
    OR (is_branch_manager() AND branch_id = staff_branch_id())
  );

CREATE POLICY "candidates_scoped_insert" ON candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (is_zonal_hr_manager() AND zone_id = staff_zone_id())
  );

-- Table: candidate_otps (Only Edge Function / Service role or admin)
DROP POLICY IF EXISTS "deny_all" ON candidate_otps;
CREATE POLICY "candidate_otps_admin" ON candidate_otps
  FOR ALL TO authenticated
  USING (is_super_admin());

-- Table: applications (Scoped by Candidate Zone & Branch)
DROP POLICY IF EXISTS "deny_all" ON applications;
CREATE POLICY "applications_scoped_read" ON applications
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = applications.candidate_id
        AND (
          (is_zonal_hr_manager() AND c.zone_id = staff_zone_id())
          OR (is_central_hr() AND c.zone_id = staff_zone_id())
          OR (is_branch_manager() AND c.branch_id = staff_branch_id())
        )
    )
  );

-- Table: application_steps
DROP POLICY IF EXISTS "deny_all" ON application_steps;
CREATE POLICY "application_steps_scoped_read" ON application_steps
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.id = application_steps.application_id
        AND (
          (is_zonal_hr_manager() AND c.zone_id = staff_zone_id())
          OR (is_central_hr() AND c.zone_id = staff_zone_id())
          OR (is_branch_manager() AND c.branch_id = staff_branch_id())
        )
    )
  );

-- Table: documents
DROP POLICY IF EXISTS "deny_all" ON documents;
CREATE POLICY "documents_scoped_read" ON documents
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.id = documents.application_id
        AND (
          (is_zonal_hr_manager() AND c.zone_id = staff_zone_id())
          OR (is_central_hr() AND c.zone_id = staff_zone_id())
          OR (is_branch_manager() AND c.branch_id = staff_branch_id())
        )
    )
  );

-- Table: verification_remarks
DROP POLICY IF EXISTS "deny_all" ON verification_remarks;
CREATE POLICY "verification_remarks_scoped" ON verification_remarks
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.id = verification_remarks.application_id
        AND (
          (is_zonal_hr_manager() AND c.zone_id = staff_zone_id())
          OR (is_central_hr() AND c.zone_id = staff_zone_id())
          OR (is_branch_manager() AND c.branch_id = staff_branch_id())
        )
    )
  );

-- Table: hr_decisions
DROP POLICY IF EXISTS "deny_all" ON hr_decisions;
CREATE POLICY "hr_decisions_scoped" ON hr_decisions
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR (
      is_zonal_hr_manager() AND EXISTS (
        SELECT 1 FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        WHERE a.id = hr_decisions.application_id AND c.zone_id = staff_zone_id()
      )
    )
  );

-- Table: employees
DROP POLICY IF EXISTS "deny_all" ON employees;
CREATE POLICY "employees_scoped" ON employees
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      WHERE a.id = employees.application_id
        AND (
          (is_zonal_hr_manager() AND c.zone_id = staff_zone_id())
          OR (is_central_hr() AND c.zone_id = staff_zone_id())
          OR (is_branch_manager() AND c.branch_id = staff_branch_id())
        )
    )
  );

-- Table: audit_logs
DROP POLICY IF EXISTS "deny_all" ON audit_logs;
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_super_admin() OR is_zonal_hr_manager());

-- Table: notifications
DROP POLICY IF EXISTS "deny_all" ON notifications;
CREATE POLICY "notifications_read" ON notifications
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (recipient_type = 'staff' AND recipient_id = auth.uid())
  );
