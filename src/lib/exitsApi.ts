// ==============================================================================
// PostEx HR Onboarding Portal — Exits & Clearance API Client (Step 9)
// ==============================================================================

import { getStaffAccessToken, refreshStaffAccessToken } from './staffAuth';

export type ExitItemKey =
  | 'office_files'
  | 'keys'
  | 'mobile_sim'
  | 'id_card'
  | 'company_car'
  | 'others';

export type ExitItemStatus = 'pending' | 'received' | 'not_received' | 'not_applicable';

export type ClearanceSubmitStatus = 'received' | 'not_received' | 'not_applicable';

export interface ExitClearanceItem {
  id?: string;
  exit_id?: string;
  item_key: ExitItemKey;
  status: ExitItemStatus;
  detail?: string | null;
  updated_at?: string | null;
  updated_by_id?: string | null;
}

export interface ExitListItem {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  designation: string;
  branch: string;
  branch_id?: string | null;
  branch_name?: string;
  zone_id?: string | null;
  zone_name?: string;
  exit_type: 'resignation' | 'termination' | 'absconding';
  last_working_date: string;
  reason: string;
  notes?: string | null;
  status: 'in_progress' | 'completed';
  clearance_filled: number; // items not 'pending' out of 6
  clearance_total: number; // 6
  pdf_generated_at?: string | null;
  initiated_at: string;
  initiated_by_name?: string | null;
}

export interface ExitDetailRecord extends ExitListItem {
  clearance_items: ExitClearanceItem[];
}

export interface GetExitsResponse {
  success: boolean;
  exits: ExitListItem[];
  counts?: {
    total: number;
    in_progress: number;
    completed: number;
  };
  error?: string;
}

export interface GetExitByIdResponse {
  success: boolean;
  exit: ExitDetailRecord;
  error?: string;
}

export interface SaveClearanceItemPayload {
  item_key: ExitItemKey;
  status: ClearanceSubmitStatus;
  detail?: string;
}

export interface SaveClearanceResponse {
  success: boolean;
  message?: string;
  clearance_items?: ExitClearanceItem[];
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStaffAccessToken();
  if (!token) {
    throw new Error('Active staff session token required. Please sign in again.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function fetchWithExitAuth(url: string, init?: RequestInit): Promise<Response> {
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch {
    const refreshed = await refreshStaffAccessToken();
    if (refreshed) {
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshed}`,
      };
    } else {
      throw new Error('Active staff session token required. Please sign in again.');
    }
  }

  let res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...((init?.headers as Record<string, string>) || {}),
    },
  });

  if (res.status === 401) {
    const refreshedToken = await refreshStaffAccessToken();
    if (refreshedToken) {
      const retryHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshedToken}`,
        ...((init?.headers as Record<string, string>) || {}),
      };
      res = await fetch(url, {
        ...init,
        headers: retryHeaders,
      });
    }
  }

  return res;
}

// 1. GET /api/exits?status=in_progress
export async function getExits(params?: { status?: string }): Promise<GetExitsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) {
    queryParams.set('status', params.status);
  } else {
    queryParams.set('status', 'in_progress');
  }

  const res = await fetchWithExitAuth(`/api/exits?${queryParams.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch exit records (HTTP ${res.status})`);
  }
  return data;
}

// 2. GET /api/exits/:id
export async function getExitById(id: string): Promise<GetExitByIdResponse> {
  if (!id) throw new Error('Exit ID is required.');
  const res = await fetchWithExitAuth(`/api/exits/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch exit record (HTTP ${res.status})`);
  }
  return data;
}

// 3. PUT /api/exits/:id/clearance
export async function saveClearance(
  id: string,
  items: SaveClearanceItemPayload[]
): Promise<SaveClearanceResponse> {
  if (!id) throw new Error('Exit ID is required.');
  const res = await fetchWithExitAuth(`/api/exits/${encodeURIComponent(id)}/clearance`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to save clearance items (HTTP ${res.status})`);
  }
  return data;
}

// 4. GET /api/exits/:id/pdf
export async function downloadExitPdf(id: string, employeeCode?: string): Promise<Blob> {
  if (!id) throw new Error('Exit ID is required.');
  const res = await fetchWithExitAuth(`/api/exits/${encodeURIComponent(id)}/pdf`);
  if (!res.ok) {
    let errText = 'Failed to generate ECF PDF';
    try {
      const data = await res.json();
      errText = data.error || errText;
    } catch {
      errText = `PDF generation failed (HTTP ${res.status})`;
    }
    throw new Error(errText);
  }

  const blob = await res.blob();
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCode = (employeeCode || 'PX-EMP').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `ECF_${safeCode}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 100);
  }
  return blob;
}

export interface CompletedExitItem {
  id: string;
  employee_id: string;
  employee_code: string;
  name: string;
  employee_name: string;
  full_name: string;
  designation: string;
  branch: string;
  zone: string;
  exit_type: 'resignation' | 'termination' | 'absconding';
  last_working_date: string;
  completed_at: string | null;
  completed_by: string;
  pdf_generated_at: string | null;
  status: string;
}

export interface GetCompletedExitsResponse {
  success: boolean;
  exits: CompletedExitItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface CompleteExitResponse {
  success: boolean;
  message?: string;
  exit_id?: string;
  error?: string;
  code?: string;
  pending_items?: string[];
  outstanding_items?: string[];
}

// 5. POST /api/exits/:id/complete
export async function completeExit(
  id: string,
  options?: { confirm_outstanding?: boolean }
): Promise<CompleteExitResponse> {
  if (!id) throw new Error('Exit ID is required.');
  const res = await fetchWithExitAuth(`/api/exits/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      confirm_outstanding: Boolean(options?.confirm_outstanding),
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const error: any = new Error(data.error || `Failed to complete exit (HTTP ${res.status})`);
    error.code = data.code;
    error.pending_items = data.pending_items;
    error.outstanding_items = data.outstanding_items;
    error.status = res.status;
    throw error;
  }
  return data;
}

// 6. GET /api/exits?status=completed
export async function getCompletedExits(params?: {
  page?: number;
  limit?: number;
}): Promise<GetCompletedExitsResponse> {
  const query = new URLSearchParams();
  query.set('status', 'completed');
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetchWithExitAuth(`/api/exits?${query.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch exited employees (HTTP ${res.status})`);
  }
  return data;
}

export const exitsApi = {
  getExits,
  getExitById,
  saveClearance,
  downloadExitPdf,
  completeExit,
  getCompletedExits,
};
