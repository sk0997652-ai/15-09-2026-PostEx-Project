import { OnboardingStage, OnboardingReviewerRole, OnboardingCandidate } from './onboardingTypes';
import { createEmployeeFromOnboarding } from './adapters/employeeIntegrationAdapter';

export interface TransitionContext {
  targetStage: OnboardingStage;
  actorName?: string;
  actorRole?: 'candidate' | 'branch_manager' | 'central_hr' | 'system';
  reviewerRole?: OnboardingReviewerRole;
  reason?: string;
}

export class InvalidStageTransitionError extends Error {
  constructor(public currentStage: OnboardingStage, public targetStage: OnboardingStage, message?: string) {
    super(message || `Cannot transition candidate from ${currentStage} to ${targetStage}`);
    this.name = 'InvalidStageTransitionError';
  }
}

export const STAGE_CONFIG: Record<
  OnboardingStage,
  {
    displayName: string;
    pipelineLabel: string;
    allowedTransitions: OnboardingStage[];
    defaultWithRole: string;
    color: string;
  }
> = {
  Invited: {
    displayName: 'Invited',
    pipelineLabel: 'Invited',
    allowedTransitions: ['Draft'],
    defaultWithRole: 'Candidate',
    color: '#94a3b8',
  },
  Draft: {
    displayName: 'Filling Form',
    pipelineLabel: 'Filling Form',
    allowedTransitions: ['BM_Review'],
    defaultWithRole: 'Candidate',
    color: '#64748b',
  },
  BM_Review: {
    displayName: 'BM Review',
    pipelineLabel: 'BM Review',
    allowedTransitions: ['HR_Review', 'Need_Correction', 'Rejected'],
    defaultWithRole: 'Branch Manager',
    color: '#0ea5e9',
  },
  HR_Review: {
    displayName: 'HR Review',
    pipelineLabel: 'HR Review',
    allowedTransitions: ['Joining_Tasks', 'Need_Correction', 'Rejected'],
    defaultWithRole: 'HR',
    color: '#6366f1',
  },
  Need_Correction: {
    displayName: 'Need Correction',
    pipelineLabel: 'Need Correction',
    allowedTransitions: ['BM_Review', 'HR_Review'],
    defaultWithRole: 'Candidate',
    color: '#f59e0b',
  },
  Joining_Tasks: {
    displayName: 'Joining Tasks',
    pipelineLabel: 'Joining Tasks',
    allowedTransitions: ['Onboarded'],
    defaultWithRole: 'HR Officer',
    color: '#8b5cf6',
  },
  Onboarded: {
    displayName: 'Onboarded',
    pipelineLabel: 'Onboarded',
    allowedTransitions: [],
    defaultWithRole: 'Completed',
    color: '#10b981',
  },
  Rejected: {
    displayName: 'Rejected',
    pipelineLabel: 'Rejected',
    allowedTransitions: [],
    defaultWithRole: 'Completed',
    color: '#e11d48',
  },
};

/**
 * Returns UI badge text according to strict specification:
 * - Normal: Invited, Filling Form, BM Review, HR Review, Joining Tasks, Onboarded, Rejected
 * - Returned: "Correction · BM" / "Correction · HR"
 * - Rejected: "Rejected · BM" / "Rejected · HR"
 */
export function getStageBadgeText(candidate: Pick<OnboardingCandidate, 'stage' | 'returned_by' | 'rejected_by'>): string {
  if (candidate.stage === 'Need_Correction') {
    return candidate.returned_by ? `Correction · ${candidate.returned_by}` : 'Correction · BM';
  }
  if (candidate.stage === 'Rejected') {
    return candidate.rejected_by ? `Rejected · ${candidate.rejected_by}` : 'Rejected · HR';
  }
  return STAGE_CONFIG[candidate.stage].displayName;
}

export function getWithRole(stage: OnboardingStage): string {
  return STAGE_CONFIG[stage].defaultWithRole;
}

export function validateStageTransition(currentStage: OnboardingStage, targetStage: OnboardingStage): boolean {
  if (currentStage === targetStage) return true;
  const allowed = STAGE_CONFIG[currentStage]?.allowedTransitions || [];
  return allowed.includes(targetStage);
}

export async function executeStageTransition(
  candidate: OnboardingCandidate,
  context: TransitionContext
): Promise<{ updatedCandidate: OnboardingCandidate; employeeCreated?: boolean }> {
  if (!validateStageTransition(candidate.stage, context.targetStage)) {
    throw new InvalidStageTransitionError(candidate.stage, context.targetStage);
  }

  const now = new Date().toISOString();
  const updatedCandidate: OnboardingCandidate = {
    ...candidate,
    stage: context.targetStage,
    stage_entered_at: now,
    updated_at: now,
  };

  if (context.targetStage === 'Need_Correction') {
    updatedCandidate.returned_by = context.reviewerRole || (candidate.stage === 'BM_Review' ? 'BM' : 'HR');
    updatedCandidate.return_reason = context.reason;
  } else if (context.targetStage === 'Rejected') {
    updatedCandidate.rejected_by = context.reviewerRole || (candidate.stage === 'BM_Review' ? 'BM' : 'HR');
    updatedCandidate.reject_reason = context.reason;
  } else if (context.targetStage === 'BM_Review' && candidate.stage === 'Need_Correction') {
    // Returning from correction to BM
    updatedCandidate.returned_by = undefined;
  } else if (context.targetStage === 'HR_Review' && candidate.stage === 'Need_Correction') {
    // Returning from correction to HR
    updatedCandidate.returned_by = undefined;
  }

  let employeeCreated = false;
  if (context.targetStage === 'Onboarded') {
    updatedCandidate.completed_at = now;
    // Call the single dedicated integration adapter
    const employeeRecord = await createEmployeeFromOnboarding(updatedCandidate);
    updatedCandidate.employee_id = employeeRecord.id;
    employeeCreated = true;
  }

  return { updatedCandidate, employeeCreated };
}
