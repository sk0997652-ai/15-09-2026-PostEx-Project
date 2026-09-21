// ==============================================================================
// PostEx HR Onboarding Portal — Super Admin API Client (Step 5)
// ==============================================================================

import { supabase } from './supabase';

async function getAuthHeader(): Promise<{ Authorization: string } | {}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export interface DashboardMetrics {
  totalCandidates: number;
  pendingApplications: number;
  approvedApplications: number;
  totalEmployees: number;
  totalStaff: number;
  totalZones: number;
  totalBranches: number;
}

export interface OrgStructure {
  zones: Array<{ id: string; name: string; created_at: string }>;
  branches: Array<{ id: string; name: string; zone_id: string; address: string | null; zones?: { name: string } }>;
  departments: Array<{ id: string; name: string; created_at: string }>;
  designations: Array<{ id: string; name: string; department_id: string; departments?: { name: string } }>;
  roles: Array<{ id: string; name: string }>;
}

export interface StaffUserItem {
  id: string;
  name: string;
  email: string;
  role_id: string;
  zone_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  roles?: { name: string };
  zones?: { name: string };
  branches?: { name: string };
}

export interface PermissionOverrideItem {
  id: string;
  staff_profile_id: string;
  permission_id: string;
  granted: boolean;
  reason: string;
  created_at: string;
  permissions?: { id: string; key: string; description: string | null };
}

export interface CandidateBrowserRecord {
  id: string;
  full_name: string;
  cnic: string;
  masked_cnic: string;
  mobile: string;
  email: string | null;
  joining_id: string;
  zone_id: string | null;
  branch_id: string | null;
  created_at: string;
  zones?: { id: string; name: string };
  branches?: { id: string; name: string };
  applications?: Array<{ id: string; status: string; current_step: number }>;
}

export interface AuditLogItem {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface OrgSettings {
  companyName: string;
  dataRetentionDaysAfterRejection: number;
  supportEmail: string;
  autoArchiveEnabled: boolean;
  lastUpdated: string;
}

export const superAdminApi = {
  async getMetrics(): Promise<DashboardMetrics> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/metrics', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch metrics');
    }
    return data.metrics;
  },

  async getOrgStructure(): Promise<OrgStructure> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/org-structure', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch organization structure');
    }
    return data;
  },

  async createOrgEntity(entity: 'zones' | 'branches' | 'departments' | 'designations', payload: any) {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch(`/api/admin/org/${entity}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to create ${entity}`);
    }
    return data.data;
  },

  async updateOrgEntity(entity: 'zones' | 'branches' | 'departments' | 'designations', id: string, payload: any) {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch(`/api/admin/org/${entity}/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to update ${entity}`);
    }
    return data.data;
  },

  async deleteOrgEntity(entity: 'zones' | 'branches' | 'departments' | 'designations', id: string, reason?: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/org/${entity}/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: reason || 'Deleted via Super Admin Organization Manager' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to delete ${entity}`);
    }
    return true;
  },

  async getStaff(): Promise<StaffUserItem[]> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/staff', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch staff list');
    }
    return data.staff;
  },

  async createStaff(payload: {
    email: string;
    name: string;
    role_id: string;
    zone_id?: string | null;
    branch_id?: string | null;
  }): Promise<{ staff: StaffUserItem; one_time_temporary_password: string }> {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create staff member');
    }
    return data;
  },

  async updateStaff(id: string, payload: {
    name: string;
    role_id: string;
    zone_id?: string | null;
    branch_id?: string | null;
    is_active?: boolean;
  }) {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update staff member');
    }
    return data.staff;
  },

  async toggleStaffStatus(id: string, is_active: boolean) {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch(`/api/admin/staff/${id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_active }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update staff status');
    }
    return data.staff;
  },

  async regenerateStaffPassword(target_staff_id: string): Promise<{ temporary_password: string }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/staff/${target_staff_id}/regenerate-password`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to regenerate password');
    }
    return data;
  },

  async getPermissionOverrides(staffId: string): Promise<{
    overrides: PermissionOverrideItem[];
    allPermissions: Array<{ id: string; key: string; description: string | null }>;
    roleDefaultPermissionKeys?: string[];
    staffProfile?: any;
  }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/permission-overrides/${staffId}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch permission overrides');
    }
    return data;
  },

  async saveUserPermissions(payload: {
    staff_profile_id: string;
    permissionsState: Record<string, boolean>;
    reason: string;
  }): Promise<{ success: boolean; changesCount: number; message: string }> {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/admin/user-permissions/save', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save user permissions');
    }
    return data;
  },

  async setPermissionOverride(payload: {
    staff_profile_id: string;
    permission_id: string;
    granted: boolean;
    reason: string;
  }) {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/admin/permission-overrides', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update permission override');
    }
    return data;
  },

  async deletePermissionOverride(id: string) {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/admin/permission-overrides/${id}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete permission override');
    }
    return true;
  },

  async getRecords(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    zone_id?: string;
  }): Promise<{
    records: CandidateBrowserRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const headers = await getAuthHeader();
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.zone_id ? { zone_id: params.zone_id } : {}),
    });
    const res = await fetch(`/api/admin/records?${qs.toString()}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch records');
    }
    return data;
  },

  async getAuditLogs(params: {
    page: number;
    limit: number;
    action?: string;
    entity_type?: string;
  }): Promise<{
    logs: AuditLogItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const headers = await getAuthHeader();
    const qs = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit),
      ...(params.action ? { action: params.action } : {}),
      ...(params.entity_type ? { entity_type: params.entity_type } : {}),
    });
    const res = await fetch(`/api/admin/audit-logs?${qs.toString()}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch audit logs');
    }
    return data;
  },

  async getSettings(): Promise<OrgSettings> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/admin/settings', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch organization settings');
    }
    return data.settings;
  },

  async updateSettings(payload: Partial<OrgSettings>): Promise<OrgSettings> {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update organization settings');
    }
    return data.settings;
  },

  async runDataRetentionCleanup(): Promise<{
    success: boolean;
    countArchived: number;
    thresholdDays: number;
    cutoffDate: string;
    archivedIds: string[];
    message: string;
  }> {
    const headers = { 'Content-Type': 'application/json', ...(await getAuthHeader()) };
    const res = await fetch('/api/admin/data-retention/run-cleanup', {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to execute data retention cleanup');
    }
    return data;
  },
};
