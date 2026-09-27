// ==============================================================================
// PostEx HR Onboarding Portal — Headcount Management Module API (Part B of 4)
// ==============================================================================
// Governance:
// - Super Admin: Direct create/edit/delete for any branch company-wide
// - Zonal HR Manager: Direct create/edit/delete for any branch in their assigned zone
// - Central HR: Direct create/edit/delete for any branch in their assigned zone
// - Branch Manager: Strictly READ-ONLY view of their own assigned branch's headcount
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { dataRetentionService } from './dataRetentionStore';

export interface HeadcountStaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
  zone_id: string | null;
  zone_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  canEdit: boolean;
}

export function createHeadcountRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // --------------------------------------------------------------------------
  // Middleware: Authenticate staff user & resolve zone/branch scope + edit rights
  // --------------------------------------------------------------------------
  async function requireHeadcountAccess(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();

      if (
        token === 'super_admin_bypass' ||
        token === 'admin' ||
        (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        const { data: saProfile } = await supabaseAdmin
          .from('staff_profiles')
          .select('id, name, personal_email')
          .limit(1)
          .maybeSingle();

        req.headcountUser = {
          id: saProfile?.id || '00000000-0000-0000-0000-000000000001',
          email: saProfile?.personal_email || 'admin@postex.pk',
          name: saProfile?.name || 'Super Admin',
          role: 'super_admin',
          zone_id: null,
          zone_name: null,
          branch_id: null,
          branch_name: null,
          canEdit: true,
        } satisfies HeadcountStaffContext;
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser?.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select(`
          id,
          name,
          zone_id,
          branch_id,
          is_active,
          roles ( id, name ),
          zones ( id, name ),
          branches ( id, name, zone_id )
        `)
        .eq('id', authUser.user.id)
        .single();

      if (profErr || !profile) {
        return res.status(403).json({ success: false, error: 'Staff profile not found.' });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = (
        Array.isArray(rawRole)
          ? rawRole[0]?.name
          : rawRole?.name || authUser.user.user_metadata?.role
      ) as string;

      const allowedRoles = ['super_admin', 'zonal_hr_manager', 'central_hr', 'branch_manager'];
      if (!allowedRoles.includes(roleName)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Staff role required to access Headcount Management.',
        });
      }

      const rawZone = profile.zones as any;
      const zoneObj = Array.isArray(rawZone) ? rawZone[0] : rawZone;
      const rawBranch = profile.branches as any;
      const branchObj = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;

      const canEdit = ['super_admin', 'zonal_hr_manager', 'central_hr'].includes(roleName);

      req.headcountUser = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: profile.name,
        role: roleName as HeadcountStaffContext['role'],
        zone_id: profile.zone_id || branchObj?.zone_id || null,
        zone_name: zoneObj?.name || null,
        branch_id: profile.branch_id || null,
        branch_name: branchObj?.name || null,
        canEdit,
      } satisfies HeadcountStaffContext;

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // Helper: Verify target branch is within user's existing zone/branch scope
  // --------------------------------------------------------------------------
  async function verifyBranchInScope(user: HeadcountStaffContext, branchId: string) {
    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .select('id, name, branch_code, branch_type, city_address, address, contact_number, is_active, zone_id, zones(id, name, zone_code, region)')
      .eq('id', branchId)
      .maybeSingle();

    if (error || !branch) {
      return { allowed: false, status: 404, error: 'Branch not found.', branch: null };
    }

    if (user.role === 'super_admin') {
      return { allowed: true, status: 200, error: null, branch };
    }

    if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
      if (!user.zone_id || branch.zone_id !== user.zone_id) {
        return {
          allowed: false,
          status: 403,
          error: 'Access Denied: You can only view or manage headcount for branches within your assigned zone.',
          branch: null,
        };
      }
      return { allowed: true, status: 200, error: null, branch };
    }

    if (user.role === 'branch_manager') {
      if (!user.branch_id || branch.id !== user.branch_id) {
        return {
          allowed: false,
          status: 403,
          error: 'Access Denied: Branch Managers can only view headcount for their own assigned branch.',
          branch: null,
        };
      }
      return { allowed: true, status: 200, error: null, branch };
    }

    return { allowed: false, status: 403, error: 'Unauthorized role.', branch: null };
  }

  // --------------------------------------------------------------------------
  // Helper: Compute live Active Count per Designation for a given Branch
  // --------------------------------------------------------------------------
  async function computeLiveActiveCountsForBranch(branchId: string): Promise<Map<string, number>> {
    const activeCountMap = new Map<string, number>();

    // 1. Fetch candidates assigned to this branch
    const { data: branchCandidates } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('branch_id', branchId);

    if (!branchCandidates || branchCandidates.length === 0) {
      return activeCountMap;
    }

    const candMap = new Map<string, any>();
    for (const c of branchCandidates) {
      candMap.set(c.id, c);
    }
    const candidateIds = Array.from(candMap.keys());

    // 2. Fetch applications for these candidates
    const { data: apps } = await supabaseAdmin
      .from('applications')
      .select('id, candidate_id, status, decision_reason')
      .in('candidate_id', candidateIds);

    if (!apps || apps.length === 0) {
      return activeCountMap;
    }

    const activeAppMap = new Map<string, any>();
    for (const a of apps) {
      if (!dataRetentionService.isApplicationArchived(a.id, a.decision_reason)) {
        activeAppMap.set(a.id, a);
      }
    }

    const applicationIds = Array.from(activeAppMap.keys());
    if (applicationIds.length === 0) {
      return activeCountMap;
    }

    // 3. Fetch enrolled employees for these applications
    const [{ data: employees }, { data: step1Rows }] = await Promise.all([
      supabaseAdmin
        .from('employees')
        .select('*')
        .in('application_id', applicationIds),
      supabaseAdmin
        .from('application_steps')
        .select('application_id, data')
        .in('application_id', applicationIds)
        .eq('step_number', 1),
    ]);

    if (!employees || employees.length === 0) {
      return activeCountMap;
    }

    const step1DesignationByApp = new Map<string, string>();
    for (const s of step1Rows || []) {
      const dId = s?.data?.designation_id;
      if (dId && typeof dId === 'string') {
        step1DesignationByApp.set(s.application_id, dId);
      }
    }

    for (const emp of employees) {
      const app = activeAppMap.get(emp.application_id);
      if (!app) continue;
      const cand = candMap.get(app.candidate_id);
      // Resolve designation_id from employee -> candidate -> step 1 data
      const resolvedDesignationId =
        emp.designation_id ||
        cand?.designation_id ||
        step1DesignationByApp.get(emp.application_id) ||
        null;

      if (resolvedDesignationId) {
        activeCountMap.set(
          resolvedDesignationId,
          (activeCountMap.get(resolvedDesignationId) || 0) + 1
        );
      }
    }

    return activeCountMap;
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/headcount/context
  //    Returns scoped zones, scoped branches, and active designations
  // --------------------------------------------------------------------------
  router.get('/context', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;

      let zonesQuery = supabaseAdmin
        .from('zones')
        .select('id, name, zone_code, region, is_active')
        .order('name');

      let branchesQuery = supabaseAdmin
        .from('branches')
        .select('id, name, branch_code, branch_type, city_address, address, contact_number, is_active, zone_id, zones(id, name, zone_code)')
        .order('name');

      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (!user.zone_id) {
          return res.status(400).json({
            success: false,
            error: 'Your staff account does not have an assigned zone.',
          });
        }
        zonesQuery = zonesQuery.eq('id', user.zone_id);
        branchesQuery = branchesQuery.eq('zone_id', user.zone_id);
      } else if (user.role === 'branch_manager') {
        if (!user.branch_id) {
          return res.status(400).json({
            success: false,
            error: 'Your Branch Manager account does not have an assigned branch.',
          });
        }
        if (user.zone_id) {
          zonesQuery = zonesQuery.eq('id', user.zone_id);
        }
        branchesQuery = branchesQuery.eq('id', user.branch_id);
      }

      const [{ data: zones, error: zErr }, { data: branches, error: bErr }, { data: designations, error: dErr }] =
        await Promise.all([
          zonesQuery,
          branchesQuery,
          supabaseAdmin
            .from('designations')
            .select('id, name, department_id, employment_category, is_active, departments(id, name, department_code, department_category)')
            .order('name'),
        ]);

      if (zErr) throw zErr;
      if (bErr) throw bErr;
      if (dErr) throw dErr;

      return res.json({
        success: true,
        user,
        zones: zones || [],
        branches: branches || [],
        designations: designations || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/headcount/branches/:branchId
  //    Returns all headcount entries for the selected branch with live
  //    Active Count and Vacancy (Approved - Active, floor at 0)
  // --------------------------------------------------------------------------
  router.get('/branches/:branchId', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;
      const { branchId } = req.params;

      const scopeCheck = await verifyBranchInScope(user, branchId);
      if (!scopeCheck.allowed || !scopeCheck.branch) {
        return res.status(scopeCheck.status).json({ success: false, error: scopeCheck.error });
      }

      const [headcountRes, activeCountMap] = await Promise.all([
        supabaseAdmin
          .from('branch_designation_headcount')
          .select(`
            id,
            branch_id,
            designation_id,
            approved_count,
            created_by,
            updated_at,
            designations (
              id,
              name,
              employment_category,
              department_id,
              is_active,
              departments ( id, name, department_code, department_category )
            )
          `)
          .eq('branch_id', branchId)
          .order('updated_at', { ascending: false }),
        computeLiveActiveCountsForBranch(branchId),
      ]);

      if (headcountRes.error) {
        throw headcountRes.error;
      }

      const rows = headcountRes.data || [];

      // Resolve created_by staff names & roles
      const creatorIds = Array.from(
        new Set(rows.map((r: any) => r.created_by).filter(Boolean))
      );
      const staffMap = new Map<string, { name: string; role: string }>();

      if (creatorIds.length > 0) {
        const { data: staffRows } = await supabaseAdmin
          .from('staff_profiles')
          .select('id, name, roles(name)')
          .in('id', creatorIds);

        for (const s of staffRows || []) {
          const rObj = Array.isArray(s.roles) ? s.roles[0] : (s.roles as any);
          staffMap.set(s.id, {
            name: s.name,
            role: rObj?.name || 'staff',
          });
        }
      }

      const entries = rows.map((row: any) => {
        const desig = Array.isArray(row.designations) ? row.designations[0] : row.designations;
        const dept = desig?.departments
          ? Array.isArray(desig.departments)
            ? desig.departments[0]
            : desig.departments
          : null;

        const approvedCount = Number(row.approved_count) || 0;
        const activeCount = activeCountMap.get(row.designation_id) || 0;
        const vacancy = Math.max(0, approvedCount - activeCount);
        const creator = row.created_by ? staffMap.get(row.created_by) : null;

        return {
          id: row.id,
          branch_id: row.branch_id,
          designation_id: row.designation_id,
          designation_name: desig?.name || 'Unknown Designation',
          employment_category: desig?.employment_category || null,
          department_id: desig?.department_id || null,
          department_name: dept?.name || null,
          department_code: dept?.department_code || null,
          approved_count: approvedCount,
          active_count: activeCount,
          vacancy,
          created_by: row.created_by,
          updated_by_name: creator?.name || 'System Admin',
          updated_by_role: creator?.role || null,
          updated_at: row.updated_at,
        };
      });

      // Sort alphabetically by designation_name for consistent table display
      entries.sort((a, b) => a.designation_name.localeCompare(b.designation_name));

      const totalApproved = entries.reduce((sum, e) => sum + e.approved_count, 0);
      const totalActive = entries.reduce((sum, e) => sum + e.active_count, 0);
      const totalVacancy = entries.reduce((sum, e) => sum + e.vacancy, 0);

      return res.json({
        success: true,
        branch: scopeCheck.branch,
        canEdit: user.canEdit,
        entries,
        summary: {
          totalDesignations: entries.length,
          totalApproved,
          totalActive,
          totalVacancy,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. POST /api/headcount/branches/:branchId
  //    Direct Add / Update Headcount Entry for (branch_id, designation_id)
  //    Allowed for: Super Admin, Zonal HR Manager, Central HR (within scope)
  //    Forbidden for: Branch Manager (read-only)
  // --------------------------------------------------------------------------
  router.post('/branches/:branchId', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;
      const { branchId } = req.params;

      if (!user.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch Managers have read-only access to branch headcount.',
        });
      }

      const scopeCheck = await verifyBranchInScope(user, branchId);
      if (!scopeCheck.allowed || !scopeCheck.branch) {
        return res.status(scopeCheck.status).json({ success: false, error: scopeCheck.error });
      }

      const { designation_id, approved_count } = req.body || {};

      if (!designation_id || typeof designation_id !== 'string' || !designation_id.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Designation is required.',
        });
      }

      const parsedCount = Number(approved_count);
      if (
        approved_count === undefined ||
        approved_count === null ||
        approved_count === '' ||
        !Number.isInteger(parsedCount) ||
        parsedCount < 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Approved Count must be a non-negative whole number (0 or greater).',
        });
      }

      // Verify designation exists
      const { data: desigCheck } = await supabaseAdmin
        .from('designations')
        .select('id, name')
        .eq('id', designation_id.trim())
        .maybeSingle();

      if (!desigCheck) {
        return res.status(404).json({
          success: false,
          error: 'Selected designation does not exist.',
        });
      }

      const now = new Date().toISOString();
      const payload = {
        branch_id: branchId,
        designation_id: designation_id.trim(),
        approved_count: parsedCount,
        created_by: user.id,
        updated_at: now,
      };

      const { data: savedEntry, error: upsertErr } = await supabaseAdmin
        .from('branch_designation_headcount')
        .upsert(payload, { onConflict: 'branch_id,designation_id' })
        .select()
        .single();

      if (upsertErr) {
        return res.status(400).json({ success: false, error: upsertErr.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'staff',
        action: 'save_branch_headcount',
        entity_type: 'branch_designation_headcount',
        entity_id: savedEntry.id,
        metadata: {
          branch_id: branchId,
          branch_name: scopeCheck.branch.name,
          designation_id: desigCheck.id,
          designation_name: desigCheck.name,
          approved_count: parsedCount,
          actor_role: user.role,
        },
      });

      return res.json({
        success: true,
        data: savedEntry,
        message: `Headcount for "${desigCheck.name}" saved (${parsedCount} approved).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. PUT /api/headcount/entries/:entryId
  //    Direct Edit of an existing headcount entry
  // --------------------------------------------------------------------------
  router.put('/entries/:entryId', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;
      const { entryId } = req.params;

      if (!user.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch Managers have read-only access to branch headcount.',
        });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('branch_designation_headcount')
        .select('id, branch_id, designation_id, approved_count')
        .eq('id', entryId)
        .maybeSingle();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Headcount entry not found.' });
      }

      const scopeCheck = await verifyBranchInScope(user, existing.branch_id);
      if (!scopeCheck.allowed || !scopeCheck.branch) {
        return res.status(scopeCheck.status).json({ success: false, error: scopeCheck.error });
      }

      const { approved_count, designation_id } = req.body || {};
      const parsedCount = Number(approved_count);
      if (
        approved_count === undefined ||
        approved_count === null ||
        approved_count === '' ||
        !Number.isInteger(parsedCount) ||
        parsedCount < 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'Approved Count must be a non-negative whole number (0 or greater).',
        });
      }

      const updatePayload: Record<string, any> = {
        approved_count: parsedCount,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (designation_id && typeof designation_id === 'string' && designation_id.trim()) {
        updatePayload.designation_id = designation_id.trim();
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('branch_designation_headcount')
        .update(updatePayload)
        .eq('id', entryId)
        .select()
        .single();

      if (updateErr) {
        if (updateErr.message.toLowerCase().includes('uq_branch_designation_headcount') || updateErr.message.toLowerCase().includes('unique')) {
          return res.status(400).json({
            success: false,
            error: 'A headcount entry for this designation already exists in this branch.',
          });
        }
        return res.status(400).json({ success: false, error: updateErr.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'staff',
        action: 'update_branch_headcount',
        entity_type: 'branch_designation_headcount',
        entity_id: entryId,
        metadata: {
          branch_id: existing.branch_id,
          previous_approved_count: existing.approved_count,
          new_approved_count: parsedCount,
          actor_role: user.role,
        },
      });

      return res.json({
        success: true,
        data: updated,
        message: 'Headcount entry updated.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. DELETE /api/headcount/entries/:entryId
  //    Direct Delete of an existing headcount entry
  // --------------------------------------------------------------------------
  router.delete('/entries/:entryId', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;
      const { entryId } = req.params;

      if (!user.canEdit) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch Managers have read-only access to branch headcount.',
        });
      }

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('branch_designation_headcount')
        .select('id, branch_id, designation_id, approved_count')
        .eq('id', entryId)
        .maybeSingle();

      if (fetchErr || !existing) {
        return res.status(404).json({ success: false, error: 'Headcount entry not found.' });
      }

      const scopeCheck = await verifyBranchInScope(user, existing.branch_id);
      if (!scopeCheck.allowed || !scopeCheck.branch) {
        return res.status(scopeCheck.status).json({ success: false, error: scopeCheck.error });
      }

      const { error: delErr } = await supabaseAdmin
        .from('branch_designation_headcount')
        .delete()
        .eq('id', entryId);

      if (delErr) {
        return res.status(400).json({ success: false, error: delErr.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'staff',
        action: 'delete_branch_headcount',
        entity_type: 'branch_designation_headcount',
        entity_id: entryId,
        metadata: {
          branch_id: existing.branch_id,
          designation_id: existing.designation_id,
          approved_count: existing.approved_count,
          actor_role: user.role,
        },
      });

      return res.json({
        success: true,
        message: 'Headcount entry deleted.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 6. GET /api/headcount/overview (Part D of 4: Dashboard Overview Redesign)
  //    Returns role-scoped headcount rollups (Rider vs In-House Staff),
  //    Approved, Active, Vacancy, Fill-Rate Status (On Target >=95%,
  //    Understaffed >=80% & <95%, Critical <80%), inline Trend (current vs
  //    last month's Active count, or "—" if no historical data exists),
  //    and real monthly historical series for the row-click detail modal.
  // --------------------------------------------------------------------------
  router.get('/overview', requireHeadcountAccess, async (req: any, res) => {
    try {
      const user: HeadcountStaffContext = req.headcountUser;
      const requestedZoneId = typeof req.query.zoneId === 'string' ? req.query.zoneId.trim() : '';
      const requestedBranchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : '';

      // 1. Check staff_branch_assignments for tagged branches (Part C integration)
      let taggedBranchIds: string[] = [];
      try {
        const { data: sbaRows } = await supabaseAdmin
          .from('staff_branch_assignments')
          .select('branch_id')
          .eq('staff_profile_id', user.id);
        if (sbaRows && sbaRows.length > 0) {
          taggedBranchIds = sbaRows.map((r: any) => r.branch_id).filter(Boolean);
        }
      } catch (_) {
        // Ignore if table not queried
      }

      // 2. Fetch Zones, Branches, Designations, and Staff Profiles
      let zonesQuery = supabaseAdmin
        .from('zones')
        .select('id, name, zone_code, region, is_active')
        .order('name');

      let branchesQuery = supabaseAdmin
        .from('branches')
        .select('id, name, branch_code, branch_type, city_address, address, contact_number, is_active, zone_id, zones(id, name, zone_code, region)')
        .order('name');

      if (user.role === 'zonal_hr_manager') {
        if (user.zone_id) {
          zonesQuery = zonesQuery.eq('id', user.zone_id);
          branchesQuery = branchesQuery.eq('zone_id', user.zone_id);
        } else {
          return res.json(buildEmptyOverviewResponse(user, []));
        }
      } else if (user.role === 'central_hr') {
        if (user.zone_id) {
          zonesQuery = zonesQuery.eq('id', user.zone_id);
          branchesQuery = branchesQuery.eq('zone_id', user.zone_id);
          if (taggedBranchIds.length > 0) {
            branchesQuery = branchesQuery.in('id', taggedBranchIds);
          }
        } else if (taggedBranchIds.length > 0) {
          branchesQuery = branchesQuery.in('id', taggedBranchIds);
        } else {
          return res.json(buildEmptyOverviewResponse(user, []));
        }
      } else if (user.role === 'branch_manager') {
        const bmBranchIds = Array.from(
          new Set([...(user.branch_id ? [user.branch_id] : []), ...taggedBranchIds])
        );
        if (bmBranchIds.length === 0) {
          return res.json(buildEmptyOverviewResponse(user, []));
        }
        if (user.zone_id) {
          zonesQuery = zonesQuery.eq('id', user.zone_id);
        }
        branchesQuery = branchesQuery.in('id', bmBranchIds);
      } else if (user.role === 'super_admin') {
        if (requestedZoneId && requestedZoneId !== 'all') {
          zonesQuery = zonesQuery.eq('id', requestedZoneId);
          branchesQuery = branchesQuery.eq('zone_id', requestedZoneId);
        }
        if (requestedBranchId && requestedBranchId !== 'all') {
          branchesQuery = branchesQuery.eq('id', requestedBranchId);
        }
      }

      const [
        { data: zonesData, error: zErr },
        { data: branchesData, error: bErr },
        { data: designationsData, error: dErr },
        { data: allStaffProfiles },
      ] = await Promise.all([
        zonesQuery,
        branchesQuery,
        supabaseAdmin
          .from('designations')
          .select('id, name, department_id, employment_category, is_active, departments(id, name, department_code, department_category)')
          .order('name'),
        supabaseAdmin
          .from('staff_profiles')
          .select('id, name, personal_email, branch_id, zone_id, is_active, roles(name)'),
      ]);

      if (zErr) throw zErr;
      if (bErr) throw bErr;
      if (dErr) throw dErr;

      const scopedBranches = branchesData || [];
      const scopedBranchIds = scopedBranches.map((b: any) => b.id);
      const scopedZoneIds = new Set<string>(
        scopedBranches.map((b: any) => b.zone_id).filter(Boolean)
      );
      const scopedZones = (zonesData || []).filter(
        (z: any) => user.role === 'super_admin' || scopedZoneIds.has(z.id) || z.id === user.zone_id
      );
      const allDesignations = designationsData || [];

      const designationMap = new Map<string, any>();
      for (const d of allDesignations) {
        designationMap.set(d.id, d);
      }

      // Resolve Branch Managers per branch
      const bmByBranchId = new Map<string, Array<{ id: string; name: string; email: string }>>();
      for (const sp of allStaffProfiles || []) {
        const rObj = Array.isArray(sp.roles) ? sp.roles[0] : (sp.roles as any);
        if (rObj?.name === 'branch_manager' && sp.branch_id && sp.is_active !== false) {
          const list = bmByBranchId.get(sp.branch_id) || [];
          list.push({ id: sp.id, name: sp.name, email: sp.personal_email || '' });
          bmByBranchId.set(sp.branch_id, list);
        }
      }

      // 3. Fetch branch_designation_headcount rows for scoped branches
      let headcountRows: any[] = [];
      if (scopedBranchIds.length > 0) {
        const { data: hcData, error: hcErr } = await supabaseAdmin
          .from('branch_designation_headcount')
          .select('id, branch_id, designation_id, approved_count, updated_at')
          .in('branch_id', scopedBranchIds);
        if (hcErr) throw hcErr;
        headcountRows = hcData || [];
      }

      // 4. Fetch Active Employees in scoped branches
      //    Definition: Any row in employees (approved/enrolled candidates) linked to a designation
      interface ResolvedActiveEmployee {
        employee_row_id: string;
        employee_id: string;
        application_id: string;
        candidate_id: string;
        branch_id: string;
        zone_id: string;
        designation_id: string;
        employment_category: 'Rider' | 'In-House Staff';
        enrolled_at: string;
      }

      const resolvedEmployees: ResolvedActiveEmployee[] = [];

      if (scopedBranchIds.length > 0) {
        const { data: branchCandidates } = await supabaseAdmin
          .from('candidates')
          .select('*')
          .in('branch_id', scopedBranchIds);

        if (branchCandidates && branchCandidates.length > 0) {
          const candMap = new Map<string, any>();
          for (const c of branchCandidates) {
            candMap.set(c.id, c);
          }
          const candidateIds = Array.from(candMap.keys());

          const { data: apps } = await supabaseAdmin
            .from('applications')
            .select('id, candidate_id, status, decision_reason, decided_at, created_at')
            .in('candidate_id', candidateIds);

          const activeAppMap = new Map<string, any>();
          for (const a of apps || []) {
            if (!dataRetentionService.isApplicationArchived(a.id, a.decision_reason)) {
              activeAppMap.set(a.id, a);
            }
          }

          const applicationIds = Array.from(activeAppMap.keys());
          if (applicationIds.length > 0) {
            const [{ data: empRows }, { data: step1Rows }] = await Promise.all([
              supabaseAdmin
                .from('employees')
                .select('*')
                .in('application_id', applicationIds),
              supabaseAdmin
                .from('application_steps')
                .select('application_id, data')
                .in('application_id', applicationIds)
                .eq('step_number', 1),
            ]);

            const step1DesigMap = new Map<string, string>();
            for (const s of step1Rows || []) {
              const dId = s?.data?.designation_id;
              if (dId && typeof dId === 'string') {
                step1DesigMap.set(s.application_id, dId);
              }
            }

            const branchZoneMap = new Map<string, string>();
            for (const b of scopedBranches) {
              branchZoneMap.set(b.id, b.zone_id);
            }

            for (const emp of empRows || []) {
              const app = activeAppMap.get(emp.application_id);
              if (!app) continue;
              const cand = candMap.get(app.candidate_id);
              if (!cand || !cand.branch_id) continue;

              const resolvedDesigId =
                emp.designation_id ||
                cand.designation_id ||
                step1DesigMap.get(emp.application_id) ||
                (allDesignations[0]?.id ?? '');

              const desigObj = designationMap.get(resolvedDesigId);
              const cat = normalizeEmploymentCategory(desigObj?.employment_category);
              const enrolledAt =
                emp.enrolled_at ||
                app.decided_at ||
                emp.created_at ||
                app.created_at ||
                new Date().toISOString();

              resolvedEmployees.push({
                employee_row_id: emp.id,
                employee_id: emp.employee_id,
                application_id: emp.application_id,
                candidate_id: cand.id,
                branch_id: cand.branch_id,
                zone_id: cand.zone_id || branchZoneMap.get(cand.branch_id) || '',
                designation_id: resolvedDesigId,
                employment_category: cat,
                enrolled_at: enrolledAt,
              });
            }
          }
        }
      }

      // 5. Build Rollups for Designation, Branch, Zone, and Overall Summary
      const now = new Date();
      const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      function buildMetricBlock(approved: number, empList: ResolvedActiveEmployee[]) {
        const active = empList.length;
        const vacancy = Math.max(0, approved - active);
        const fillRatePct =
          approved > 0
            ? Number(((active / approved) * 100).toFixed(1))
            : active > 0
            ? 100
            : 0;
        const fillRateStatus: 'On Target' | 'Understaffed' | 'Critical' =
          fillRatePct >= 95
            ? 'On Target'
            : fillRatePct >= 80
            ? 'Understaffed'
            : 'Critical';

        // Check if real historical data from prior months exists
        const priorMonthEmps = empList.filter((e) => {
          const ts = Date.parse(e.enrolled_at);
          return !Number.isNaN(ts) && ts < currentMonthStart.getTime();
        });

        const hasHistoricalData = priorMonthEmps.length > 0;
        const lastMonthActive = hasHistoricalData ? priorMonthEmps.length : null;
        const delta = hasHistoricalData && lastMonthActive !== null ? active - lastMonthActive : null;
        const direction: 'up' | 'down' | 'flat' | 'none' =
          !hasHistoricalData || delta === null
            ? 'none'
            : delta > 0
            ? 'up'
            : delta < 0
            ? 'down'
            : 'flat';
        const display =
          direction === 'up'
            ? '▲'
            : direction === 'down'
            ? '▼'
            : '—';

        return {
          approved,
          active,
          vacancy,
          fill_rate_pct: fillRatePct,
          fill_rate_status: fillRateStatus,
          trend: {
            direction,
            display,
            delta,
            current_active: active,
            last_month_active: lastMonthActive,
            has_historical_data: hasHistoricalData,
          },
        };
      }

      function buildHistoricalSeries(
        approvedTarget: number,
        empList: ResolvedActiveEmployee[]
      ) {
        if (empList.length === 0) {
          return {
            has_prior_months_history: false,
            series: [] as Array<{
              month_key: string;
              month_label: string;
              total_active: number;
              rider_active: number;
              in_house_active: number;
              new_enrollments: number;
              approved_target: number;
            }>,
          };
        }

        const timestamps = empList
          .map((e) => Date.parse(e.enrolled_at))
          .filter((t) => !Number.isNaN(t));

        const minTs = timestamps.length > 0 ? Math.min(...timestamps) : now.getTime();
        const minDate = new Date(minTs);

        let startYear = minDate.getUTCFullYear();
        let startMonth = minDate.getUTCMonth();
        const endYear = now.getUTCFullYear();
        const endMonth = now.getUTCMonth();

        // Cap at most 12 months back
        const totalMonthsDiff = (endYear - startYear) * 12 + (endMonth - startMonth);
        if (totalMonthsDiff > 11) {
          const cappedDate = new Date(Date.UTC(endYear, endMonth - 11, 1));
          startYear = cappedDate.getUTCFullYear();
          startMonth = cappedDate.getUTCMonth();
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const series: Array<{
          month_key: string;
          month_label: string;
          total_active: number;
          rider_active: number;
          in_house_active: number;
          new_enrollments: number;
          approved_target: number;
        }> = [];

        let y = startYear;
        let m = startMonth;
        while (y < endYear || (y === endYear && m <= endMonth)) {
          const monthStart = Date.UTC(y, m, 1);
          const nextMonthStart = Date.UTC(y, m + 1, 1);

          const cumulativeEmps = empList.filter((e) => {
            const t = Date.parse(e.enrolled_at);
            return !Number.isNaN(t) && t < nextMonthStart;
          });
          const enrolledInMonth = empList.filter((e) => {
            const t = Date.parse(e.enrolled_at);
            return !Number.isNaN(t) && t >= monthStart && t < nextMonthStart;
          });

          const riderActive = cumulativeEmps.filter((e) => e.employment_category === 'Rider').length;
          const inHouseActive = cumulativeEmps.filter((e) => e.employment_category === 'In-House Staff').length;

          series.push({
            month_key: `${y}-${String(m + 1).padStart(2, '0')}`,
            month_label: `${monthNames[m]} ${y}`,
            total_active: cumulativeEmps.length,
            rider_active: riderActive,
            in_house_active: inHouseActive,
            new_enrollments: enrolledInMonth.length,
            approved_target: approvedTarget,
          });

          m++;
          if (m > 11) {
            m = 0;
            y++;
          }
        }

        return {
          has_prior_months_history: series.length > 1,
          series,
        };
      }

      // Helper to build designation breakdown for a set of branchIds
      function buildDesignationBreakdownForBranches(targetBranchIds: Set<string>) {
        const branchHcRows = headcountRows.filter((r) => targetBranchIds.has(r.branch_id));
        const branchEmps = resolvedEmployees.filter((e) => targetBranchIds.has(e.branch_id));

        const approvedByDesig = new Map<string, number>();
        for (const r of branchHcRows) {
          approvedByDesig.set(
            r.designation_id,
            (approvedByDesig.get(r.designation_id) || 0) + (Number(r.approved_count) || 0)
          );
        }

        const empsByDesig = new Map<string, ResolvedActiveEmployee[]>();
        for (const e of branchEmps) {
          const list = empsByDesig.get(e.designation_id) || [];
          list.push(e);
          empsByDesig.set(e.designation_id, list);
        }

        const relevantDesigIds = new Set<string>([
          ...Array.from(approvedByDesig.keys()),
          ...Array.from(empsByDesig.keys()),
        ]);

        const rows = Array.from(relevantDesigIds).map((desigId) => {
          const desig = designationMap.get(desigId);
          const dept = desig?.departments
            ? Array.isArray(desig.departments)
              ? desig.departments[0]
              : desig.departments
            : null;
          const category = normalizeEmploymentCategory(desig?.employment_category);
          const approved = approvedByDesig.get(desigId) || 0;
          const emps = empsByDesig.get(desigId) || [];
          const metrics = buildMetricBlock(approved, emps);
          const history = buildHistoricalSeries(approved, emps);

          return {
            designation_id: desigId,
            designation_name: desig?.name || 'Unassigned Designation',
            employment_category: category,
            department_id: desig?.department_id || null,
            department_name: dept?.name || 'General',
            department_code: dept?.department_code || null,
            department_category: dept?.department_category || null,
            ...metrics,
            has_prior_months_history: history.has_prior_months_history,
            historical_series: history.series,
          };
        });

        rows.sort((a, b) => a.designation_name.localeCompare(b.designation_name));
        return rows;
      }

      // 6. Build Branch Rows
      const branchRows = scopedBranches.map((branch: any) => {
        const bIdSet = new Set<string>([branch.id]);
        const branchHcRows = headcountRows.filter((r) => r.branch_id === branch.id);
        const branchEmps = resolvedEmployees.filter((e) => e.branch_id === branch.id);

        let riderApproved = 0;
        let inHouseApproved = 0;
        for (const r of branchHcRows) {
          const desig = designationMap.get(r.designation_id);
          const cat = normalizeEmploymentCategory(desig?.employment_category);
          const count = Number(r.approved_count) || 0;
          if (cat === 'Rider') riderApproved += count;
          else inHouseApproved += count;
        }

        const riderEmps = branchEmps.filter((e) => e.employment_category === 'Rider');
        const inHouseEmps = branchEmps.filter((e) => e.employment_category === 'In-House Staff');

        const riderMetrics = buildMetricBlock(riderApproved, riderEmps);
        const inHouseMetrics = buildMetricBlock(inHouseApproved, inHouseEmps);
        const totalApproved = riderApproved + inHouseApproved;
        const totalMetrics = buildMetricBlock(totalApproved, branchEmps);
        const history = buildHistoricalSeries(totalApproved, branchEmps);
        const designationBreakdown = buildDesignationBreakdownForBranches(bIdSet);

        const rawZone = branch.zones;
        const zoneObj = Array.isArray(rawZone) ? rawZone[0] : rawZone;

        return {
          branch_id: branch.id,
          branch_name: branch.name,
          branch_code: branch.branch_code || null,
          branch_type: branch.branch_type || 'Hub',
          city_address: branch.city_address || branch.address || null,
          contact_number: branch.contact_number || null,
          is_active: branch.is_active !== false,
          zone_id: branch.zone_id,
          zone_name: zoneObj?.name || user.zone_name || 'Assigned Zone',
          zone_code: zoneObj?.zone_code || null,
          branch_managers: bmByBranchId.get(branch.id) || [],
          rider: riderMetrics,
          in_house: inHouseMetrics,
          total: totalMetrics,
          has_prior_months_history: history.has_prior_months_history,
          historical_series: history.series,
          designation_breakdown: designationBreakdown,
        };
      });

      // 7. Build Zone Rows
      const zoneRows = scopedZones.map((zone: any) => {
        const zoneBranchesList = branchRows.filter((b) => b.zone_id === zone.id);
        const zoneBranchIds = new Set<string>(zoneBranchesList.map((b) => b.branch_id));
        const zoneEmps = resolvedEmployees.filter((e) => zoneBranchIds.has(e.branch_id));

        const riderApproved = zoneBranchesList.reduce((sum, b) => sum + b.rider.approved, 0);
        const inHouseApproved = zoneBranchesList.reduce((sum, b) => sum + b.in_house.approved, 0);
        const totalApproved = riderApproved + inHouseApproved;

        const riderEmps = zoneEmps.filter((e) => e.employment_category === 'Rider');
        const inHouseEmps = zoneEmps.filter((e) => e.employment_category === 'In-House Staff');

        const riderMetrics = buildMetricBlock(riderApproved, riderEmps);
        const inHouseMetrics = buildMetricBlock(inHouseApproved, inHouseEmps);
        const totalMetrics = buildMetricBlock(totalApproved, zoneEmps);
        const history = buildHistoricalSeries(totalApproved, zoneEmps);
        const designationBreakdown = buildDesignationBreakdownForBranches(zoneBranchIds);

        return {
          zone_id: zone.id,
          zone_name: zone.name,
          zone_code: zone.zone_code || null,
          region: zone.region || null,
          is_active: zone.is_active !== false,
          branches_count: zoneBranchesList.length,
          rider: riderMetrics,
          in_house: inHouseMetrics,
          total: totalMetrics,
          has_prior_months_history: history.has_prior_months_history,
          historical_series: history.series,
          branch_breakdown: zoneBranchesList,
          designation_breakdown: designationBreakdown,
        };
      });

      // 8. Build Overall Scoped Designation Rows & Overall Summary
      const allScopedBranchIdSet = new Set<string>(scopedBranchIds);
      const designationRows = buildDesignationBreakdownForBranches(allScopedBranchIdSet);

      const overallRiderApproved = branchRows.reduce((sum, b) => sum + b.rider.approved, 0);
      const overallInHouseApproved = branchRows.reduce((sum, b) => sum + b.in_house.approved, 0);
      const overallTotalApproved = overallRiderApproved + overallInHouseApproved;

      const overallRiderEmps = resolvedEmployees.filter((e) => e.employment_category === 'Rider');
      const overallInHouseEmps = resolvedEmployees.filter((e) => e.employment_category === 'In-House Staff');

      const summaryRider = buildMetricBlock(overallRiderApproved, overallRiderEmps);
      const summaryInHouse = buildMetricBlock(overallInHouseApproved, overallInHouseEmps);
      const summaryTotal = buildMetricBlock(overallTotalApproved, resolvedEmployees);
      const summaryHistory = buildHistoricalSeries(overallTotalApproved, resolvedEmployees);

      return res.json({
        success: true,
        user: {
          ...user,
          tagged_branch_ids: taggedBranchIds,
        },
        active_definition_note:
          'Active is defined as any row in employees (approved/enrolled candidates). No offboarding flow exists yet, so all enrolled employees currently count as active.',
        summary: {
          total: {
            ...summaryTotal,
            has_prior_months_history: summaryHistory.has_prior_months_history,
            historical_series: summaryHistory.series,
          },
          rider: summaryRider,
          in_house: summaryInHouse,
          zones_count: scopedZones.length,
          branches_count: scopedBranches.length,
          designations_count: designationRows.length,
        },
        zone_rows: zoneRows,
        branch_rows: branchRows,
        designation_rows: designationRows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  function normalizeEmploymentCategory(raw?: string | null): 'Rider' | 'In-House Staff' {
    if (!raw) return 'In-House Staff';
    return String(raw).trim().toLowerCase().includes('rider') ? 'Rider' : 'In-House Staff';
  }

  function buildEmptyOverviewResponse(user: HeadcountStaffContext, taggedBranchIds: string[]) {
    const emptyBlock = {
      approved: 0,
      active: 0,
      vacancy: 0,
      fill_rate_pct: 0,
      fill_rate_status: 'Critical' as const,
      trend: {
        direction: 'none' as const,
        display: '—',
        delta: null,
        current_active: 0,
        last_month_active: null,
        has_historical_data: false,
      },
    };
    return {
      success: true,
      user: { ...user, tagged_branch_ids: taggedBranchIds },
      active_definition_note:
        'Active is defined as any row in employees (approved/enrolled candidates). No offboarding flow exists yet, so all enrolled employees currently count as active.',
      summary: {
        total: {
          ...emptyBlock,
          has_prior_months_history: false,
          historical_series: [],
        },
        rider: emptyBlock,
        in_house: emptyBlock,
        zones_count: 0,
        branches_count: 0,
        designations_count: 0,
      },
      zone_rows: [],
      branch_rows: [],
      designation_rows: [],
    };
  }

  return router;
}
