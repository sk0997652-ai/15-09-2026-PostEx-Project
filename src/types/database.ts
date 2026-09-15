// ==============================================================================
// PostEx HR Onboarding Portal — TypeScript Database Definitions (Step 2)
// Generated from Postgres schema with strict typing
// ==============================================================================

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'bm_verification'
  | 'needs_correction'
  | 'hr_review'
  | 'approved'
  | 'rejected';

export type DocumentVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'correction_required';

export type HrDecisionType =
  | 'approved'
  | 'rejected'
  | 'returned_for_correction';

export type NotificationChannel =
  | 'sms'
  | 'email'
  | 'in_app';

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'failed';

export type RoleName =
  | 'super_admin'
  | 'zonal_hr_manager'
  | 'central_hr'
  | 'branch_manager'
  | 'candidate';

// ------------------------------------------------------------------------------
// Table Entity Interfaces
// ------------------------------------------------------------------------------

export interface Zone {
  id: string;
  name: string;
  created_at: string;
}

export interface Branch {
  id: string;
  zone_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface Designation {
  id: string;
  name: string;
  department_id: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: RoleName | string;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  created_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface StaffProfile {
  id: string; // references auth.users
  name: string;
  role_id: string;
  must_change_password: boolean;
  created_by: string | null;
  is_active: boolean;
  zone_id: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface UserPermissionOverride {
  id: string;
  staff_profile_id: string;
  permission_id: string;
  granted: boolean;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface Candidate {
  id: string;
  full_name: string;
  cnic: string;
  mobile: string;
  email: string | null;
  joining_id: string;
  zone_id: string | null;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CandidateOtp {
  id: string;
  candidate_id: string;
  otp_hash: string;
  expires_at: string;
  attempt_count: number;
  created_at: string;
}

export interface CandidateSession {
  token: string;
  candidate: {
    id: string;
    full_name: string;
    cnic: string;
    joining_id: string;
    mobile: string;
  };
  expires_at: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  status: ApplicationStatus;
  current_step: number;
  assigned_branch_manager_id: string | null;
  assigned_central_hr_id: string | null;
  locked: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
}

export interface ApplicationStep {
  id: string;
  application_id: string;
  step_number: number;
  step_name: string;
  data: Record<string, unknown>;
  completed: boolean;
  updated_at: string;
}

export interface Document {
  id: string;
  application_id: string;
  type: string;
  storage_path: string;
  uploaded_at: string;
  verification_status: DocumentVerificationStatus;
  verified_by: string | null;
  remark: string | null;
}

export interface VerificationRemark {
  id: string;
  application_id: string;
  document_id: string | null;
  remark: string;
  created_by: string | null;
  created_at: string;
}

export interface HrDecision {
  id: string;
  application_id: string;
  decided_by: string | null;
  decision: HrDecisionType;
  reason: string;
  created_at: string;
}

export interface Employee {
  id: string;
  application_id: string;
  employee_id: string;
  pdf_dossier_storage_path: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: 'staff' | 'candidate' | 'system' | string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_type: 'candidate' | 'staff' | string;
  recipient_id: string;
  channel: NotificationChannel;
  message: string;
  sent_at: string | null;
  status: NotificationStatus;
  created_at: string;
}

// ------------------------------------------------------------------------------
// Generic Supabase Database Schema Type Definition
// ------------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      zones: { Row: Zone; Insert: Omit<Zone, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Zone> };
      branches: { Row: Branch; Insert: Omit<Branch, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Branch> };
      departments: { Row: Department; Insert: Omit<Department, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Department> };
      designations: { Row: Designation; Insert: Omit<Designation, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Designation> };
      roles: { Row: Role; Insert: Omit<Role, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Role> };
      permissions: { Row: Permission; Insert: Omit<Permission, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Permission> };
      role_permissions: { Row: RolePermission; Insert: RolePermission; Update: Partial<RolePermission> };
      staff_profiles: { Row: StaffProfile; Insert: Omit<StaffProfile, 'created_at'> & { created_at?: string }; Update: Partial<StaffProfile> };
      user_permission_overrides: { Row: UserPermissionOverride; Insert: Omit<UserPermissionOverride, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<UserPermissionOverride> };
      candidates: { Row: Candidate; Insert: Omit<Candidate, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Candidate> };
      candidate_otps: { Row: CandidateOtp; Insert: Omit<CandidateOtp, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<CandidateOtp> };
      applications: { Row: Application; Insert: Omit<Application, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Application> };
      application_steps: { Row: ApplicationStep; Insert: Omit<ApplicationStep, 'id' | 'updated_at'> & { id?: string; updated_at?: string }; Update: Partial<ApplicationStep> };
      documents: { Row: Document; Insert: Omit<Document, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string }; Update: Partial<Document> };
      verification_remarks: { Row: VerificationRemark; Insert: Omit<VerificationRemark, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<VerificationRemark> };
      hr_decisions: { Row: HrDecision; Insert: Omit<HrDecision, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<HrDecision> };
      employees: { Row: Employee; Insert: Omit<Employee, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Employee> };
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<AuditLog> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Notification> };
    };
  };
}
