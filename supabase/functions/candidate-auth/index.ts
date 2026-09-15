// Supabase Edge Function: candidate-auth
// Handles Candidate OTP generation, rate limiting, verification, and scoped 8-hour session minting.

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

// SHA-256 hash helper
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Mint scoped Candidate Session Token (8-hour expiry)
async function mintCandidateSessionToken(
  candidate: { id: string; joining_id: string; full_name: string; cnic: string },
  secret: string
): Promise<{ token: string; expires_at: string }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const exp = issuedAt + 8 * 3600; // 8 hours TTL

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: candidate.id,
    role: 'candidate',
    joining_id: candidate.joining_id,
    full_name: candidate.full_name,
    cnic: candidate.cnic,
    iat: issuedAt,
    exp: exp,
  };

  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const message = `${b64Header}.${b64Payload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const b64Signature = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return {
    token: `${message}.${b64Signature}`,
    expires_at: new Date(exp * 1000).toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase server configuration missing.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body;

    // --------------------------------------------------------------------------
    // ACTION 1: Request OTP
    // --------------------------------------------------------------------------
    if (action === 'request_otp') {
      const { joining_id, cnic, mobile } = body;

      if (!joining_id || !cnic || !mobile) {
        return new Response(
          JSON.stringify({ error: 'Joining ID, CNIC, and Mobile Number are all required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanJoiningId = String(joining_id).trim();
      const cleanCnic = String(cnic).trim();
      const cleanMobile = String(mobile).trim().replace(/[\s-]/g, '');

      // Verify matching candidate
      const { data: candidates, error: queryError } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, mobile, joining_id')
        .eq('joining_id', cleanJoiningId)
        .eq('cnic', cleanCnic);

      if (queryError || !candidates || candidates.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Authentication failed: No candidate record matched the provided Joining ID and CNIC.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const candidate = candidates[0];
      const dbMobileClean = candidate.mobile.replace(/[\s-]/g, '');

      // Verify mobile match (allowing leading 0 or 92)
      const mobileMatches =
        dbMobileClean === cleanMobile ||
        dbMobileClean.endsWith(cleanMobile.slice(-10)) ||
        cleanMobile.endsWith(dbMobileClean.slice(-10));

      if (!mobileMatches) {
        return new Response(
          JSON.stringify({ error: 'Authentication failed: Mobile number does not match registered candidate record.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // [HARD RULE] Rate Limiting: Max 3 OTP requests per 15 minutes per candidate
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count: recentOtpCount, error: countError } = await supabaseAdmin
        .from('candidate_otps')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidate.id)
        .gte('created_at', fifteenMinutesAgo);

      if (countError) {
        console.error('Rate limit query error:', countError);
      }

      if ((recentOtpCount ?? 0) >= 3) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded: Maximum 3 OTP requests allowed per 15 minutes. Please wait before requesting another OTP.',
            code: 'RATE_LIMIT_EXCEEDED',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Invalidate any existing active OTPs for this candidate
      await supabaseAdmin
        .from('candidate_otps')
        .update({ expires_at: new Date().toISOString() })
        .eq('candidate_id', candidate.id)
        .gt('expires_at', new Date().toISOString());

      // Generate 6-digit cryptographic OTP
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      const otpNumber = 100000 + (randomArray[0] % 900000);
      const otp = otpNumber.toString();

      const otpHash = await sha256Hex(otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

      // Store in candidate_otps
      const { error: insertError } = await supabaseAdmin
        .from('candidate_otps')
        .insert({
          candidate_id: candidate.id,
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempt_count: 0,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Failed to store OTP: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stubbed SMS function (logged to console per requirements)
      console.log(`[SMS STUB] Sent OTP ${otp} to mobile ${candidate.mobile} for candidate ${candidate.full_name} (${candidate.joining_id}). Valid for 5 minutes.`);

      return new Response(
        JSON.stringify({
          success: true,
          candidate_id: candidate.id,
          expires_at: expiresAt,
          message: `6-digit OTP sent to registered mobile (${candidate.mobile.slice(0, 4)}***${candidate.mobile.slice(-3)}).`,
          // Including test OTP in response for verification/testing convenience in prototype
          _test_otp: otp,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --------------------------------------------------------------------------
    // ACTION 2: Verify OTP
    // --------------------------------------------------------------------------
    if (action === 'verify_otp') {
      const { candidate_id, otp } = body;

      if (!candidate_id || !otp) {
        return new Response(
          JSON.stringify({ error: 'Candidate ID and 6-digit OTP are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanOtp = String(otp).trim();

      // Retrieve candidate record
      const { data: candidate, error: candError } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, mobile, joining_id')
        .eq('id', candidate_id)
        .single();

      if (candError || !candidate) {
        return new Response(
          JSON.stringify({ error: 'Access denied: Candidate record not found.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retrieve most recent active OTP
      const { data: otps, error: otpError } = await supabaseAdmin
        .from('candidate_otps')
        .select('id, otp_hash, expires_at, attempt_count')
        .eq('candidate_id', candidate_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (otpError || !otps || otps.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Access denied: No active OTP found. Please request a new OTP.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const activeOtp = otps[0];
      const now = new Date();

      if (new Date(activeOtp.expires_at) < now) {
        return new Response(
          JSON.stringify({ error: 'OTP has expired (valid for 5 minutes). Please request a new OTP.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // [HARD RULE] Max 5 verification attempts per OTP
      if (activeOtp.attempt_count >= 5) {
        // Invalidate OTP
        await supabaseAdmin
          .from('candidate_otps')
          .update({ expires_at: now.toISOString() })
          .eq('id', activeOtp.id);

        return new Response(
          JSON.stringify({
            error: 'Maximum verification attempts (5) exceeded. This OTP has been invalidated. Please request a new OTP.',
            code: 'MAX_ATTEMPTS_EXCEEDED',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const providedHash = await sha256Hex(cleanOtp);

      // Verify OTP hash
      if (providedHash !== activeOtp.otp_hash) {
        const newAttempts = activeOtp.attempt_count + 1;
        const attemptsLeft = 5 - newAttempts;

        await supabaseAdmin
          .from('candidate_otps')
          .update({
            attempt_count: newAttempts,
            ...(attemptsLeft <= 0 ? { expires_at: now.toISOString() } : {}),
          })
          .eq('id', activeOtp.id);

        if (attemptsLeft <= 0) {
          return new Response(
            JSON.stringify({
              error: 'Invalid OTP. Maximum 5 attempts reached. OTP is now invalidated. Please request a new one.',
              code: 'MAX_ATTEMPTS_EXCEEDED',
              attempts_remaining: 0,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            error: `Invalid OTP code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
            attempts_remaining: attemptsLeft,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // OTP is valid! Invalidate OTP immediately to prevent reuse
      await supabaseAdmin
        .from('candidate_otps')
        .update({ expires_at: now.toISOString() })
        .eq('id', activeOtp.id);

      // Mint scoped Candidate Session Token (8-hour TTL)
      const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || serviceRoleKey;
      const session = await mintCandidateSessionToken(candidate, jwtSecret);

      // Log successful login audit trail
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: candidate.id,
        actor_type: 'candidate',
        action: 'CANDIDATE_OTP_LOGIN_SUCCESS',
        entity_type: 'candidates',
        entity_id: candidate.id,
        metadata: { joining_id: candidate.joining_id },
      });

      return new Response(
        JSON.stringify({
          success: true,
          token: session.token,
          expires_at: session.expires_at,
          candidate: {
            id: candidate.id,
            full_name: candidate.full_name,
            cnic: candidate.cnic,
            joining_id: candidate.joining_id,
            mobile: candidate.mobile,
          },
          message: 'Candidate authentication successful.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Candidate auth error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
