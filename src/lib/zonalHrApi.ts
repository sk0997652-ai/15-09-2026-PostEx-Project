/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';

export interface ZonalMetrics {
  zoneId: string;
  zoneName: string;
  totalCandidates: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  branchesCount: number;
  staffCount: number;
  avgTurnaroundHours: string;
  branches: Array<{ id: string; name: string }>;
}

export interface ZonalStaffProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  roles?: { id: string; name: string } | null;
  zones?: { id: string; name: string } | null;
  branches?: { id: string; name: string } | null;
}

export interface ZonalCandidate {
  id: string;
  full_name: string;
  cnic: string;
  masked_cnic: string;
  mobile: string;
  email: string;
  joining_id: string;
  zone_id: string;
  branch_id?: string | null;
  branches?: { name: string } | null;
  zones?: { name: string } | null;
}

export interface ZonalApplication {
  id: string;
  candidate_id: string;
  status: 'draft' | 'submitted' | 'bm_verification' | 'needs_correction' | 'hr_review' | 'approved' | 'rejected';
  current_step: number;
  assigned_branch_manager_id?: string | null;
  assigned_central_hr_id?: string | null;
  assigned_central_hr_name?: string;
  locked: boolean;
  submitted_at?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  created_at: string;
  candidate?: ZonalCandidate | null;
}

export interface CentralHrStaffMember {
  id: string;
  name: string;
  email: string;
}

// Helper to get bearer session token
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Active staff session token required. Please sign in again.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// 1. Get Zone-scoped metrics and turnaround stats
export async function getZonalMetrics(zoneId?: string): Promise<{ zone: any; metrics: ZonalMetrics }> {
  const headers = await getAuthHeaders();
  const query = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
  const res = await fetch(`/api/zonal/metrics${query}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load zonal metrics');
  }
  return { zone: data.zone, metrics: data.metrics };
}

// 2. Get Zone-scoped staff list & branches
export async function getZonalStaff(zoneId?: string): Promise<{ staff: ZonalStaffProfile[]; branches: Array<{ id: string; name: string }> }> {
  const headers = await getAuthHeaders();
  const query = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
  const res = await fetch(`/api/zonal/staff${query}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load zonal staff');
  }
  return { staff: data.staff, branches: data.branches };
}

// 3. Create staff in zone (strictly Central HR or Branch Manager)
export async function createZonalStaff(payload: {
  email: string;
  name: string;
  role_name: 'central_hr' | 'branch_manager';
  branch_id?: string;
  phone?: string;
  zone_id?: string;
}): Promise<{ staff: ZonalStaffProfile; one_time_temporary_password: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/zonal/staff', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create staff account');
  }
  return { staff: data.staff, one_time_temporary_password: data.one_time_temporary_password };
}

// 4. Regenerate password for staff in zone
export async function regenerateZonalStaffPassword(staffId: string): Promise<{ temporary_password: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/zonal/staff/${encodeURIComponent(staffId)}/regenerate-password`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to regenerate password');
  }
  return { temporary_password: data.temporary_password };
}

// 5. Get paginated applications list
export async function getZonalApplications(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  zone_id?: string;
}): Promise<{
  applications: ZonalApplication[];
  centralHrStaff: CentralHrStaffMember[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const headers = await getAuthHeaders();
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));
  if (params.status) queryParams.set('status', params.status);
  if (params.search) queryParams.set('search', params.search);
  if (params.zone_id) queryParams.set('zone_id', params.zone_id);

  const res = await fetch(`/api/zonal/applications?${queryParams.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to load zonal applications');
  }
  return {
    applications: data.applications || [],
    centralHrStaff: data.centralHrStaff || [],
    pagination: data.pagination,
  };
}

// 6. Reassign application to another Central HR in the zone
export async function reassignZonalApplication(
  applicationId: string,
  newCentralHrId: string,
  reason?: string
): Promise<{ success: boolean; message: string; application: ZonalApplication }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/zonal/applications/${encodeURIComponent(applicationId)}/reassign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ new_central_hr_id: newCentralHrId, reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to reassign application');
  }
  return data;
}

// 7. Override decision hook
export async function overrideZonalApplicationDecision(
  applicationId: string,
  decision: 'approved' | 'correction_needed' | 'rejected',
  reason: string
): Promise<{ success: boolean; message: string; application: ZonalApplication }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/zonal/applications/${encodeURIComponent(applicationId)}/override-decision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision, reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to record override decision');
  }
  return data;
}
