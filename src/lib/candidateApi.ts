import { getCandidateSession } from './candidateAuth';

export interface Step1Data {
  full_name?: string;
  father_husband_name?: string;
  cnic?: string;
  dob?: string;
  gender?: string;
  marital_status?: string;
  blood_group?: string;
  mobile?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  residential_address?: string;
  city?: string;
  province?: string;
}

export interface Step2Data {
  highest_qualification?: string;
  degree_title?: string;
  institute_name?: string;
  graduation_year?: string;
  total_experience?: string;
  last_employer?: string;
  last_designation?: string;
  last_salary?: string;
  notice_period?: string;
}

export interface Step3Data {
  next_of_kin_name?: string;
  next_of_kin_relation?: string;
  next_of_kin_phone?: string;
  dependents_count?: string;
  ref1_name?: string;
  ref1_organization?: string;
  ref1_designation?: string;
  ref1_phone?: string;
  ref1_city?: string;
  ref2_name?: string;
  ref2_organization?: string;
  ref2_designation?: string;
  ref2_phone?: string;
  ref2_city?: string;
}

export interface CandidateApplicationResponse {
  success: boolean;
  error?: string;
  candidate?: any;
  application?: {
    id: string;
    status: string;
    current_step: number;
    submitted_at?: string;
    decision_reason?: string;
    application_steps?: Array<{
      id: string;
      step_number: number;
      step_name: string;
      data: any;
      completed: boolean;
      updated_at: string;
    }>;
    documents?: any[];
  } | null;
  consentGiven?: boolean;
}

function getAuthHeader(): Record<string, string> {
  const session = getCandidateSession();
  if (!session || !session.token) {
    return {};
  }
  return {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchCandidateApplication(): Promise<CandidateApplicationResponse> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch('/api/candidate/application', { headers });
    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to fetch application: ${msg}` };
  }
}

export async function logCandidateConsent(termsAccepted: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch('/api/candidate/consent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        terms_accepted: termsAccepted,
        accepted_at: new Date().toISOString(),
        client_user_agent: navigator.userAgent,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Consent recording failed: ${msg}` };
  }
}

export async function autosaveStepData(
  stepNumber: number,
  stepName: string,
  stepData: Record<string, any>
): Promise<{ success: boolean; saved_at?: string; error?: string }> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch('/api/candidate/autosave', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        step_number: stepNumber,
        step_name: stepName,
        data: stepData,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Autosave failed: ${msg}` };
  }
}

export async function uploadCandidateDocument(
  file: File,
  type: string
): Promise<{ success: boolean; document?: any; error?: string }> {
  try {
    const session = getCandidateSession();
    if (!session || !session.token) {
      return { success: false, error: 'No active candidate session.' };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/candidate/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: formData,
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Document upload failed: ${msg}` };
  }
}

export async function deleteCandidateDocument(docId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch(`/api/candidate/documents/${docId}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Document deletion failed: ${msg}` };
  }
}

export async function fetchCandidateDocuments(): Promise<{ success: boolean; documents?: any[]; error?: string }> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch('/api/candidate/documents', {
      headers,
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to fetch documents: ${msg}` };
  }
}

export async function submitCandidateApplication(payload?: {
  signatureDataUrl?: string;
  typedSignature?: string;
  signatureHash?: string;
  thumbDataUrl?: string;
  attestationConfirmed?: boolean;
}): Promise<{ success: boolean; status?: string; submitted_at?: string; error?: string }> {
  try {
    const headers = getAuthHeader();
    if (!headers.Authorization) {
      return { success: false, error: 'No active candidate session.' };
    }

    const res = await fetch('/api/candidate/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        submitted_at: new Date().toISOString(),
        ...(payload || {}),
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Submission failed: ${msg}` };
  }
}
