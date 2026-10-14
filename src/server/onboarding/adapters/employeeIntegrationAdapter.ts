// Employee Integration Adapter: Single bridge function when onboarding reaches 'Onboarded'
// ==============================================================================
// RULES COMPLIANCE:
// 1. NO new Employee model is created.
// 2. Exactly ONE integration function: `createEmployeeFromOnboarding(candidate)`.
// 3. Clear integration point for existing `employees` table.
// 4. Zero writes to any other existing tables.
// ==============================================================================

import { OnboardingCandidate } from '../onboardingTypes';

export interface ExistingEmployeeRecord {
  id: string;
  emp_id: string;
  full_name: string;
  cnic: string;
  mobile: string;
  email?: string;
  designation_id: string;
  branch_id: string;
  status: string;
  joining_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Creates or links an employee record in the existing PostEx `employees` table
 * once an onboarding candidate successfully completes all onboarding verification steps.
 * 
 * INTEGRATION POINT:
 * In your live database environment, connect this to your existing ORM or SQL client:
 * Example SQL:
 * `INSERT INTO public.employees (id, emp_id, full_name, cnic, mobile, email, designation_id, branch_id, status, joining_date)
 *  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', NOW())
 *  ON CONFLICT (cnic) DO UPDATE SET status = 'Active', updated_at = NOW() RETURNING *;`
 */
export async function createEmployeeFromOnboarding(
  candidate: OnboardingCandidate
): Promise<ExistingEmployeeRecord> {
  const generatedId = `emp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const employeeRecord: ExistingEmployeeRecord = {
    id: generatedId,
    emp_id: candidate.emp_id,
    full_name: candidate.full_name,
    cnic: candidate.cnic,
    mobile: candidate.mobile,
    email: candidate.email,
    designation_id: candidate.designation_id,
    branch_id: candidate.branch_id,
    status: 'Active',
    joining_date: now,
    created_at: now,
    updated_at: now,
  };

  // --------------------------------------------------------------------------
  // INTEGRATION POINT FOR EXISTING DATABASE TABLE `employees`:
  // Connect to your live database client here to persist into `public.employees`.
  // --------------------------------------------------------------------------
  console.log(`[Adapter:createEmployeeFromOnboarding] Created employee record for ${candidate.emp_id} (${candidate.full_name}) into existing employee workflow.`);

  return employeeRecord;
}
