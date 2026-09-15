import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
export const supabaseAnonKey = typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('MY_') &&
  !supabaseAnonKey.includes('MY_')
);

// Fallback dummy credentials when environment secrets are not yet added
// to prevent initial bundle runtime crash while awaiting user configuration
const clientUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const clientKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface ConnectivityDiagnostic {
  configured: boolean;
  urlProvided: boolean;
  keyProvided: boolean;
  maskedUrl: string;
  maskedKey: string;
  timestamp: string;
  status: 'checking' | 'connected' | 'not_configured' | 'connection_error';
  latencyMs?: number;
  message: string;
  details?: {
    authReachable: boolean;
    restReachable: boolean;
    errorCode?: string;
    errorMessage?: string;
  };
}

export async function checkSupabaseConnectivity(): Promise<ConnectivityDiagnostic> {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured) {
    return {
      configured: false,
      urlProvided: Boolean(supabaseUrl),
      keyProvided: Boolean(supabaseAnonKey),
      maskedUrl: supabaseUrl ? maskString(supabaseUrl, 10, 4) : 'Not provided',
      maskedKey: supabaseAnonKey ? maskString(supabaseAnonKey, 6, 4) : 'Not provided',
      timestamp,
      status: 'not_configured',
      message: 'Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to environment secrets.',
      details: {
        authReachable: false,
        restReachable: false,
      },
    };
  }

  const startTime = performance.now();

  try {
    // 1. Check Supabase Auth Gateway
    const authPromise = supabase.auth.getSession();
    
    // 2. Check Supabase REST API endpoint
    const restPromise = fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    const [authResult, restResponse] = await Promise.allSettled([
      authPromise,
      restPromise,
    ]);

    const latencyMs = Math.round(performance.now() - startTime);

    const authOk = authResult.status === 'fulfilled' && !authResult.value.error;
    const restOk = restResponse.status === 'fulfilled' && (restResponse.value.status === 200 || restResponse.value.status === 404 || restResponse.value.status === 401 || restResponse.value.ok);

    if (authOk || (restResponse.status === 'fulfilled' && restResponse.value.status < 500)) {
      return {
        configured: true,
        urlProvided: true,
        keyProvided: true,
        maskedUrl: maskString(supabaseUrl, 12, 6),
        maskedKey: maskString(supabaseAnonKey, 6, 4),
        timestamp,
        status: 'connected',
        latencyMs,
        message: 'Successfully established connection to Supabase backend services.',
        details: {
          authReachable: authResult.status === 'fulfilled',
          restReachable: restResponse.status === 'fulfilled',
        },
      };
    }

    const authErrorMsg = authResult.status === 'fulfilled' && authResult.value.error ? authResult.value.error.message : undefined;

    return {
      configured: true,
      urlProvided: true,
      keyProvided: true,
      maskedUrl: maskString(supabaseUrl, 12, 6),
      maskedKey: maskString(supabaseAnonKey, 6, 4),
      timestamp,
      status: 'connection_error',
      latencyMs,
      message: authErrorMsg || 'Failed to reach Supabase endpoints. Please verify your Project URL and Anon API key.',
      details: {
        authReachable: authOk,
        restReachable: restResponse.status === 'fulfilled' && restResponse.value.ok,
        errorMessage: authErrorMsg,
      },
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorString = err instanceof Error ? err.message : String(err);

    return {
      configured: true,
      urlProvided: true,
      keyProvided: true,
      maskedUrl: maskString(supabaseUrl, 12, 6),
      maskedKey: maskString(supabaseAnonKey, 6, 4),
      timestamp,
      status: 'connection_error',
      latencyMs,
      message: `Network error connecting to Supabase: ${errorString}`,
      details: {
        authReachable: false,
        restReachable: false,
        errorMessage: errorString,
      },
    };
  }
}

function maskString(str: string, head: number, tail: number): string {
  if (str.length <= head + tail) return '***';
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}
