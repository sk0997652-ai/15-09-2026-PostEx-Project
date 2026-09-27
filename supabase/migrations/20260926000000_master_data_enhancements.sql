-- ==============================================================================
-- Migration: Master Data Setup Enhancements (Part A of 4)
-- Target: Supabase Postgres SQL Editor
-- Description:
--   1. Enhances 'zones' with zone_code (UNIQUE), region, and is_active
--   2. Enhances 'branches' with branch_code (UNIQUE), branch_type, city_address,
--      contact_number, and is_active
--   3. Enhances 'departments' with department_code (UNIQUE), department_category,
--      and is_active
--   4. Enhances 'designations' with employment_category ('Rider' / 'In-House Staff')
--      and is_active
-- ==============================================================================

-- ==============================================================================
-- 1. ZONES TABLE ENHANCEMENTS
-- ==============================================================================
ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS zone_code TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Safe backfill in case any rows exist prior to setting NOT NULL
UPDATE public.zones
SET
  zone_code = COALESCE(zone_code, 'ZN-' || SUBSTRING(id::text, 1, 6)),
  region = COALESCE(region, 'Punjab')
WHERE zone_code IS NULL OR region IS NULL;

ALTER TABLE public.zones
  ALTER COLUMN zone_code SET NOT NULL,
  ALTER COLUMN region SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zones_zone_code_key'
  ) THEN
    ALTER TABLE public.zones
      ADD CONSTRAINT zones_zone_code_key UNIQUE (zone_code);
  END IF;
END $$;

-- ==============================================================================
-- 2. BRANCHES TABLE ENHANCEMENTS
-- ==============================================================================
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS branch_type TEXT,
  ADD COLUMN IF NOT EXISTS city_address TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Safe backfill in case any rows exist prior to setting NOT NULL
UPDATE public.branches
SET
  branch_code = COALESCE(branch_code, 'BR-' || SUBSTRING(id::text, 1, 6)),
  branch_type = COALESCE(branch_type, 'Hub'),
  city_address = COALESCE(city_address, address, 'N/A')
WHERE branch_code IS NULL OR branch_type IS NULL OR city_address IS NULL;

ALTER TABLE public.branches
  ALTER COLUMN branch_code SET NOT NULL,
  ALTER COLUMN branch_type SET NOT NULL,
  ALTER COLUMN city_address SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_branch_code_key'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_branch_code_key UNIQUE (branch_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_branch_type_check'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_branch_type_check
      CHECK (branch_type IN ('Hub', 'Sub-Hub', 'Warehouse', 'Franchise'));
  END IF;
END $$;

-- ==============================================================================
-- 3. DEPARTMENTS TABLE ENHANCEMENTS
-- ==============================================================================
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_code TEXT,
  ADD COLUMN IF NOT EXISTS department_category TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Safe backfill in case any rows exist prior to setting NOT NULL
UPDATE public.departments
SET
  department_code = COALESCE(department_code, 'DEPT-' || SUBSTRING(id::text, 1, 6)),
  department_category = COALESCE(department_category, 'Field Operations')
WHERE department_code IS NULL OR department_category IS NULL;

ALTER TABLE public.departments
  ALTER COLUMN department_code SET NOT NULL,
  ALTER COLUMN department_category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_department_code_key'
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT departments_department_code_key UNIQUE (department_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_department_category_check'
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT departments_department_category_check
      CHECK (department_category IN ('Field Operations', 'Corporate (Head Office)'));
  END IF;
END $$;

-- ==============================================================================
-- 4. DESIGNATIONS TABLE ENHANCEMENTS
-- ==============================================================================
ALTER TABLE public.designations
  ADD COLUMN IF NOT EXISTS employment_category TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Safe backfill in case any rows exist prior to setting NOT NULL
UPDATE public.designations
SET
  employment_category = COALESCE(employment_category, 'In-House Staff')
WHERE employment_category IS NULL;

ALTER TABLE public.designations
  ALTER COLUMN employment_category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'designations_employment_category_check'
  ) THEN
    ALTER TABLE public.designations
      ADD CONSTRAINT designations_employment_category_check
      CHECK (employment_category IN ('Rider', 'In-House Staff'));
  END IF;
END $$;

-- Reload PostgREST schema cache so new columns are immediately recognized by API
NOTIFY pgrst, 'reload schema';
