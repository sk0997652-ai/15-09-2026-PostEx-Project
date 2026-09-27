// ==============================================================================
// PostEx HR Onboarding Portal — Headcount Management API Client (Part B of 4)
// ==============================================================================

import { supabase } from './supabase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export interface HeadcountZone {
  id: string;
  name: string;
  zone_code?: string;
  region?: string;
  is_active?: boolean;
}

export interface HeadcountBranch {
  id: string;
  name: string;
  branch_code?: string;
  branch_type?: string;
  city_address?: string;
  address?: string | null;
  contact_number?: string | null;
  is_active?: boolean;
  zone_id: string;
  zones?: { id: string; name: string; zone_code?: string };
}

export interface HeadcountDesignation {
  id: string;
  name: string;
  department_id: string;
  employment_category?: 'Rider' | 'In-House Staff' | string;
  is_active?: boolean;
  departments?: { id: string; name: string; department_code?: string; department_category?: string };
}

export interface HeadcountEntryItem {
  id: string;
  branch_id: string;
  designation_id: string;
  designation_name: string;
  employment_category: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  approved_count: number;
  active_count: number;
  vacancy: number;
  created_by: string | null;
  updated_by_name: string;
  updated_by_role: string | null;
  updated_at: string;
}

export interface HeadcountContextResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
    zone_id: string | null;
    zone_name: string | null;
    branch_id: string | null;
    branch_name: string | null;
    canEdit: boolean;
  };
  zones: HeadcountZone[];
  branches: HeadcountBranch[];
  designations: HeadcountDesignation[];
}

export interface BranchHeadcountResponse {
  success: boolean;
  branch: HeadcountBranch;
  canEdit: boolean;
  entries: HeadcountEntryItem[];
  summary: {
    totalDesignations: number;
    totalApproved: number;
    totalActive: number;
    totalVacancy: number;
  };
}

export type FillRateStatus = 'On Target' | 'Understaffed' | 'Critical';

export interface OverviewTrendInfo {
  direction: 'up' | 'down' | 'flat' | 'none';
  display: '▲' | '▼' | '—' | string;
  delta: number | null;
  current_active: number;
  last_month_active: number | null;
  has_historical_data: boolean;
}

export interface OverviewMetricBlock {
  approved: number;
  active: number;
  vacancy: number;
  fill_rate_pct: number;
  fill_rate_status: FillRateStatus;
  trend: OverviewTrendInfo;
}

export interface OverviewHistoricalPoint {
  month_key: string;
  month_label: string;
  total_active: number;
  rider_active: number;
  in_house_active: number;
  new_enrollments: number;
  approved_target: number;
}

export interface OverviewDesignationRow extends OverviewMetricBlock {
  designation_id: string;
  designation_name: string;
  employment_category: 'Rider' | 'In-House Staff';
  department_id: string | null;
  department_name: string;
  department_code: string | null;
  department_category: string | null;
  has_prior_months_history: boolean;
  historical_series: OverviewHistoricalPoint[];
}

export interface OverviewBranchRow {
  branch_id: string;
  branch_name: string;
  branch_code: string | null;
  branch_type: string;
  city_address: string | null;
  contact_number: string | null;
  is_active: boolean;
  zone_id: string;
  zone_name: string;
  zone_code: string | null;
  branch_managers: Array<{ id: string; name: string; email: string }>;
  rider: OverviewMetricBlock;
  in_house: OverviewMetricBlock;
  total: OverviewMetricBlock;
  has_prior_months_history: boolean;
  historical_series: OverviewHistoricalPoint[];
  designation_breakdown: OverviewDesignationRow[];
}

export interface OverviewZoneRow {
  zone_id: string;
  zone_name: string;
  zone_code: string | null;
  region: string | null;
  is_active: boolean;
  branches_count: number;
  rider: OverviewMetricBlock;
  in_house: OverviewMetricBlock;
  total: OverviewMetricBlock;
  has_prior_months_history: boolean;
  historical_series: OverviewHistoricalPoint[];
  branch_breakdown: OverviewBranchRow[];
  designation_breakdown: OverviewDesignationRow[];
}

export interface HeadcountOverviewResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
    zone_id: string | null;
    zone_name: string | null;
    branch_id: string | null;
    branch_name: string | null;
    canEdit: boolean;
    tagged_branch_ids: string[];
  };
  active_definition_note: string;
  summary: {
    total: OverviewMetricBlock & {
      has_prior_months_history: boolean;
      historical_series: OverviewHistoricalPoint[];
    };
    rider: OverviewMetricBlock;
    in_house: OverviewMetricBlock;
    zones_count: number;
    branches_count: number;
    designations_count: number;
  };
  zone_rows: OverviewZoneRow[];
  branch_rows: OverviewBranchRow[];
  designation_rows: OverviewDesignationRow[];
}

export const headcountApi = {
  async getOverview(params?: { zoneId?: string; branchId?: string }): Promise<HeadcountOverviewResponse> {
    const headers = await getAuthHeaders();
    const qs = new URLSearchParams();
    if (params?.zoneId) qs.set('zoneId', params.zoneId);
    if (params?.branchId) qs.set('branchId', params.branchId);
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetch(`/api/headcount/overview${queryStr}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load headcount overview.');
    }
    return data;
  },

  async getContext(): Promise<HeadcountContextResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/headcount/context', { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load headcount context.');
    }
    return data;
  },

  async getBranchHeadcount(branchId: string): Promise<BranchHeadcountResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/headcount/branches/${branchId}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load branch headcount entries.');
    }
    return data;
  },

  async saveBranchHeadcount(
    branchId: string,
    payload: { designation_id: string; approved_count: number }
  ): Promise<{ success: boolean; data: any; message: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/headcount/branches/${branchId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save headcount entry.');
    }
    return data;
  },

  async updateHeadcountEntry(
    entryId: string,
    payload: { approved_count: number; designation_id?: string }
  ): Promise<{ success: boolean; data: any; message: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/headcount/entries/${entryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update headcount entry.');
    }
    return data;
  },

  async deleteHeadcountEntry(entryId: string): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/headcount/entries/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete headcount entry.');
    }
    return data;
  },
};
