import { CandidateSession } from '../types/database';

export type { CandidateSession };

export interface CandidateSessionState {
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

const CANDIDATE_SESSION_KEY = 'postex_candidate_session';

export async function requestCandidateOtp(params: {
  joining_id: string;
  cnic: string;
  mobile: string;
}): Promise<{
  success: boolean;
  candidate_id?: string;
  expires_at?: string;
  message?: string;
  error?: string;
  test_otp?: string;
}> {
  if (!params.joining_id || !params.cnic || !params.mobile) {
    return {
      success: false,
      error: 'All fields (Joining ID, CNIC, and Mobile) are required.',
    };
  }

  try {
    const res = await fetch('/api/candidate-auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        joining_id: params.joining_id.trim(),
        cnic: params.cnic.trim(),
        mobile: params.mobile.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Authentication failed. Please verify credentials.',
      };
    }

    return {
      success: true,
      candidate_id: data.candidate_id,
      expires_at: data.expires_at,
      message: data.message,
      test_otp: data._test_otp,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Connection to candidate authentication service failed: ${msg}` };
  }
}

export async function verifyCandidateOtp(params: {
  candidate_id: string;
  otp: string;
}): Promise<{
  success: boolean;
  session?: CandidateSessionState;
  error?: string;
  attempts_remaining?: number;
}> {
  if (!params.candidate_id || !params.otp) {
    return { success: false, error: 'Candidate ID and OTP are required.' };
  }

  try {
    const res = await fetch('/api/candidate-auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: params.candidate_id,
        otp: params.otp.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Invalid OTP code.',
        attempts_remaining: data.attempts_remaining,
      };
    }

    // Save session to storage with strict 8-hour boundary
    const sessionData: CandidateSessionState = {
      token: data.token,
      candidate: data.candidate,
      expires_at: data.expires_at,
    };

    localStorage.setItem(CANDIDATE_SESSION_KEY, JSON.stringify(sessionData));

    return {
      success: true,
      session: sessionData,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Verification request failed: ${msg}` };
  }
}

export function getCandidateSession(): CandidateSessionState | null {
  const raw = localStorage.getItem(CANDIDATE_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed: CandidateSessionState = JSON.parse(raw);
    const now = new Date().getTime();
    const expiry = new Date(parsed.expires_at).getTime();

    // [HARD RULE] Expire sessions after 8 hours. Deny access on failure.
    if (now > expiry) {
      clearCandidateSession();
      return null;
    }

    return parsed;
  } catch {
    clearCandidateSession();
    return null;
  }
}

export function clearCandidateSession(): void {
  localStorage.removeItem(CANDIDATE_SESSION_KEY);
}
