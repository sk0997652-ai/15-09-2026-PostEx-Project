-- ==============================================================================
-- Migration: Dual-Track Form Templates, Sections, Fields, and Org Branding
-- Target: Supabase Postgres
-- Description:
--   1. Adds `track` column to `candidates` and `applications` ('executive' / 'non_executive')
--   2. Creates `organization_settings` table for company display name & logo branding
--   3. Creates `form_templates`, `form_sections`, and `form_fields` tables for Super Admin Form Builder
--   4. Seeds default company settings ('PostEx') and initial dual-track templates
-- ==============================================================================

-- 1. ADD `track` COLUMN TO candidates & applications
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidates' AND column_name = 'track'
  ) THEN
    ALTER TABLE public.candidates 
    ADD COLUMN track TEXT DEFAULT 'executive' CHECK (track IN ('executive', 'non_executive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applications' AND column_name = 'track'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN track TEXT DEFAULT 'executive' CHECK (track IN ('executive', 'non_executive'));
  END IF;
END $$;

-- 2. ORGANIZATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'PostEx',
  portal_name TEXT NOT NULL DEFAULT 'HR Onboarding Portal',
  logo_storage_path TEXT,
  support_email TEXT DEFAULT 'hr-support@postex.pk',
  data_retention_days INTEGER DEFAULT 90,
  auto_archive_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Initial seed for organization settings if none exists
INSERT INTO public.organization_settings (id, company_name, portal_name, support_email, data_retention_days, auto_archive_enabled)
SELECT 'a0000000-0000-0000-0000-000000000001', 'PostEx', 'HR Onboarding Portal', 'hr-support@postex.pk', 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.organization_settings);

-- 3. FORM TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track TEXT NOT NULL CHECK (track IN ('executive', 'non_executive')),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. FORM SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.form_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. FORM FIELDS TABLE
CREATE TABLE IF NOT EXISTS public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
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

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_form_templates_track_active ON public.form_templates(track, is_active);
CREATE INDEX IF NOT EXISTS idx_form_sections_template ON public.form_sections(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON public.form_fields(section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_candidates_track ON public.candidates(track);
CREATE INDEX IF NOT EXISTS idx_applications_track ON public.applications(track);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- Allow read access for public / authenticated (candidates and staff need to see active templates and branding)
CREATE POLICY "Allow read organization settings" ON public.organization_settings FOR SELECT USING (true);
CREATE POLICY "Allow read form templates" ON public.form_templates FOR SELECT USING (true);
CREATE POLICY "Allow read form sections" ON public.form_sections FOR SELECT USING (true);
CREATE POLICY "Allow read form fields" ON public.form_fields FOR SELECT USING (true);

-- Allow full access for service_role
CREATE POLICY "Service role full access settings" ON public.organization_settings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access templates" ON public.form_templates FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access sections" ON public.form_sections FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access fields" ON public.form_fields FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
