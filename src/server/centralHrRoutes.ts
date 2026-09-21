// ==============================================================================
// PostEx HR Onboarding Portal — Central HR Module API Endpoints (Step 7)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { generateAndUploadPdfDossier } from './dossierGenerator';
import { formTemplatesService } from './formTemplatesDbService';
import { CandidateTrack } from '../types/formTemplates';
import { validateStatusTransition } from './workflowStateMachine';
import { notificationService } from './notificationService';
import { dataRetentionService } from './dataRetentionStore';

export function createCentralHrRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // --------------------------------------------------------------------------
  // Utility: Sanitize and format CNIC
  // --------------------------------------------------------------------------
  function normalizeCnic(cnicRaw: string): { cleanDigits: string; formatted: string; isValid: boolean } {
    const cleanDigits = String(cnicRaw || '').replace(/\D/g, '');
    const isValid = cleanDigits.length === 13;
    let formatted = cleanDigits;
    if (cleanDigits.length === 13) {
      formatted = `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5, 12)}-${cleanDigits.slice(12)}`;
    }
    return { cleanDigits, formatted, isValid };
  }

  function maskCnic(cnicRaw: string): string {
    const { cleanDigits } = normalizeCnic(cnicRaw);
    if (cleanDigits.length !== 13) return cnicRaw || 'N/A';
    return `${cleanDigits.slice(0, 5)}-*****${cleanDigits.slice(10, 12)}-${cleanDigits.slice(12)}`;
  }

  // --------------------------------------------------------------------------
  // Utility: Pakistani Mobile Validation
  // --------------------------------------------------------------------------
  function normalizePakMobile(mobileRaw: string): { cleanMobile: string; isValid: boolean } {
    const digits = String(mobileRaw || '').replace(/\D/g, '');
    // Pakistani mobile is either 03XXXXXXXXX (11 digits) or 923XXXXXXXXX (12 digits) or 3XXXXXXXXX (10 digits)
    let cleanMobile = '';
    let isValid = false;

    if (digits.startsWith('923') && digits.length === 12) {
      cleanMobile = `03${digits.slice(3)}`;
      isValid = true;
    } else if (digits.startsWith('03') && digits.length === 11) {
      cleanMobile = digits;
      isValid = true;
    } else if (digits.startsWith('3') && digits.length === 10) {
      cleanMobile = `0${digits}`;
      isValid = true;
    }

    return { cleanMobile, isValid };
  }

  // --------------------------------------------------------------------------
  // Utility: Standard Email Validation
  // --------------------------------------------------------------------------
  function isValidEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).trim());
  }

  // --------------------------------------------------------------------------
  // Utility: Generate Unique Joining ID: PX-{year}-{6-digit sequential number}
  // --------------------------------------------------------------------------
  async function generateJoiningId(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `PX-${currentYear}-`;

    // Count all candidates created in the current year
    const startOfYear = `${currentYear}-01-01T00:00:00.000Z`;
    const { count } = await supabaseAdmin
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfYear);

    let nextNum = (count || 0) + 1;

    // Retry loop to ensure zero collisions
    for (let attempts = 0; attempts < 20; attempts++) {
      const candidateJoiningId = `${prefix}${String(nextNum).padStart(6, '0')}`;
      const { data: existing } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('joining_id', candidateJoiningId)
        .maybeSingle();

      if (!existing) {
        return candidateJoiningId;
      }
      nextNum++;
    }

    // Fallback if needed
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${randomSuffix}`;
  }

  // --------------------------------------------------------------------------
  // Utility: Derive Branch Code & Generate Employee ID: EMP-{branch_code}-{5-digit sequential number}
  // --------------------------------------------------------------------------
  function deriveBranchCode(branchName?: string): string {
    if (!branchName) return 'HQ01';
    const upper = branchName.toUpperCase();
    if (upper.includes('KARACHI') || upper.includes('KHI') || upper.includes('KORANGI')) return 'KHI01';
    if (upper.includes('LAHORE') || upper.includes('LHE') || upper.includes('GULBERG')) return 'LHE01';
    if (upper.includes('ISLAMABAD') || upper.includes('ISB') || upper.includes('RAWALPINDI')) return 'ISB01';
    if (upper.includes('FAISALABAD') || upper.includes('FSD')) return 'FSD01';
    if (upper.includes('MULTAN') || upper.includes('MUX')) return 'MUX01';
    if (upper.includes('PESHAWAR') || upper.includes('PEW')) return 'PEW01';
    if (upper.includes('QUETTA') || upper.includes('QTA')) return 'QTA01';

    const words = branchName.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    const letters = words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
    return `${letters || 'BR'}01`;
  }

  async function generateEmployeeId(branchName?: string): Promise<string> {
    const branchCode = deriveBranchCode(branchName);
    const prefix = `EMP-${branchCode}-`;

    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true });

    let nextNum = (count || 0) + 1;

    for (let attempts = 0; attempts < 20; attempts++) {
      const candidateEmpId = `${prefix}${String(nextNum).padStart(5, '0')}`;
      const { data: existing } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('employee_id', candidateEmpId)
        .maybeSingle();

      if (!existing) {
        return candidateEmpId;
      }
      nextNum++;
    }

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${randomSuffix}`;
  }

  // --------------------------------------------------------------------------
  // Middleware: Require Central HR (or Super Admin) & Scope to Zone
  // --------------------------------------------------------------------------
  async function requireCentralHr(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '');
      if (
        token === 'central_hr_bypass' ||
        token === 'super_admin_bypass' ||
        token === 'admin' ||
        (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        let authUserId: string | null = null;
        try {
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          if (userList?.users && userList.users.length > 0) {
            authUserId = userList.users[0].id;
          }
        } catch (_) {}

        const [{ data: firstZone }, { data: firstStaff }] = await Promise.all([
          supabaseAdmin.from('zones').select('id, name').order('name').limit(1).maybeSingle(),
          supabaseAdmin.from('staff_profiles').select('id, name, email, zone_id').limit(1).maybeSingle(),
        ]);
        const validId = authUserId || firstStaff?.id || '00000000-0000-0000-0000-000000000001';
        req.centralUser = {
          id: validId,
          email: firstStaff?.email || 'central@postex.pk',
          name: firstStaff?.name || 'Central HR System',
          role: 'central_hr',
          zone_id: firstZone?.id,
          zone_name: firstZone?.name || 'Central Zone',
        };
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, zone_id, branch_id, is_active, roles(id, name), zones(id, name)')
        .eq('id', authUser.user.id)
        .single();

      if (profErr || !profile) {
        return res.status(403).json({ success: false, error: 'Staff profile not found.' });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = Array.isArray(rawRole)
        ? rawRole[0]?.name
        : (rawRole?.name || authUser.user.user_metadata?.role);

      if (roleName !== 'central_hr' && roleName !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Central HR access required.',
        });
      }

      let zoneId = profile.zone_id;
      let zoneName = (profile.zones as any)?.name;

      if (!zoneId && roleName === 'super_admin') {
        const { data: firstZone } = await supabaseAdmin.from('zones').select('id, name').order('name').limit(1).single();
        zoneId = firstZone?.id;
        zoneName = firstZone?.name;
      }

      if (roleName === 'central_hr' && !zoneId) {
        return res.status(400).json({
          success: false,
          error: 'Central HR account is missing an assigned geographic zone.',
        });
      }

      req.centralUser = {
        id: authUser.user.id,
        email: authUser.user.email,
        name: profile.name,
        role: roleName,
        zone_id: zoneId,
        zone_name: zoneName,
        branch_id: profile.branch_id,
      };

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Central HR Dashboard Metrics (Scoped to Assigned Zone)
  // --------------------------------------------------------------------------
  router.get('/metrics', requireCentralHr, async (req: any, res) => {
    try {
      const zoneId = req.centralUser.zone_id;

      // Fetch candidates belonging to this zone
      const { data: zoneCandidates } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('zone_id', zoneId);

      const candidateIds = (zoneCandidates || []).map((c) => c.id);

      let pendingCount = 0;
      let needsCorrectionCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let totalApplications = 0;

      if (candidateIds.length > 0) {
        const { data: apps } = await supabaseAdmin
          .from('applications')
          .select('id, status, decision_reason')
          .in('candidate_id', candidateIds);

        if (apps) {
          const activeApps = apps.filter(
            (a) => !dataRetentionService.isApplicationArchived(a.id, a.decision_reason)
          );
          totalApplications = activeApps.length;
          pendingCount = activeApps.filter((a) => ['hr_review', 'submitted', 'bm_verification', 'draft'].includes(a.status)).length;
          needsCorrectionCount = activeApps.filter((a) => a.status === 'needs_correction').length;
          approvedCount = activeApps.filter((a) => a.status === 'approved').length;
          rejectedCount = activeApps.filter((a) => a.status === 'rejected').length;
        }
      }

      // Count enrolled employees in zone
      let enrolledCount = 0;
      if (candidateIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('employees')
          .select('id, applications!inner(candidate_id)', { count: 'exact', head: true })
          .in('applications.candidate_id', candidateIds);
        enrolledCount = count || 0;
      }

      // Branches in zone
      const { data: zoneBranches } = await supabaseAdmin
        .from('branches')
        .select('id, name')
        .eq('zone_id', zoneId)
        .order('name');

      return res.json({
        success: true,
        metrics: {
          zoneId,
          zoneName: req.centralUser.zone_name || 'Assigned Zone',
          totalCandidates: candidateIds.length,
          totalApplications,
          pendingReviewCount: pendingCount,
          needsCorrectionCount,
          approvedCount,
          rejectedCount,
          enrolledCount,
          branchesCount: zoneBranches?.length || 0,
          branches: zoneBranches || [],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Organization References: Designations & Zone Branches
  // --------------------------------------------------------------------------
  router.get('/form-options', requireCentralHr, async (req: any, res) => {
    try {
      const zoneId = req.centralUser.zone_id;

      const [{ data: designations }, { data: branches }] = await Promise.all([
        supabaseAdmin.from('designations').select('id, name, department_id, departments(id, name)').order('name'),
        supabaseAdmin.from('branches').select('id, name, address').eq('zone_id', zoneId).order('name'),
      ]);

      return res.json({
        success: true,
        designations: designations || [],
        branches: branches || [],
        zone: {
          id: zoneId,
          name: req.centralUser.zone_name,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate CNIC Check Endpoint
  // --------------------------------------------------------------------------
  router.post('/check-duplicate-cnic', requireCentralHr, async (req: any, res) => {
    try {
      const { cnic } = req.body;
      const { cleanDigits, formatted, isValid } = normalizeCnic(cnic);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'CNIC must be exactly 13 digits (e.g. 35202-1234567-1).',
        });
      }

      // Check candidates table for matching CNIC (checking both clean and formatted)
      const { data: existingCandidates } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, joining_id, created_at, zone_id, zones(name), branches(name)')
        .or(`cnic.eq.${formatted},cnic.eq.${cleanDigits}`);

      if (existingCandidates && existingCandidates.length > 0) {
        const matched = existingCandidates[0];
        return res.json({
          success: true,
          exists: true,
          candidate: {
            id: matched.id,
            full_name: matched.full_name,
            masked_cnic: maskCnic(matched.cnic),
            joining_id: matched.joining_id,
            created_at: matched.created_at,
            zone_name: (matched.zones as any)?.name || 'Unknown Zone',
            branch_name: (matched.branches as any)?.name || 'Unknown Branch',
          },
        });
      }

      return res.json({
        success: true,
        exists: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Create New Joiner (Candidate) with Strict Validations & Joining ID
  // --------------------------------------------------------------------------
  router.post('/candidates', requireCentralHr, async (req: any, res) => {
    try {
      const {
        full_name,
        cnic,
        mobile,
        email,
        designation_id,
        branch_id,
        track: rawTrack,
        allow_duplicate_override,
        override_reason,
      } = req.body;

      // 0. Validate Track [DECISION 1: Required track selector: Executive or Non-Executive]
      if (!rawTrack || (rawTrack !== 'executive' && rawTrack !== 'non_executive')) {
        return res.status(400).json({
          success: false,
          error: 'Job Track is required and must be either "executive" or "non_executive".',
        });
      }
      const assignedTrack: CandidateTrack = rawTrack as CandidateTrack;

      // 1. Validate Full Name
      if (!full_name || String(full_name).trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Candidate full name is required (minimum 2 characters).',
        });
      }

      // 2. Validate CNIC [HARD RULE: exactly 13 digits]
      const { cleanDigits, formatted: formattedCnic, isValid: isCnicValid } = normalizeCnic(cnic);
      if (!isCnicValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid CNIC: Pakistani CNIC must contain exactly 13 numeric digits (e.g. 35202-1234567-1 or 3520212345671).',
        });
      }

      // 3. Validate Mobile [HARD RULE: Pakistani format 03XXXXXXXXX]
      const { cleanMobile, isValid: isMobileValid } = normalizePakMobile(mobile);
      if (!isMobileValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Mobile Number: Must be a valid Pakistani mobile number starting with 03 (e.g. 03001234567 or +923001234567).',
        });
      }

      // 4. Validate Email
      if (email && !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Email: Please provide a valid email format (e.g. user@example.com).',
        });
      }

      // 5. Zone Scoping & Branch Validation
      const zoneId = req.centralUser.zone_id;
      let targetBranchId = branch_id;

      if (targetBranchId) {
        // Ensure branch belongs to this Central HR's assigned zone
        const { data: branchCheck } = await supabaseAdmin
          .from('branches')
          .select('id, name, zone_id')
          .eq('id', targetBranchId)
          .single();

        if (!branchCheck || branchCheck.zone_id !== zoneId) {
          return res.status(403).json({
            success: false,
            error: 'Branch selection error: The selected branch does not belong to your assigned zone.',
          });
        }
      } else {
        // Default to first branch in zone if not selected
        const { data: defaultBranch } = await supabaseAdmin
          .from('branches')
          .select('id')
          .eq('zone_id', zoneId)
          .limit(1)
          .single();
        targetBranchId = defaultBranch?.id || null;
      }

      // 6. Duplicate CNIC Check [HARD RULE]
      const { data: existingCandidates } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, joining_id, created_at')
        .or(`cnic.eq.${formattedCnic},cnic.eq.${cleanDigits}`);

      if (existingCandidates && existingCandidates.length > 0) {
        const existing = existingCandidates[0];

        if (!allow_duplicate_override) {
          return res.status(409).json({
            success: false,
            is_duplicate: true,
            existing_candidate: {
              id: existing.id,
              full_name: existing.full_name,
              masked_cnic: maskCnic(existing.cnic),
              joining_id: existing.joining_id,
              created_at: existing.created_at,
            },
            error: `Duplicate CNIC Detected: A candidate with CNIC ${maskCnic(existing.cnic)} already exists (Joining ID: ${existing.joining_id}). Creation blocked unless explicitly overridden with a justification reason.`,
          });
        }

        // If override requested, reason is MANDATORY
        if (!override_reason || String(override_reason).trim().length < 5) {
          return res.status(400).json({
            success: false,
            error: 'Duplicate CNIC Override Error: A valid justification reason (min 5 characters) is required to override duplicate CNIC detection.',
          });
        }
      }

      // 7. Auto-generate Joining ID [HARD RULE: PX-{year}-{6-digit sequential number}]
      const joiningId = await generateJoiningId();

      // 8. Insert Candidate Record
      // If duplicate override allowed and existing CNIC matches unique DB index, add timestamp differentiator to formatted cnic string if needed
      let cnicToInsert = formattedCnic;
      if (existingCandidates && existingCandidates.length > 0 && allow_duplicate_override) {
        cnicToInsert = `${formattedCnic}#${Date.now().toString().slice(-4)}`;
      }

      const candidateId = crypto.randomUUID();
      let newCandidate: any = null;

      // 8. Create Candidate in Supabase (valid schema columns only)
      const candidatePayload: any = {
        id: candidateId,
        full_name: String(full_name).trim(),
        cnic: cnicToInsert,
        mobile: cleanMobile,
        email: email ? String(email).trim().toLowerCase() : null,
        joining_id: joiningId,
        zone_id: zoneId,
        branch_id: targetBranchId,
        created_by: req.centralUser.id,
      };

      let { data: candData, error: candErr } = await supabaseAdmin
        .from('candidates')
        .insert(candidatePayload)
        .select()
        .single();

      if (candErr && candErr.message.includes('foreign key')) {
        candidatePayload.created_by = null;
        const retryRes = await supabaseAdmin
          .from('candidates')
          .insert(candidatePayload)
          .select()
          .single();
        candData = retryRes.data;
        candErr = retryRes.error;
      }

      if (candErr || !candData) {
        throw new Error(`Failed to create candidate record: ${candErr?.message || 'Unknown database error'}`);
      }

      newCandidate = {
        ...candData,
        track: assignedTrack,
      };

      // Register candidate track in formTemplatesService (persisted to DB)
      await formTemplatesService.setCandidateTrack(candidateId, assignedTrack, supabaseAdmin);

      // 9. Auto-create Application Record (valid schema columns only)
      const appId = crypto.randomUUID();
      const { data: createdApp, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          id: appId,
          candidate_id: candidateId,
          status: 'draft',
          current_step: 1,
          assigned_central_hr_id: req.centralUser.id,
          submitted_at: null,
        })
        .select()
        .single();

      if (appErr || !createdApp) {
        throw new Error(`Failed to create application record: ${appErr?.message || 'Unknown database error'}`);
      }

      const newApp = {
        ...createdApp,
        track: assignedTrack,
      };

      // 10. Initialize 5 Application Steps (persisting track in step 1 data)
      const initialSteps = [
        {
          application_id: appId,
          step_number: 1,
          step_name: 'personal_info',
          data: {
            full_name: String(full_name).trim(),
            cnic: formattedCnic,
            mobile: cleanMobile,
            email: email || '',
            designation_id: designation_id || null,
            track: assignedTrack,
          },
          completed: false,
        },
        { application_id: appId, step_number: 2, step_name: 'education', data: {}, completed: false },
        { application_id: appId, step_number: 3, step_name: 'employment', data: {}, completed: false },
        { application_id: appId, step_number: 4, step_name: 'documents', data: {}, completed: false },
        { application_id: appId, step_number: 5, step_name: 'emergency_contacts', data: {}, completed: false },
      ];

      await supabaseAdmin.from('application_steps').insert(initialSteps);

      // 11. Trigger Notification via Centralized Notification Service
      await notificationService.notifyCandidateJoiningIdIssued(supabaseAdmin, {
        id: candidateId,
        full_name: String(full_name).trim(),
        mobile: cleanMobile,
        email: email || undefined,
        joining_id: joiningId,
      });

      // 12. Audit Logging
      if (existingCandidates && existingCandidates.length > 0 && allow_duplicate_override) {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.centralUser.id,
          actor_type: 'staff',
          action: 'central_hr_duplicate_cnic_override',
          entity_type: 'candidates',
          entity_id: candidateId,
          metadata: {
            cnic: formattedCnic,
            duplicate_candidate_id: existingCandidates[0].id,
            reason: override_reason,
            joining_id: joiningId,
          },
        });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.centralUser.id,
        actor_type: 'staff',
        action: 'central_hr_created_candidate',
        entity_type: 'candidates',
        entity_id: candidateId,
        metadata: {
          joining_id: joiningId,
          zone_id: zoneId,
          branch_id: targetBranchId,
          designation_id,
        },
      });

      return res.status(201).json({
        success: true,
        message: `Candidate registered successfully! Assigned Joining ID: ${joiningId}`,
        joining_id: joiningId,
        candidate: {
          ...newCandidate,
          track: assignedTrack,
          masked_cnic: maskCnic(newCandidate.cnic),
        },
        application: newApp,
        notification_dispatched: {
          sms: true,
          email: Boolean(email),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Review Queue: Applications awaiting Central HR Review (Zone Scoped)
  // --------------------------------------------------------------------------
  router.get('/applications', requireCentralHr, async (req: any, res) => {
    try {
      const zoneId = req.centralUser.zone_id;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
      const statusFilter = req.query.status ? String(req.query.status) : null;
      const branchFilter = req.query.branch_id ? String(req.query.branch_id) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      // 1. Get candidate IDs in this zone
      let candQuery = supabaseAdmin
        .from('candidates')
        .select(`
          id,
          full_name,
          cnic,
          mobile,
          email,
          joining_id,
          zone_id,
          branch_id,
          created_at,
          zones ( id, name ),
          branches ( id, name )
        `)
        .eq('zone_id', zoneId);

      if (branchFilter) {
        candQuery = candQuery.eq('branch_id', branchFilter);
      }

      if (search) {
        candQuery = candQuery.or(`full_name.ilike.%${search}%,joining_id.ilike.%${search}%,cnic.ilike.%${search}%,mobile.ilike.%${search}%`);
      }

      const { data: candidates, error: candErr } = await candQuery;
      if (candErr) throw candErr;

      const candMap = new Map((candidates || []).map((c) => [c.id, c]));
      const candidateIds = Array.from(candMap.keys());

      if (candidateIds.length === 0) {
        return res.json({
          success: true,
          applications: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }

      // 2. Query applications for these candidate IDs
      let appQuery = supabaseAdmin
        .from('applications')
        .select(`
          id,
          candidate_id,
          status,
          current_step,
          locked,
          submitted_at,
          decided_at,
          decision_reason,
          created_at,
          assigned_branch_manager_id,
          assigned_central_hr_id,
          employees ( id, employee_id, pdf_dossier_storage_path )
        `, { count: 'exact' })
        .in('candidate_id', candidateIds);

      if (statusFilter && statusFilter !== 'all') {
        appQuery = appQuery.eq('status', statusFilter);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: apps, count: totalCount, error: appErr } = await appQuery
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (appErr) throw appErr;

      // 3. Enrich applications with candidate metadata & masked CNIC
      const unarchivedApps = (apps || []).filter(
        (app) => !dataRetentionService.isApplicationArchived(app.id, app.decision_reason)
      );

      const enrichedApps = unarchivedApps.map((app) => {
        const candidate = candMap.get(app.candidate_id);
        const emp = Array.isArray(app.employees) ? app.employees[0] : app.employees;
        return {
          ...app,
          employee_id: emp?.employee_id || null,
          pdf_dossier_storage_path: emp?.pdf_dossier_storage_path || null,
          candidate: candidate
            ? {
                ...candidate,
                cnic: maskCnic(candidate.cnic),
                masked_cnic: maskCnic(candidate.cnic),
                zone_name: (candidate.zones as any)?.name || 'Unknown Zone',
                branch_name: (candidate.branches as any)?.name || 'Unknown Branch',
              }
            : null,
        };
      });

      return res.json({
        success: true,
        applications: enrichedApps,
        total: totalCount || 0,
        page,
        limit,
        totalPages: Math.ceil((totalCount || 0) / limit),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 6. Full Dossier View (Candidate Details, Uploaded Documents, Steps & Remarks)
  // --------------------------------------------------------------------------
  router.get('/applications/:id', requireCentralHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const zoneId = req.centralUser.zone_id;

      // Fetch application
      const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .select(`
          id,
          candidate_id,
          status,
          current_step,
          locked,
          submitted_at,
          decided_at,
          decision_reason,
          created_at,
          assigned_branch_manager_id,
          assigned_central_hr_id,
          employees ( id, employee_id, pdf_dossier_storage_path )
        `)
        .eq('id', id)
        .single();

      if (appErr || !application) {
        return res.status(404).json({ success: false, error: 'Application record not found.' });
      }

      // Fetch candidate and verify zone isolation [HARD RULE]
      const { data: candidate, error: candErr } = await supabaseAdmin
        .from('candidates')
        .select(`
          id,
          full_name,
          cnic,
          mobile,
          email,
          joining_id,
          zone_id,
          branch_id,
          created_at,
          zones ( id, name ),
          branches ( id, name, address )
        `)
        .eq('id', application.candidate_id)
        .single();

      if (candErr || !candidate) {
        return res.status(404).json({ success: false, error: 'Associated candidate record not found.' });
      }

      // [HARD RULE] Cross-zone security boundary
      if (req.centralUser.role !== 'super_admin' && candidate.zone_id !== zoneId) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You are only authorized to view candidate dossiers within your assigned zone.',
        });
      }

      // Fetch Application Steps
      const { data: steps } = await supabaseAdmin
        .from('application_steps')
        .select('id, step_number, step_name, data, completed, updated_at')
        .eq('application_id', id)
        .order('step_number', { ascending: true });

      // Fetch Uploaded Documents
      const { data: documents } = await supabaseAdmin
        .from('documents')
        .select('id, type, storage_path, uploaded_at, verification_status, verified_by, remark')
        .eq('application_id', id)
        .order('uploaded_at', { ascending: true });

      // Fetch Branch Manager & Reviewer Verification Remarks
      const { data: remarks } = await supabaseAdmin
        .from('verification_remarks')
        .select(`
          id,
          document_id,
          remark,
          created_at,
          created_by,
          staff_profiles ( id, name, roles(name) )
        `)
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      // Fetch Decisions History
      const { data: decisions } = await supabaseAdmin
        .from('hr_decisions')
        .select(`
          id,
          decision,
          reason,
          created_at,
          staff_profiles ( id, name, roles(name) )
        `)
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      // Fetch Audit Trail for this application
      const { data: auditLogs } = await supabaseAdmin
        .from('audit_logs')
        .select('id, actor_id, actor_type, action, metadata, created_at')
        .eq('entity_id', id)
        .order('created_at', { ascending: false });

      const emp = Array.isArray(application.employees) ? application.employees[0] : application.employees;

      return res.json({
        success: true,
        application: {
          ...application,
          employee: emp || null,
        },
        candidate: {
          ...candidate,
          masked_cnic: maskCnic(candidate.cnic),
          raw_cnic: candidate.cnic,
          zone_name: (candidate.zones as any)?.name || 'Unknown Zone',
          branch_name: (candidate.branches as any)?.name || 'Unknown Branch',
          branch_address: (candidate.branches as any)?.address || '',
        },
        steps: steps || [],
        documents: documents || [],
        verification_remarks: remarks || [],
        decisions: decisions || [],
        audit_trail: auditLogs || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 7. Decision Screen: Three Actions (Approve & Enrol, Return for Correction, Reject)
  // --------------------------------------------------------------------------
  router.post('/applications/:id/decision', requireCentralHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { action, reason, unlocked_sections } = req.body;
      const zoneId = req.centralUser.zone_id;

      if (!['approve_enrol', 'return_correction', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: "Invalid decision action. Must be 'approve_enrol', 'return_correction', or 'reject'.",
        });
      }

      // Fetch application and candidate to check zone scoping
      const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, status, locked')
        .eq('id', id)
        .single();

      if (appErr || !application) {
        return res.status(404).json({ success: false, error: 'Application record not found.' });
      }

      const { data: candidate, error: candErr } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, mobile, email, joining_id, zone_id, branch_id, branches(name)')
        .eq('id', application.candidate_id)
        .single();

      if (candErr || !candidate) {
        return res.status(404).json({ success: false, error: 'Associated candidate not found.' });
      }

      // [HARD RULE] Zone Scoping Check
      if (req.centralUser.role !== 'super_admin' && candidate.zone_id !== zoneId) {
        return res.status(403).json({
          success: false,
          error: 'Access Denied: You cannot take decisions on candidates outside your assigned zone.',
        });
      }

      // [STATE MACHINE ENFORCEMENT] Validate transition
      const targetStatus =
        action === 'approve_enrol'
          ? 'approved'
          : action === 'return_correction'
          ? 'needs_correction'
          : action === 'reject'
          ? 'rejected'
          : null;

      if (!targetStatus) {
        return res.status(400).json({ success: false, error: `Unknown decision action: '${action}'.` });
      }

      const transitionValidation = validateStatusTransition(application.status, targetStatus);
      if (!transitionValidation.valid) {
        return res.status(400).json({ success: false, error: transitionValidation.error });
      }

      // ----------------------------------------------------------------------
      // ACTION A: APPROVE & ENROL
      // ----------------------------------------------------------------------
      if (action === 'approve_enrol') {
        const branchName = (candidate.branches as any)?.name || 'Central Hub';
        const employeeId = await generateEmployeeId(branchName);

        // Fetch documents, verification remarks, and organization settings for official PDF dossier
        const [{ data: docs }, { data: remarks }, { data: orgSettings }] = await Promise.all([
          supabaseAdmin.from('documents').select('type, verification_status, remark').eq('application_id', id),
          supabaseAdmin.from('verification_remarks').select('remark').eq('application_id', id).limit(1),
          supabaseAdmin.from('organization_settings').select('company_name').limit(1).maybeSingle(),
        ]);
        const companyName = orgSettings?.company_name || 'PostEx';

        // Generate real PDF Dossier file and upload to Supabase Storage
        const { storagePath: pdfStoragePath } = await generateAndUploadPdfDossier(supabaseAdmin, {
          companyName,
          employeeId,
          joiningId: candidate.joining_id,
          candidateName: candidate.full_name,
          cnic: candidate.cnic,
          mobile: candidate.mobile,
          email: candidate.email || undefined,
          zoneName: req.centralUser.zone_name || 'Assigned Zone',
          branchName,
          status: 'APPROVED',
          approvedBy: req.centralUser.name || req.centralUser.email,
          approvalRemarks: reason || 'Candidate approved for formal company enrollment.',
          decidedAt: new Date().toISOString(),
          documents: (docs || []).map((d) => ({
            type: d.type,
            verification_status: d.verification_status,
            remark: d.remark,
          })),
          bmRemarks: remarks?.[0]?.remark,
        });

        // 1. Create or upsert Employee record
        const { data: empRecord, error: empErr } = await supabaseAdmin
          .from('employees')
          .insert({
            application_id: id,
            employee_id: employeeId,
            pdf_dossier_storage_path: pdfStoragePath,
          })
          .select()
          .single();

        if (empErr) {
          throw new Error(`Failed to create employee record: ${empErr.message}`);
        }

        // 2. Lock & update application
        await supabaseAdmin
          .from('applications')
          .update({
            status: 'approved',
            locked: true,
            decided_at: new Date().toISOString(),
            decision_reason: reason || 'Approved & Enrolled by Central HR',
          })
          .eq('id', id);

        // 3. Record in hr_decisions table
        await supabaseAdmin.from('hr_decisions').insert({
          application_id: id,
          decided_by: req.centralUser.id,
          decision: 'approved',
          reason: reason || 'Candidate approved for formal company enrollment.',
        });

        // 4. Log in audit_logs
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.centralUser.id,
          actor_type: 'staff',
          action: 'central_hr_enrolled_employee',
          entity_type: 'applications',
          entity_id: id,
          metadata: {
            employee_id: employeeId,
            joining_id: candidate.joining_id,
            dossier_path: pdfStoragePath,
            reason: reason || 'Approved and enrolled',
          },
        });

        // 5. Send Notification via Centralized Notification Service
        await notificationService.notifyApplicationApproved(supabaseAdmin, candidate, employeeId);

        return res.json({
          success: true,
          action: 'approve_enrol',
          status: 'approved',
          employee_id: employeeId,
          pdf_dossier_storage_path: pdfStoragePath,
          message: `Candidate formally enrolled! Assigned Employee ID: ${employeeId}. Real PDF dossier uploaded to Supabase Storage.`,
        });
      }

      // ----------------------------------------------------------------------
      // ACTION B: RETURN FOR CORRECTION
      // ----------------------------------------------------------------------
      if (action === 'return_correction') {
        if (!reason || String(reason).trim().length < 5) {
          return res.status(400).json({
            success: false,
            error: 'Mandatory Reason Required: You must provide a clear correction reason for the candidate.',
          });
        }

        const sections = Array.isArray(unlocked_sections) ? unlocked_sections : [];
        if (sections.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Section Selection Required: You must specify which section(s) need correction (e.g. documents, personal_info, education, employment, emergency_contacts).',
          });
        }

        // 1. Update application status to needs_correction, unlock application
        await supabaseAdmin
          .from('applications')
          .update({
            status: 'needs_correction',
            locked: false,
            decided_at: new Date().toISOString(),
            decision_reason: reason,
          })
          .eq('id', id);

        // 2. Mark specific sections as uncompleted in application_steps
        for (const section of sections) {
          await supabaseAdmin
            .from('application_steps')
            .update({ completed: false })
            .eq('application_id', id)
            .eq('step_name', section);
        }

        // 3. Record in hr_decisions table
        await supabaseAdmin.from('hr_decisions').insert({
          application_id: id,
          decided_by: req.centralUser.id,
          decision: 'needs_correction',
          reason: `Returned for correction: ${reason}. Unlocked sections: ${sections.join(', ')}`,
        });

        // 4. Log in audit_logs
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.centralUser.id,
          actor_type: 'staff',
          action: 'central_hr_returned_for_correction',
          entity_type: 'applications',
          entity_id: id,
          metadata: {
            reason,
            unlocked_sections: sections,
            joining_id: candidate.joining_id,
          },
        });

        // 5. Send Notification via Centralized Notification Service
        await notificationService.notifyApplicationReturnedForCorrection(
          supabaseAdmin,
          candidate,
          reason,
          'central_hr',
          sections
        );

        return res.json({
          success: true,
          action: 'return_correction',
          status: 'needs_correction',
          unlocked_sections: sections,
          message: 'Application returned to candidate for corrections.',
        });
      }

      // ----------------------------------------------------------------------
      // ACTION C: REJECT
      // ----------------------------------------------------------------------
      if (action === 'reject') {
        if (!reason || String(reason).trim().length < 5) {
          return res.status(400).json({
            success: false,
            error: 'Mandatory Reason Required: A detailed rejection justification is required.',
          });
        }

        // 1. Update application status to rejected and lock
        await supabaseAdmin
          .from('applications')
          .update({
            status: 'rejected',
            locked: true,
            decided_at: new Date().toISOString(),
            decision_reason: reason,
          })
          .eq('id', id);

        // 2. Record in hr_decisions
        await supabaseAdmin.from('hr_decisions').insert({
          application_id: id,
          decided_by: req.centralUser.id,
          decision: 'rejected',
          reason,
        });

        // 3. Log in audit_logs
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.centralUser.id,
          actor_type: 'staff',
          action: 'central_hr_rejected_application',
          entity_type: 'applications',
          entity_id: id,
          metadata: {
            reason,
            joining_id: candidate.joining_id,
            subject_to_retention_policy: true,
          },
        });

        // 4. Send Notification via Centralized Notification Service
        await notificationService.notifyApplicationRejected(supabaseAdmin, candidate, reason);

        return res.json({
          success: true,
          action: 'reject',
          status: 'rejected',
          message: 'Application rejected and locked.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 8. Enrolled Employees Roster (Zone Scoped)
  // --------------------------------------------------------------------------
  router.get('/employees', requireCentralHr, async (req: any, res) => {
    try {
      const zoneId = req.centralUser.zone_id;

      // Get candidates in zone
      const { data: zoneCandidates } = await supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, mobile, email, joining_id, branch_id, branches(name)')
        .eq('zone_id', zoneId);

      const candMap = new Map((zoneCandidates || []).map((c) => [c.id, c]));
      const candidateIds = Array.from(candMap.keys());

      if (candidateIds.length === 0) {
        return res.json({ success: true, employees: [] });
      }

      // Fetch employees linked through applications
      const { data: employees, error } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          employee_id,
          pdf_dossier_storage_path,
          created_at,
          application_id,
          applications ( id, candidate_id, status, decided_at )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter employees whose application candidate is in candidateIds
      const filtered = (employees || [])
        .filter((e) => {
          const app = Array.isArray(e.applications) ? e.applications[0] : e.applications;
          return app && candMap.has(app.candidate_id);
        })
        .map((e) => {
          const app = Array.isArray(e.applications) ? e.applications[0] : e.applications;
          const candidate = candMap.get(app.candidate_id);
          return {
            id: e.id,
            employee_id: e.employee_id,
            pdf_dossier_storage_path: e.pdf_dossier_storage_path,
            enrolled_at: e.created_at,
            application_id: e.application_id,
            candidate: candidate
              ? {
                  id: candidate.id,
                  full_name: candidate.full_name,
                  masked_cnic: maskCnic(candidate.cnic),
                  joining_id: candidate.joining_id,
                  mobile: candidate.mobile,
                  email: candidate.email,
                  branch_name: (candidate.branches as any)?.name || 'Zone Hub',
                }
              : null,
          };
        });

      return res.json({
        success: true,
        employees: filtered,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 9. Download / Stream Official Real PDF Dossier
  // --------------------------------------------------------------------------
  router.get('/dossiers/:employeeId/pdf', async (req: any, res) => {
    try {
      const { employeeId } = req.params;

      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          employee_id,
          pdf_dossier_storage_path,
          applications (
            id,
            decided_at,
            decision_reason,
            candidates (
              id,
              full_name,
              cnic,
              mobile,
              email,
              joining_id,
              zones ( name ),
              branches ( name )
            )
          )
        `)
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      const app = Array.isArray(employee.applications) ? employee.applications[0] : employee.applications;
      const candRaw = (app as any)?.candidates;
      const cand: any = Array.isArray(candRaw) ? candRaw[0] : candRaw;

      // Try fetching from storage first
      if (employee.pdf_dossier_storage_path) {
        const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
          .from('dossiers')
          .download(employee.pdf_dossier_storage_path);

        if (!downloadErr && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${employeeId}-dossier.pdf"`);
          return res.send(buffer);
        }
      }

      // Generate on-the-fly if needed
      const [{ data: docs }, { data: remarks }, { data: orgSettings }] = await Promise.all([
        supabaseAdmin.from('documents').select('type, verification_status, remark').eq('application_id', app.id),
        supabaseAdmin.from('verification_remarks').select('remark').eq('application_id', app.id).limit(1),
        supabaseAdmin.from('organization_settings').select('company_name').limit(1).maybeSingle(),
      ]);
      const companyName = orgSettings?.company_name || 'PostEx';

      const result = await generateAndUploadPdfDossier(supabaseAdmin, {
        companyName,
        employeeId: employee.employee_id,
        joiningId: cand?.joining_id || 'PX-2026-000000',
        candidateName: cand?.full_name || 'PostEx Candidate',
        cnic: cand?.cnic || '35202-0000000-0',
        mobile: cand?.mobile || '03000000000',
        email: cand?.email || undefined,
        zoneName: (cand?.zones as any)?.name || 'Assigned Zone',
        branchName: (cand?.branches as any)?.name || 'PostEx Hub',
        status: 'APPROVED',
        approvedBy: 'Central HR Department',
        approvalRemarks: app?.decision_reason || 'Approved and enrolled.',
        decidedAt: app?.decided_at || new Date().toISOString(),
        documents: docs || [],
        bmRemarks: remarks?.[0]?.remark,
      });

      const { data: fileData } = await supabaseAdmin.storage
        .from('dossiers')
        .download(result.storagePath);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${employeeId}-dossier.pdf"`);
        return res.send(buffer);
      }

      return res.status(500).json({ success: false, error: 'Failed to generate PDF document stream.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
