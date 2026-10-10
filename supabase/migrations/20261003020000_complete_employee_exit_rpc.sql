-- ==============================================================================
-- PostEx HR Onboarding Portal — Migration
-- Migration: 20261003020000_complete_employee_exit_rpc.sql
-- Description:
--   Atomic Postgres RPC function to complete employee exit clearance lifecycle
--   in a single transaction with row locking, status checks, clearance item
--   validation, outstanding items confirmation enforcement, employee status
--   transition to 'exited', and audit logging.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.complete_employee_exit(
  p_exit_id UUID,
  p_actor_id UUID,
  p_actor_name TEXT,
  p_confirm_outstanding BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exit RECORD;
  v_emp RECORD;
  v_pending_items TEXT[];
  v_outstanding_items TEXT[];
BEGIN
  -- 1. Lock the exit row FOR UPDATE
  SELECT id, employee_id, status, exit_type, last_working_date, reason
  INTO v_exit
  FROM public.employee_exits
  WHERE id = p_exit_id
  FOR UPDATE;

  -- Verify exit exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXIT_NOT_FOUND: Exit record with ID % does not exist.', p_exit_id;
  END IF;

  -- 2. Lock the employee row FOR UPDATE
  SELECT id, status, employee_id, full_name, zone_id, branch_id
  INTO v_emp
  FROM public.employees
  WHERE id = v_exit.employee_id
  FOR UPDATE;

  -- Verify employee exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: Associated employee with ID % does not exist.', v_exit.employee_id;
  END IF;

  -- 3. Fail with clear exception code if exit is not 'in_progress'
  IF v_exit.status != 'in_progress' THEN
    RAISE EXCEPTION 'EXIT_NOT_IN_PROGRESS: Exit status is ''%''. Only exits with status ''in_progress'' can be completed.', v_exit.status;
  END IF;

  -- 4. Check if any of the 6 clearance items is still 'pending' (or missing)
  -- The 6 canonical keys: office_files, keys, mobile_sim, id_card, company_car, others
  SELECT array_agg(expected.k ORDER BY expected.k)
  INTO v_pending_items
  FROM (
    SELECT unnest(ARRAY['office_files', 'keys', 'mobile_sim', 'id_card', 'company_car', 'others']) AS k
  ) expected
  LEFT JOIN public.exit_clearance_items eci
    ON eci.exit_id = p_exit_id AND eci.item_key = expected.k
  WHERE eci.status IS NULL OR eci.status = 'pending';

  IF v_pending_items IS NOT NULL AND array_length(v_pending_items, 1) > 0 THEN
    RAISE EXCEPTION 'PENDING_CLEARANCE_ITEMS: [%]', array_to_string(v_pending_items, ', ');
  END IF;

  -- 5. Check if any item is 'not_received' and p_confirm_outstanding is false
  SELECT array_agg(eci.item_key ORDER BY eci.item_key)
  INTO v_outstanding_items
  FROM public.exit_clearance_items eci
  WHERE eci.exit_id = p_exit_id AND eci.status = 'not_received';

  IF v_outstanding_items IS NOT NULL AND array_length(v_outstanding_items, 1) > 0 THEN
    IF NOT COALESCE(p_confirm_outstanding, FALSE) THEN
      RAISE EXCEPTION 'OUTSTANDING_ITEMS: [%]', array_to_string(v_outstanding_items, ', ');
    END IF;
  END IF;

  -- 6. Set employee_exits.status = 'completed', completed_at = now(), completed_by_id = p_actor_id
  UPDATE public.employee_exits
  SET
    status = 'completed',
    completed_at = now(),
    completed_by_id = p_actor_id
  WHERE id = p_exit_id;

  -- 7. Set employees.status = 'exited', updated_at = now()
  UPDATE public.employees
  SET
    status = 'exited',
    updated_at = now()
  WHERE id = v_exit.employee_id;

  -- 8. Insert audit_logs row 'employee_exit_completed' (with outstanding items, if any)
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
    'employee_exit_completed',
    'employee_exits',
    p_exit_id::text,
    jsonb_build_object(
      'exit_id', p_exit_id,
      'employee_id', v_exit.employee_id,
      'employee_code', v_emp.employee_id,
      'employee_name', v_emp.full_name,
      'actor_name', p_actor_name,
      'outstanding_items', COALESCE(to_jsonb(v_outstanding_items), '[]'::jsonb),
      'confirmed_outstanding', COALESCE(p_confirm_outstanding, FALSE)
    )
  );

  -- 9. Return exit id
  RETURN p_exit_id;
END;
$$;

-- Security: Revoke from PUBLIC / anon / authenticated and grant only to service_role
REVOKE ALL ON FUNCTION public.complete_employee_exit(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_employee_exit(UUID, UUID, TEXT, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.complete_employee_exit(UUID, UUID, TEXT, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_employee_exit(UUID, UUID, TEXT, BOOLEAN) TO service_role;

NOTIFY pgrst, 'reload schema';
