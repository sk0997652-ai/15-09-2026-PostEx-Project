export type OnboardingStage =
  | 'Invited'
  | 'Draft'
  | 'BM_Review'
  | 'HR_Review'
  | 'Need_Correction'
  | 'Joining_Tasks'
  | 'Onboarded'
  | 'Rejected';

export type OnboardingReviewerRole = 'BM' | 'HR';

export interface OnboardingCandidate {
  id: string;
  emp_id: string;
  full_name: string;
  cnic: string;
  mobile: string;
  email?: string;
  designation_id: string;
  branch_id: string;
  stage: OnboardingStage;
  returned_by?: OnboardingReviewerRole;
  rejected_by?: OnboardingReviewerRole;
  return_reason?: string;
  reject_reason?: string;
  invited_at: string;
  stage_entered_at: string;
  completed_at?: string;
  employee_id?: string;
  reminders_count: number;
  last_reminded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTimelineEvent {
  id: string;
  candidate_id: string;
  step_number: number;
  step_name: string;
  status: 'completed' | 'current' | 'returned' | 'rejected' | 'pending';
  details?: string;
  actor_name?: string;
  actor_role?: string;
  created_at: string;
}

export interface OnboardingReminderLog {
  id: string;
  candidate_id: string;
  channel: string;
  message: string;
  reminded_by: string;
  created_at: string;
}

export interface CandidateRow {
  id: string;
  emp_id: string;
  emp_name: string;
  cnic: string;
  designation: string;
  branch: string;
  branch_id: string;
  stage: string; // Formatted badge label for UI
  stage_raw: OnboardingStage;
  with_role: string;
  days_in_stage: number;
  invited_on: string;
  is_overdue: boolean;
  can_remind: boolean;
}

export interface SummaryData {
  flashcards: {
    pending: number;
    onboarded: number;
    overdue: number;
    need_correction: number;
    rejected: number;
    sla_met: number;
    avg_time_days: number;
  };
  pipeline_by_stage: Array<{
    stage: string;
    stage_raw: OnboardingStage;
    count: number;
    color: string;
  }>;
  who_is_holding: Array<{
    role: string;
    open_cases: number;
    avg_wait_days: number;
    sla_days: number;
    is_breached: boolean;
  }>;
  needs_attention: Array<{
    branch_id: string;
    branch_name: string;
    overdue_count: number;
  }>;
}

export interface TimelineData {
  candidate: {
    emp_id: string;
    name: string;
    cnic: string;
    designation: string;
    branch: string;
    invited_on: string;
    current_stage: string;
  };
  steps: Array<{
    step_number: number;
    title: string;
    status: 'completed' | 'current' | 'returned' | 'rejected' | 'pending';
    note?: string;
    timestamp?: string;
  }>;
}
