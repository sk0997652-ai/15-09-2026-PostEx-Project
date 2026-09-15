-- ==============================================================================
-- PostEx HR Onboarding Portal — Database Seed Script (Step 3)
-- ==============================================================================
-- Purpose:
-- 1. Populates baseline organizational seed data (zones, branches, departments, designations).
-- 2. Creates the initial Super Admin in auth.users and staff_profiles (must_change_password = true).
-- 3. Creates a test Candidate record for verifying Candidate OTP login.
--
-- Note: Staff password policy [HARD RULE]: min 10 chars, at least 1 letter, at least 1 number.
-- Initial Super Admin temporary password: 'PostExAdmin2026!' (meets policy, 15 chars).
-- ==============================================================================

-- 1. Ensure required roles exist
INSERT INTO roles (name)
VALUES
  ('super_admin'),
  ('zonal_hr_manager'),
  ('central_hr'),
  ('branch_manager'),
  ('candidate')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Zones
INSERT INTO zones (id, name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'North Zone'),
  ('22222222-2222-2222-2222-222222222222', 'Central Zone'),
  ('33333333-3333-3333-3333-333333333333', 'South Zone')
ON CONFLICT (name) DO NOTHING;

-- 3. Seed Branches
INSERT INTO branches (id, zone_id, name, address)
VALUES
  ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222222222', 'Lahore Gulberg Hub', 'Plot 14-B, Main Boulevard, Gulberg, Lahore'),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', 'Islamabad I-9 Hub', 'Sector I-9/2, Industrial Area, Islamabad'),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 'Karachi Korangi Hub', 'Korangi Industrial Area, Sector 15, Karachi')
ON CONFLICT DO NOTHING;

-- 4. Seed Departments & Designations
INSERT INTO departments (id, name)
VALUES
  ('55555555-5555-5555-5555-555555555551', 'Logistics & Operations'),
  ('55555555-5555-5555-5555-555555555552', 'Human Resources'),
  ('55555555-5555-5555-5555-555555555553', 'Information Technology')
ON CONFLICT (name) DO NOTHING;

INSERT INTO designations (name, department_id)
VALUES
  ('Operations Associate', '55555555-5555-5555-5555-555555555551'),
  ('Delivery Rider', '55555555-5555-5555-5555-555555555551'),
  ('Fleet Supervisor', '55555555-5555-5555-5555-555555555551'),
  ('HR Business Partner', '55555555-5555-5555-5555-555555555552'),
  ('Software Engineer', '55555555-5555-5555-5555-555555555553')
ON CONFLICT DO NOTHING;

-- 5. Seed Super Admin User in Supabase Auth & staff_profiles
-- Email: admin@postex.pk
-- Temporary Password: PostExAdmin2026!
-- must_change_password: true
DO $$
DECLARE
  v_admin_user_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_role_id UUID;
BEGIN
  -- Get super_admin role id
  SELECT id INTO v_role_id FROM roles WHERE name = 'super_admin';

  -- Insert into auth.users (if not already existing)
  -- Uses pgcrypto crypt with blowfish standard compatible with GoTrue
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@postex.pk') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_user_id,
      'authenticated',
      'authenticated',
      'admin@postex.pk',
      crypt('PostExAdmin2026!', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"PostEx Super Admin","must_change_password":true,"role":"super_admin"}'::jsonb,
      now(),
      now()
    );
  ELSE
    SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'admin@postex.pk';
  END IF;

  -- Create or sync staff_profiles entry
  INSERT INTO staff_profiles (
    id,
    name,
    role_id,
    must_change_password,
    is_active,
    created_at
  )
  VALUES (
    v_admin_user_id,
    'PostEx Super Admin',
    v_role_id,
    true,
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    must_change_password = EXCLUDED.must_change_password,
    is_active = true;

END $$;

-- 6. Seed Test Candidate for OTP Login Verification
-- Joining ID: PEX-2026-001
-- CNIC: 35201-1234567-1
-- Mobile: 03001234567
INSERT INTO candidates (
  id,
  full_name,
  cnic,
  mobile,
  email,
  joining_id,
  zone_id,
  branch_id,
  created_at
)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Muhammad Ali',
  '35201-1234567-1',
  '03001234567',
  'ali.candidate@example.com',
  'PEX-2026-001',
  '22222222-2222-2222-2222-222222222222', -- Central Zone
  '44444444-4444-4444-4444-444444444441', -- Lahore Gulberg Hub
  now()
)
ON CONFLICT (cnic) DO UPDATE SET
  joining_id = EXCLUDED.joining_id,
  mobile = EXCLUDED.mobile;
