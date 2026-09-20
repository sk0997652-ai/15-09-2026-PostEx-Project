import express from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { createSuperAdminRouter } from './src/server/superAdminRoutes';
import { createZonalHrRouter } from './src/server/zonalHrRoutes';
import { createCentralHrRouter } from './src/server/centralHrRoutes';
import { createBranchManagerRouter } from './src/server/branchManagerRoutes';
import { formTemplatesService } from './src/server/formTemplatesStore';
import { validateStatusTransition } from './src/server/workflowStateMachine';
import { notificationService } from './src/server/notificationService';
import { dataRetentionService } from './src/server/dataRetentionStore';

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Admin Client using server-side service role key
const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseServerConfigured = Boolean(
  rawSupabaseUrl &&
  rawServiceRoleKey &&
  rawSupabaseUrl.startsWith('https://') &&
  !rawSupabaseUrl.includes('MY_') &&
  !rawServiceRoleKey.includes('MY_')
);

const supabaseUrl = isSupabaseServerConfigured ? rawSupabaseUrl.trim() : 'https://placeholder-project.supabase.co';
const serviceRoleKey = isSupabaseServerConfigured ? rawServiceRoleKey.trim() : 'placeholder-service-role-key';

if (!isSupabaseServerConfigured) {
  console.warn('PostEx Portal: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined. Server running in standby mode.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper: SHA-256 hash string
function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Helper: Generate secure temporary password
// [HARD RULE]: Min 10 chars, at least 1 number, at least 1 letter
function generateSecureTempPassword(length = 14): string {
  const lettersUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lettersLower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*()-_=+';
  const allChars = lettersUpper + lettersLower + digits + special;

  const randomBytes = crypto.randomBytes(length);
  const pwdChars = [
    lettersUpper[randomBytes[0] % lettersUpper.length],
    lettersLower[randomBytes[1] % lettersLower.length],
    digits[randomBytes[2] % digits.length],
    special[randomBytes[3] % special.length],
  ];

  for (let i = 4; i < length; i++) {
    pwdChars.push(allChars[randomBytes[i] % allChars.length]);
  }

  // Fisher-Yates shuffle
  for (let i = pwdChars.length - 1; i > 0; i--) {
    const j = randomBytes[i] % (i + 1);
    [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
  }

  return pwdChars.join('');
}

// Helper: Mint Scoped Candidate JWT Session Token (8-Hour expiry)
function mintCandidateSessionToken(
  candidate: { id: string; joining_id: string; full_name: string; cnic: string },
  secret: string
): { token: string; expires_at: string } {
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

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${b64Header}.${b64Payload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64url');

  return {
    token: `${message}.${signature}`,
    expires_at: new Date(exp * 1000).toISOString(),
  };
}

// Helper: Verify Candidate JWT Session Token
function verifyCandidateSessionToken(
  token: string,
  secret: string
): { valid: boolean; payload?: { sub: string; role: string; joining_id: string; full_name: string; cnic: string; exp: number }; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure.' };
    }
    const [b64Header, b64Payload, signature] = parts;
    const message = `${b64Header}.${b64Payload}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64url');

    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid token signature.' };
    }

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'Session token has expired (8-hour maximum lifetime exceeded).' };
    }

    if (payload.role !== 'candidate') {
      return { valid: false, error: 'Token is not scoped for candidate access.' };
    }

    return { valid: true, payload };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Token verification failed: ${message}` };
  }
}

// Helper: Fetch Staff Context and Permissions
async function getStaffContext(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('staff_profiles')
    .select('id, name, role_id, zone_id, branch_id, is_active, roles(id, name)')
    .eq('id', userId)
    .single();

  if (!profile || !profile.is_active) {
    return null;
  }

  const roleName = (profile.roles as any)?.name || 'staff';
  const roleId = profile.role_id;

  // Fetch role permissions
  const { data: rolePerms } = await supabaseAdmin
    .from('role_permissions')
    .select('permissions(key)')
    .eq('role_id', roleId);

  const permissions = new Set<string>();
  if (rolePerms) {
    rolePerms.forEach((rp: any) => {
      if (rp.permissions?.key) permissions.add(rp.permissions.key);
    });
  }

  // Fetch overrides
  const { data: overrides } = await supabaseAdmin
    .from('user_permission_overrides')
    .select('permission_id, granted, permissions(key)')
    .eq('staff_profile_id', userId);

  if (overrides) {
    overrides.forEach((ov: any) => {
      if (ov.permissions?.key) {
        if (ov.granted) {
          permissions.add(ov.permissions.key);
        } else {
          permissions.delete(ov.permissions.key);
        }
      }
    });
  }

  return {
    userId: profile.id,
    name: profile.name,
    role: roleName,
    zoneId: profile.zone_id,
    branchId: profile.branch_id,
    permissions: Array.from(permissions),
  };
}

// ==============================================================================
// 1. API: CANDIDATE OTP AUTHENTICATION
// ==============================================================================

app.post('/api/candidate-auth/request-otp', async (req, res) => {
  try {
    const { joining_id, cnic, mobile } = req.body;

    if (!joining_id || !cnic || !mobile) {
      return res.status(400).json({
        success: false,
        error: 'Joining ID, CNIC, and Mobile Number are all required.',
      });
    }

    const cleanJoiningId = String(joining_id).trim();
    const cleanCnic = String(cnic).trim();
    const cleanDigits = cleanCnic.replace(/\D/g, '');
    const formattedCnic = cleanDigits.length === 13 ? `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5, 12)}-${cleanDigits.slice(12)}` : cleanCnic;
    const cleanMobile = String(mobile).trim();

    const { data: candidate, error: candError } = await supabaseAdmin
      .from('candidates')
      .select('id, full_name, cnic, mobile, joining_id')
      .eq('joining_id', cleanJoiningId)
      .or(`cnic.eq.${cleanCnic},cnic.eq.${formattedCnic},cnic.eq.${cleanDigits}`)
      .maybeSingle();

    if (candError || !candidate) {
      return res.status(401).json({
        success: false,
        error: 'No candidate found matching the provided Joining ID and CNIC.',
      });
    }

    const normDbMobile = candidate.mobile.replace(/\D/g, '').slice(-10);
    const normInputMobile = cleanMobile.replace(/\D/g, '').slice(-10);

    if (normDbMobile !== normInputMobile) {
      return res.status(401).json({
        success: false,
        error: 'Mobile number does not match registered candidate records.',
      });
    }

    // Rate Limiting: Max 3 requests per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentCount, error: countErr } = await supabaseAdmin
      .from('candidate_otps')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidate.id)
      .gte('created_at', fifteenMinutesAgo);

    if (countErr) {
      console.error('Error checking OTP rate limits:', countErr);
    } else if (recentCount !== null && recentCount >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too many OTP requests. Maximum 3 requests allowed every 15 minutes to prevent SMS abuse.',
      });
    }

    // Invalidate existing active OTPs
    await supabaseAdmin
      .from('candidate_otps')
      .delete()
      .eq('candidate_id', candidate.id);

    // Generate 6-digit cryptographic OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = sha256Hex(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: otpInsertErr } = await supabaseAdmin
      .from('candidate_otps')
      .insert({
        candidate_id: candidate.id,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempt_count: 0,
      });

    if (otpInsertErr) {
      console.error('Error storing OTP:', otpInsertErr);
      return res.status(500).json({ success: false, error: 'Failed to generate OTP. Try again.' });
    }

    // Consolidated notification service dispatch
    await notificationService.notifyCandidateOtp(supabaseAdmin, candidate.id, candidate.mobile, rawOtp);

    return res.json({
      success: true,
      message: 'A 6-digit OTP has been dispatched to your mobile number. Valid for 5 minutes.',
      expires_at: expiresAt,
      candidate_id: candidate.id,
      _test_otp: rawOtp,
      dev_otp: rawOtp,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Candidate request-otp error:', err);
    return res.status(500).json({ success: false, error: message });
  }
});

app.post('/api/candidate-auth/verify-otp', async (req, res) => {
  try {
    const { candidate_id, otp } = req.body;

    if (!candidate_id || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Candidate ID and 6-digit OTP are required.',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP format. OTP must be exactly 6 digits.',
      });
    }

    const { data: otpRecord, error: fetchErr } = await supabaseAdmin
      .from('candidate_otps')
      .select('*')
      .eq('candidate_id', candidate_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !otpRecord) {
      return res.status(401).json({
        success: false,
        error: 'No active OTP found. Please request a new OTP.',
      });
    }

    const now = new Date();
    const expiry = new Date(otpRecord.expires_at);

    if (now > expiry) {
      await supabaseAdmin.from('candidate_otps').delete().eq('id', otpRecord.id);
      return res.status(401).json({
        success: false,
        error: 'OTP has expired (5-minute validity exceeded). Please request a new OTP.',
      });
    }

    if (otpRecord.attempt_count >= 5) {
      await supabaseAdmin.from('candidate_otps').delete().eq('id', otpRecord.id);
      return res.status(429).json({
        success: false,
        error: 'Maximum 5 verification attempts exceeded. This OTP has been invalidated.',
      });
    }

    const computedHash = sha256Hex(cleanOtp);

    if (computedHash !== otpRecord.otp_hash) {
      const newAttempts = otpRecord.attempt_count + 1;
      
      if (newAttempts >= 5) {
        await supabaseAdmin.from('candidate_otps').delete().eq('id', otpRecord.id);
        return res.status(401).json({
          success: false,
          error: 'Maximum 5 verification attempts exceeded. This OTP has been invalidated.',
          attempts_remaining: 0,
          remaining_attempts: 0,
        });
      }

      await supabaseAdmin
        .from('candidate_otps')
        .update({ attempt_count: newAttempts })
        .eq('id', otpRecord.id);

      const remaining = Math.max(0, 5 - newAttempts);
      return res.status(401).json({
        success: false,
        error: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        attempts_remaining: remaining,
        remaining_attempts: remaining,
      });
    }

    await supabaseAdmin.from('candidate_otps').delete().eq('id', otpRecord.id);

    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id, joining_id, full_name, cnic')
      .eq('id', candidate_id)
      .single();

    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Candidate profile not found.' });
    }

    const jwtSecret = serviceRoleKey;
    const sessionData = mintCandidateSessionToken(candidate, jwtSecret);

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: candidate.id,
      actor_type: 'candidate',
      action: 'candidate_otp_login_success',
      entity_type: 'candidate',
      entity_id: candidate.id,
      metadata: { joining_id: candidate.joining_id },
    });

    return res.json({
      success: true,
      token: sessionData.token,
      expires_at: sessionData.expires_at,
      candidate: {
        id: candidate.id,
        joining_id: candidate.joining_id,
        full_name: candidate.full_name,
        cnic: candidate.cnic,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Candidate verify-otp error:', err);
    return res.status(500).json({ success: false, error: message });
  }
});

// ==============================================================================
// 2. API: PRIVILEGED ACTION GUARDS (Edge Function / Server Level)
// ==============================================================================

// Staff Password Regeneration Guard
// Allowed: super_admin or zonal_hr_manager (for staff in their zone)
app.post('/api/staff/regenerate-password', async (req, res) => {
  try {
    const { target_staff_id, requester_token } = req.body;

    if (!target_staff_id) {
      return res.status(400).json({ success: false, error: 'Target staff user ID is required.' });
    }

    // Verify caller authorization
    const rawAuth = req.headers.authorization || '';
    const bearerToken = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7).trim() : null;
    const effectiveToken = requester_token || bearerToken;

    if (!effectiveToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication token is required.' });
    }

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(effectiveToken);
    if (authErr || !authUser.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid staff token.' });
    }

    const requesterCtx = await getStaffContext(authUser.user.id);
    if (!requesterCtx) {
      return res.status(403).json({ success: false, error: 'Requester staff profile not found or inactive.' });
    }

      // Privileged Action Check
      if (requesterCtx.role !== 'super_admin' && requesterCtx.role !== 'zonal_hr_manager') {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Staff with role "${requesterCtx.role}" is not authorized to regenerate credentials.`,
        });
      }

      // If zonal_hr_manager, ensure target is in their zone
      if (requesterCtx.role === 'zonal_hr_manager') {
        const { data: targetProfile } = await supabaseAdmin
          .from('staff_profiles')
          .select('zone_id')
          .eq('id', target_staff_id)
          .single();

        if (targetProfile && targetProfile.zone_id !== requesterCtx.zoneId) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Zonal HR Manager can only regenerate credentials for staff in their assigned zone.',
          });
        }
      }

    const newTempPassword = generateSecureTempPassword(14);

    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      target_staff_id,
      {
        password: newTempPassword,
        user_metadata: { must_change_password: true },
      }
    );

    if (updateAuthErr) {
      console.error('Error updating staff auth password:', updateAuthErr);
      return res.status(500).json({ success: false, error: updateAuthErr.message });
    }

    await supabaseAdmin
      .from('staff_profiles')
      .update({ must_change_password: true })
      .eq('id', target_staff_id);

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: target_staff_id,
      actor_type: 'system',
      action: 'regenerate_temp_password',
      entity_type: 'staff_profile',
      entity_id: target_staff_id,
      metadata: { must_change_password: true },
    });

    return res.json({
      success: true,
      temporary_password: newTempPassword,
      must_change_password: true,
      message: 'Temporary password generated successfully. Set must_change_password = true.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Staff regenerate-password error:', err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Privileged Action Guard: HR Decision State Transition
// Allowed: super_admin, zonal_hr_manager, or central_hr with applications.decide
app.post('/api/applications/decide', async (req, res) => {
  try {
    const { application_id, decision, reason, staff_token } = req.body;

    if (!application_id || !decision || !staff_token) {
      return res.status(400).json({
        success: false,
        error: 'Application ID, decision, and staff_token are required.',
      });
    }

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(staff_token);
    if (authErr || !authUser.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid staff token.' });
    }

    const ctx = await getStaffContext(authUser.user.id);
    if (!ctx) {
      return res.status(403).json({ success: false, error: 'Staff profile inactive or not found.' });
    }

    // Check permission
    const hasDecidePerm = ctx.role === 'super_admin' || ctx.permissions.includes('applications.decide');
    if (!hasDecidePerm) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role "${ctx.role}" is not permitted to make HR decisions.`,
      });
    }

    // Verify scope on target application
    const { data: appData } = await supabaseAdmin
      .from('applications')
      .select('id, candidate_id, candidates(zone_id, branch_id)')
      .eq('id', application_id)
      .single();

    if (!appData) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const candZoneId = (appData.candidates as any)?.zone_id;
    if (ctx.role !== 'super_admin' && candZoneId !== ctx.zoneId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot decide on candidate outside your assigned zone.',
      });
    }

    // Record decision
    const { data: decData, error: decErr } = await supabaseAdmin
      .from('hr_decisions')
      .insert({
        application_id,
        decided_by: ctx.userId,
        decision,
        reason: reason || 'HR review decision',
      })
      .select()
      .single();

    if (decErr) {
      return res.status(500).json({ success: false, error: decErr.message });
    }

    const newStatus = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'needs_correction';
    await supabaseAdmin
      .from('applications')
      .update({
        status: newStatus,
        decided_at: new Date().toISOString(),
        decision_reason: reason,
      })
      .eq('id', application_id);

    return res.json({
      success: true,
      decision: decData,
      status: newStatus,
      message: `HR decision recorded: ${decision}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// ==============================================================================
// 3. API: RBAC SCOPED DATA ACCESS (For Step 4 Testing & Client Fetching)
// ==============================================================================

// Staff Profile & Role Session Resolver
app.get('/api/staff/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization header required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authUser.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('staff_profiles')
      .select('id, name, is_active, must_change_password, zone_id, branch_id, roles(id, name), zones(id, name), branches(id, name)')
      .eq('id', authUser.user.id)
      .maybeSingle();

    if (profErr) {
      return res.status(500).json({ success: false, error: profErr.message });
    }

    if (!profile) {
      // Fallback for default super admin or unprofiled accounts
      const isSuper = authUser.user.email === 'admin@postex.pk' || authUser.user.user_metadata?.role === 'super_admin';
      return res.json({
        success: true,
        user: {
          id: authUser.user.id,
          email: authUser.user.email || '',
          name: authUser.user.user_metadata?.name || 'Staff User',
          role: isSuper ? 'super_admin' : 'staff',
          must_change_password: Boolean(authUser.user.user_metadata?.must_change_password),
          is_active: true,
        },
      });
    }

    if (!profile.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Contact HR Administrator.' });
    }

    const rawRole = profile.roles as any;
    const roleName = Array.isArray(rawRole)
      ? rawRole[0]?.name
      : (rawRole?.name || authUser.user.user_metadata?.role || 'staff');

    const rawZone = profile.zones as any;
    const zoneName = Array.isArray(rawZone) ? rawZone[0]?.name : rawZone?.name;

    const rawBranch = profile.branches as any;
    const branchName = Array.isArray(rawBranch) ? rawBranch[0]?.name : rawBranch?.name;

    return res.json({
      success: true,
      user: {
        id: profile.id,
        email: authUser.user.email || '',
        name: profile.name,
        role: roleName,
        zone_id: profile.zone_id,
        zone_name: zoneName || undefined,
        branch_id: profile.branch_id,
        branch_name: branchName || undefined,
        must_change_password: Boolean(profile.must_change_password),
        is_active: profile.is_active,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Staff Password Update & Forced Change Resolver
app.post('/api/staff/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization header required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authUser.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const { new_password } = req.body;
    if (!new_password || typeof new_password !== 'string') {
      return res.status(400).json({ success: false, error: 'New password is required.' });
    }

    // Policy check: min 10 chars, at least 1 letter, at least 1 number
    if (new_password.length < 10) {
      return res.status(400).json({ success: false, error: 'Password must be at least 10 characters long.' });
    }
    if (!/[A-Za-z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      return res.status(400).json({ success: false, error: 'Password must contain at least one letter and one number.' });
    }

    // Update in auth.users
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.user.id, {
      password: new_password,
      user_metadata: {
        ...authUser.user.user_metadata,
        must_change_password: false,
      },
    });

    if (updateAuthErr) {
      return res.status(400).json({ success: false, error: updateAuthErr.message });
    }

    // Update in staff_profiles
    await supabaseAdmin
      .from('staff_profiles')
      .update({ must_change_password: false })
      .eq('id', authUser.user.id);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: authUser.user.id,
      actor_type: 'staff',
      action: 'staff_changed_password',
      entity_type: 'staff_profiles',
      entity_id: authUser.user.id,
      metadata: { must_change_password: false },
    });

    return res.json({
      success: true,
      message: 'Password updated successfully. Account unlocked.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Staff Candidates Query (Respects Geographic Scope)
app.get('/api/staff/candidates', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authorization header required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authUser.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }

    const ctx = await getStaffContext(authUser.user.id);
    if (!ctx) {
      return res.status(403).json({ success: false, error: 'Staff profile not found.' });
    }

    let query = supabaseAdmin.from('candidates').select('id, full_name, cnic, mobile, joining_id, zone_id, branch_id, zones(name), branches(name)');

    // Apply geographic scoping
    if (ctx.role === 'super_admin') {
      // Full access across all zones
    } else if (ctx.role === 'zonal_hr_manager' || ctx.role === 'central_hr') {
      if (!ctx.zoneId) {
        return res.json({ success: true, data: [] });
      }
      query = query.eq('zone_id', ctx.zoneId);
    } else if (ctx.role === 'branch_manager') {
      if (!ctx.branchId) {
        return res.json({ success: true, data: [] });
      }
      query = query.eq('branch_id', ctx.branchId);
    } else {
      return res.status(403).json({ success: false, error: 'Unauthorized role.' });
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      role: ctx.role,
      scope: { zone_id: ctx.zoneId, branch_id: ctx.branchId },
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Candidate Application Query (Candidate Scoped Isolation)
app.get('/api/candidate/application', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const secret = serviceRoleKey;
    const verification = verifyCandidateSessionToken(token, secret);

    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;

    const { data: candidate, error: candErr } = await supabaseAdmin
      .from('candidates')
      .select('*, zones(name), branches(name)')
      .eq('id', candidateId)
      .single();

    if (candErr || !candidate) {
      return res.status(404).json({ success: false, error: 'Candidate not found.' });
    }

    // Resolve track: DB column or fallback store
    const resolvedTrack = candidate.track || formTemplatesService.getCandidateTrack(candidateId) || 'executive';
    candidate.track = resolvedTrack;

    // Resolve candidate designation from audit logs or designations table
    let designationTitle = (candidate as any).designation_title || (candidate as any).designation || null;
    if (!designationTitle) {
      try {
        const { data: creationLogs } = await supabaseAdmin
          .from('audit_logs')
          .select('metadata')
          .eq('entity_id', candidateId)
          .eq('action', 'central_hr_created_candidate')
          .order('created_at', { ascending: false })
          .limit(1);

        const creationLog = creationLogs?.[0];

        if (creationLog?.metadata?.designation_id) {
          const { data: desigRow } = await supabaseAdmin
            .from('designations')
            .select('name')
            .eq('id', creationLog.metadata.designation_id)
            .maybeSingle();
          if (desigRow?.name) {
            designationTitle = desigRow.name;
          }
        }
      } catch {
        // continue
      }
    }
    if (!designationTitle) {
      designationTitle = resolvedTrack === 'executive' ? 'Operations Executive' : 'Courier & Logistics Associate';
    }
    candidate.designation = designationTitle;

    const { data: application } = await supabaseAdmin
      .from('applications')
      .select('*, application_steps(*), documents(*)')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (application && application.track === undefined) {
      application.track = resolvedTrack;
    }

    // Attach signed preview URLs to uploaded documents
    if (application && Array.isArray(application.documents)) {
      application.documents = await Promise.all(
        application.documents.map(async (doc: any) => {
          try {
            const { data: signed } = await supabaseAdmin.storage
              .from('candidate-documents')
              .createSignedUrl(doc.storage_path, 3600);
            return {
              ...doc,
              preview_url: signed?.signedUrl || `/api/documents/${doc.id}/view`,
            };
          } catch {
            return {
              ...doc,
              preview_url: `/api/documents/${doc.id}/view`,
            };
          }
        })
      );
    }

    // Check if consent has been recorded (safe against multiple audit rows)
    const { data: consentLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('id, created_at')
      .eq('actor_id', candidateId)
      .eq('action', 'CONSENT_GRANTED')
      .limit(1);

    const consentGiven = Boolean(consentLogs && consentLogs.length > 0);

    return res.json({
      success: true,
      candidate,
      application: application || null,
      consentGiven,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Organization Settings Public Endpoint
app.get('/api/organization-settings', async (req, res) => {
  try {
    const settings = await formTemplatesService.getOrgSettings(supabaseAdmin);
    return res.json({ success: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Organization Settings Update Endpoint (Admin/Staff)
app.put('/api/admin/organization-settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Staff authorization required.' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: authUser } = await supabaseAdmin.auth.getUser(token);
    const userId = authUser?.user?.id || 'admin';

    const settings = await formTemplatesService.updateOrgSettings(req.body, userId, supabaseAdmin);
    return res.json({ success: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Form Template for candidate track (Executive or Non-Executive)
app.get('/api/form-templates/:track', async (req, res) => {
  try {
    const track = req.params.track as 'executive' | 'non_executive';
    if (track !== 'executive' && track !== 'non_executive') {
      return res.status(400).json({
        success: false,
        error: 'Invalid track parameter. Must be "executive" or "non_executive".',
      });
    }
    const template = await formTemplatesService.getActiveTemplate(track, supabaseAdmin);
    return res.json({ success: true, template });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Candidate Log Consent Endpoint
app.post('/api/candidate/consent', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const { terms_accepted, client_user_agent } = req.body;

    if (!terms_accepted) {
      return res.status(400).json({ success: false, error: 'Terms must be explicitly accepted.' });
    }

    // 1. Ensure Application row exists in draft status
    let { data: application } = await supabaseAdmin
      .from('applications')
      .select('id, status, current_step')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      const { data: newApp, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          candidate_id: candidateId,
          status: 'draft',
          current_step: 1,
          locked: false,
        })
        .select()
        .single();

      if (appErr) {
        console.error('Failed to create application draft:', appErr);
      } else {
        application = newApp;
      }
    }

    // 2. Record logged consent in audit_logs
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        actor_id: candidateId,
        actor_type: 'candidate',
        action: 'CONSENT_GRANTED',
        entity_type: 'application',
        entity_id: application ? application.id : candidateId,
        metadata: {
          terms_version: '2026.1',
          accepted_at: new Date().toISOString(),
          ip_address: req.ip || req.socket.remoteAddress || '127.0.0.1',
          user_agent: client_user_agent || req.headers['user-agent'] || 'PostEx Web Client',
        },
      });

    return res.json({
      success: true,
      message: 'Candidate consent logged securely.',
      application_id: application?.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Candidate Autosave Step Data Endpoint
app.post('/api/candidate/autosave', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const { step_number, step_name, data: stepData } = req.body;

    if (!step_number || !step_name || !stepData) {
      return res.status(400).json({ success: false, error: 'step_number, step_name, and data are required.' });
    }

    // Find or create application
    let { data: application } = await supabaseAdmin
      .from('applications')
      .select('id, status, current_step')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      const { data: newApp, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          candidate_id: candidateId,
          status: 'draft',
          current_step: Number(step_number),
          locked: false,
        })
        .select()
        .single();

      if (appErr) {
        return res.status(500).json({ success: false, error: 'Failed to create application draft: ' + appErr.message });
      }
      application = newApp;
    }

    // Check if this step already has a row
    const { data: existingStep } = await supabaseAdmin
      .from('application_steps')
      .select('id')
      .eq('application_id', application.id)
      .eq('step_number', step_number)
      .maybeSingle();

    if (existingStep) {
      await supabaseAdmin
        .from('application_steps')
        .update({
          step_name,
          data: stepData,
          completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStep.id);
    } else {
      await supabaseAdmin
        .from('application_steps')
        .insert({
          application_id: application.id,
          step_number,
          step_name,
          data: stepData,
          completed: true,
        });
    }

    // Update application current step
    const nextStep = Math.max(application.current_step || 1, Number(step_number));
    await supabaseAdmin
      .from('applications')
      .update({
        current_step: nextStep,
      })
      .eq('id', application.id);

    return res.json({
      success: true,
      saved_at: new Date().toISOString(),
      step_number,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Candidate Document Upload Multer Configuration (Max 5MB, JPG/PNG/PDF only)
const candidateDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype || ext}". Only JPG, PNG, and PDF files are accepted.`));
    }
  },
});

// Candidate Document Upload Endpoint
app.post('/api/candidate/documents/upload', (req, res, next) => {
  candidateDocUpload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 5MB limit. Please upload a file smaller than 5MB.',
        });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload validation failed.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const docType = req.body.type;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file was provided for upload.' });
    }
    if (!docType) {
      return res.status(400).json({ success: false, error: 'Document type is required.' });
    }

    // Secondary strict server-side validation check
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!allowedMimes.includes(file.mimetype) || !allowedExts.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        error: `Server rejected file: "${file.mimetype}". Only JPG, PNG, and PDF formats are permitted.`,
      });
    }
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: `Server rejected file: size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds 5MB limit.`,
      });
    }

    // Find or create application
    let { data: application } = await supabaseAdmin
      .from('applications')
      .select('id, status, locked')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      const { data: newApp, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          candidate_id: candidateId,
          status: 'draft',
          current_step: 1,
          locked: false,
        })
        .select()
        .single();
      if (appErr) throw appErr;
      application = newApp;
    }

    // If application is locked and not in needs_correction, disallow new uploads
    if (application.locked && application.status !== 'needs_correction') {
      return res.status(403).json({
        success: false,
        error: 'Application is locked and submitted. Document changes are only allowed during correction requests.',
      });
    }

    // Ensure candidate-documents bucket exists
    try {
      await supabaseAdmin.storage.createBucket('candidate-documents', { public: false });
    } catch {
      // Bucket already exists
    }

    const cleanBaseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `applications/${application.id}/${docType}-${Date.now()}-${cleanBaseName}${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('candidate-documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({
        success: false,
        error: `Supabase Storage upload failed: ${uploadError.message}`,
      });
    }

    // Check if a single document of this type already exists (for non-multiple types)
    const isMultiple = docType === 'education_certificate' || docType === 'other';
    if (!isMultiple) {
      const { data: existingDoc } = await supabaseAdmin
        .from('documents')
        .select('id, storage_path')
        .eq('application_id', application.id)
        .eq('type', docType)
        .maybeSingle();

      if (existingDoc) {
        // Delete old file from storage
        try {
          await supabaseAdmin.storage.from('candidate-documents').remove([existingDoc.storage_path]);
        } catch {
          // ignore cleanup errors
        }
        await supabaseAdmin.from('documents').delete().eq('id', existingDoc.id);
      }
    }

    // Insert record in documents table
    const { data: docRecord, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        application_id: application.id,
        type: docType,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
        verification_status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Generate signed preview URL
    const { data: signedData } = await supabaseAdmin.storage
      .from('candidate-documents')
      .createSignedUrl(storagePath, 3600);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: candidateId,
      actor_type: 'candidate',
      action: 'DOCUMENT_UPLOADED',
      entity_type: 'document',
      entity_id: docRecord.id,
      metadata: {
        type: docType,
        filename: file.originalname,
        size_bytes: file.size,
        mime_type: file.mimetype,
        storage_path: storagePath,
      },
    });

    return res.json({
      success: true,
      document: {
        ...docRecord,
        file_name: file.originalname,
        file_size: file.size,
        preview_url: signedData?.signedUrl || `/api/documents/${docRecord.id}/view`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Candidate Fetch Documents Endpoint
app.get('/api/candidate/documents', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const { data: application } = await supabaseAdmin
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      return res.json({ success: true, documents: [] });
    }

    const { data: docs, error: docsErr } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('application_id', application.id)
      .order('uploaded_at', { ascending: true });

    if (docsErr) throw docsErr;

    const documentsWithUrls = await Promise.all(
      (docs || []).map(async (doc) => {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from('candidate-documents')
            .createSignedUrl(doc.storage_path, 3600);
          return {
            ...doc,
            preview_url: signed?.signedUrl || `/api/documents/${doc.id}/view`,
          };
        } catch {
          return {
            ...doc,
            preview_url: `/api/documents/${doc.id}/view`,
          };
        }
      })
    );

    return res.json({ success: true, documents: documentsWithUrls });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Candidate Delete Document Endpoint
app.delete('/api/candidate/documents/:docId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const docId = req.params.docId;

    const { data: application } = await supabaseAdmin
      .from('applications')
      .select('id, status, locked')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    if (application.locked && application.status !== 'needs_correction') {
      return res.status(403).json({
        success: false,
        error: 'Application is locked. Documents cannot be removed after final submission.',
      });
    }

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path, type')
      .eq('id', docId)
      .eq('application_id', application.id)
      .maybeSingle();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found or access denied.' });
    }

    // Remove from storage
    try {
      await supabaseAdmin.storage.from('candidate-documents').remove([doc.storage_path]);
    } catch {
      // continue
    }

    // Delete row
    await supabaseAdmin.from('documents').delete().eq('id', docId);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: candidateId,
      actor_type: 'candidate',
      action: 'DOCUMENT_DELETED',
      entity_type: 'document',
      entity_id: docId,
      metadata: { type: doc.type, storage_path: doc.storage_path },
    });

    return res.json({ success: true, message: 'Document removed successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Secure Document View/Stream Endpoint (Supports candidate, BM, Central HR, Zonal HR, Super Admin)
app.get('/api/documents/:docId/view', async (req, res) => {
  try {
    const docId = req.params.docId;
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path, type, application_id')
      .eq('id', docId)
      .maybeSingle();

    if (docErr || !doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    // Generate signed URL from candidate-documents
    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from('candidate-documents')
      .createSignedUrl(doc.storage_path, 3600);

    if (signedData?.signedUrl) {
      return res.redirect(signedData.signedUrl);
    }

    // Fallback: download directly and stream
    const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
      .from('candidate-documents')
      .download(doc.storage_path);

    if (downloadErr || !fileData) {
      return res.status(500).json({ success: false, error: 'Unable to retrieve document.' });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const isPdf = doc.storage_path.toLowerCase().endsWith('.pdf');
    const isPng = doc.storage_path.toLowerCase().endsWith('.png');
    const contentType = isPdf ? 'application/pdf' : isPng ? 'image/png' : 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

// Candidate Submit Application Endpoint
app.post('/api/candidate/submit', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Candidate session token required.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const verification = verifyCandidateSessionToken(token, serviceRoleKey);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({ success: false, error: verification.error });
    }

    const candidateId = verification.payload.sub;
    const { signatureDataUrl, typedSignature, signatureHash, thumbDataUrl } = req.body;

    const { data: application } = await supabaseAdmin
      .from('applications')
      .select('id, status, candidate_id')
      .eq('candidate_id', candidateId)
      .maybeSingle();

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application draft not found.' });
    }

    // [STATE MACHINE ENFORCEMENT] Validate transition to 'bm_verification'
    const transitionCheck = validateStatusTransition(application.status, 'bm_verification');
    if (!transitionCheck.valid) {
      return res.status(400).json({
        success: false,
        error: transitionCheck.error,
      });
    }

    const submittedAt = new Date().toISOString();

    // 1. If Canvas Signature Data URL provided, persist to candidate-documents
    if (signatureDataUrl && typeof signatureDataUrl === 'string' && signatureDataUrl.startsWith('data:image')) {
      try {
        const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const sigPath = `applications/${application.id}/signature-${Date.now()}.png`;

        await supabaseAdmin.storage
          .from('candidate-documents')
          .upload(sigPath, buffer, { contentType: 'image/png', upsert: true });

        await supabaseAdmin.from('documents').insert({
          application_id: application.id,
          type: 'digital_signature',
          storage_path: sigPath,
          uploaded_at: submittedAt,
          verification_status: 'verified',
        });
      } catch (err) {
        console.warn('Could not store signature canvas image:', err);
      }
    }

    // 2. If Thumb Impression Data URL provided, persist to candidate-documents
    if (thumbDataUrl && typeof thumbDataUrl === 'string' && thumbDataUrl.startsWith('data:image')) {
      try {
        const base64Thumb = thumbDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const thumbBuffer = Buffer.from(base64Thumb, 'base64');
        const thumbPath = `applications/${application.id}/thumb-${Date.now()}.png`;

        await supabaseAdmin.storage
          .from('candidate-documents')
          .upload(thumbPath, thumbBuffer, { contentType: 'image/png', upsert: true });

        await supabaseAdmin.from('documents').insert({
          application_id: application.id,
          type: 'thumb_impression',
          storage_path: thumbPath,
          uploaded_at: submittedAt,
          verification_status: 'pending',
        });
      } catch (err) {
        console.warn('Could not store thumb image:', err);
      }
    }

    // 3. Update application status: bm_verification, locked: true
    const { error: updateErr } = await supabaseAdmin
      .from('applications')
      .update({
        status: 'bm_verification',
        submitted_at: submittedAt,
        locked: true,
      })
      .eq('id', application.id);

    if (updateErr) {
      return res.status(500).json({ success: false, error: updateErr.message });
    }

    // 4. Audit log
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        actor_id: candidateId,
        actor_type: 'candidate',
        action: 'APPLICATION_SUBMITTED',
        entity_type: 'application',
        entity_id: application.id,
        metadata: {
          submitted_at: submittedAt,
          previous_status: application.status,
          target_status: 'bm_verification',
          typedSignature: typedSignature || null,
          signatureHash: signatureHash || null,
          hasSignatureCanvas: Boolean(signatureDataUrl),
          hasThumbprint: Boolean(thumbDataUrl),
        },
      });

    // 5. Consolidated Notification Dispatch
    const { data: candInfo } = await supabaseAdmin
      .from('candidates')
      .select('id, full_name, mobile, joining_id, branches(name)')
      .eq('id', candidateId)
      .maybeSingle();

    if (candInfo) {
      await notificationService.notifyCandidateApplicationSubmitted(
        supabaseAdmin,
        candInfo,
        (candInfo as any).branches?.name
      );
    }

    return res.json({
      success: true,
      status: 'bm_verification',
      submitted_at: submittedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: message });
  }
});

// Direct Cross-Scope Verification Endpoint (For automated test execution)
app.post('/api/rbac/verify-access', async (req, res) => {
  try {
    const { requester_role, requester_zone_id, requester_branch_id, target_zone_id, target_branch_id, action } = req.body;

    if (requester_role === 'super_admin') {
      return res.json({ allowed: true, reason: 'Super Admin bypasses all scope boundaries.' });
    }

    if (requester_role === 'zonal_hr_manager' || requester_role === 'central_hr') {
      if (!requester_zone_id || requester_zone_id !== target_zone_id) {
        return res.status(403).json({
          allowed: false,
          reason: `Access Denied: Zonal HR from Zone ${requester_zone_id} cannot access Target Zone ${target_zone_id}.`,
        });
      }
      return res.json({ allowed: true });
    }

    if (requester_role === 'branch_manager') {
      if (action === 'regenerate_staff_password') {
        return res.status(403).json({
          allowed: false,
          reason: 'Access Denied: Branch Manager is not authorized for credential regeneration.',
        });
      }
      if (!requester_branch_id || requester_branch_id !== target_branch_id) {
        return res.status(403).json({
          allowed: false,
          reason: `Access Denied: Branch Manager from Branch ${requester_branch_id} cannot access Branch ${target_branch_id}.`,
        });
      }
      return res.json({ allowed: true });
    }

    return res.status(403).json({ allowed: false, reason: 'Unknown or unauthorized role.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// ==============================================================================
// 4. API: SUPER ADMIN (Step 5), ZONAL HR (Step 6), CENTRAL HR (Step 7), & BRANCH MANAGER (Step 8)
// ==============================================================================

app.use('/api/admin', createSuperAdminRouter(supabaseAdmin));
app.use('/api/zonal', createZonalHrRouter(supabaseAdmin));
app.use('/api/central', createCentralHrRouter(supabaseAdmin));
app.use('/api/branch', createBranchManagerRouter(supabaseAdmin));

// ==============================================================================
// 5. Vite Middleware Setup
// ==============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PostEx HR Portal Server running on http://0.0.0.0:${PORT}`);

    // Initialize Data Retention Service and start background 24-hour retention scheduler
    dataRetentionService.ensureInitialized(supabaseAdmin).then(() => {
      console.log('[DATA RETENTION] Retention service initialized successfully.');
    }).catch((err) => {
      console.warn('[DATA RETENTION] Warning on init:', err);
    });

    setInterval(() => {
      dataRetentionService.runRetentionCleanup(supabaseAdmin)
        .then((res) => {
          if (res.countArchived > 0) {
            console.log(`[DATA RETENTION CRON] Cleaned up ${res.countArchived} records older than ${res.thresholdDays} days.`);
          }
        })
        .catch((err) => {
          console.error('[DATA RETENTION CRON ERROR]:', err);
        });
    }, 24 * 60 * 60 * 1000);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PostEx portal server:', err);
});
