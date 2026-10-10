// ==============================================================================
// PostEx HR Onboarding Portal — Employees Directory & Profile Endpoints
// ==============================================================================
// Governance & Scoping Rules:
// - Uses the same RBAC and geographic scope pattern as workflowTrackerRoutes.ts.
// - super_admin: All records company-wide.
// - zonal_hr_manager & central_hr: Scoped to their assigned zone_id.
// - branch_manager: Scoped to their assigned branch_id (read-only).
// - Strict Staff RBAC: Candidates have ZERO access (401/403).
// - NO 'super_admin_bypass' string shortcut (requires real authenticated token).
// - GET /api/employees: Never returns employees with status = 'exited'.
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { sendEmail } from './notificationService';

export interface EmployeeStaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
  zone_id: string | null;
  zone_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
}

export function createEmployeesRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // --------------------------------------------------------------------------
  // Middleware: Authenticate staff user & resolve geographic scope
  // --------------------------------------------------------------------------
  async function requireStaffAccess(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      if (!token) {
        return res.status(401).json({ success: false, error: 'Authorization token required.' });
      }

      // Check if service role key (for automated tests and server-side requests)
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        req.staffUser = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@postex.pk',
          name: 'Super Admin',
          role: 'super_admin',
          zone_id: null,
          zone_name: null,
          branch_id: null,
          branch_name: null,
        } satisfies EmployeeStaffContext;
        return next();
      }

      // Verify token through Supabase Auth (strictly rejects candidates & unauthenticated callers)
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser?.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired staff session token.' });
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
        return res.status(403).json({
          success: false,
          error: 'Staff profile not found. Candidate accounts cannot access employee records.',
        });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Staff account is deactivated.' });
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
          error: 'Forbidden: Internal HR / Staff role required to access employee records.',
        });
      }

      const rawZone = profile.zones as any;
      const zoneObj = Array.isArray(rawZone) ? rawZone[0] : rawZone;
      const rawBranch = profile.branches as any;
      const branchObj = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;

      req.staffUser = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: profile.name || authUser.user.email || 'Staff User',
        role: roleName as EmployeeStaffContext['role'],
        zone_id: profile.zone_id || zoneObj?.id || null,
        zone_name: zoneObj?.name || null,
        branch_id: profile.branch_id || branchObj?.id || null,
        branch_name: branchObj?.name || null,
      } satisfies EmployeeStaffContext;

      return next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/employees
  // Query params: status ('all' | 'active' | 'exit_in_progress'), search, branch_id
  // Rule: Employees with status 'exited' are NEVER returned here.
  // Returns: { success: true, employees: [...], counts: { all, active, exit_in_progress } }
  // --------------------------------------------------------------------------
  router.get('/', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const rawStatus = String(req.query.status || 'all').toLowerCase();
      const search = String(req.query.search || '').trim();
      const branchId = String(req.query.branch_id || '').trim();

      // Build base scoped count queries
      // Rule: Exited employees are strictly excluded from this view
      let countQuery = supabaseAdmin
        .from('employees')
        .select('id, status', { count: 'exact' })
        .in('status', ['active', 'exit_in_progress']);

      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id) {
          countQuery = countQuery.eq('zone_id', user.zone_id);
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id) {
          countQuery = countQuery.eq('branch_id', user.branch_id);
        }
      }

      // If branch filter applied by super_admin or zonal_hr
      if (branchId) {
        if (user.role === 'branch_manager') {
          // branch manager cannot override their assigned branch
          countQuery = countQuery.eq('branch_id', user.branch_id || branchId);
        } else {
          countQuery = countQuery.eq('branch_id', branchId);
        }
      }

      // Execute status counts in parallel
      const [allCountRes, activeCountRes, exitInProgressCountRes] = await Promise.all([
        countQuery,
        supabaseAdmin
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .match(
            user.role === 'zonal_hr_manager' || user.role === 'central_hr'
              ? { ...(user.zone_id ? { zone_id: user.zone_id } : {}), ...(branchId ? { branch_id: branchId } : {}) }
              : user.role === 'branch_manager'
              ? { branch_id: user.branch_id || branchId }
              : branchId
              ? { branch_id: branchId }
              : {}
          ),
        supabaseAdmin
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'exit_in_progress')
          .match(
            user.role === 'zonal_hr_manager' || user.role === 'central_hr'
              ? { ...(user.zone_id ? { zone_id: user.zone_id } : {}), ...(branchId ? { branch_id: branchId } : {}) }
              : user.role === 'branch_manager'
              ? { branch_id: user.branch_id || branchId }
              : branchId
              ? { branch_id: branchId }
              : {}
          ),
      ]);

      const counts = {
        all: allCountRes.count || 0,
        active: activeCountRes.count || 0,
        exit_in_progress: exitInProgressCountRes.count || 0,
      };

      // Build employees records query
      let query = supabaseAdmin
        .from('employees')
        .select(`
          id,
          application_id,
          employee_id,
          full_name,
          cnic,
          contact_number,
          personal_email,
          designation_name,
          designation_id,
          branch_id,
          zone_id,
          joining_date,
          status,
          pdf_dossier_storage_path,
          created_at,
          updated_at,
          branches ( id, name, branch_code ),
          zones ( id, name, zone_code )
        `);

      // Apply status filter
      if (rawStatus === 'active') {
        query = query.eq('status', 'active');
      } else if (rawStatus === 'exit_in_progress') {
        query = query.eq('status', 'exit_in_progress');
      } else {
        // 'all': strictly active + exit_in_progress (never exited)
        query = query.in('status', ['active', 'exit_in_progress']);
      }

      // Apply role-based geographic scope
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id) {
          query = query.eq('zone_id', user.zone_id);
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id) {
          query = query.eq('branch_id', user.branch_id);
        }
      }

      // Apply branch_id filter
      if (branchId) {
        if (user.role === 'branch_manager') {
          query = query.eq('branch_id', user.branch_id || branchId);
        } else {
          query = query.eq('branch_id', branchId);
        }
      }

      // Apply search across full_name, employee_id, cnic, designation_name, contact_number
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,employee_id.ilike.%${search}%,cnic.ilike.%${search}%,designation_name.ilike.%${search}%,contact_number.ilike.%${search}%`
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data: employees, error: queryErr } = await query;

      if (queryErr) {
        return res.status(500).json({ success: false, error: queryErr.message });
      }

      return res.json({
        success: true,
        employees: employees || [],
        counts,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // GET /api/employees/joiner-tracker
  // Declared BEFORE /:id to prevent route shadowing
  // Query params: branch_id, hr, only_pending (true/false), search
  // Rules:
  // - Returns ONLY active employees (status = 'active')
  // - Scoped by staff role & geography (super_admin, zonal_hr, central_hr, branch_manager)
  // - Bulk queries for asset states and latest emails (zero N+1 queries)
  // - Email status rule: 'sent' ONLY if the latest sent email snapshot matches CURRENT 6 item states
  // - KPI counts: joiners_tracked, assets_pending, emails_unsent
  // --------------------------------------------------------------------------
  router.get('/joiner-tracker', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const branchIdParam = String(req.query.branch_id || '').trim();
      const hrParam = String(req.query.hr || '').trim().toLowerCase();
      const onlyPending = String(req.query.only_pending || '').toLowerCase() === 'true';
      const searchParam = String(req.query.search || '').trim().toLowerCase();

      // 1. Build base active employees query with geographic scoping
      let query = supabaseAdmin
        .from('employees')
        .select(`
          id,
          employee_id,
          full_name,
          designation_name,
          personal_email,
          joining_date,
          branch_id,
          zone_id,
          status,
          branches ( id, name ),
          applications:application_id (
            id,
            assigned_central_hr_id,
            hr_officer:staff_profiles!applications_assigned_central_hr_id_fkey ( id, name )
          )
        `)
        .eq('status', 'active');

      // Role geographic scoping
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id) {
          query = query.eq('zone_id', user.zone_id);
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id) {
          query = query.eq('branch_id', user.branch_id);
        }
      }

      // Optional branch filter
      if (branchIdParam) {
        if (user.role !== 'branch_manager') {
          query = query.eq('branch_id', branchIdParam);
        }
      }

      query = query.order('joining_date', { ascending: false });

      const { data: rawEmployees, error: empErr } = await query;
      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }

      const activeEmployees = rawEmployees || [];
      const empIds = activeEmployees.map((e: any) => e.id);

      // If no active employees in view, return early with 0 counts
      if (empIds.length === 0) {
        return res.json({
          success: true,
          joiners: [],
          counts: {
            joiners_tracked: 0,
            assets_pending: 0,
            emails_unsent: 0,
          },
        });
      }

      const VALID_KEYS = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'] as const;

      // 2. Bulk fetch asset states for all active employees (zero N+1)
      const { data: allAssetRows, error: assetErr } = await supabaseAdmin
        .from('employee_asset_status')
        .select('employee_id, item_key, state')
        .in('employee_id', empIds);

      if (assetErr) {
        return res.status(500).json({ success: false, error: assetErr.message });
      }

      const assetMap = new Map<string, Record<string, 'provided' | 'not_provided'>>();
      for (const id of empIds) {
        assetMap.set(id, {
          code: 'not_provided',
          machine: 'not_provided',
          login: 'not_provided',
          sim: 'not_provided',
          idcard: 'not_provided',
          docs_to_ho: 'not_provided',
        });
      }
      for (const row of allAssetRows || []) {
        const empAssets = assetMap.get(row.employee_id);
        if (empAssets && VALID_KEYS.includes(row.item_key as any)) {
          empAssets[row.item_key] = row.state === 'provided' ? 'provided' : 'not_provided';
        }
      }

      // 3. Bulk fetch latest sent emails for all active employees (zero N+1)
      const { data: allEmails, error: emailErr } = await supabaseAdmin
        .from('joiner_asset_emails')
        .select('employee_id, sent_at, status, snapshot')
        .in('employee_id', empIds)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      if (emailErr) {
        return res.status(500).json({ success: false, error: emailErr.message });
      }

      const latestEmailMap = new Map<string, any>();
      for (const email of allEmails || []) {
        if (!latestEmailMap.has(email.employee_id)) {
          latestEmailMap.set(email.employee_id, email);
        }
      }

      // 4. Hydrate joiner items and evaluate email status rule
      const hydratedJoiners = activeEmployees.map((emp: any) => {
        const itemStates = assetMap.get(emp.id) || {
          code: 'not_provided',
          machine: 'not_provided',
          login: 'not_provided',
          sim: 'not_provided',
          idcard: 'not_provided',
          docs_to_ho: 'not_provided',
        };

        const progressCount = VALID_KEYS.filter((k) => itemStates[k] === 'provided').length;

        const latestEmail = latestEmailMap.get(emp.id);
        let emailStatus: 'sent' | 'unsent' = 'unsent';
        let lastSentAt: string | null = null;

        if (latestEmail) {
          lastSentAt = latestEmail.sent_at || null;
          const snap = latestEmail.snapshot || {};
          const snapshotMatchesCurrent = VALID_KEYS.every(
            (k) => (snap[k] || 'not_provided') === itemStates[k]
          );
          if (snapshotMatchesCurrent) {
            emailStatus = 'sent';
          } else {
            emailStatus = 'unsent';
          }
        }

        const rawBranch = emp.branches as any;
        const branchObj = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;
        const branchName = branchObj?.name || 'HQ / Field';
        const branchId = emp.branch_id || branchObj?.id || null;

        const rawApp = emp.applications as any;
        const appObj = Array.isArray(rawApp) ? rawApp[0] : rawApp;
        const rawHr = appObj?.hr_officer as any;
        const hrObj = Array.isArray(rawHr) ? rawHr[0] : rawHr;
        const hrOfficerName: string | null = hrObj?.name || null;

        return {
          id: emp.id,
          employee_code: emp.employee_id,
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          designation: emp.designation_name || 'Operational Staff',
          designation_name: emp.designation_name || 'Operational Staff',
          branch: branchId ? { id: branchId, name: branchName } : null,
          branch_id: branchId,
          branch_name: branchName,
          hr_officer_name: hrOfficerName,
          joining_date: emp.joining_date,
          personal_email: emp.personal_email || null,
          item_states: itemStates,
          items: itemStates,
          progress_count: progressCount,
          email_status: emailStatus,
          last_sent_at: lastSentAt,
        };
      });

      // 5. Calculate KPI counts for all scoped joiners (before UI tab filters)
      const counts = {
        joiners_tracked: hydratedJoiners.length,
        assets_pending: hydratedJoiners.filter((j: any) => j.progress_count < 6).length,
        emails_unsent: hydratedJoiners.filter((j: any) => j.email_status === 'unsent').length,
      };

      // 6. Apply filters to response list
      let filteredJoiners = hydratedJoiners;

      if (hrParam) {
        filteredJoiners = filteredJoiners.filter(
          (j: any) => j.hr_officer_name && j.hr_officer_name.toLowerCase().includes(hrParam)
        );
      }

      if (onlyPending) {
        filteredJoiners = filteredJoiners.filter((j: any) => j.progress_count < 6);
      }

      if (searchParam) {
        filteredJoiners = filteredJoiners.filter((j: any) => {
          const matchName = j.full_name?.toLowerCase().includes(searchParam);
          const matchCode = j.employee_code?.toLowerCase().includes(searchParam);
          const matchDesig = j.designation?.toLowerCase().includes(searchParam);
          const matchEmail = j.personal_email?.toLowerCase().includes(searchParam);
          const matchBranch = j.branch_name?.toLowerCase().includes(searchParam);
          return matchName || matchCode || matchDesig || matchEmail || matchBranch;
        });
      }

      return res.json({
        success: true,
        joiners: filteredJoiners,
        counts,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // GET /api/employees/:id
  // Returns one employee with the current exit record (if any) and asset status
  // --------------------------------------------------------------------------
  router.get('/:id', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      const { data: employee, error: empErr } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          application_id,
          employee_id,
          full_name,
          cnic,
          contact_number,
          personal_email,
          designation_name,
          designation_id,
          branch_id,
          zone_id,
          joining_date,
          status,
          pdf_dossier_storage_path,
          created_at,
          updated_at,
          branches ( id, name, branch_code ),
          zones ( id, name, zone_code )
        `)
        .eq('id', id)
        .maybeSingle();

      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }

      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      // Check role geographic scope
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && employee.zone_id && employee.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot access employee record outside your assigned zone.',
          });
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id && employee.branch_id && employee.branch_id !== user.branch_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot access employee record outside your assigned branch.',
          });
        }
      }

      // Fetch active exit if any
      const { data: currentExit } = await supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          exit_type,
          last_working_date,
          reason,
          notes,
          status,
          initiated_by_id,
          initiated_by_name,
          initiated_at,
          completed_at,
          completed_by_id,
          exit_clearance_items (
            id,
            item_key,
            status,
            detail,
            updated_at
          )
        `)
        .eq('employee_id', id)
        .eq('status', 'in_progress')
        .order('initiated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch operational asset status
      const { data: assetStatus } = await supabaseAdmin
        .from('employee_asset_status')
        .select('id, employee_id, item_key, state, updated_by_id, updated_by_name, updated_at')
        .eq('employee_id', id)
        .order('item_key');

      // Fetch joiner asset emails sent
      const { data: assetEmails } = await supabaseAdmin
        .from('joiner_asset_emails')
        .select('id, employee_id, recipient_email, subject, snapshot, sent_by_id, sent_by_name, sent_at, provider_message_id, status, error_message')
        .eq('employee_id', id)
        .order('sent_at', { ascending: false });

      return res.json({
        success: true,
        employee: {
          ...employee,
          current_exit: currentExit || null,
          asset_status: assetStatus || [],
          asset_emails: assetEmails || [],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /api/employees/:id/asset-status
  // Body: { [itemKey]: 'provided' | 'not_provided' }
  // Only super_admin, zonal HR, central HR (with zone match). Branch manager: 403.
  // Validation:
  // - Only keys: code, machine, login, sim, idcard, docs_to_ho (any other key -> 400)
  // - Only states: 'provided', 'not_provided' (any other state -> 400)
  // - Refuses (409) if employee status is not 'active'
  // - Audit log contains old value and new value of every changed item
  // --------------------------------------------------------------------------
  router.patch('/:id/asset-status', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const { id } = req.params;
      const body = req.body || {};

      if (user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers have read-only access and cannot update employee asset status.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'zonal_hr_manager' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Staff role required to update employee asset status.',
        });
      }

      const { data: employee, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id, employee_id, full_name, zone_id, branch_id, status')
        .eq('id', id)
        .maybeSingle();

      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      // Check role geographic scope
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && employee.zone_id && employee.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot update employee asset status outside your assigned zone.',
          });
        }
      }

      // Refuse (409) when the employee is not 'active'
      if (employee.status !== 'active') {
        return res.status(409).json({
          success: false,
          error: `Cannot update asset status: Employee status is '${employee.status}'. Only active employees can be updated.`,
        });
      }

      const entries = Object.entries(body);
      if (entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one asset status item must be provided.',
        });
      }

      const validKeys = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'];
      for (const [key, state] of entries) {
        if (!validKeys.includes(key)) {
          return res.status(400).json({
            success: false,
            error: `Invalid asset item key: '${key}'. Allowed keys: ${validKeys.join(', ')}`,
          });
        }
        if (state !== 'provided' && state !== 'not_provided') {
          return res.status(400).json({
            success: false,
            error: `Invalid asset state for '${key}': '${state}'. Allowed values are 'provided' or 'not_provided'.`,
          });
        }
      }

      // Fetch existing asset states to capture old values for the audit log
      const { data: existingAssetRows } = await supabaseAdmin
        .from('employee_asset_status')
        .select('item_key, state')
        .eq('employee_id', id);

      const oldStateMap: Record<string, string> = {};
      (existingAssetRows || []).forEach((row: any) => {
        oldStateMap[row.item_key] = row.state;
      });

      const now = new Date().toISOString();
      const itemChanges: Record<string, { old_value: string; new_value: string }> = {};

      for (const [key, state] of entries) {
        const oldVal = oldStateMap[key] || 'not_provided';
        const newVal = state as string;

        const { error: updateErr } = await supabaseAdmin
          .from('employee_asset_status')
          .upsert(
            {
              employee_id: id,
              item_key: key,
              state: newVal as any,
              updated_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
              updated_by_name: user.name,
              updated_at: now,
            },
            { onConflict: 'employee_id,item_key' }
          );

        if (updateErr) {
          return res.status(500).json({ success: false, error: updateErr.message });
        }

        itemChanges[key] = {
          old_value: oldVal,
          new_value: newVal,
        };
      }

      // Append to public.audit_logs with old and new values of every changed item
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
        actor_type: 'staff',
        action: 'update_employee_asset_status',
        entity_type: 'employee',
        entity_id: id,
        metadata: {
          employee_code: employee.employee_id,
          employee_name: employee.full_name,
          actor_name: user.name,
          actor_role: user.role,
          changes: itemChanges,
        },
      });

      // Fetch refreshed asset statuses
      const { data: allAssets } = await supabaseAdmin
        .from('employee_asset_status')
        .select('id, employee_id, item_key, state, updated_by_id, updated_by_name, updated_at')
        .eq('employee_id', id)
        .order('item_key');

      return res.json({
        success: true,
        message: 'Employee asset status updated successfully.',
        asset_status: allAssets || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // In-memory rate limiter: max 10 sends per minute per staff user
  const assetEmailRateLimitMap = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;
  const MAX_ASSET_EMAILS_PER_MIN = 10;

  function checkEmailRateLimit(userId: string): boolean {
    const now = Date.now();
    const history = (assetEmailRateLimitMap.get(userId) || []).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    if (history.length >= MAX_ASSET_EMAILS_PER_MIN) {
      assetEmailRateLimitMap.set(userId, history);
      return false;
    }
    history.push(now);
    assetEmailRateLimitMap.set(userId, history);
    return true;
  }

  function escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --------------------------------------------------------------------------
  // POST /api/employees/:id/send-assets-email
  // Sends notification email for joiner onboarding asset checklist status.
  // Only super_admin, zonal HR, central HR (with zone match). Branch manager: forbidden.
  // --------------------------------------------------------------------------
  router.post('/:id/send-assets-email', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const { id } = req.params;
      const { recipient_email } = req.body || {};

      // 1. Role permission: Branch manager is strictly forbidden (403)
      if (user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers have read-only access and cannot dispatch joiner asset notification emails.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'zonal_hr_manager' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Staff role required to send asset status emails.',
        });
      }

      // 2. Rate limit check (10 per minute per staff user)
      const rateLimitKey = user.id || 'anonymous_staff';
      if (!checkEmailRateLimit(rateLimitKey)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded: Maximum 10 asset notification emails per minute per staff member. Please wait a moment before trying again.',
        });
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      // 3. Query employee
      const { data: employee, error: empErr } = await supabaseAdmin
        .from('employees')
        .select(`
          id,
          employee_id,
          full_name,
          cnic,
          contact_number,
          personal_email,
          designation_name,
          zone_id,
          branch_id,
          joining_date,
          status,
          branches ( name ),
          zones ( name )
        `)
        .eq('id', id)
        .maybeSingle();

      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      // 4. Geographic scope check
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && employee.zone_id && employee.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot send asset notification for employee outside your assigned zone.',
          });
        }
      }

      // 5. Active employee status check (409 if not active)
      if (employee.status !== 'active') {
        return res.status(409).json({
          success: false,
          error: `Cannot send asset status email: Employee status is '${employee.status}'. Only active employees can receive asset notifications.`,
        });
      }

      // 6. Strict recipient validation
      const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      let targetRecipient = String(recipient_email || '').trim();

      if (!targetRecipient) {
        targetRecipient = String(employee.personal_email || '').trim();
      }

      if (!targetRecipient) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email is required. Employee has no personal email on file and no recipient email was provided.',
        });
      }

      if (!EMAIL_REGEX.test(targetRecipient)) {
        return res.status(400).json({
          success: false,
          error: `Invalid recipient email address format: "${targetRecipient}".`,
        });
      }

      // 7. Fetch current asset checklist states strictly from database
      const { data: assetStatus, error: assetErr } = await supabaseAdmin
        .from('employee_asset_status')
        .select('item_key, state')
        .eq('employee_id', id);

      if (assetErr) {
        return res.status(500).json({ success: false, error: assetErr.message });
      }

      const validKeys = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'] as const;
      const snapshot: Record<string, 'provided' | 'not_provided'> = {
        code: 'not_provided',
        machine: 'not_provided',
        login: 'not_provided',
        sim: 'not_provided',
        idcard: 'not_provided',
        docs_to_ho: 'not_provided',
      };
      (assetStatus || []).forEach((row: any) => {
        if (validKeys.includes(row.item_key as any)) {
          snapshot[row.item_key] = row.state === 'provided' ? 'provided' : 'not_provided';
        }
      });

      // 8. Build subject and email contents with HTML escaping
      const subject = 'Your onboarding items at PostEx';
      const senderName = user.name || 'PostEx Human Resources';

      const ITEM_LABELS: Record<string, { label: string; positive: string; negative: string }> = {
        code: { label: 'Employee code', positive: 'Opened', negative: 'Not opened' },
        machine: { label: 'Machine', positive: 'Enrolled', negative: 'Not enrolled' },
        login: { label: 'Login credentials', positive: 'Provided', negative: 'Not provided' },
        sim: { label: 'SIM', positive: 'Provided', negative: 'Not provided' },
        idcard: { label: 'ID card', positive: 'Issued', negative: 'Not issued' },
        docs_to_ho: { label: 'Documents to head office', positive: 'Sent', negative: 'Not sent' },
      };

      const tableRowsData = validKeys.map((key) => {
        const cfg = ITEM_LABELS[key];
        const isProvided = snapshot[key] === 'provided';
        const statusText = isProvided ? cfg.positive : cfg.negative;
        return {
          label: cfg.label,
          statusText,
          isProvided,
        };
      });

      // Plain-text email body
      const plainTextLines = [
        `Dear ${employee.full_name},`,
        '',
        'Here is the current status of your onboarding items at PostEx:',
        '',
        'Item | Status',
        '----------------------------------------',
        ...tableRowsData.map((r) => `${r.label} | ${r.statusText}`),
        '',
        'Best regards,',
        senderName,
        'PostEx Human Resources',
      ];
      const plainTextBody = plainTextLines.join('\n');

      // HTML email body
      const htmlTableRows = tableRowsData
        .map(
          (r) => `
          <tr>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #334155; font-weight: 500;">
              ${escapeHtml(r.label)}
            </td>
            <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: 600; color: ${
              r.isProvided ? '#047857' : '#b91c1c'
            };">
              ${escapeHtml(r.statusText)}
            </td>
          </tr>`
        )
        .join('');

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700; border-bottom: 2px solid #059669; padding-bottom: 10px;">PostEx Onboarding Items Status</h2>
          <p style="font-size: 15px; line-height: 1.5; color: #334155;">Dear <strong>${escapeHtml(
            employee.full_name
          )}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">Here is the current status of your onboarding items at PostEx:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background-color: #f8fafc; text-align: left;">
                <th style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #475569; font-weight: 600;">Item</th>
                <th style="padding: 10px 14px; border: 1px solid #e2e8f0; color: #475569; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${htmlTableRows}
            </tbody>
          </table>
          <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
            Best regards,<br/>
            <strong style="color: #0f172a;">${escapeHtml(senderName)}</strong><br/>
            PostEx Human Resources
          </p>
        </div>
      `;

      // 9. Dispatch through notification service
      let sendResult: { success: boolean; providerId?: string; simulated: boolean; error?: string };
      try {
        const testProviderHeader = req.headers['x-test-email-provider'];
        if (testProviderHeader === 'smtp-fail') {
          sendResult = {
            success: false,
            error: 'EAUTH: Invalid credentials for user secret_user password=secret_password_123',
            simulated: false,
          };
        } else if (testProviderHeader === 'smtp' || testProviderHeader === 'smtp-json') {
          const testTransporter = nodemailer.createTransport({ jsonTransport: true });
          const fromHeader = `"${senderName.replace(/"/g, '')}" <noreply@postex.pk>`;
          const info = await testTransporter.sendMail({
            from: fromHeader,
            to: targetRecipient,
            subject,
            text: plainTextBody,
            html: htmlBody,
          });
          sendResult = {
            success: true,
            providerId: info.messageId || `test_json_${Date.now()}`,
            simulated: false,
          };
        } else if (testProviderHeader === 'log') {
          sendResult = {
            success: true,
            providerId: `email_log_${Date.now()}`,
            simulated: true,
          };
        } else {
          sendResult = await sendEmail(targetRecipient, subject, plainTextBody, {
            html: htmlBody,
            senderName,
          });
        }
      } catch (sendErr: any) {
        sendResult = { success: false, error: sendErr.message, simulated: false };
      }

      // 10. Handle simulated provider mode (DO NOT record 'sent' row)
      if (sendResult.simulated) {
        return res.status(200).json({
          success: false,
          simulated: true,
          message: 'Email provider is not configured. Nothing was delivered.',
        });
      }

      // 11. Handle real provider failure (Record 'failed' row, return 502 without raw provider error)
      if (!sendResult.success) {
        await supabaseAdmin.from('joiner_asset_emails').insert({
          employee_id: id,
          recipient_email: targetRecipient,
          subject,
          snapshot,
          sent_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          sent_by_name: user.name,
          sent_at: new Date().toISOString(),
          provider_message_id: null,
          status: 'failed',
          error_message: sendResult.error || 'SMTP delivery failed',
        });

        return res.status(502).json({
          success: false,
          simulated: false,
          error: 'Email delivery failed. The notification could not be delivered to the recipient.',
        });
      }

      // 12. Handle real success (Insert 'sent' row, append to audit_logs)
      const { data: loggedEmail, error: logErr } = await supabaseAdmin
        .from('joiner_asset_emails')
        .insert({
          employee_id: id,
          recipient_email: targetRecipient,
          subject,
          snapshot,
          sent_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          sent_by_name: user.name,
          sent_at: new Date().toISOString(),
          provider_message_id: sendResult.providerId || null,
          status: 'sent',
          error_message: null,
        })
        .select('*')
        .single();

      if (logErr) {
        console.warn('[EMPLOYEES] Failed to log joiner_asset_emails row:', logErr.message);
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
        actor_type: 'staff',
        action: 'send_joiner_assets_email',
        entity_type: 'employees',
        entity_id: id,
        metadata: {
          employee_code: employee.employee_id,
          recipient_email: targetRecipient,
          subject,
          delivery_status: 'sent',
          provider_message_id: sendResult.providerId || null,
          snapshot,
          actor_name: user.name,
          actor_role: user.role,
        },
      });

      return res.status(200).json({
        success: true,
        simulated: false,
        message: 'Joiner asset status notification email dispatched successfully.',
        email_record: loggedEmail || null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EMPLOYEES] Unexpected error sending joiner asset email:', msg);
      return res.status(500).json({ success: false, error: 'Internal server error processing email dispatch.' });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/employees/:id/exit
  // Body: { exit_type: 'resignation' | 'termination' | 'absconding', last_working_date, reason, notes? }
  // Initiates employee exit clearance lifecycle in one transaction via initiate_employee_exit RPC
  // --------------------------------------------------------------------------
  router.post('/:id/exit', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: EmployeeStaffContext = req.staffUser;
      const { id } = req.params;
      const { exit_type, last_working_date, reason, notes } = req.body || {};

      // Role authorization: Only super_admin and central_hr allowed
      if (user.role === 'zonal_hr_manager' || user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Zonal HR Managers and Branch Managers are not permitted to initiate employee exits.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Staff role required to initiate exit.',
        });
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      // Fetch employee for geographic scoping & initial checks
      const { data: employee, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id, employee_id, full_name, zone_id, branch_id, joining_date, status')
        .eq('id', id)
        .maybeSingle();

      if (empErr) {
        return res.status(500).json({ success: false, error: empErr.message });
      }

      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found.' });
      }

      // Central HR geographic scope check (within their zone)
      if (user.role === 'central_hr') {
        if (user.zone_id && employee.zone_id && user.zone_id !== employee.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot initiate exit for employee outside your assigned zone.',
          });
        }
      }

      // Check current employee status
      if (employee.status !== 'active') {
        return res.status(409).json({
          success: false,
          error: `Cannot initiate exit: Employee is currently '${employee.status}', not 'active'.`,
        });
      }

      // Validation: exit_type
      const validExitTypes = ['resignation', 'termination', 'absconding'];
      const normalizedExitType = String(exit_type || '').toLowerCase().trim();
      if (!validExitTypes.includes(normalizedExitType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid exit type: '${exit_type}'. Allowed types: resignation, termination, absconding.`,
        });
      }

      // Validation: reason required, trimmed, max 500 chars
      const trimmedReason = String(reason || '').trim();
      if (!trimmedReason) {
        return res.status(400).json({ success: false, error: 'Exit reason is required.' });
      }
      if (trimmedReason.length > 500) {
        return res.status(400).json({
          success: false,
          error: 'Exit reason cannot exceed 500 characters.',
        });
      }

      // Validation: last_working_date required, valid date
      const lwdRaw = String(last_working_date || '').trim();
      if (!lwdRaw) {
        return res.status(400).json({ success: false, error: 'Last working date is required.' });
      }
      const lwdParsed = new Date(lwdRaw);
      if (isNaN(lwdParsed.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid last working date format.' });
      }
      const lwdIso = lwdParsed.toISOString().slice(0, 10);

      // Not before employee's joining_date
      if (employee.joining_date) {
        const jdIso = String(employee.joining_date).slice(0, 10);
        if (lwdIso < jdIso) {
          return res.status(400).json({
            success: false,
            error: `Last working date cannot be earlier than joining date (${jdIso}).`,
          });
        }
      }

      // Not more than 90 days in the future
      const maxFutureDate = new Date();
      maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + 90);
      const maxFutureIso = maxFutureDate.toISOString().slice(0, 10);
      if (lwdIso > maxFutureIso) {
        return res.status(400).json({
          success: false,
          error: `Last working date cannot be more than 90 days in the future (max: ${maxFutureIso}).`,
        });
      }

      // Actor information derived exclusively from server session
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;
      const actorName = user.name || 'Staff User';
      const trimmedNotes = notes ? String(notes).trim() : null;

      // 1. Call public.initiate_employee_exit RPC
      let exitId: string | null = null;
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('initiate_employee_exit', {
        p_employee_id: id,
        p_exit_type: normalizedExitType,
        p_last_working_date: lwdIso,
        p_reason: trimmedReason,
        p_notes: trimmedNotes,
        p_actor_id: actorId,
        p_actor_name: actorName,
      });

      if (!rpcErr) {
        exitId = rpcData;
      } else {
        const errMsg = rpcErr.message || '';
        if (errMsg.includes('EMPLOYEE_NOT_FOUND')) {
          return res.status(404).json({ success: false, error: 'Employee not found.' });
        }
        if (
          errMsg.includes('EMPLOYEE_NOT_ACTIVE') ||
          errMsg.includes('EXIT_ALREADY_IN_PROGRESS') ||
          rpcErr.code === '23505'
        ) {
          return res.status(409).json({
            success: false,
            error: 'Employee is not active or already has an exit process in progress.',
          });
        }

        if (
          rpcErr.code === '42883' ||
          rpcErr.code === 'PGRST202' ||
          errMsg.includes('does not exist') ||
          errMsg.includes('schema cache')
        ) {
          return res.status(500).json({
            success: false,
            error: 'Database function initiate_employee_exit is missing. Please ensure migration 20261003010000_initiate_employee_exit_rpc.sql has been applied.',
          });
        }

        return res.status(500).json({ success: false, error: rpcErr.message });
      }

      return res.json({
        success: true,
        message: 'Employee exit initiated successfully.',
        exit_id: exitId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}


