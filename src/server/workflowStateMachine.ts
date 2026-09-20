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
  const updatePayload: Record<string, any> = {
    status: targetStatus,
    ...extraUpdates,
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

  // 4. Record audit log if actor info provided
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
        ...metadata,
      },
    });
  }

  return {
    success: true,
    previousStatus: currentStatus,
    newStatus: targetStatus,
    application: updatedApp,
  };
}
