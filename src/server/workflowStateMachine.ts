import { SupabaseClient } from '@supabase/supabase-js';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'bm_verification'
  | 'needs_correction'
  | 'hr_review'
  | 'approved'
  | 'rejected';

/**
 * Explicit, typed application state machine transition map.
 * Enforces:
 *   draft -> submitted | bm_verification
 *   submitted -> bm_verification
 *   bm_verification -> needs_correction | hr_review | rejected
 *   needs_correction -> bm_verification | submitted
 *   hr_review -> approved | rejected | needs_correction
 *   approved -> [] (Terminal state)
 *   rejected -> [] (Terminal state)
 */
export const VALID_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted', 'bm_verification'],
  submitted: ['bm_verification'],
  bm_verification: ['needs_correction', 'hr_review', 'rejected'],
  needs_correction: ['bm_verification', 'submitted'],
  hr_review: ['approved', 'rejected', 'needs_correction'],
  approved: [], // Terminal: no further transitions allowed
  rejected: [], // Terminal: no further transitions allowed
};

export class InvalidStateTransitionError extends Error {
  public fromStatus: string;
  public toStatus: string;
  public allowedTransitions: string[];

  constructor(fromStatus: string, toStatus: string, allowedTransitions: string[]) {
    super(
      `Illegal workflow transition: Cannot transition application from '${fromStatus}' to '${toStatus}'. ` +
      `Allowed transitions from '${fromStatus}': [${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (terminal state)'}].`
    );
    this.name = 'InvalidStateTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.allowedTransitions = allowedTransitions;
  }
}

/**
 * Validates whether a transition from currentStatus to targetStatus is valid.
 */
export function validateStatusTransition(
  currentStatus: string,
  targetStatus: string
): { valid: boolean; error?: string; allowed?: ApplicationStatus[] } {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus as ApplicationStatus];
  if (!allowed) {
    return {
      valid: false,
      error: `Unknown current application status: '${currentStatus}'.`,
      allowed: [],
    };
  }

  if (!allowed.includes(targetStatus as ApplicationStatus)) {
    return {
      valid: false,
      error: `Illegal state machine transition: Cannot transition application from '${currentStatus}' to '${targetStatus}'. Allowed next states: [${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}].`,
      allowed,
    };
  }

  return { valid: true, allowed };
}

/**
 * Throws InvalidStateTransitionError if transition is not permitted.
 */
export function assertValidTransition(currentStatus: string, targetStatus: string): void {
  const result = validateStatusTransition(currentStatus, targetStatus);
  if (!result.valid) {
    throw new InvalidStateTransitionError(currentStatus, targetStatus, result.allowed || []);
  }
}

export interface TransitionOptions {
  supabaseAdmin: SupabaseClient;
  applicationId: string;
  targetStatus: ApplicationStatus;
  actorId?: string;
  actorType?: 'candidate' | 'staff' | 'system';
  actionName?: string;
  reason?: string;
  extraUpdates?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  previousStatus?: ApplicationStatus;
  newStatus?: ApplicationStatus;
  application?: any;
  employee?: any;
}

export const DEFAULT_ASSET_KEYS = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'] as const;

export async function ensureEmployeeForApprovedApplication(
  supabaseAdmin: SupabaseClient,
  applicationId: string,
  options?: {
    pdfDossierStoragePath?: string;
    actorId?: string;
  }
): Promise<{ employee: any; created: boolean }> {
  // 1. Fetch application and candidate particulars
  const { data: appData, error: appErr } = await supabaseAdmin
    .from('applications')
    .select(`
      id,
      status,
      decided_at,
      created_at,
      candidate_id,
      candidates (
        id,
        full_name,
        cnic,
        mobile,
        email,
        designation_id,
        branch_id,
        zone_id,
        branches ( id, name, branch_code ),
        zones ( id, name, zone_code ),
        designations ( id, name )
      )
    `)
    .eq('id', applicationId)
    .single();

  if (appErr || !appData) {
    throw new Error(`Failed to fetch application ${applicationId} for employee creation: ${appErr?.message}`);
  }

  const cand = (appData.candidates as any) || {};

  // Resolve designation name & id
  let desigId = cand.designation_id || null;
  let desigName = cand.designations?.name || null;
  if (!desigId) {
    const { data: step1 } = await supabaseAdmin
      .from('application_steps')
      .select('data')
      .eq('application_id', applicationId)
      .eq('step_number', 1)
      .maybeSingle();
    if (step1?.data?.designation_id) {
      desigId = step1.data.designation_id;
      const { data: dRow } = await supabaseAdmin
        .from('designations')
        .select('name')
        .eq('id', desigId)
        .maybeSingle();
      if (dRow?.name) desigName = dRow.name;
    }
  }

  const joiningDate = appData.decided_at
    ? appData.decided_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // 2. Check if employee already exists for this application (idempotent)
  const { data: existingEmp } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (existingEmp) {
    // If existing employee record has missing full_name/cnic/contact details from older schema, update it
    const updatePatch: Record<string, any> = {};
    if (!existingEmp.full_name && cand.full_name) updatePatch.full_name = cand.full_name;
    if (!existingEmp.cnic && cand.cnic) updatePatch.cnic = cand.cnic;
    if (!existingEmp.contact_number && cand.mobile) updatePatch.contact_number = cand.mobile;
    if (!existingEmp.personal_email && cand.email) updatePatch.personal_email = cand.email;
    if (!existingEmp.designation_name && desigName) updatePatch.designation_name = desigName;
    if (!existingEmp.designation_id && desigId) updatePatch.designation_id = desigId;
    if (!existingEmp.branch_id && cand.branch_id) updatePatch.branch_id = cand.branch_id;
    if (!existingEmp.zone_id && cand.zone_id) updatePatch.zone_id = cand.zone_id;
    if (!existingEmp.joining_date) updatePatch.joining_date = joiningDate;
    if (!existingEmp.status) updatePatch.status = 'active';

    let currentEmp = existingEmp;
    if (Object.keys(updatePatch).length > 0) {
      updatePatch.updated_at = new Date().toISOString();
      const { data: updatedEmp } = await supabaseAdmin
        .from('employees')
        .update(updatePatch)
        .eq('id', existingEmp.id)
        .select('*')
        .maybeSingle();
      if (updatedEmp) currentEmp = updatedEmp;
    }

    // Ensure the 6 default employee_asset_status rows exist
    const defaultAssetRows = DEFAULT_ASSET_KEYS.map((k) => ({
      employee_id: currentEmp.id,
      item_key: k,
      state: 'not_provided' as const,
      updated_at: new Date().toISOString(),
    }));

    await supabaseAdmin
      .from('employee_asset_status')
      .upsert(defaultAssetRows, { onConflict: 'employee_id,item_key', ignoreDuplicates: true });

    return { employee: currentEmp, created: false };
  }

  // 3. Generate employee_id (EMP-{branchCode}-{5 digits})
  const branchObj = cand.branches;
  let branchCode = branchObj?.branch_code;
  if (!branchCode) {
    const bName = (branchObj?.name || '').toUpperCase();
    if (bName.includes('KARACHI') || bName.includes('KHI') || bName.includes('KORANGI')) branchCode = 'KHI01';
    else if (bName.includes('LAHORE') || bName.includes('LHE') || bName.includes('GULBERG')) branchCode = 'LHE01';
    else if (bName.includes('ISLAMABAD') || bName.includes('ISB') || bName.includes('RAWALPINDI')) branchCode = 'ISB01';
    else if (bName.includes('FAISALABAD') || bName.includes('FSD')) branchCode = 'FSD01';
    else if (bName.includes('MULTAN') || bName.includes('MUX')) branchCode = 'MUX01';
    else if (bName.includes('PESHAWAR') || bName.includes('PEW')) branchCode = 'PEW01';
    else if (bName.includes('QUETTA') || bName.includes('QTA')) branchCode = 'QTA01';
    else {
      const words = (branchObj?.name || 'HQ').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
      const letters = words.map((w: string) => w[0]).join('').toUpperCase().slice(0, 3);
      branchCode = `${letters || 'HQ'}01`;
    }
  }

  const { count } = await supabaseAdmin.from('employees').select('id', { count: 'exact', head: true });
  let nextNum = (count || 0) + 1;
  let empCode = `EMP-${branchCode}-${String(nextNum).padStart(5, '0')}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data: dup } = await supabaseAdmin.from('employees').select('id').eq('employee_id', empCode).maybeSingle();
    if (!dup) break;
    nextNum++;
    empCode = `EMP-${branchCode}-${String(nextNum).padStart(5, '0')}`;
  }

  const empPayload = {
    application_id: applicationId,
    employee_id: empCode,
    full_name: cand.full_name || 'Enrolled Employee',
    cnic: cand.cnic || '00000-0000000-0',
    contact_number: cand.mobile || '03000000000',
    personal_email: cand.email || null,
    designation_name: desigName || 'Standard Operational Staff',
    designation_id: desigId || null,
    branch_id: cand.branch_id || null,
    zone_id: cand.zone_id || null,
    joining_date: joiningDate,
    status: 'active' as const,
    pdf_dossier_storage_path: options?.pdfDossierStoragePath || null,
    updated_at: new Date().toISOString(),
  };

  const { data: newEmp, error: insErr } = await supabaseAdmin
    .from('employees')
    .insert(empPayload)
    .select('*')
    .single();

  if (insErr) {
    const { data: retryEmp } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (retryEmp) {
      return { employee: retryEmp, created: false };
    }
    throw new Error(`Failed to create employee row: ${insErr.message}`);
  }

  // Insert the 6 default asset rows (idempotently)
  const assetRows = DEFAULT_ASSET_KEYS.map((k) => ({
    employee_id: newEmp.id,
    item_key: k,
    state: 'not_provided' as const,
    updated_at: new Date().toISOString(),
  }));

  await supabaseAdmin
    .from('employee_asset_status')
    .upsert(assetRows, { onConflict: 'employee_id,item_key', ignoreDuplicates: true });

  return { employee: newEmp, created: true };
}

/**
 * Atomically validates and executes an application status transition in Supabase.
 * Uses atomic conditional update (.eq('status', currentStatus)) to prevent race conditions.
 */
export async function executeApplicationTransition(
  opts: TransitionOptions
): Promise<TransitionResult> {
  const {
    supabaseAdmin,
    applicationId,
    targetStatus,
    actorId,
    actorType = 'staff',
    actionName,
    reason,
    extraUpdates = {},
    metadata = {},
  } = opts;

  // 1. Fetch current status
  const { data: app, error: fetchErr } = await supabaseAdmin
    .from('applications')
    .select('id, status, candidate_id, locked')
    .eq('id', applicationId)
    .maybeSingle();

  if (fetchErr || !app) {
    return {
      success: false,
      error: fetchErr ? fetchErr.message : 'Application not found.',
    };
  }

  const currentStatus = app.status as ApplicationStatus;

  // 2. Validate transition against state machine rules
  const validation = validateStatusTransition(currentStatus, targetStatus);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      previousStatus: currentStatus,
    };
  }

  // 3. Atomically update application status with condition on current status
  const appUpdates = { ...extraUpdates };
  delete appUpdates.pdf_dossier_storage_path;
  delete appUpdates.pdfDossierStoragePath;

  const updatePayload: Record<string, any> = {
    status: targetStatus,
    ...appUpdates,
  };

  if (reason && !updatePayload.decision_reason) {
    updatePayload.decision_reason = reason;
  }

  const { data: updatedApp, error: updateErr } = await supabaseAdmin
    .from('applications')
    .update(updatePayload)
    .eq('id', applicationId)
    .eq('status', currentStatus)
    .select()
    .maybeSingle();

  if (updateErr) {
    return {
      success: false,
      error: `Database update failed: ${updateErr.message}`,
      previousStatus: currentStatus,
    };
  }

  if (!updatedApp) {
    // Race condition detected: another process modified the status concurrently
    const { data: refetched } = await supabaseAdmin
      .from('applications')
      .select('status')
      .eq('id', applicationId)
      .maybeSingle();

    return {
      success: false,
      error: `Concurrent update conflict: Application status changed from '${currentStatus}' to '${refetched?.status}' before transition could complete.`,
      previousStatus: refetched?.status as ApplicationStatus,
    };
  }

  // 4. If targetStatus is 'approved', ensure exactly one employee row and 6 default asset rows are created
  let employeeRecord: any = null;
  if (targetStatus === 'approved') {
    try {
      const empRes = await ensureEmployeeForApprovedApplication(supabaseAdmin, applicationId, {
        actorId,
        pdfDossierStoragePath: extraUpdates.pdf_dossier_storage_path,
      });
      employeeRecord = empRes.employee;
    } catch (empCreationErr: any) {
      console.error('[STATE MACHINE] Failed to ensure employee for approved application:', empCreationErr);
    }
  }

  // 5. Record audit log if actor info provided
  if (actorId && actionName) {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId,
      actor_type: actorType,
      action: actionName,
      entity_type: 'applications',
      entity_id: applicationId,
      metadata: {
        from_status: currentStatus,
        to_status: targetStatus,
        reason: reason || null,
        employee_id: employeeRecord?.employee_id || null,
        ...metadata,
      },
    });
  }

  return {
    success: true,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    application: updatedApp,
    employee: employeeRecord,
  };
}
