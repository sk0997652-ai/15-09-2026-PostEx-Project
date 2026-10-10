// ==============================================================================
// PostEx HR Onboarding Portal — ECF Template API Client (Step 10)
// ==============================================================================

import { getStaffAccessToken, refreshStaffAccessToken } from './staffAuth';

export interface EcfTemplateMetadata {
  id: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_name: string;
  storage_path: string;
}

export interface GetEcfTemplateResponse {
  success: boolean;
  template: EcfTemplateMetadata | null;
  signed_url: string | null;
  error?: string;
}

export interface UploadEcfTemplateResponse {
  success: boolean;
  message?: string;
  template?: EcfTemplateMetadata;
  error?: string;
}

export interface DeleteEcfTemplateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const token = await getStaffAccessToken();
  if (!token) {
    throw new Error('Active staff session token required. Please sign in again.');
  }
  return token;
}

async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  let token: string;
  try {
    token = await getAuthToken();
  } catch {
    const refreshed = await refreshStaffAccessToken();
    if (refreshed) {
      token = refreshed;
    } else {
      throw new Error('Active staff session token required. Please sign in again.');
    }
  }

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let res = await fetch(url, {
    ...init,
    headers: {
      ...baseHeaders,
      ...((init?.headers as Record<string, string>) || {}),
    },
  });

  if (res.status === 401) {
    const refreshedToken = await refreshStaffAccessToken();
    if (refreshedToken) {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${refreshedToken}`,
          ...((init?.headers as Record<string, string>) || {}),
        },
      });
    }
  }

  return res;
}

/**
 * 1. GET /api/admin/ecf-template
 * Returns active template metadata & 5-minute signed URL (or null if none).
 */
export async function getActiveEcfTemplate(): Promise<GetEcfTemplateResponse> {
  const res = await fetchWithAuth('/api/admin/ecf-template');
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch active ECF template (HTTP ${res.status})`);
  }
  return data;
}

/**
 * 2. POST /api/admin/ecf-template
 * Super Admin only. Multipart file upload (PNG, JPG, or PDF max 5 MB).
 */
export async function uploadEcfTemplate(file: File): Promise<UploadEcfTemplateResponse> {
  const formData = new FormData();
  formData.append('template', file);

  const res = await fetchWithAuth('/api/admin/ecf-template', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to upload ECF template (HTTP ${res.status})`);
  }
  return data;
}

/**
 * 3. DELETE /api/admin/ecf-template/:id
 * Super Admin only. Deactivates active template.
 */
export async function deleteEcfTemplate(id: string): Promise<DeleteEcfTemplateResponse> {
  if (!id) throw new Error('Template ID is required.');
  const res = await fetchWithAuth(`/api/admin/ecf-template/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to remove ECF template (HTTP ${res.status})`);
  }
  return data;
}

export const ecfTemplateApi = {
  getActiveEcfTemplate,
  uploadEcfTemplate,
  deleteEcfTemplate,
};
