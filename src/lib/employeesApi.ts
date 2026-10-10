// ==============================================================================
// PostEx HR Onboarding Portal — Employees Lifecycle API Client
// ==============================================================================

import { getStaffAccessToken } from './staffAuth';

export interface EmployeeListItem {
  id: string;
  application_id: string;
  employee_id: string;
  full_name: string;
  cnic: string;
  contact_number: string;
  personal_email: string | null;
  designation_name: string;
  designation_id: string | null;
  branch_id: string | null;
  zone_id: string | null;
  joining_date: string;
  status: 'active' | 'exit_in_progress';
  pdf_dossier_storage_path?: string | null;
  created_at: string;
  updated_at: string;
  branches?: { id: string; name: string; branch_code?: string } | null;
  zones?: { id: string; name: string; zone_code?: string } | null;
}

export interface EmployeesResponse {
  success: boolean;
  employees: EmployeeListItem[];
  counts: {
    all: number;
    active: number;
    exit_in_progress: number;
  };
  error?: string;
}

export interface EmployeeAssetStatusItem {
  id: string;
  employee_id: string;
  item_key: 'code' | 'machine' | 'login' | 'sim' | 'idcard' | 'docs_to_ho' | string;
  state: 'provided' | 'not_provided';
  updated_by_id?: string | null;
  updated_by_name?: string | null;
  updated_at: string;
}

export interface EmployeeDetailRecord extends EmployeeListItem {
  current_exit?: {
    id: string;
    employee_id: string;
    exit_type: 'resignation' | 'termination' | 'absconding';
    last_working_date: string;
    reason: string;
    notes?: string | null;
    status: 'in_progress' | 'completed';
    initiated_by_id?: string | null;
    initiated_by_name?: string | null;
    initiated_at: string;
    completed_at?: string | null;
    completed_by_id?: string | null;
    exit_clearance_items?: Array<{
      id: string;
      item_key: string;
      status: string;
      detail?: string | null;
      updated_at: string;
    }>;
  } | null;
  asset_status: EmployeeAssetStatusItem[];
  asset_emails: any[];
}

export interface EmployeeDetailResponse {
  success: boolean;
  employee: EmployeeDetailRecord;
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStaffAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function getEmployees(params?: {
  status?: 'all' | 'active' | 'exit_in_progress';
  search?: string;
  branch_id?: string;
}): Promise<EmployeesResponse> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.branch_id) searchParams.set('branch_id', params.branch_id);

  const url = `/api/employees${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Failed to fetch employees (HTTP ${res.status})`);
  }
  return res.json();
}

export async function getEmployeeById(id: string): Promise<EmployeeDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/employees/${id}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Failed to fetch employee record (HTTP ${res.status})`);
  }
  return res.json();
}

export interface StartExitPayload {
  exit_type: 'resignation' | 'termination' | 'absconding';
  last_working_date: string;
  reason: string;
  notes?: string;
}

export interface StartExitResponse {
  success: boolean;
  message?: string;
  exit_id?: string;
  error?: string;
}

export async function startEmployeeExit(
  employeeId: string,
  payload: StartExitPayload
): Promise<StartExitResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/employees/${employeeId}/exit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Failed to initiate exit (HTTP ${res.status})`);
  }
  return data;
}

export interface JoinerItemStates {
  code: 'provided' | 'not_provided';
  machine: 'provided' | 'not_provided';
  login: 'provided' | 'not_provided';
  sim: 'provided' | 'not_provided';
  idcard: 'provided' | 'not_provided';
  docs_to_ho: 'provided' | 'not_provided';
}

export interface JoinerTrackerItem {
  id: string;
  employee_code: string;
  employee_id: string;
  full_name: string;
  designation: string;
  designation_name: string;
  branch: { id: string; name: string } | null;
  branch_id: string | null;
  branch_name: string | null;
  hr_officer_name: string | null;
  joining_date: string;
  personal_email: string | null;
  item_states: JoinerItemStates;
  items: JoinerItemStates;
  progress_count: number;
  email_status: 'sent' | 'unsent';
  last_sent_at: string | null;
}

export interface JoinerTrackerResponse {
  success: boolean;
  joiners: JoinerTrackerItem[];
  counts: {
    joiners_tracked: number;
    assets_pending: number;
    emails_unsent: number;
  };
  error?: string;
}

export async function getJoinerTracker(params?: {
  branch_id?: string;
  hr?: string;
  only_pending?: boolean;
  search?: string;
}): Promise<JoinerTrackerResponse> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  if (params?.branch_id) searchParams.set('branch_id', params.branch_id);
  if (params?.hr) searchParams.set('hr', params.hr);
  if (params?.only_pending !== undefined) searchParams.set('only_pending', String(params.only_pending));
  if (params?.search) searchParams.set('search', params.search);

  const url = `/api/employees/joiner-tracker${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Failed to fetch joiner tracker (HTTP ${res.status})`);
  }
  return res.json();
}

export interface UpdateAssetStatusResponse {
  success: boolean;
  message?: string;
  asset_status?: EmployeeAssetStatusItem[];
  error?: string;
}

export async function updateEmployeeAssetStatus(
  employeeId: string,
  updates: Partial<Record<'code' | 'machine' | 'login' | 'sim' | 'idcard' | 'docs_to_ho', 'provided' | 'not_provided'>>
): Promise<UpdateAssetStatusResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/employees/${employeeId}/asset-status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Failed to update asset status (HTTP ${res.status})`);
  }
  return data;
}

export interface SendAssetsEmailResponse {
  success: boolean;
  simulated?: boolean;
  message?: string;
  email_record?: any;
  error?: string;
}

export async function sendEmployeeAssetsEmail(
  employeeId: string,
  options?: { recipient_email?: string; subject?: string }
): Promise<SendAssetsEmailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/employees/${employeeId}/send-assets-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Failed to send assets email (HTTP ${res.status})`);
  }
  return data;
}

export const employeesApi = {
  getEmployees,
  getEmployeeById,
  startEmployeeExit,
  getJoinerTracker,
  updateEmployeeAssetStatus,
  sendEmployeeAssetsEmail,
};

export * from './exitsApi';
