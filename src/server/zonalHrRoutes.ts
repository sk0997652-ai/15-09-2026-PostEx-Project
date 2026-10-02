// ==============================================================================
// PostEx HR Onboarding Portal — Zonal HR Manager API Endpoints (Step 6)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { validateStatusTransition } from './workflowStateMachine';
import { notificationService } from './notificationService';
import { dataRetentionService } from './dataRetentionStore';
import { masterDataFallbackStore } from './masterDataFallbackStore';

export function createZonalHrRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // Helper: Generate secure temporary password
  // [HARD RULE]: min 10 chars, at least 1 number, at least 1 letter
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

    for (let i = pwdChars.length - 1; i > 0; i--) {
      const j = randomBytes[i] % (i + 1);
      [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
    }

    return pwdChars.join('');
  }

  // Middleware: Require Zonal HR Manager (or Super Admin) & attach their assigned zone
  async function requireZonalHr(req: any, res: any, next: any) {
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
        .select('id, name, zone_id, branch_id, is_active, roles(id, name)')
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

      if (roleName !== 'zonal_hr_manager' && roleName !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Zonal HR Manager access required.',
        });
      }

      let zoneId = profile.zone_id;
      if (!zoneId && roleName === 'super_admin') {
        // Super admin can operate across zones or default to first zone
        const { data: firstZone } = await supabaseAdmin.from('zones').select('id').order('name').limit(1).single();
        zoneId = firstZone?.id;
      }

      if (roleName === 'zonal_hr_manager' && !zoneId) {
        return res.status(400).json({
          success: false,
          error: 'Zonal HR account has no assigned geographic zone.',
        });
      }

      req.zonalUser = {
        id: authUser.user.id,
        email: authUser.user.email,
        name: profile.name,
        role: roleName,
        zone_id: zoneId,
      };

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Zone-Scoped Dashboard Metrics & Reports
  // --------------------------------------------------------------------------
  router.get('/metrics', requireZonalHr, async (req: any, res) => {
    try {
      if (req.query.zone_id && req.query.zone_id !== req.zonalUser.zone_id && req.zonalUser.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are only authorized to manage your assigned zone.',
        });
      }

      const zoneId = req.query.zone_id && req.zonalUser.role === 'super_admin'
        ? String(req.query.zone_id)
        : req.zonalUser.zone_id;

      if (!zoneId) {
        return res.status(400).json({ success: false, error: 'Zone ID required.' });
      }

      // Fetch zone info
      const { data: zoneData } = await supabaseAdmin
        .from('zones')
        .select('id, name')
        .eq('id', zoneId)
        .single();

      // Find candidates belonging to this zone
      const { data: zoneCandidates } = await supabaseAdmin
        .from('candidates')
        .select('id')
        .eq('zone_id', zoneId);

      const candidateIds = (zoneCandidates || []).map((c) => c.id);

      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let totalApplications = 0;
      let avgTurnaroundHours: number | null = null;

      if (candidateIds.length > 0) {
        const [
          { count: pending },
          { count: approved },
          { count: rejected },
          { count: total },
          { data: completedApps },
        ] = await Promise.all([
          supabaseAdmin
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('candidate_id', candidateIds)
            .in('status', ['draft', 'submitted', 'bm_verification', 'needs_correction', 'hr_review']),
          supabaseAdmin
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('candidate_id', candidateIds)
            .eq('status', 'approved'),
          supabaseAdmin
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('candidate_id', candidateIds)
            .eq('status', 'rejected'),
          supabaseAdmin
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .in('candidate_id', candidateIds),
          supabaseAdmin
            .from('applications')
            .select('submitted_at, decided_at')
            .in('candidate_id', candidateIds)
            .not('submitted_at', 'is', null)
            .not('decided_at', 'is', null),
        ]);

        pendingCount = pending || 0;
        approvedCount = approved || 0;
        rejectedCount = rejected || 0;
        totalApplications = total || 0;

        if (completedApps && completedApps.length > 0) {
          const diffs = completedApps.map((a) => {
            const sub = new Date(a.submitted_at).getTime();
            const dec = new Date(a.decided_at).getTime();
            return Math.max(0, dec - sub) / (1000 * 60 * 60); // in hours
          });
          const sum = diffs.reduce((acc, curr) => acc + curr, 0);
          avgTurnaroundHours = Math.round((sum / diffs.length) * 10) / 10;
        }
      }

      // Count subordinate staff (Central HR + Branch Manager) in this zone
      const { count: staffCount } = await supabaseAdmin
        .from('staff_profiles')
        .select('*, roles!inner(name)', { count: 'exact', head: true })
        .eq('zone_id', zoneId)
        .in('roles.name', ['central_hr', 'branch_manager']);

      // List branches in this zone
      const { data: zoneBranches } = await supabaseAdmin
        .from('branches')
        .select('id, name')
        .eq('zone_id', zoneId);

      return res.json({
        success: true,
        zone: zoneData,
        metrics: {
          zoneId,
          zoneName: zoneData?.name || 'Assigned Zone',
          totalCandidates: candidateIds.length,
          totalApplications,
          pendingApplications: pendingCount,
          approvedApplications: approvedCount,
          rejectedApplications: rejectedCount,
          branchesCount: zoneBranches?.length || 0,
          staffCount: staffCount || 0,
          avgTurnaroundHours: avgTurnaroundHours !== null ? `${avgTurnaroundHours} hrs` : 'N/A (No completed reviews)',
          branches: zoneBranches || [],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Zone-Scoped Staff Management (Strictly Central HR & Branch Manager)
  // --------------------------------------------------------------------------
  async function computeNextStaffEmployeeId(): Promise<string> {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, staff_employee_id');

      if (error || !rows) {
        const { count } = await supabaseAdmin
          .from('staff_profiles')
          .select('*', { count: 'exact', head: true });
        return `PX-STAFF-${1000 + (count || 0) + 1}`;
      }

      let maxNum = 1000;
      for (const r of rows as any[]) {
        const val = String(r.staff_employee_id || '').trim();
        const m = val.match(/^PX-STAFF-(\d+)$/i);
        if (m) {
          const parsed = parseInt(m[1], 10);
          if (!Number.isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
      if (maxNum === 1000 && rows.length > 1) {
        maxNum = 1000 + rows.length;
      }
      return `PX-STAFF-${maxNum + 1}`;
    } catch {
      return 'PX-STAFF-1001';
    }
  }

  router.get('/staff/next-employee-id', requireZonalHr, async (_req: any, res) => {
    try {
      const nextStaffEmployeeId = await computeNextStaffEmployeeId();
      return res.json({ success: true, nextStaffEmployeeId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.get('/staff', requireZonalHr, async (req: any, res) => {
    try {
      if (req.query.zone_id && req.query.zone_id !== req.zonalUser.zone_id && req.zonalUser.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are only authorized to manage your assigned zone.',
        });
      }

      const zoneId = req.zonalUser.role === 'super_admin' && req.query.zone_id
        ? String(req.query.zone_id)
        : req.zonalUser.zone_id;

      // [HARD RULE]: Filter strictly to subordinate roles (central_hr, branch_manager) in this zone.
      // Zonal HR Managers and Super Admins MUST NEVER be returned.
      let { data: staffList, error } = await supabaseAdmin
        .from('staff_profiles')
        .select(`
          id,
          name,
          personal_email,
          phone_number,
          staff_employee_id,
          department_id,
          designation_id,
          is_active,
          must_change_password,
          created_at,
          roles!inner ( id, name ),
          zones ( id, name ),
          branches ( id, name ),
          departments ( id, name, department_code ),
          designations ( id, name, employment_category, department_id )
        `)
        .eq('zone_id', zoneId)
        .in('roles.name', ['central_hr', 'branch_manager'])
        .order('created_at', { ascending: false });

      if (error) {
        const fallback = await supabaseAdmin
          .from('staff_profiles')
          .select(`
            id,
            name,
            is_active,
            must_change_password,
            created_at,
            roles!inner ( id, name ),
            zones ( id, name ),
            branches ( id, name )
          `)
          .eq('zone_id', zoneId)
          .in('roles.name', ['central_hr', 'branch_manager'])
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        staffList = fallback.data as any;
      }

      // Fetch tagged branches from staff_branch_assignments
      const taggedBranchesByStaff = new Map<string, Array<{ id: string; name: string; branch_code?: string }>>();
      const { data: sbaRows, error: sbaErr } = await supabaseAdmin
        .from('staff_branch_assignments')
        .select('staff_profile_id, branch_id, branches(id, name, branch_code)');

      if (!sbaErr && sbaRows) {
        for (const row of sbaRows as any[]) {
          const brObj = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          if (row.staff_profile_id && brObj?.id) {
            const list = taggedBranchesByStaff.get(row.staff_profile_id) || [];
            if (!list.some((b) => b.id === brObj.id)) {
              list.push({ id: brObj.id, name: brObj.name, branch_code: brObj.branch_code });
            }
            taggedBranchesByStaff.set(row.staff_profile_id, list);
          }
        }
      }

      // Fetch emails from auth.users
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map((authUsers?.users || []).map((u) => [u.id, u.email]));

      const enriched = (staffList || []).map((s: any) => {
        const tagged =
          taggedBranchesByStaff.get(s.id) ||
          (s.branches?.id ? [{ id: s.branches.id, name: s.branches.name }] : []);
        return {
          ...s,
          email: emailMap.get(s.id) || 'staff@postex.pk',
          phone: s.phone_number || null,
          tagged_branches: tagged,
          branch_ids: tagged.map((b) => b.id),
        };
      });

      // Also return list of branches in this zone, departments, designations, and nextStaffEmployeeId
      const [{ data: branches }, { data: departments }, { data: designations }, nextStaffEmployeeId] =
        await Promise.all([
          supabaseAdmin.from('branches').select('id, name, branch_code, branch_type').eq('zone_id', zoneId).order('name'),
          supabaseAdmin.from('departments').select('id, name, department_code, department_category, is_active').order('name'),
          supabaseAdmin
            .from('designations')
            .select('*, departments(id, name, department_code)')
            .order('name'),
          computeNextStaffEmployeeId(),
        ]);

      return res.json({
        success: true,
        staff: enriched,
        branches: branches || [],
        departments: departments || [],
        designations: masterDataFallbackStore.enrichDesignations(designations || []),
        nextStaffEmployeeId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Create Staff scoped strictly to this Zone (Roles restricted: central_hr or branch_manager)
  router.post('/staff', requireZonalHr, async (req: any, res) => {
    try {
      const {
        email,
        name,
        personal_email,
        phone_number,
        phone,
        staff_employee_id,
        department_id,
        designation_id,
        role_name,
        branch_id,
        branch_ids,
      } = req.body || {};

      if (!email || !name || !role_name) {
        return res.status(400).json({ success: false, error: 'Email, name, and role are required.' });
      }

      // Hard enforcement: Zonal HR can ONLY create central_hr and branch_manager
      if (!['central_hr', 'branch_manager'].includes(role_name)) {
        return res.status(403).json({
          success: false,
          error: 'Zonal HR can only create Central HR or Branch Manager accounts.',
        });
      }

      const zoneId = req.zonalUser.role === 'super_admin' && req.body.zone_id
        ? String(req.body.zone_id)
        : req.zonalUser.zone_id;

      // Validate Department -> Designation link if both are provided
      const cleanDeptId = department_id && String(department_id).trim() ? String(department_id).trim() : null;
      const cleanDesigId = designation_id && String(designation_id).trim() ? String(designation_id).trim() : null;

      if (cleanDesigId) {
        const { data: desigRow } = await supabaseAdmin
          .from('designations')
          .select('id, name, department_id')
          .eq('id', cleanDesigId)
          .maybeSingle();
        if (!desigRow) {
          return res.status(400).json({ success: false, error: 'Selected Designation does not exist.' });
        }
        if (cleanDeptId && desigRow.department_id !== cleanDeptId) {
          return res.status(400).json({
            success: false,
            error: 'Selected Designation does not belong to the selected Department.',
          });
        }
      }

      // Normalize Branch Tagging
      const rawBranchIds: string[] = Array.isArray(branch_ids)
        ? branch_ids.map((b: any) => String(b).trim()).filter(Boolean)
        : branch_id && String(branch_id).trim()
        ? [String(branch_id).trim()]
        : [];
      const uniqueBranchIds = Array.from(new Set(rawBranchIds));

      // If branch_manager, at least one branch is mandatory and MUST belong to this zone
      if (role_name === 'branch_manager' && uniqueBranchIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Branch is required for Branch Manager.' });
      }

      if (uniqueBranchIds.length > 0) {
        const { data: brList } = await supabaseAdmin
          .from('branches')
          .select('id, zone_id')
          .in('id', uniqueBranchIds);
        const invalidBr = (brList || []).find((b) => b.zone_id !== zoneId);
        if (invalidBr || (brList || []).length !== uniqueBranchIds.length) {
          return res.status(403).json({
            success: false,
            error: 'Branch does not belong to your assigned zone.',
          });
        }
      }

      const primaryBranchId =
        role_name === 'branch_manager'
          ? uniqueBranchIds[0] || null
          : branch_id && String(branch_id).trim()
          ? String(branch_id).trim()
          : uniqueBranchIds.length === 1
          ? uniqueBranchIds[0]
          : null;

      // Resolve or auto-generate Staff Employee ID (PX-STAFF-XXXX)
      const resolvedStaffEmpId =
        staff_employee_id && String(staff_employee_id).trim()
          ? String(staff_employee_id).trim()
          : await computeNextStaffEmployeeId();

      const { data: existingEmpId } = await supabaseAdmin
        .from('staff_profiles')
        .select('id')
        .eq('staff_employee_id', resolvedStaffEmpId)
        .maybeSingle();

      if (existingEmpId) {
        return res.status(400).json({
          success: false,
          error: `Staff Employee ID "${resolvedStaffEmpId}" already exists. Please enter a unique Employee ID.`,
        });
      }

      // Get role ID
      const { data: roleRow, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', role_name)
        .single();
      if (roleErr || !roleRow) {
        return res.status(400).json({ success: false, error: `Invalid role: ${role_name}` });
      }

      const tempPassword = generateSecureTempPassword(14);
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanName = String(name).trim();
      const cleanPersonalEmail =
        personal_email && String(personal_email).trim() ? String(personal_email).trim().toLowerCase() : null;
      const rawPhone = phone_number ?? phone ?? '';
      const cleanPhone = rawPhone && String(rawPhone).trim() ? String(rawPhone).trim() : null;

      // Create Supabase Auth user
      const { data: authUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: cleanName,
          role: role_name,
          must_change_password: true,
          zone_id: zoneId,
        },
      });

      if (createAuthErr || !authUser.user) {
        return res.status(400).json({
          success: false,
          error: createAuthErr ? createAuthErr.message : 'Failed to create auth user.',
        });
      }

      const profileUpsertPayload: Record<string, any> = {
        id: authUser.user.id,
        name: cleanName,
        personal_email: cleanPersonalEmail,
        phone_number: cleanPhone,
        staff_employee_id: resolvedStaffEmpId,
        department_id: cleanDeptId,
        designation_id: cleanDesigId,
        role_id: roleRow.id,
        zone_id: zoneId,
        branch_id: primaryBranchId,
        is_active: true,
        must_change_password: true,
        created_by: req.zonalUser.id,
      };

      // Upsert profile in staff_profiles with mandatory must_change_password = true
      let { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .upsert(profileUpsertPayload)
        .select(`
          id,
          name,
          personal_email,
          phone_number,
          staff_employee_id,
          department_id,
          designation_id,
          is_active,
          must_change_password,
          zone_id,
          branch_id,
          roles(name),
          branches(name),
          departments(id, name, department_code),
          designations(id, name, employment_category, department_id)
        `)
        .single();

      if (profErr && (profErr.message.includes('staff_employee_id') || profErr.message.includes('personal_email') || profErr.message.includes('department_id'))) {
        const retry = await supabaseAdmin
          .from('staff_profiles')
          .upsert({
            id: authUser.user.id,
            name: cleanName,
            role_id: roleRow.id,
            zone_id: zoneId,
            branch_id: primaryBranchId,
            is_active: true,
            must_change_password: true,
          })
          .select(`
            id,
            name,
            is_active,
            must_change_password,
            zone_id,
            branch_id,
            roles(name),
            branches(name)
          `)
          .single();
        profile = retry.data as any;
        profErr = retry.error;
      }

      if (profErr) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return res.status(500).json({ success: false, error: profErr.message });
      }

      if (uniqueBranchIds.length > 0) {
        await supabaseAdmin.from('staff_branch_assignments').upsert(
          uniqueBranchIds.map((bId) => ({
            staff_profile_id: authUser.user.id,
            branch_id: bId,
          })),
          { onConflict: 'staff_profile_id,branch_id' }
        );
      }

      // Log in audit trail
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: 'ZONAL_STAFF_CREATED',
        entity_type: 'staff_profiles',
        entity_id: authUser.user.id,
        metadata: {
          email: cleanEmail,
          staff_employee_id: resolvedStaffEmpId,
          personal_email: cleanPersonalEmail,
          phone_number: cleanPhone,
          department_id: cleanDeptId,
          designation_id: cleanDesigId,
          role: role_name,
          zone_id: zoneId,
          branch_id: primaryBranchId,
          branch_ids: uniqueBranchIds,
        },
      });

      return res.status(201).json({
        success: true,
        staff: {
          ...profile,
          email: cleanEmail,
          staff_employee_id: (profile as any)?.staff_employee_id || resolvedStaffEmpId,
          personal_email: (profile as any)?.personal_email ?? cleanPersonalEmail,
          phone_number: (profile as any)?.phone_number ?? cleanPhone,
          department_id: (profile as any)?.department_id ?? cleanDeptId,
          designation_id: (profile as any)?.designation_id ?? cleanDesigId,
          branch_ids: uniqueBranchIds,
        },
        one_time_temporary_password: tempPassword,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Edit Staff Member in Zone
  router.put('/staff/:id', requireZonalHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        personal_email,
        phone_number,
        phone,
        staff_employee_id,
        department_id,
        designation_id,
        branch_id,
        branch_ids,
        role_name,
      } = req.body || {};
      const zoneId = req.zonalUser.role === 'super_admin' ? null : req.zonalUser.zone_id;

      // Confirm target belongs to their zone
      const { data: targetProfile, error: targErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, zone_id, roles(name)')
        .eq('id', id)
        .single();

      if (targErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Staff member not found.' });
      }

      if (zoneId && targetProfile.zone_id !== zoneId) {
        return res.status(403).json({
          success: false,
          error: 'You cannot edit staff outside your assigned zone.',
        });
      }

      const updateData: any = {};
      if (name && typeof name === 'string' && name.trim()) {
        updateData.name = name.trim();
      }
      if (personal_email !== undefined) {
        updateData.personal_email =
          personal_email && String(personal_email).trim() ? String(personal_email).trim().toLowerCase() : null;
      }
      if (phone_number !== undefined || phone !== undefined) {
        const rawPhone = phone_number ?? phone ?? '';
        updateData.phone_number = rawPhone && String(rawPhone).trim() ? String(rawPhone).trim() : null;
      }
      if (staff_employee_id !== undefined && String(staff_employee_id).trim()) {
        updateData.staff_employee_id = String(staff_employee_id).trim();
      }
      if (department_id !== undefined) {
        updateData.department_id =
          department_id && String(department_id).trim() ? String(department_id).trim() : null;
      }
      if (designation_id !== undefined) {
        updateData.designation_id =
          designation_id && String(designation_id).trim() ? String(designation_id).trim() : null;
      }

      if (branch_id !== undefined) {
        if (branch_id) {
          // Verify branch belongs to this zone
          const { data: bData } = await supabaseAdmin
            .from('branches')
            .select('id, zone_id')
            .eq('id', branch_id)
            .single();
          if (!bData || (zoneId && bData.zone_id !== zoneId)) {
            return res.status(400).json({ success: false, error: 'Branch does not belong to your zone.' });
          }
          updateData.branch_id = branch_id;
        } else {
          updateData.branch_id = null;
        }
      }

      if (Array.isArray(branch_ids)) {
        const cleanIds = Array.from(new Set(branch_ids.map((b: any) => String(b).trim()).filter(Boolean)));
        if (cleanIds.length > 0 && zoneId) {
          const { data: bList } = await supabaseAdmin
            .from('branches')
            .select('id, zone_id')
            .in('id', cleanIds);
          const invalidBr = (bList || []).find((b) => b.zone_id !== zoneId);
          if (invalidBr || (bList || []).length !== cleanIds.length) {
            return res.status(400).json({ success: false, error: 'One or more branches do not belong to your zone.' });
          }
        }
        if (branch_id === undefined) {
          updateData.branch_id = cleanIds[0] || null;
        }
        await supabaseAdmin.from('staff_branch_assignments').delete().eq('staff_profile_id', id);
        if (cleanIds.length > 0) {
          await supabaseAdmin.from('staff_branch_assignments').insert(
            cleanIds.map((bId) => ({ staff_profile_id: id, branch_id: bId }))
          );
        }
      }

      if (role_name) {
        if (!['central_hr', 'branch_manager'].includes(role_name)) {
          return res.status(400).json({ success: false, error: 'Only Central HR and Branch Manager roles can be assigned.' });
        }
        const { data: rRow } = await supabaseAdmin.from('roles').select('id').eq('name', role_name).single();
        if (rRow) {
          updateData.role_id = rRow.id;
        }
      }

      let { data: updated, error: updErr } = await supabaseAdmin
        .from('staff_profiles')
        .update(updateData)
        .eq('id', id)
        .select('*, roles(name), branches(name), departments(id, name, department_code), designations(id, name, employment_category, department_id)')
        .single();

      if (updErr && (updErr.message.includes('staff_employee_id') || updErr.message.includes('personal_email') || updErr.message.includes('department_id'))) {
        const fallbackData: any = {};
        if (updateData.name !== undefined) fallbackData.name = updateData.name;
        if (updateData.branch_id !== undefined) fallbackData.branch_id = updateData.branch_id;
        if (updateData.role_id !== undefined) fallbackData.role_id = updateData.role_id;
        const retry = await supabaseAdmin
          .from('staff_profiles')
          .update(fallbackData)
          .eq('id', id)
          .select('*, roles(name), branches(name)')
          .single();
        updated = retry.data as any;
        updErr = retry.error;
      }

      if (updErr) {
        if (updErr.message.toLowerCase().includes('staff_profiles_staff_employee_id_key')) {
          return res.status(400).json({
            success: false,
            error: `Staff Employee ID "${staff_employee_id}" already exists. Please enter a unique Employee ID.`,
          });
        }
        return res.status(400).json({ success: false, error: updErr.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: 'ZONAL_STAFF_UPDATED',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { ...updateData, previous_name: targetProfile.name },
      });

      return res.json({ success: true, staff: updated, message: 'Staff profile updated successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Toggle Staff Active Status in Zone
  router.patch('/staff/:id/status', requireZonalHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const zoneId = req.zonalUser.role === 'super_admin' ? null : req.zonalUser.zone_id;

      const { data: targetProfile, error: targErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, zone_id, roles(name)')
        .eq('id', id)
        .single();

      if (targErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Staff member not found.' });
      }

      if (zoneId && targetProfile.zone_id !== zoneId) {
        return res.status(403).json({
          success: false,
          error: 'You cannot change status of staff outside your assigned zone.',
        });
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('staff_profiles')
        .update({ is_active: Boolean(is_active) })
        .eq('id', id)
        .select('*, roles(name)')
        .single();

      if (updErr) {
        return res.status(400).json({ success: false, error: updErr.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: is_active ? 'ZONAL_STAFF_ACTIVATED' : 'ZONAL_STAFF_DEACTIVATED',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { staff_name: targetProfile.name, is_active },
      });

      return res.json({ success: true, staff: updated, message: `Staff user ${is_active ? 'activated' : 'deactivated'}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Regenerate Password for staff in their zone
  router.post('/staff/:id/regenerate-password', requireZonalHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const zoneId = req.zonalUser.role === 'super_admin' ? null : req.zonalUser.zone_id;

      // Confirm target belongs to their zone
      const { data: targetProfile, error: targErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, zone_id, roles(name)')
        .eq('id', id)
        .single();

      if (targErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Staff member not found.' });
      }

      if (zoneId && targetProfile.zone_id !== zoneId) {
        return res.status(403).json({
          success: false,
          error: 'You cannot regenerate passwords for staff in another zone.',
        });
      }

      // [HARD RULE]: Zonal HR can only regenerate credentials for subordinate staff (central_hr, branch_manager)
      const targetRole = Array.isArray(targetProfile.roles)
        ? (targetProfile.roles as any)[0]?.name
        : (targetProfile.roles as any)?.name;

      if (req.zonalUser.role !== 'super_admin' && !['central_hr', 'branch_manager'].includes(targetRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You can only regenerate passwords for subordinate Central HR and Branch Manager accounts.',
        });
      }

      const newTempPassword = generateSecureTempPassword(14);

      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: newTempPassword,
        user_metadata: { must_change_password: true },
      });

      if (updateAuthErr) {
        return res.status(500).json({ success: false, error: updateAuthErr.message });
      }

      await supabaseAdmin
        .from('staff_profiles')
        .update({ must_change_password: true })
        .eq('id', id);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: 'ZONAL_PASSWORD_REGENERATED',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { staff_name: targetProfile.name },
      });

      // Dispatch centralized notification
      await notificationService.notifyStaffCredentialReset(
        supabaseAdmin,
        { id, name: targetProfile.name },
        newTempPassword,
        req.zonalUser.id
      );

      return res.json({
        success: true,
        temporary_password: newTempPassword,
        message: 'Password regenerated successfully. Staff will be forced to change on login.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Paginated Candidate Applications (Scoped to Zone) with Filter & CNIC Masking
  // --------------------------------------------------------------------------
  router.get('/applications', requireZonalHr, async (req: any, res) => {
    try {
      if (req.query.zone_id && req.query.zone_id !== req.zonalUser.zone_id && req.zonalUser.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are only authorized to manage your assigned zone.',
        });
      }

      const zoneId = req.zonalUser.role === 'super_admin' && req.query.zone_id
        ? String(req.query.zone_id)
        : req.zonalUser.zone_id;

      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
      const offset = (page - 1) * limit;
      const status = req.query.status ? String(req.query.status) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      // 1. Get all candidate IDs belonging to this zone
      let candidateQuery = supabaseAdmin
        .from('candidates')
        .select('id, full_name, cnic, mobile, email, joining_id, zone_id, branch_id, branches(name), zones(name)')
        .eq('zone_id', zoneId);

      if (search) {
        candidateQuery = candidateQuery.or(
          `full_name.ilike.%${search}%,joining_id.ilike.%${search}%,cnic.ilike.%${search}%`
        );
      }

      const { data: candidates, error: candErr } = await candidateQuery;
      if (candErr) throw candErr;

      const candidateMap = new Map((candidates || []).map((c) => [c.id, c]));
      const candidateIds = Array.from(candidateMap.keys());

      if (candidateIds.length === 0) {
        return res.json({
          success: true,
          applications: [],
          centralHrStaff: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }

      // 2. Query applications for these candidates
      let appQuery = supabaseAdmin
        .from('applications')
        .select(`
          id,
          candidate_id,
          status,
          current_step,
          assigned_branch_manager_id,
          assigned_central_hr_id,
          locked,
          submitted_at,
          decided_at,
          decision_reason,
          created_at
        `, { count: 'exact' })
        .in('candidate_id', candidateIds);

      if (status) {
        appQuery = appQuery.eq('status', status);
      }

      const { data: applications, count, error: appErr } = await appQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (appErr) throw appErr;

      // 3. Fetch list of Central HR in this zone for reassignment dropdowns
      const { data: centralHrStaff } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, roles!inner(name)')
        .eq('zone_id', zoneId)
        .eq('roles.name', 'central_hr');

      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map((authUsers?.users || []).map((u) => [u.id, u.email]));
      const centralHrNameMap = new Map((centralHrStaff || []).map((s) => [s.id, s.name]));

      const enrichedCentralHr = (centralHrStaff || []).map((s) => ({
        id: s.id,
        name: s.name,
        email: emailMap.get(s.id) || 'hr@postex.pk',
      }));

      // 4. Enrich applications with masked candidate data
      const unarchivedApps = (applications || []).filter(
        (app) => req.query.include_archived === 'true' || !dataRetentionService.isApplicationArchived(app.id, app.decision_reason)
      );

      const enrichedApps = unarchivedApps.map((app) => {
        const cand = candidateMap.get(app.candidate_id);
        let maskedCnic = '*****';
        if (cand?.cnic) {
          const raw = cand.cnic.replace(/\D/g, '');
          if (raw.length >= 13) {
            maskedCnic = `${raw.slice(0, 5)}-*****${raw.slice(10, 12)}-${raw.slice(12)}`;
          } else {
            maskedCnic = cand.cnic.slice(0, 5) + '*****' + cand.cnic.slice(-2);
          }
        }

        return {
          ...app,
          assigned_central_hr_name: app.assigned_central_hr_id
            ? centralHrNameMap.get(app.assigned_central_hr_id) || 'Central HR Reviewer'
            : 'Unassigned',
          candidate: cand
            ? {
                ...cand,
                cnic: maskedCnic,
                masked_cnic: maskedCnic,
              }
            : null,
        };
      });

      return res.json({
        success: true,
        applications: enrichedApps,
        centralHrStaff: enrichedCentralHr,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Reassign Candidate Application Between Central HR in the Zone
  // --------------------------------------------------------------------------
  router.post('/applications/:id/reassign', requireZonalHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { new_central_hr_id, reason } = req.body;

      if (!new_central_hr_id) {
        return res.status(400).json({ success: false, error: 'Target Central HR ID is required.' });
      }

      // Fetch application and candidate to check zone
      const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, assigned_central_hr_id, status, candidates(zone_id, full_name)')
        .eq('id', id)
        .single();

      if (appErr || !application) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candidate = application.candidates as any;
      const appZoneId = candidate?.zone_id;

      if (req.zonalUser.role !== 'super_admin' && appZoneId !== req.zonalUser.zone_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Application does not belong to your assigned zone.',
        });
      }

      // Confirm target Central HR belongs to this zone
      const { data: targetHr, error: targetErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, zone_id, roles(name)')
        .eq('id', new_central_hr_id)
        .single();

      if (targetErr || !targetHr) {
        return res.status(404).json({ success: false, error: 'Target Central HR staff not found.' });
      }

      if (req.zonalUser.role !== 'super_admin' && targetHr.zone_id !== req.zonalUser.zone_id) {
        return res.status(403).json({
          success: false,
          error: 'Target Central HR must belong to the same zone as the candidate.',
        });
      }

      // Perform update
      const { data: updatedApp, error: updateErr } = await supabaseAdmin
        .from('applications')
        .update({
          assigned_central_hr_id: new_central_hr_id,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Log in audit trail
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: 'zonal_reassigned_reviewer',
        entity_type: 'applications',
        entity_id: id,
        metadata: {
          previous_central_hr_id: application.assigned_central_hr_id,
          new_central_hr_id,
          target_hr_name: targetHr.name,
          reason: reason || 'Zonal HR reassignment',
        },
      });

      return res.json({
        success: true,
        message: `Application reassigned to ${targetHr.name}.`,
        application: updatedApp,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Override-Decision Hook (Approve / Return for Correction / Reject)
  // --------------------------------------------------------------------------
  router.post('/applications/:id/override-decision', requireZonalHr, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { decision, reason } = req.body;

      if (!decision || !['approved', 'correction_needed', 'rejected'].includes(decision)) {
        return res.status(400).json({
          success: false,
          error: 'Valid decision (approved, correction_needed, rejected) is required.',
        });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Mandatory justification reason is required for Zonal HR override decisions.',
        });
      }

      // Fetch application and candidate to check zone
      const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .select('id, candidate_id, status, candidates(id, zone_id, full_name, mobile, email, joining_id)')
        .eq('id', id)
        .single();

      if (appErr || !application) {
        return res.status(404).json({ success: false, error: 'Application not found.' });
      }

      const candidate = application.candidates as any;
      const appZoneId = candidate?.zone_id;

      if (req.zonalUser.role !== 'super_admin' && appZoneId !== req.zonalUser.zone_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Application does not belong to your assigned zone.',
        });
      }

      let newStatus: string;
      let hrDecisionType: string;

      if (decision === 'approved') {
        newStatus = 'approved';
        hrDecisionType = 'approved';
      } else if (decision === 'correction_needed') {
        newStatus = 'needs_correction';
        hrDecisionType = 'returned_for_correction';
      } else {
        newStatus = 'rejected';
        hrDecisionType = 'rejected';
      }

      // [STATE MACHINE ENFORCEMENT]
      const transValidation = validateStatusTransition(application.status, newStatus);
      if (!transValidation.valid) {
        return res.status(400).json({ success: false, error: transValidation.error });
      }

      const now = new Date().toISOString();

      // Update application
      const { data: updatedApp, error: updateErr } = await supabaseAdmin
        .from('applications')
        .update({
          status: newStatus,
          locked: decision === 'approved' || decision === 'rejected',
          decided_at: now,
          decision_reason: reason.trim(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Record in hr_decisions table
      try {
        await supabaseAdmin.from('hr_decisions').insert({
          application_id: id,
          decided_by: req.zonalUser.id,
          decision: hrDecisionType,
          reason: reason.trim(),
          decided_at: now,
        });
      } catch (hrErr) {
        console.warn('Could not record into hr_decisions table:', hrErr);
      }

      // Log in audit trail
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.zonalUser.id,
        actor_type: 'staff',
        action: `zonal_hr_override_${decision}`,
        entity_type: 'applications',
        entity_id: id,
        metadata: {
          previous_status: application.status,
          new_status: newStatus,
          decision,
          reason: reason.trim(),
          override_by_name: req.zonalUser.name,
        },
      });

      // Dispatch centralized notification to candidate
      if (candidate) {
        if (newStatus === 'approved') {
          await notificationService.notifyApplicationApproved(
            supabaseAdmin,
            candidate,
            `EMP-${candidate.joining_id || id.slice(0, 6)}`
          );
        } else if (newStatus === 'needs_correction') {
          await notificationService.notifyApplicationReturnedForCorrection(
            supabaseAdmin,
            candidate,
            reason.trim(),
            'central_hr'
          );
        } else if (newStatus === 'rejected') {
          await notificationService.notifyApplicationRejected(
            supabaseAdmin,
            candidate,
            reason.trim()
          );
        }
      }

      return res.json({
        success: true,
        message: `Override decision (${decision}) recorded successfully.`,
        application: updatedApp,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
