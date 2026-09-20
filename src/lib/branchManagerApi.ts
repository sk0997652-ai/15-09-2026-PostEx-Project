/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';

export interface BranchMetrics {
  branchId: string;
  branchName: string;
  zoneName: string;
  totalApplications: number;
  pendingVerification: number;
  needsCorrection: number;
  forwardedToCentral: number;
  approved: number;
  rejected: number;
}

export interface BranchCandidate {
  id: string;
  full_name: string;
  cnic: string;
  masked_cnic: string;
  mobile: string;
  email: string | null;
  joining_id: string;
  branch_id: string;
  branch_name?: string;
  zone_id: string;
}

export interface BranchDocument {
  id: string;
  application_id: string;
  type: string;
  storage_path: string;
  uploaded_at: string;
  verification_status: 'pending' | 'verified' | 'correction_required' | 'rejected';
  verified_by: string | null;
  remark: string | null;
}

export interface VerificationRemarkItem {
  id: string;
  application_id: string;
  document_id: string | null;
  remark: string;
  created_by: string | null;
  created_at: string;
}

export interface BranchApplicationSummary {
  id: string;
  candidate_id: string;
  status: 'draft' | 'submitted' | 'bm_verification' | 'needs_correction' | 'hr_review' | 'approved' | 'rejected';
  current_step: number;
  locked: boolean;
  assigned_branch_manager_id: string | null;
  assigned_central_hr_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
  candidate: BranchCandidate | null;
  documents_total: number;
  documents_verified: number;
  documents_correction_required: number;
  remarks_count: number;
  is_resubmitted: boolean;
}

export interface BranchApplicationDetail extends BranchApplicationSummary {
  documents: BranchDocument[];
  remarks: VerificationRemarkItem[];
  digitalSignature: {
    signedAt: string;
    signerName: string;
    signatureHash: string;
  } | null;
  allReviewed: boolean;
  totalDocs: number;
  verifiedDocs: number;
  correctionDocs: number;
}

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

export async function fetchBranchProfile(): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/branch/profile', { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch Branch Manager profile.');
  }
  return data.profile;
}

export async function fetchBranchMetrics(): Promise<BranchMetrics> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/branch/metrics', { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch branch metrics.');
  }
  return data.metrics;
}

export async function fetchBranchApplications(params: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  applications: BranchApplicationSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`/api/branch/applications?${query.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch branch applications.');
  }
  return {
    applications: data.applications,
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages,
  };
}

export async function fetchBranchApplicationDetail(appId: string): Promise<BranchApplicationDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/branch/applications/${appId}`, { headers });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch application detail.');
  }
  return data.application;
}

export async function verifyBranchDocument(
  appId: string,
  docId: string,
  status: 'verified' | 'correction_required',
  remark?: string
): Promise<{ message: string; document: BranchDocument }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/branch/applications/${appId}/documents/${docId}/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status, remark }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update document verification status.');
  }
  return { message: data.message, document: data.document };
}

export async function signBranchApplication(
  appId: string,
  signerName: string
): Promise<{
  message: string;
  signature: { signerName: string; signedAt: string; signatureHash: string };
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/branch/applications/${appId}/sign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ signerName }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to apply digital signature.');
  }
  return { message: data.message, signature: data.signature };
}

export async function forwardApplicationToCentralHr(appId: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/branch/applications/${appId}/forward`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to forward application to Central HR.');
  }
  return { message: data.message };
}

export async function returnApplicationToCandidate(
  appId: string,
  reason: string
): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/branch/applications/${appId}/return-to-candidate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to return application to candidate.');
  }
  return { message: data.message };
}

export async function seedSampleBranchApplication(): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/branch/test/seed-sample-application', {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate sample candidate.');
  }
  return data;
}

export async function simulateCandidateResubmission(
  applicationId: string,
  documentId: string
): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/branch/test/resubmit-section', {
    method: 'POST',
    headers,
    body: JSON.stringify({ applicationId, documentId }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to simulate candidate resubmission.');
  }
  return data;
}
