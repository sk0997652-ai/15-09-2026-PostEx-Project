-- ==============================================================================
-- Migration: Dual-Track Form Templates, Sections, Fields, and Org Branding
-- Target: Supabase Postgres SQL Editor
-- Description:
--   1. Adds 'track' column to 'candidates' and 'applications' ('executive' / 'non_executive')
--   2. Backfills 'track' for existing candidates/applications
--   3. Creates 'organization_settings' table for branding & retention policies
--   4. Creates 'form_templates', 'form_sections', and 'form_fields' tables
--   5. Seeds all 12 Executive and 8 Non-Executive sections with all fields
--   6. Configures Row Level Security (RLS) policies:
--        - SELECT: Allowed for anon & authenticated (candidates & staff read forms/branding)
--        - INSERT/UPDATE/DELETE: Restricted to super_admin and service_role
-- ==============================================================================

-- 1. ADD 'track' COLUMN TO candidates & applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'track'
  ) THEN
    ALTER TABLE public.candidates
    ADD COLUMN track TEXT NOT NULL DEFAULT 'executive' CHECK (track IN ('executive', 'non_executive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'track'
  ) THEN
    ALTER TABLE public.applications
    ADD COLUMN track TEXT NOT NULL DEFAULT 'executive' CHECK (track IN ('executive', 'non_executive'));
  END IF;
END $$;

-- 1B. BACKFILL TRACK FROM EXISTING APPLICATION STEPS (IF ANY)
UPDATE public.candidates c
SET track = 'non_executive'
FROM public.applications a
JOIN public.application_steps s ON s.application_id = a.id
WHERE a.candidate_id = c.id
  AND s.step_number = 1
  AND (s.data->>'track' = 'non_executive');

UPDATE public.applications a
SET track = 'non_executive'
FROM public.application_steps s
WHERE s.application_id = a.id
  AND s.step_number = 1
  AND (s.data->>'track' = 'non_executive');

-- 2. ORGANIZATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_name TEXT NOT NULL DEFAULT 'PostEx',
  portal_name TEXT NOT NULL DEFAULT 'HR Onboarding Portal',
  logo_storage_path TEXT,
  support_email TEXT DEFAULT 'hr-support@postex.pk',
  data_retention_days INTEGER DEFAULT 90,
  auto_archive_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed initial organization settings if none exists
INSERT INTO public.organization_settings (id, company_name, portal_name, support_email, data_retention_days, auto_archive_enabled)
SELECT 'default-org-settings', 'PostEx', 'HR Onboarding Portal', 'hr-support@postex.pk', 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.organization_settings);

-- 3. FORM TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.form_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  track TEXT NOT NULL CHECK (track IN ('executive', 'non_executive')),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. FORM SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.form_sections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. FORM FIELDS TABLE
CREATE TABLE IF NOT EXISTS public.form_fields (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section_id TEXT NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'yes_no', 'textarea', 'repeatable_table', 'signature')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  table_columns JSONB DEFAULT '[]'::jsonb,
  conditional_label TEXT,
  placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Indices
CREATE INDEX IF NOT EXISTS idx_candidates_track ON public.candidates(track);
CREATE INDEX IF NOT EXISTS idx_applications_track ON public.applications(track);
CREATE INDEX IF NOT EXISTS idx_form_templates_track ON public.form_templates(track, is_active);
CREATE INDEX IF NOT EXISTS idx_form_sections_template ON public.form_sections(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON public.form_fields(section_id, order_index);

-- 6. SEED FORM TEMPLATES, SECTIONS, AND FIELDS
-- Template: executive
INSERT INTO public.form_templates (id, track, version, is_active, created_at) VALUES ('tmpl-executive-v1', 'executive', 1, true, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-personal', 'tmpl-executive-v1', 'Personal Information', 1, 'Basic bio-data, national identity, and communication coordinates', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-1', 'sec-exec-personal', 'full_name', 'Full Name', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-2', 'sec-exec-personal', 'title', 'Title', 'dropdown', true, 2, '["Mr.","Ms.","Mrs.","Dr."]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-3', 'sec-exec-personal', 'gender', 'Gender', 'dropdown', true, 3, '["Male","Female","Other"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-4', 'sec-exec-personal', 'religion', 'Religion', 'text', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-5', 'sec-exec-personal', 'marital_status', 'Marital Status', 'dropdown', true, 5, '["Single","Married","Divorced","Widowed"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-6', 'sec-exec-personal', 'spouse_contact', 'Spouse Contact Number', 'text', false, 6, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-7', 'sec-exec-personal', 'father_husband_name', 'Father''s / Husband''s Name', 'text', true, 7, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-8', 'sec-exec-personal', 'dob', 'Date of Birth', 'date', true, 8, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-9', 'sec-exec-personal', 'place_of_birth', 'Place of Birth', 'text', true, 9, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-10', 'sec-exec-personal', 'nationality', 'Nationality', 'text', true, 10, '["Pakistani"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-11', 'sec-exec-personal', 'domicile', 'Domicile (District / Province)', 'text', false, 11, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-12', 'sec-exec-personal', 'cnic', 'CNIC Number (13 Digits)', 'text', true, 12, '[]'::jsonb, '[]'::jsonb, NULL, '35201-1234567-1', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-13', 'sec-exec-personal', 'permanent_address', 'Permanent Address', 'textarea', true, 13, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-14', 'sec-exec-personal', 'current_address', 'Current Address', 'textarea', true, 14, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-15', 'sec-exec-personal', 'landline_phone', 'Phone Number (Landline)', 'text', false, 15, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-16', 'sec-exec-personal', 'mobile', 'Mobile Number (Pakistani 03XXXXXXXXX)', 'text', true, 16, '[]'::jsonb, '[]'::jsonb, NULL, '03001234567', now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-spouse-dependents', 'tmpl-executive-v1', 'Spouse & Dependents', 2, 'Family details, dependent children or elders, and housing status', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-20', 'sec-exec-spouse-dependents', 'spouse_name', 'Name of Spouse (if applicable)', 'text', false, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-21', 'sec-exec-spouse-dependents', 'dependents_table', 'Dependent Details (allow up to 5 rows)', 'repeatable_table', false, 2, '[]'::jsonb, '[{"key":"relationship","label":"Relationship","type":"dropdown","options":["Husband","Wife","Son","Daughter","Father","Mother"]},{"key":"name","label":"Name","type":"text"},{"key":"cnic","label":"CNIC / B-Form","type":"text"},{"key":"marriage_date","label":"Marriage Date","type":"date"},{"key":"dob","label":"Date of Birth","type":"date"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-22', 'sec-exec-spouse-dependents', 'residence_status', 'Residence Status', 'dropdown', true, 3, '["Own a house","Rent it","Live with relatives","Company provided"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-health', 'tmpl-executive-v1', 'Health Details', 3, 'Physical fitness, medical examinations, and hospitalization history', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-30', 'sec-exec-health', 'blood_group', 'Blood Group', 'dropdown', true, 1, '["A+","A-","B+","B-","O+","O-","AB+","AB-"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-31', 'sec-exec-health', 'last_medical_exam_date', 'Last Medical Examination Date', 'date', false, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-32', 'sec-exec-health', 'occasion_of_last_exam', 'Occasion of Last Exam', 'text', false, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-33', 'sec-exec-health', 'result_of_last_exam', 'Result of Last Exam', 'text', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-34', 'sec-exec-health', 'has_illness_or_disability', 'Any illness requiring hospitalization or physical disability?', 'yes_no', true, 5, '[]'::jsonb, '[]'::jsonb, 'If yes, please provide complete medical details', NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-35', 'sec-exec-health', 'illness_details', 'Details of illness or disability', 'textarea', false, 6, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-academic', 'tmpl-executive-v1', 'Academic Details', 4, 'Educational qualifications, certifications, honors, and awards', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-40', 'sec-exec-academic', 'academic_record', 'Academic Record', 'repeatable_table', true, 1, '[]'::jsonb, '[{"key":"examination_passed","label":"Examination Passed","type":"dropdown","options":["Matriculation / O-Levels","Intermediate / A-Levels","Graduation / Bachelor","Post-Graduation / Master","Doctorate / PhD","Other Specialized Degree","Diploma / Short Course"]},{"key":"year","label":"Year Passed","type":"text"},{"key":"division_grade","label":"Division / Grade / GPA","type":"text"},{"key":"institution","label":"Name of Institution / Board","type":"text"},{"key":"major_subjects","label":"Major Subjects","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-41', 'sec-exec-academic', 'special_training', 'Special Training or Professional Courses', 'textarea', false, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-42', 'sec-exec-academic', 'honors_awards', 'Any Honors, Awards or Scholarships Won', 'textarea', false, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-43', 'sec-exec-academic', 'foreign_degrees', 'Any Foreign Degree or Distinction', 'text', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-44', 'sec-exec-academic', 'other_academic_notes', 'Any other to mention', 'text', false, 5, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-languages', 'tmpl-executive-v1', 'Language Proficiency', 5, 'Competence in spoken, reading, and written communication', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-50', 'sec-exec-languages', 'languages_table', 'Languages', 'repeatable_table', false, 1, '[]'::jsonb, '[{"key":"language","label":"Language","type":"text"},{"key":"spoken","label":"Spoken Proficiency","type":"dropdown","options":["Slight","Moderate","Proficient"]},{"key":"read","label":"Reading Proficiency","type":"dropdown","options":["Slight","Moderate","Proficient"]},{"key":"written","label":"Written Proficiency","type":"dropdown","options":["Slight","Moderate","Proficient"]}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-employment', 'tmpl-executive-v1', 'Employment History', 6, 'Previous corporate employers, tenure, compensation breakdown, and service bonds', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-60', 'sec-exec-employment', 'employment_record', 'Employment Record (up to 6 past positions)', 'repeatable_table', false, 1, '[]'::jsonb, '[{"key":"date_from","label":"Date From","type":"date"},{"key":"date_to","label":"Date To","type":"date"},{"key":"employer_name_address","label":"Employer Name & Address","type":"text"},{"key":"position_held","label":"Position(s) Held","type":"text"},{"key":"gross_salary_starting","label":"Gross Salary — Starting (PKR)","type":"number"},{"key":"gross_salary_last","label":"Gross Salary — Present/Last (PKR)","type":"number"},{"key":"reason_for_leaving","label":"Reasons for Leaving","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-61', 'sec-exec-employment', 'pay_total', 'Last Pay Package Breakdown: Total Gross (PKR)', 'number', false, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-62', 'sec-exec-employment', 'pay_basic', 'Basic Salary (PKR)', 'number', false, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-63', 'sec-exec-employment', 'pay_utilities', 'Utilities Allowance (PKR)', 'number', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-64', 'sec-exec-employment', 'pay_transport', 'Transport Allowance (PKR)', 'number', false, 5, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-65', 'sec-exec-employment', 'pay_house_rent', 'House Rent Allowance (PKR)', 'number', false, 6, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-66', 'sec-exec-employment', 'pay_entertainment', 'Entertainment Allowance (PKR)', 'number', false, 7, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-67', 'sec-exec-employment', 'pay_bonus', 'Bonus / Commissions (PKR)', 'number', false, 8, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-68', 'sec-exec-employment', 'pay_provident_fund', 'Provident Fund (PKR)', 'number', false, 9, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-69', 'sec-exec-employment', 'pay_others', 'Others — specify (PKR)', 'text', false, 10, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-70', 'sec-exec-employment', 'other_benefits', 'Details of any other benefits from present/last employer', 'textarea', false, 11, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-71', 'sec-exec-employment', 'has_incentive_reward', 'Any Incentive, Reward, or other allowance received?', 'yes_no', false, 12, '[]'::jsonb, '[]'::jsonb, 'If yes, specify details of incentive/reward', NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-72', 'sec-exec-employment', 'is_under_service_bond', 'Are you under any service bond with your present employer?', 'yes_no', true, 13, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-present-job', 'tmpl-executive-v1', 'Present Job Information', 7, 'Corporate onboarding role, work station, and agreed compensation', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-80', 'sec-exec-present-job', 'position_applied', 'Position Applied For', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-81', 'sec-exec-present-job', 'employee_id_ref', 'Employee ID (if applicable / rehire)', 'text', false, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-82', 'sec-exec-present-job', 'date_of_joining', 'Date of Joining', 'date', false, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-83', 'sec-exec-present-job', 'salary_gross', 'Salary — Gross Agreed (PKR)', 'number', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-84', 'sec-exec-present-job', 'work_location', 'Work Location / Hub', 'text', false, 5, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-preferences', 'tmpl-executive-v1', 'Work Preferences', 8, 'Mobility, travel willingness, own vehicle, and driver license', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-90', 'sec-exec-preferences', 'work_anywhere_pakistan', 'Prepared to work anywhere in Pakistan?', 'yes_no', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-91', 'sec-exec-preferences', 'extensive_travel', 'Prepared for extensive travel?', 'yes_no', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-92', 'sec-exec-preferences', 'own_transport', 'Do you have your own transport?', 'yes_no', true, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-93', 'sec-exec-preferences', 'driving_license', 'Do you have a Driving License?', 'yes_no', true, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-emergency', 'tmpl-executive-v1', 'Emergency Contact', 9, 'Designated next-of-kin or emergency respondent coordinates', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-100', 'sec-exec-emergency', 'emergency_name', 'Full Name', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-101', 'sec-exec-emergency', 'emergency_address', 'Address', 'textarea', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-102', 'sec-exec-emergency', 'emergency_city', 'City', 'text', true, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-103', 'sec-exec-emergency', 'emergency_relationship', 'Relationship', 'text', true, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-104', 'sec-exec-emergency', 'emergency_contact', 'Contact Number', 'text', true, 5, '[]'::jsonb, '[]'::jsonb, NULL, '03XXXXXXXXX', now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-references', 'tmpl-executive-v1', 'References', 10, 'Four credible references (2 personal, 2 professional business contacts)', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-110', 'sec-exec-references', 'references_table', 'References (4 rows: Personal 1, Personal 2, Business 1, Business 2)', 'repeatable_table', true, 1, '[]'::jsonb, '[{"key":"category","label":"Category","type":"dropdown","options":["Personal (1)","Personal (2)","Business (1)","Business (2)"]},{"key":"name","label":"Full Name","type":"text"},{"key":"position","label":"Designation / Organization","type":"text"},{"key":"address","label":"Postal Address","type":"text"},{"key":"contact_no","label":"Contact Number","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-111', 'sec-exec-references', 'has_relative_in_company', 'Does any relative or friend work in this organization?', 'yes_no', true, 2, '[]'::jsonb, '[]'::jsonb, 'If yes, state Name, Designation, and Relationship', NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-interests', 'tmpl-executive-v1', 'Interests & Career Choice', 11, 'Professional memberships, organizational alignment, and candidate statement', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-120', 'sec-exec-interests', 'club_memberships', 'Membership of Professional, Social, Cultural Organizations and Clubs', 'textarea', false, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-121', 'sec-exec-interests', 'reasons_for_selecting', 'Reasons for selecting this organization', 'textarea', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-122', 'sec-exec-interests', 'suitability_statement', 'Why do you consider yourself suitable for the position applied?', 'textarea', true, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-exec-declaration', 'tmpl-executive-v1', 'Declaration', 12, 'Legal affirmation of truthfulness and declaration of signing particulars', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-130', 'sec-exec-declaration', 'place', 'Place (City of Signing)', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, 'e.g. Lahore / Karachi / Islamabad', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-e-131', 'sec-exec-declaration', 'signing_date', 'Date of Signing', 'date', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

-- Template: non_executive
INSERT INTO public.form_templates (id, track, version, is_active, created_at) VALUES ('tmpl-non-executive-v1', 'non_executive', 1, true, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-employee', 'tmpl-non-executive-v1', 'Employee Information', 1, 'Frontline candidate biographical data and identity particulars', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-1', 'sec-nex-employee', 'designation_applied', 'Designation Applied For', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-2', 'sec-nex-employee', 'name_as_per_cnic', 'Name, as per CNIC', 'text', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-3', 'sec-nex-employee', 'cnic', 'Employee CNIC Number (13 Digits)', 'text', true, 3, '[]'::jsonb, '[]'::jsonb, NULL, '35201-1234567-1', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-4', 'sec-nex-employee', 'dob', 'Date of Birth', 'date', true, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-5', 'sec-nex-employee', 'contact_number', 'Contact Number (Mobile)', 'text', true, 5, '[]'::jsonb, '[]'::jsonb, NULL, '03001234567', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-6', 'sec-nex-employee', 'cnic_issue_date', 'CNIC Issuance Date', 'date', false, 6, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-7', 'sec-nex-employee', 'cnic_expiry_date', 'CNIC Expiry Date', 'date', false, 7, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-8', 'sec-nex-employee', 'marital_status', 'Marital Status', 'dropdown', true, 8, '["Single","Married","Divorced","Widowed"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-9', 'sec-nex-employee', 'place_of_birth', 'Place of Birth', 'text', true, 9, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-10', 'sec-nex-employee', 'gender', 'Gender', 'dropdown', true, 10, '["Male","Female","Other"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-11', 'sec-nex-employee', 'blood_group', 'Blood Group', 'dropdown', true, 11, '["A+","A-","B+","B-","O+","O-","AB+","AB-"]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-12', 'sec-nex-employee', 'father_name_cnic', 'Father''s Name, as per CNIC', 'text', true, 12, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-13', 'sec-nex-employee', 'religion', 'Religion', 'text', false, 13, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-14', 'sec-nex-employee', 'father_cnic', 'Father''s CNIC Number', 'text', false, 14, '[]'::jsonb, '[]'::jsonb, NULL, '35201-XXXXXXX-X', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-15', 'sec-nex-employee', 'mother_name_cnic', 'Mother''s Name, as per CNIC', 'text', false, 15, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-address', 'tmpl-non-executive-v1', 'Address & Family', 2, 'Residential coordinates, next of kin, and internal company relatives', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-20', 'sec-nex-address', 'permanent_address', 'Permanent Address', 'textarea', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-21', 'sec-nex-address', 'current_address', 'Current Address', 'textarea', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-22', 'sec-nex-address', 'next_of_kin_name', 'Next of Kin Name', 'text', true, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-23', 'sec-nex-address', 'next_of_kin_relation', 'Next of Kin Relationship', 'text', true, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-24', 'sec-nex-address', 'next_of_kin_contact', 'Next of Kin Contact Number', 'text', true, 5, '[]'::jsonb, '[]'::jsonb, NULL, '03XXXXXXXXX', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-25', 'sec-nex-address', 'has_relative_working', 'Any relative/blood relation working within the company?', 'yes_no', true, 6, '[]'::jsonb, '[]'::jsonb, 'If yes, please specify relative name, branch, and role', NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-experience', 'tmpl-non-executive-v1', 'Experience', 3, 'Tenure in applied operational role and geographic flexibility', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-30', 'sec-nex-experience', 'total_experience', 'Total Experience in Position Applied', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, 'e.g. 2 Years as Delivery Courier', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-31', 'sec-nex-experience', 'willing_to_work_anywhere', 'Willing to work anywhere in Pakistan?', 'yes_no', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-academic', 'tmpl-non-executive-v1', 'Academic Details', 4, 'Educational certificates and academic background', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-40', 'sec-nex-academic', 'academic_record', 'Academic Record', 'repeatable_table', true, 1, '[]'::jsonb, '[{"key":"degree","label":"Degree / Certificate","type":"dropdown","options":["Matriculation","Intermediate","Graduation","Masters","Professional","Other"]},{"key":"subjects","label":"Subjects","type":"text"},{"key":"institute","label":"Institute / School","type":"text"},{"key":"passing_year","label":"Passing Year","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-employment', 'tmpl-non-executive-v1', 'Employment Record', 5, 'Previous logistics hubs, courier companies, or warehouse roles', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-50', 'sec-nex-employment', 'employment_record', 'Employment Record', 'repeatable_table', false, 1, '[]'::jsonb, '[{"key":"company_name","label":"Company Name","type":"text"},{"key":"position","label":"Position","type":"text"},{"key":"responsibilities","label":"Major Responsibilities","type":"text"},{"key":"duration_from","label":"Duration From","type":"date"},{"key":"duration_to","label":"Duration To","type":"date"},{"key":"achievements","label":"Achievements / Notes","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-references', 'tmpl-non-executive-v1', 'References', 6, 'Four credible references (2 personal acquaintances, 2 business or past employers)', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-60', 'sec-nex-references', 'references_table', 'References (4 fixed rows: Personal 1, Personal 2, Business 1, Business 2)', 'repeatable_table', true, 1, '[]'::jsonb, '[{"key":"type","label":"Type","type":"dropdown","options":["Personal (1)","Personal (2)","Business (1)","Business (2)"]},{"key":"name","label":"Name","type":"text"},{"key":"position_relation","label":"Position / Relationship","type":"text"},{"key":"contact_number","label":"Contact Number","type":"text"}]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-current-job', 'tmpl-non-executive-v1', 'Current Job Information', 7, 'Assigned division, zone, operational branch, department, and salary', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-70', 'sec-nex-current-job', 'division', 'Division', 'text', false, 1, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-71', 'sec-nex-current-job', 'zone', 'Zone (Pre-filled from assignment)', 'text', false, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-72', 'sec-nex-current-job', 'branch', 'Branch / Hub', 'text', false, 3, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-73', 'sec-nex-current-job', 'work_location', 'Area / Work Location', 'text', false, 4, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-74', 'sec-nex-current-job', 'department', 'Department', 'text', false, 5, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-75', 'sec-nex-current-job', 'sub_department', 'Sub Department', 'text', false, 6, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-76', 'sec-nex-current-job', 'function', 'Function', 'text', false, 7, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-77', 'sec-nex-current-job', 'current_designation', 'Current Designation', 'text', false, 8, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-78', 'sec-nex-current-job', 'additional_replacement', 'Additional / Replacement', 'text', false, 9, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-79', 'sec-nex-current-job', 'date_of_joining', 'Date of Joining', 'date', false, 10, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-80', 'sec-nex-current-job', 'monthly_gross_salary', 'Monthly Gross Salary (PKR)', 'number', false, 11, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-81', 'sec-nex-current-job', 'shift_details', 'Shift Details (Day / Night / Morning)', 'text', false, 12, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_sections (id, template_id, title, order_index, description, created_at) VALUES ('sec-nex-declaration', 'tmpl-non-executive-v1', 'Declaration', 8, 'Affirmation of truthfulness, financial consent, and declaration of signing particulars', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-90', 'sec-nex-declaration', 'place', 'Place (City of Signing)', 'text', true, 1, '[]'::jsonb, '[]'::jsonb, NULL, 'e.g. Lahore / Karachi / Islamabad', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.form_fields (id, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, created_at) VALUES ('f-ne-91', 'sec-nex-declaration', 'signing_date', 'Date of Signing', 'date', true, 2, '[]'::jsonb, '[]'::jsonb, NULL, NULL, now()) ON CONFLICT (id) DO NOTHING;


-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Allow read organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Allow super_admin manage organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Allow read form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Allow super_admin manage form templates" ON public.form_templates;
DROP POLICY IF EXISTS "Allow read form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Allow super_admin manage form sections" ON public.form_sections;
DROP POLICY IF EXISTS "Allow read form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Allow super_admin manage form fields" ON public.form_fields;
DROP POLICY IF EXISTS "Service role full access settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Service role full access templates" ON public.form_templates;
DROP POLICY IF EXISTS "Service role full access sections" ON public.form_sections;
DROP POLICY IF EXISTS "Service role full access fields" ON public.form_fields;

-- A. READ POLICIES (Accessible to candidates & staff)
CREATE POLICY "Allow read organization settings"
  ON public.organization_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow read form templates"
  ON public.form_templates FOR SELECT
  USING (true);

CREATE POLICY "Allow read form sections"
  ON public.form_sections FOR SELECT
  USING (true);

CREATE POLICY "Allow read form fields"
  ON public.form_fields FOR SELECT
  USING (true);

-- B. WRITE POLICIES (Restricted to super_admin)
CREATE POLICY "Allow super_admin manage organization settings"
  ON public.organization_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Allow super_admin manage form templates"
  ON public.form_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Allow super_admin manage form sections"
  ON public.form_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Allow super_admin manage form fields"
  ON public.form_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      JOIN public.roles r ON sp.role_id = r.id
      WHERE sp.id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- C. SERVICE ROLE FULL ACCESS (Internal system operations)
CREATE POLICY "Service role full access settings" ON public.organization_settings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access templates" ON public.form_templates FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access sections" ON public.form_sections FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access fields" ON public.form_fields FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
