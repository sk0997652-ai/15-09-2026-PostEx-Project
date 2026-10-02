-- ==============================================================================
-- Migration: Cities Table, Master Data Codes & Legacy Bulk Import Support
-- Target: Supabase Postgres SQL Editor
-- Description:
--   1. Creates 'public.cities' table (id, city_code UNIQUE, name, zone_id FK nullable,
--      is_active, created_at) with RLS policies matching master data tables.
--   2. Adds nullable 'city_id' UUID FK (referencing public.cities) to 'public.branches'.
--   3. Adds nullable 'designation_code' TEXT UNIQUE to 'public.designations'.
--   4. Relaxes legacy NOT NULL constraints on optional master data columns
--      (zones.region, departments.department_category, designations.department_id,
--      designations.employment_category, branches.branch_type, branches.city_address)
--      so "CODE | NAME" bulk imports and streamlined creation forms work seamlessly.
-- ==============================================================================

-- ==============================================================================
-- 1. NEW TABLE: public.cities
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_code TEXT,
  name TEXT NOT NULL,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cities_city_code_key'
  ) THEN
    ALTER TABLE public.cities
      ADD CONSTRAINT cities_city_code_key UNIQUE (city_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cities_zone_id ON public.cities(zone_id);
CREATE INDEX IF NOT EXISTS idx_cities_city_code ON public.cities(city_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cities_city_code_norm
  ON public.cities (UPPER(BTRIM(city_code)))
  WHERE city_code IS NOT NULL AND BTRIM(city_code) <> '';

-- Enable RLS on public.cities (matching zones/branches/departments/designations)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_read_all" ON public.cities;
DROP POLICY IF EXISTS "cities_admin_all" ON public.cities;

CREATE POLICY "cities_read_all" ON public.cities
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cities_admin_all" ON public.cities
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ==============================================================================
-- 2. ENHANCE public.branches WITH NULLABLE city_id FK
-- ==============================================================================
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branches_city_id ON public.branches(city_id);

-- Allow nullable branch_type and city_address for legacy "CODE | NAME" imports
ALTER TABLE public.branches
  ALTER COLUMN branch_type DROP NOT NULL,
  ALTER COLUMN city_address DROP NOT NULL;

-- ==============================================================================
-- 3. ENHANCE public.designations WITH NULLABLE designation_code (UNIQUE)
-- ==============================================================================
ALTER TABLE public.designations
  ADD COLUMN IF NOT EXISTS designation_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'designations_designation_code_key'
  ) THEN
    ALTER TABLE public.designations
      ADD CONSTRAINT designations_designation_code_key UNIQUE (designation_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_designations_designation_code ON public.designations(designation_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_designations_designation_code_norm
  ON public.designations (UPPER(BTRIM(designation_code)))
  WHERE designation_code IS NOT NULL AND BTRIM(designation_code) <> '';

-- Allow nullable department_id and employment_category for legacy "CODE | NAME" imports
ALTER TABLE public.designations
  ALTER COLUMN department_id DROP NOT NULL,
  ALTER COLUMN employment_category DROP NOT NULL;

-- ==============================================================================
-- 4. RELAX REMOVED UI FIELDS ON public.zones AND public.departments
-- ==============================================================================
ALTER TABLE public.zones
  ALTER COLUMN region DROP NOT NULL;

ALTER TABLE public.departments
  ALTER COLUMN department_category DROP NOT NULL;

-- Reload PostgREST schema cache so new table and columns are immediately recognized
NOTIFY pgrst, 'reload schema';
