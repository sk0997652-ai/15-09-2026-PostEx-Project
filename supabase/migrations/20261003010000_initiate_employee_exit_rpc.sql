-- ==============================================================================
-- PostEx HR Onboarding Portal — Migration
-- Migration: 20261003010000_initiate_employee_exit_rpc.sql
-- Description:
--   Atomic Postgres RPC function to initiate employee exit clearance lifecycle
--   in a single transaction with row locking, status checks, clearance item
--   seeding, and audit logging.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.initiate_employee_exit(
  p_employee_id UUID,
  p_exit_type public.employee_exit_type,
  p_last_working_date DATE,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT 'Staff User'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_exit_id UUID;
BEGIN
  -- 1. Lock the employee row FOR UPDATE
  SELECT id, status, employee_id, full_name, joining_date, zone_id, branch_id
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  -- Verify employee exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: Employee with ID % does not exist.', p_employee_id;
  END IF;

  -- Verify employee status is active (fail if not active or already exiting)
  IF v_emp.status != 'active' THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_ACTIVE: Employee is not active (current status: %). Cannot initiate exit.', v_emp.status;
  END IF;

  -- Verify no existing in_progress exit exists
  IF EXISTS (
    SELECT 1 FROM public.employee_exits
    WHERE employee_id = p_employee_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'EXIT_ALREADY_IN_PROGRESS: Employee already has an exit process in progress.';
  END IF;

  -- 2. Insert the employee_exits row (status 'in_progress')
  INSERT INTO public.employee_exits (
    employee_id,
    exit_type,
    last_working_date,
    reason,
    notes,
    status,
    initiated_by_id,
    initiated_by_name,
    initiated_at
  ) VALUES (
    p_employee_id,
    p_exit_type,
    p_last_working_date,
    p_reason,
    p_notes,
    'in_progress',
    p_actor_id,
    p_actor_name,
    now()
  )
  RETURNING id INTO v_exit_id;

  -- 3. Insert the 6 exit_clearance_items rows as 'pending'
  -- Item keys: office_files, keys, mobile_sim, id_card, company_car, others
  INSERT INTO public.exit_clearance_items (exit_id, item_key, status, updated_at)
  VALUES
    (v_exit_id, 'office_files', 'pending', now()),
    (v_exit_id, 'keys', 'pending', now()),
    (v_exit_id, 'mobile_sim', 'pending', now()),
    (v_exit_id, 'id_card', 'pending', now()),
    (v_exit_id, 'company_car', 'pending', now()),
    (v_exit_id, 'others', 'pending', now())
  ON CONFLICT (exit_id, item_key) DO NOTHING;

  -- 4. Set employees.status = 'exit_in_progress' and updated_at = now()
  UPDATE public.employees
  SET
    status = 'exit_in_progress',
    updated_at = now()
  WHERE id = p_employee_id;

  -- 5. Insert an audit_logs row with action 'employee_exit_initiated'
  INSERT INTO public.audit_logs (
    actor_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_actor_id,
    'staff',
    'employee_exit_initiated',
    'employee',
    p_employee_id::text,
    jsonb_build_object(
      'exit_id', v_exit_id,
      'employee_code', v_emp.employee_id,
      'employee_name', v_emp.full_name,
      'exit_type', p_exit_type::text,
      'last_working_date', p_last_working_date,
      'reason', p_reason,
      'actor_name', p_actor_name
    )
  );

  -- 6. Return the new exit id
  RETURN v_exit_id;
END;
$$;

-- Security: Revoke from public / anon / authenticated and grant only to service_role
REVOKE ALL ON FUNCTION public.initiate_employee_exit(UUID, public.employee_exit_type, DATE, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initiate_employee_exit(UUID, public.employee_exit_type, DATE, TEXT, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.initiate_employee_exit(UUID, public.employee_exit_type, DATE, TEXT, TEXT, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_employee_exit(UUID, public.employee_exit_type, DATE, TEXT, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
