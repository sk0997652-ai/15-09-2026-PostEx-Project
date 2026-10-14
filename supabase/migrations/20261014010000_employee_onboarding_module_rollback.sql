-- ==============================================================================
-- PostEx HR Portal — Employee Onboarding Module Rollback SQL
-- ==============================================================================
-- SAFETY GUARANTEE:
-- Drops ONLY objects created for this module (all prefixed with "onboarding_").
-- Zero impact on existing tables (branches, designations, employees, employee_workflow_tasks, etc.)
-- ==============================================================================

DROP TABLE IF EXISTS public.onboarding_reminder_logs CASCADE;
DROP TABLE IF EXISTS public.onboarding_timeline_events CASCADE;
DROP TABLE IF EXISTS public.onboarding_candidates CASCADE;

DROP TYPE IF EXISTS public.onboarding_actor_role;
DROP TYPE IF EXISTS public.onboarding_reviewer_role;
DROP TYPE IF EXISTS public.onboarding_stage;
