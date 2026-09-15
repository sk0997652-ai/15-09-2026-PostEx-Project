import { supabase } from './supabase';
import { validateStaffPassword } from './passwordPolicy';
import { StaffProfile } from '../types/database';

export interface StaffAuthState {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    zone_id?: string;
    zone_name?: string;
    branch_id?: string;
    branch_name?: string;
    must_change_password?: boolean;
  } | null;
  profile: StaffProfile | null;
  mustChangePassword: boolean;
  sessionExpiry: number | null; // Unix timestamp ms
}

const STAFF_SESSION_KEY = 'postex_staff_session_meta';
const MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours max lifetime

export async function signInStaff(email: string, password: string): Promise<{
  success: boolean;
  mustChangePassword: boolean;
  role?: string;
  user?: any;
  error?: string;
}> {
  if (!email || !password) {
    return { success: false, mustChangePassword: false, error: 'Email and password are required.' };
  }

  // 1. Authenticate with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user || !data.session) {
    // [HARD RULE] Always deny access on failure - no default identity, no guest fallback
    return {
      success: false,
      mustChangePassword: false,
      error: error?.message || 'Invalid email or password.',
    };
  }

  // 2. Fetch authenticated profile via secure server resolver
  let mustChange = Boolean(data.user.user_metadata?.must_change_password);
  let userProfile: any = null;

  try {
    const res = await fetch('/api/staff/me', {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.user) {
        userProfile = json.user;
        mustChange = Boolean(json.user.must_change_password);
      }
    }
  } catch (err) {
    console.warn('Could not query /api/staff/me directly:', err);
  }

  // Record 8-hour session timestamp
  const sessionExpiry = Date.now() + MAX_SESSION_DURATION_MS;
  localStorage.setItem(
    STAFF_SESSION_KEY,
    JSON.stringify({
      userId: data.user.id,
      loginAt: Date.now(),
      expiresAt: sessionExpiry,
    })
  );

  return {
    success: true,
    mustChangePassword: mustChange,
    role: userProfile?.role,
    user: userProfile,
  };
}

export async function updateStaffPassword(newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // [HARD RULE] Validate password policy: min 10 chars, 1 letter, 1 number
  const policyCheck = validateStaffPassword(newPassword);
  if (!policyCheck.isValid) {
    return {
      success: false,
      error: policyCheck.errors.join(' '),
    };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'No active session found.' };
  }

  try {
    const res = await fetch('/api/staff/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ new_password: newPassword }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to update password.' };
    }

    // Refresh Supabase session user metadata
    await supabase.auth.refreshSession();

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function checkStaffSession(): Promise<{
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    zone_id?: string;
    zone_name?: string;
    branch_id?: string;
    branch_name?: string;
    must_change_password?: boolean;
  } | null;
}> {
  // Check 8-hour hard session boundary
  const metaRaw = localStorage.getItem(STAFF_SESSION_KEY);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      if (Date.now() > meta.expiresAt) {
        // [HARD RULE] Session expired after 8 hours -> DENY access
        await signOutStaff();
        return { isAuthenticated: false, mustChangePassword: false, user: null };
      }
    } catch {
      await signOutStaff();
      return { isAuthenticated: false, mustChangePassword: false, user: null };
    }
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || !session.user) {
    return { isAuthenticated: false, mustChangePassword: false, user: null };
  }

  // Fetch full server-resolved staff profile with role and zoning
  try {
    const res = await fetch('/api/staff/me', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.user) {
        return {
          isAuthenticated: true,
          mustChangePassword: Boolean(json.user.must_change_password),
          user: json.user,
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching /api/staff/me in checkStaffSession:', err);
  }

  // Fallback to JWT / metadata if offline
  const isSuper = session.user.email === 'admin@postex.pk' || session.user.user_metadata?.role === 'super_admin';
  return {
    isAuthenticated: true,
    mustChangePassword: Boolean(session.user.user_metadata?.must_change_password),
    user: {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.user_metadata?.name || 'Staff User',
      role: isSuper ? 'super_admin' : (session.user.user_metadata?.role || 'staff'),
      zone_id: session.user.user_metadata?.zone_id,
    },
  };
}

export async function signOutStaff(): Promise<void> {
  localStorage.removeItem(STAFF_SESSION_KEY);
  await supabase.auth.signOut();
}
