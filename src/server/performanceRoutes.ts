// ==============================================================================
// PostEx HR Onboarding Portal — User Performance Tracker Routes (Step 11B)
// ==============================================================================
// Governance & Scoping Rules:
// - Access restricted to: super_admin and zonal_hr_manager ONLY.
// - central_hr, branch_manager, and candidates receive HTTP 403.
// - zonal_hr_manager is strictly scoped to their assigned zone_id.
// - All aggregations calculated from real database tables with bulk queries.
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export interface PerformanceStaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
  zone_id: string | null;
  zone_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
}

const TARGET_DAYS: Record<string, number> = {
  code: 0,
  machine: 1,
  login: 1,
  sim: 2,
  idcard: 3,
  docs_to_ho: 5,
};

const ASSET_KEYS = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'];

export function computePerformanceFlag(
  joinersCount: number,
  onTimeRate: number
): { label: string; variant: 'neutral' | 'success' | 'warning' | 'error'; color: string } {
  if (joinersCount < 4) {
    return { label: 'Low volume', variant: 'neutral', color: 'bg-slate-400' };
  }
  if (onTimeRate >= 85) {
    return { label: 'On track', variant: 'success', color: 'bg-emerald-500' };
  }
  if (onTimeRate >= 65) {
    return { label: 'Watch', variant: 'warning', color: 'bg-amber-500' };
  }
  return { label: 'Needs action', variant: 'error', color: 'bg-rose-500' };
}

export function createPerformanceRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // --------------------------------------------------------------------------
  // Middleware: Authenticate staff user & resolve geographic scope
  // --------------------------------------------------------------------------
  async function requirePerformanceAccess(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return res.status(401).json({ success: false, error: 'Bearer token required.' });
      }

      // 1. Service role bypass
      if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        req.staffUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@postex.pk',
          name: 'Super Admin',
          role: 'super_admin',
          zone_id: null,
          zone_name: null,
          branch_id: null,
          branch_name: null,
        } satisfies PerformanceStaffContext;
        return next();
      }

      // 2. Authenticate user with Supabase Auth
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      // 3. Fetch staff profile
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select(`
          id,
          name,
          is_active,
          zone_id,
          branch_id,
          roles ( id, name ),
          zones ( id, name ),
          branches ( id, name, zone_id )
        `)
        .eq('id', authUser.user.id)
        .maybeSingle();

      if (profErr || !profile) {
        return res.status(403).json({
          success: false,
          error: 'Staff profile not found. Candidates cannot access performance analytics.',
        });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Staff account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = Array.isArray(rawRole)
        ? rawRole[0]?.name
        : (rawRole?.name || authUser.user.user_metadata?.role);

      // Super Admin and Zonal HR Manager ONLY
      if (roleName === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers do not have access to HR performance analytics.',
        });
      }

      if (roleName === 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Central HR officers do not have access to HR performance analytics.',
        });
      }

      if (roleName !== 'super_admin' && roleName !== 'zonal_hr_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges to access performance analytics.',
        });
      }

      const rawBranch = profile.branches as any;
      const rawZone = profile.zones as any;

      req.staffUser = {
        id: profile.id,
        email: authUser.user.email || '',
        name: profile.name || 'PostEx Staff',
        role: roleName,
        zone_id: profile.zone_id || null,
        zone_name: rawZone ? (Array.isArray(rawZone) ? rawZone[0]?.name : rawZone.name) : null,
        branch_id: profile.branch_id || null,
        branch_name: rawBranch ? (Array.isArray(rawBranch) ? rawBranch[0]?.name : rawBranch.name) : null,
      } satisfies PerformanceStaffContext;

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/performance/hr
  // Query params: zone, branch, start_date, end_date (or date_from, date_to)
  // Computes live scorecard and rollups from real tables with zero N+1 queries.
  // --------------------------------------------------------------------------
  router.get('/hr', requirePerformanceAccess, async (req: any, res: any) => {
    try {
      const user: PerformanceStaffContext = req.staffUser;

      // Extract and normalize filters
      const rawZone = req.query.zone ? String(req.query.zone).trim() : null;
      const rawBranch = req.query.branch ? String(req.query.branch).trim() : null;
      const rawStartDate = (req.query.start_date || req.query.date_from)
        ? String(req.query.start_date || req.query.date_from).trim()
        : null;
      const rawEndDate = (req.query.end_date || req.query.date_to)
        ? String(req.query.end_date || req.query.date_to).trim()
        : null;

      // Scoping enforcement for Zonal HR Manager
      let effectiveZoneId: string | null = null;
      if (user.role === 'zonal_hr_manager') {
        effectiveZoneId = user.zone_id;
        if (rawZone && rawZone !== user.zone_id && rawZone !== user.zone_name) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot access HR performance metrics outside your assigned zone.',
          });
        }
      } else {
        effectiveZoneId = rawZone;
      }

      // 1. Bulk query organization metadata: Zones and Branches
      const [zonesRes, branchesRes, staffRes] = await Promise.all([
        supabaseAdmin.from('zones').select('id, name'),
        supabaseAdmin.from('branches').select('id, name, zone_id'),
        supabaseAdmin.from('staff_profiles').select('id, name, personal_email, zone_id, branch_id, roles ( id, name )'),
      ]);

      const allZones = zonesRes.data || [];
      const allBranches = branchesRes.data || [];
      const allStaff = staffRes.data || [];

      const zoneMap = new Map<string, string>();
      allZones.forEach((z) => zoneMap.set(z.id, z.name));

      const branchMap = new Map<string, { id: string; name: string; zone_id: string }>();
      allBranches.forEach((b) => branchMap.set(b.id, b));

      const staffMap = new Map<string, string>();
      allStaff.forEach((s) => staffMap.set(s.id, s.name));

      // 2. Fetch Employees matching filters
      let empQuery = supabaseAdmin
        .from('employees')
        .select(`
          id,
          employee_id,
          full_name,
          designation_name,
          joining_date,
          branch_id,
          zone_id,
          status,
          application_id
        `);

      if (effectiveZoneId) {
        // Match by zone_id or zone_name
        const matchedZone = allZones.find(
          (z) => z.id === effectiveZoneId || z.name.toLowerCase() === effectiveZoneId.toLowerCase()
        );
        const zId = matchedZone ? matchedZone.id : effectiveZoneId;
        empQuery = empQuery.eq('zone_id', zId);
      }

      if (rawBranch) {
        const matchedBranch = allBranches.find(
          (b) => b.id === rawBranch || b.name.toLowerCase() === rawBranch.toLowerCase()
        );
        const bId = matchedBranch ? matchedBranch.id : rawBranch;
        empQuery = empQuery.eq('branch_id', bId);
      }

      if (rawStartDate) {
        empQuery = empQuery.gte('joining_date', rawStartDate);
      }
      if (rawEndDate) {
        empQuery = empQuery.lte('joining_date', rawEndDate);
      }

      const { data: employees, error: empErr } = await empQuery;
      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }

      const empList = employees || [];
      const empIds = empList.map((e) => e.id);
      const appIds = empList.map((e) => e.application_id).filter(Boolean);

      // If no employees found, return zeroed metrics
      if (empList.length === 0) {
        return res.status(200).json({
          success: true,
          kpi: {
            joiners_handled: 0,
            on_time_rate: 0,
            overdue_items: 0,
            open_clearance_forms: 0,
            avg_days: 0,
            emails_sent: 0,
            emails_total: 0,
            total_items: 0,
            items_provided: 0,
          },
          scorecard: {
            officers: [],
            zones: [],
            branches: [],
          },
        });
      }

      // 3. Bulk fetch HR officer attribution for applications (Zero N+1)
      const [appsRes, enrollAuditsRes, decisionsRes] = await Promise.all([
        supabaseAdmin.from('applications').select('id, assigned_central_hr_id').in('id', appIds),
        supabaseAdmin.from('audit_logs')
          .select('entity_id, actor_id')
          .eq('action', 'central_hr_enrolled_employee')
          .in('entity_id', appIds),
        supabaseAdmin.from('hr_decisions')
          .select('application_id, decided_by')
          .eq('decision', 'approved')
          .in('application_id', appIds),
      ]);

      const appMap = new Map((appsRes.data || []).map((a) => [a.id, a.assigned_central_hr_id]));
      const auditMap = new Map((enrollAuditsRes.data || []).map((a) => [a.entity_id, a.actor_id]));
      const decisionMap = new Map((decisionsRes.data || []).map((d) => [d.application_id, d.decided_by]));

      // Attribution resolver:
      // 1) assigned_central_hr_id on applications
      // 2) actor_id on audit_logs for central_hr_enrolled_employee
      // 3) decided_by on hr_decisions
      // 4) Fallback: 'unassigned'
      function resolveOfficerId(applicationId: string | null): string {
        if (!applicationId) return 'unassigned';
        const assigned = appMap.get(applicationId);
        if (assigned) return assigned;
        const fromAudit = auditMap.get(applicationId);
        if (fromAudit) return fromAudit;
        const fromDecision = decisionMap.get(applicationId);
        if (fromDecision) return fromDecision;
        return 'unassigned';
      }

      // 4. Bulk fetch asset statuses for all employees
      const { data: assetStatuses, error: astErr } = await supabaseAdmin
        .from('employee_asset_status')
        .select('employee_id, item_key, state, updated_at')
        .in('employee_id', empIds);

      if (astErr) {
        return res.status(500).json({ success: false, error: astErr.message });
      }

      const assetMap = new Map<string, Map<string, { state: string; updated_at: string }>>();
      (assetStatuses || []).forEach((row) => {
        let m = assetMap.get(row.employee_id);
        if (!m) {
          m = new Map();
          assetMap.set(row.employee_id, m);
        }
        m.set(row.item_key, { state: row.state, updated_at: row.updated_at });
      });

      // 5. Bulk fetch latest sent emails
      const { data: emailRows, error: emailErr } = await supabaseAdmin
        .from('joiner_asset_emails')
        .select('employee_id, sent_at, status, snapshot')
        .in('employee_id', empIds)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      if (emailErr) {
        return res.status(500).json({ success: false, error: emailErr.message });
      }

      const latestEmailMap = new Map<string, any>();
      (emailRows || []).forEach((email) => {
        if (!latestEmailMap.has(email.employee_id)) {
          latestEmailMap.set(email.employee_id, email);
        }
      });

      // 6. Bulk fetch employee exits for scoping & counts
      let exitQuery = supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          status,
          initiated_by_id,
          initiated_by_name,
          completed_by_id,
          employees (
            id,
            zone_id,
            branch_id,
            joining_date
          )
        `);

      if (effectiveZoneId) {
        const matchedZone = allZones.find(
          (z) => z.id === effectiveZoneId || z.name.toLowerCase() === effectiveZoneId.toLowerCase()
        );
        const zId = matchedZone ? matchedZone.id : effectiveZoneId;
        exitQuery = exitQuery.eq('employees.zone_id', zId);
      }
      if (rawBranch) {
        const matchedBranch = allBranches.find(
          (b) => b.id === rawBranch || b.name.toLowerCase() === rawBranch.toLowerCase()
        );
        const bId = matchedBranch ? matchedBranch.id : rawBranch;
        exitQuery = exitQuery.eq('employees.branch_id', bId);
      }

      const { data: exitRows } = await exitQuery;
      const allExits = exitRows || [];

      // Map exits by employee_id and by officer
      const openExitsByOfficer = new Map<string, number>();
      const exitsHandledByOfficer = new Map<string, number>();
      const exitsCompletedByOfficer = new Map<string, number>();
      const openExitsByZone = new Map<string, number>();
      const openExitsByBranch = new Map<string, number>();

      let overallOpenEcfs = 0;

      allExits.forEach((ex: any) => {
        const emp = ex.employees as any;
        const zId = emp?.zone_id || 'unknown';
        const bId = emp?.branch_id || 'unknown';

        if (ex.status === 'in_progress') {
          overallOpenEcfs++;
          openExitsByZone.set(zId, (openExitsByZone.get(zId) || 0) + 1);
          openExitsByBranch.set(bId, (openExitsByBranch.get(bId) || 0) + 1);
          if (ex.initiated_by_id) {
            openExitsByOfficer.set(ex.initiated_by_id, (openExitsByOfficer.get(ex.initiated_by_id) || 0) + 1);
          }
        }

        if (ex.initiated_by_id) {
          exitsHandledByOfficer.set(ex.initiated_by_id, (exitsHandledByOfficer.get(ex.initiated_by_id) || 0) + 1);
        }
        if (ex.completed_by_id) {
          exitsCompletedByOfficer.set(ex.completed_by_id, (exitsCompletedByOfficer.get(ex.completed_by_id) || 0) + 1);
        }
      });

      // Current calendar date for overdue evaluation (midnight UTC)
      const now = new Date();
      const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

      // Per-joiner evaluation structures
      interface EvaluatedJoiner {
        employee: any;
        officerId: string;
        officerName: string;
        zoneId: string;
        zoneName: string;
        branchId: string;
        branchName: string;
        itemsProvided: number;
        itemsOnTime: number;
        itemsOverdue: number;
        allSixProvided: boolean;
        daysToAllProvided: number | null;
        emailSent: boolean;
      }

      const evaluatedJoiners: EvaluatedJoiner[] = [];

      let totalItemsAll = 0;
      let totalProvidedAll = 0;
      let totalOnTimeAll = 0;
      let totalOverdueAll = 0;
      let totalEmailsSentAll = 0;
      const allSixDaysListAll: number[] = [];

      empList.forEach((emp) => {
        const officerId = resolveOfficerId(emp.application_id);
        const officerName = staffMap.get(officerId) || (officerId === 'unassigned' ? 'Unassigned' : 'Central HR');

        const zId = emp.zone_id || 'unknown';
        const zName = zoneMap.get(zId) || 'Unassigned Zone';
        const bId = emp.branch_id || 'unknown';
        const bObj = branchMap.get(bId);
        const bName = bObj?.name || 'Unassigned Branch';

        const empAssets = assetMap.get(emp.id) || new Map();

        // Calculate joining date calendar timestamp (midnight UTC)
        let startMs = todayMs;
        if (emp.joining_date) {
          const parts = String(emp.joining_date).split('-');
          if (parts.length === 3) {
            startMs = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          }
        }

        let empItemsProvided = 0;
        let empItemsOnTime = 0;
        let empItemsOverdue = 0;
        const empItemOffsets: number[] = [];

        ASSET_KEYS.forEach((key) => {
          totalItemsAll++;
          const targetDay = TARGET_DAYS[key] ?? 0;
          const targetMs = startMs + targetDay * 86400000;
          const assetInfo = empAssets.get(key);

          if (assetInfo && assetInfo.state === 'provided') {
            empItemsProvided++;
            totalProvidedAll++;

            // Evaluate on-time: updated_at date <= targetMs
            const updated = new Date(assetInfo.updated_at);
            const updatedMs = Date.UTC(updated.getUTCFullYear(), updated.getUTCMonth(), updated.getUTCDate());

            if (updatedMs <= targetMs) {
              empItemsOnTime++;
              totalOnTimeAll++;
            }

            // Days taken from joining date
            const dayDiff = Math.max(0, Math.round((updatedMs - startMs) / 86400000));
            empItemOffsets.push(dayDiff);
          } else {
            // Unprovided: evaluate overdue (today past target day)
            if (todayMs > targetMs) {
              empItemsOverdue++;
              totalOverdueAll++;
            }
          }
        });

        const allSixProvided = empItemsProvided === 6 && empItemOffsets.length === 6;
        let daysToAllProvided: number | null = null;
        if (allSixProvided) {
          daysToAllProvided = Math.max(...empItemOffsets);
          allSixDaysListAll.push(daysToAllProvided);
        }

        // Email status: sent if latest email snapshot matches or status === 'sent'
        const latestEmail = latestEmailMap.get(emp.id);
        let emailSent = false;
        if (latestEmail && latestEmail.status === 'sent') {
          emailSent = true;
          totalEmailsSentAll++;
        }

        evaluatedJoiners.push({
          employee: emp,
          officerId,
          officerName,
          zoneId: zId,
          zoneName: zName,
          branchId: bId,
          branchName: bName,
          itemsProvided: empItemsProvided,
          itemsOnTime: empItemsOnTime,
          itemsOverdue: empItemsOverdue,
          allSixProvided,
          daysToAllProvided,
          emailSent,
        });
      });

      // ------------------------------------------------------------------------
      // Aggregation Helper
      // ------------------------------------------------------------------------
      function aggregateGroup(
        groupJoiners: EvaluatedJoiner[],
        openEcfs: number,
        exitsHandled = 0,
        exitsCompleted = 0
      ) {
        const joinersCount = groupJoiners.length;
        const totalItems = joinersCount * 6;
        let itemsProvided = 0;
        let onTimeItems = 0;
        let overdueItems = 0;
        let emailsSent = 0;
        const allSixDays: number[] = [];

        groupJoiners.forEach((j) => {
          itemsProvided += j.itemsProvided;
          onTimeItems += j.itemsOnTime;
          overdueItems += j.itemsOverdue;
          if (j.emailSent) emailsSent++;
          if (j.daysToAllProvided !== null) {
            allSixDays.push(j.daysToAllProvided);
          }
        });

        const onTimeRate = totalItems > 0 ? (onTimeItems / totalItems) * 100 : 0;
        const avgDays = allSixDays.length > 0
          ? allSixDays.reduce((a, b) => a + b, 0) / allSixDays.length
          : null;

        const flag = computePerformanceFlag(joinersCount, onTimeRate);

        return {
          joiners_count: joinersCount,
          total_items: totalItems,
          items_provided: itemsProvided,
          on_time_items: onTimeItems,
          on_time_rate: Number(onTimeRate.toFixed(1)),
          overdue_items: overdueItems,
          emails_sent: emailsSent,
          emails_total: joinersCount,
          avg_days: avgDays !== null ? Number(avgDays.toFixed(1)) : null,
          exits_handled: exitsHandled,
          exits_completed: exitsCompleted,
          open_clearance_forms: openEcfs,
          flag: flag.label,
          flag_variant: flag.variant,
          flag_color: flag.color,
        };
      }

      // Group 1: By HR Officer
      const officerGroups = new Map<string, EvaluatedJoiner[]>();
      evaluatedJoiners.forEach((j) => {
        const list = officerGroups.get(j.officerId) || [];
        list.push(j);
        officerGroups.set(j.officerId, list);
      });

      // Also ensure any staff profile with role central_hr in this scope is included if they had exits/joiners
      const officerRows: any[] = [];
      officerGroups.forEach((group, officerId) => {
        const officerName = group[0]?.officerName || staffMap.get(officerId) || 'Central HR';
        const openEcfs = openExitsByOfficer.get(officerId) || 0;
        const handled = exitsHandledByOfficer.get(officerId) || 0;
        const completed = exitsCompletedByOfficer.get(officerId) || 0;
        const stats = aggregateGroup(group, openEcfs, handled, completed);

        officerRows.push({
          id: officerId,
          officer_id: officerId,
          officer_name: officerName,
          name: officerName,
          scope: group[0]?.branchName || group[0]?.zoneName || 'Company-wide',
          ...stats,
        });
      });

      // Sort officers: worst on-time performers first (with low volume placed appropriately)
      officerRows.sort((a, b) => {
        const aLow = a.joiners_count < 4 ? 1 : 0;
        const bLow = b.joiners_count < 4 ? 1 : 0;
        if (aLow !== bLow) return aLow - bLow;
        return a.on_time_rate - b.on_time_rate;
      });

      // Group 2: By Zone
      const zoneGroups = new Map<string, EvaluatedJoiner[]>();
      evaluatedJoiners.forEach((j) => {
        const list = zoneGroups.get(j.zoneId) || [];
        list.push(j);
        zoneGroups.set(j.zoneId, list);
      });

      const zoneRows: any[] = [];
      zoneGroups.forEach((group, zId) => {
        const zName = zoneMap.get(zId) || group[0]?.zoneName || 'Unassigned Zone';
        const openEcfs = openExitsByZone.get(zId) || 0;
        const stats = aggregateGroup(group, openEcfs);

        zoneRows.push({
          id: zId,
          zone_id: zId,
          zone_name: zName,
          name: zName,
          scope: 'All Branches',
          ...stats,
        });
      });
      zoneRows.sort((a, b) => a.on_time_rate - b.on_time_rate);

      // Group 3: By Branch
      const branchGroups = new Map<string, EvaluatedJoiner[]>();
      evaluatedJoiners.forEach((j) => {
        const list = branchGroups.get(j.branchId) || [];
        list.push(j);
        branchGroups.set(j.branchId, list);
      });

      const branchRows: any[] = [];
      branchGroups.forEach((group, bId) => {
        const bObj = branchMap.get(bId);
        const bName = bObj?.name || group[0]?.branchName || 'Unassigned Branch';
        const zName = bObj ? zoneMap.get(bObj.zone_id) : group[0]?.zoneName || '—';
        const openEcfs = openExitsByBranch.get(bId) || 0;
        const stats = aggregateGroup(group, openEcfs);

        branchRows.push({
          id: bId,
          branch_id: bId,
          branch_name: bName,
          name: bName,
          scope: zName || 'All',
          ...stats,
        });
      });
      branchRows.sort((a, b) => a.on_time_rate - b.on_time_rate);

      // Overall Top-Level KPI Aggregation
      const overallOnTimeRate = totalItemsAll > 0 ? (totalOnTimeAll / totalItemsAll) * 100 : 0;
      const overallAvgDays = allSixDaysListAll.length > 0
        ? allSixDaysListAll.reduce((a, b) => a + b, 0) / allSixDaysListAll.length
        : null;

      return res.status(200).json({
        success: true,
        kpi: {
          joiners_handled: empList.length,
          total_items: totalItemsAll,
          items_provided: totalProvidedAll,
          on_time_items: totalOnTimeAll,
          on_time_rate: Number(overallOnTimeRate.toFixed(1)),
          overdue_items: totalOverdueAll,
          open_clearance_forms: overallOpenEcfs,
          avg_days: overallAvgDays !== null ? Number(overallAvgDays.toFixed(1)) : 0,
          emails_sent: totalEmailsSentAll,
          emails_total: empList.length,
        },
        scorecard: {
          officers: officerRows,
          zones: zoneRows,
          branches: branchRows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
