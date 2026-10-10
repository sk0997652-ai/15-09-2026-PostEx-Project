// ==============================================================================
// PostEx HR Onboarding Portal — Employee Exit Lifecycle & Clearance API Endpoints (Step 9)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateEcfPdf } from './ecfPdfGenerator';

export interface ExitStaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
  zone_id: string | null;
  zone_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
}

export const VALID_CLEARANCE_KEYS = [
  'office_files',
  'keys',
  'mobile_sim',
  'id_card',
  'company_car',
  'others',
] as const;

export const VALID_CLEARANCE_STATUSES = ['received', 'not_received', 'not_applicable'] as const;

export const DETAIL_ALLOWED_KEYS = ['mobile_sim', 'company_car', 'others'] as const;

export function createExitRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // Middleware: Require authenticated staff and resolve role/geographic scope
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

      // Check if service role key (for automated verification scripts)
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
        } satisfies ExitStaffContext;
        return next();
      }

      // Strictly verify token against Supabase Auth (candidates & invalid tokens fail here)
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
          error: 'Staff profile not found. Candidate accounts cannot access employee exit records.',
        });
      }

      if (!profile.is_active) {
        return res.status(403).json({ success: false, error: 'Staff account is deactivated.' });
      }

      const rawRole = profile.roles as any;
      const roleName = Array.isArray(rawRole)
        ? rawRole[0]?.name
        : (rawRole?.name || authUser.user.user_metadata?.role);

      const allowedRoles = ['super_admin', 'zonal_hr_manager', 'central_hr', 'branch_manager'];
      if (!roleName || !allowedRoles.includes(roleName)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges to access employee exit records.',
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
      } satisfies ExitStaffContext;

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/exits?status=in_progress or status=completed
  // Returns exits with employee details, clearance_filled count (out of 6), and pdf_generated_at.
  // For status=completed: Super Admin only, paginated, newest first.
  // Bulk queries only, zero N+1.
  // --------------------------------------------------------------------------
  router.get('/', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: ExitStaffContext = req.staffUser;
      const statusParam = req.query.status !== undefined ? String(req.query.status).trim() : 'in_progress';

      // Special handling for Exited Employees archive (status=completed)
      // Super Admin only (Zonal HR, Central HR, Branch Manager get 403)
      if (statusParam === 'completed') {
        if (user.role !== 'super_admin') {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Exited employees archive is restricted to Super Admin only.',
          });
        }

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || req.query.pageSize || '10'), 10) || 10));
        const offset = (page - 1) * limit;

        const { data: completedRows, error: exitsErr, count } = await supabaseAdmin
          .from('employee_exits')
          .select(`
            id,
            employee_id,
            exit_type,
            last_working_date,
            reason,
            notes,
            status,
            initiated_at,
            initiated_by_name,
            pdf_generated_at,
            completed_at,
            completed_by_id,
            completed_by:staff_profiles!completed_by_id ( id, name ),
            employees!inner (
              id,
              employee_id,
              full_name,
              designation_name,
              branch_id,
              zone_id,
              branches ( id, name, branch_code ),
              zones ( id, name, zone_code )
            )
          `, { count: 'exact' })
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .order('initiated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (exitsErr) {
          return res.status(500).json({ success: false, error: exitsErr.message });
        }

        const total = count || 0;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const formattedCompletedExits = (completedRows || []).map((e: any) => {
          const emp = e.employees as any;
          const compBy = e.completed_by as any;
          const completedByName = (Array.isArray(compBy) ? compBy[0]?.name : compBy?.name) || 'Staff User';

          return {
            id: e.id,
            employee_id: e.employee_id,
            employee_code: emp?.employee_id || '',
            name: emp?.full_name || '',
            employee_name: emp?.full_name || '',
            full_name: emp?.full_name || '',
            designation: emp?.designation_name || '',
            branch: (Array.isArray(emp?.branches) ? emp.branches[0]?.name : emp?.branches?.name) || '—',
            zone: (Array.isArray(emp?.zones) ? emp.zones[0]?.name : emp?.zones?.name) || '—',
            exit_type: e.exit_type,
            last_working_date: e.last_working_date,
            completed_at: e.completed_at,
            completed_by: completedByName,
            pdf_generated_at: e.pdf_generated_at || null,
            status: e.status,
          };
        });

        return res.status(200).json({
          success: true,
          exits: formattedCompletedExits,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      }

      let query = supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          exit_type,
          last_working_date,
          reason,
          notes,
          status,
          initiated_at,
          initiated_by_name,
          pdf_generated_at,
          completed_at,
          employees!inner (
            id,
            employee_id,
            full_name,
            designation_name,
            branch_id,
            zone_id,
            branches ( id, name, branch_code ),
            zones ( id, name, zone_code )
          )
        `)
        .order('initiated_at', { ascending: false });

      if (statusParam && statusParam !== 'all') {
        query = query.eq('status', statusParam);
      }

      // Role-based geographic scoping
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id) {
          query = query.eq('employees.zone_id', user.zone_id);
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id) {
          query = query.eq('employees.branch_id', user.branch_id);
        }
      }

      const { data: exits, error: exitsErr } = await query;
      if (exitsErr) {
        return res.status(500).json({ success: false, error: exitsErr.message });
      }

      if (!exits || exits.length === 0) {
        return res.status(200).json({
          success: true,
          exits: [],
          counts: { total: 0, in_progress: 0, completed: 0 },
        });
      }

      const exitIds = exits.map((e: any) => e.id);

      // Bulk fetch clearance items in a single query (NO N+1)
      const { data: clearanceItems, error: clErr } = await supabaseAdmin
        .from('exit_clearance_items')
        .select('exit_id, item_key, status, detail')
        .in('exit_id', exitIds);

      if (clErr) {
        return res.status(500).json({ success: false, error: clErr.message });
      }

      // Map clearance items by exit_id
      const clearanceMap = new Map<string, any[]>();
      (clearanceItems || []).forEach((item: any) => {
        const list = clearanceMap.get(item.exit_id) || [];
        list.push(item);
        clearanceMap.set(item.exit_id, list);
      });

      const formattedExits = exits.map((e: any) => {
        const emp = e.employees as any;
        const items = clearanceMap.get(e.id) || [];
        // count of items that are not 'pending', out of 6
        const clearanceFilled = items.filter((ci: any) => ci.status && ci.status !== 'pending').length;

        const branchData = emp?.branches as any;
        const branchName = (Array.isArray(branchData) ? branchData[0]?.name : branchData?.name) || 'Unassigned Branch';
        const zoneData = emp?.zones as any;
        const zoneName = (Array.isArray(zoneData) ? zoneData[0]?.name : zoneData?.name) || '';

        return {
          id: e.id,
          employee_id: e.employee_id,
          employee_code: emp?.employee_id || '',
          full_name: emp?.full_name || '',
          designation: emp?.designation_name || '',
          branch: branchName,
          branch_id: emp?.branch_id || null,
          branch_name: branchName,
          zone_id: emp?.zone_id || null,
          zone_name: zoneName,
          exit_type: e.exit_type,
          last_working_date: e.last_working_date,
          reason: e.reason,
          notes: e.notes || null,
          status: e.status,
          clearance_filled: clearanceFilled,
          clearance_total: 6,
          pdf_generated_at: e.pdf_generated_at || null,
          initiated_at: e.initiated_at,
          initiated_by_name: e.initiated_by_name || null,
        };
      });

      return res.status(200).json({
        success: true,
        exits: formattedExits,
        counts: {
          total: formattedExits.length,
          in_progress: formattedExits.filter((e) => e.status === 'in_progress').length,
          completed: formattedExits.filter((e) => e.status === 'completed').length,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/exits/:id
  // Returns the exit with its 6 clearance items (item_key, status, detail).
  // --------------------------------------------------------------------------
  router.get('/:id', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: ExitStaffContext = req.staffUser;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Exit ID is required.' });
      }

      const { data: exit, error: exitErr } = await supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          exit_type,
          last_working_date,
          reason,
          notes,
          status,
          initiated_at,
          initiated_by_name,
          pdf_generated_at,
          completed_at,
          employees (
            id,
            employee_id,
            full_name,
            designation_name,
            branch_id,
            zone_id,
            branches ( id, name, branch_code ),
            zones ( id, name, zone_code )
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (exitErr) {
        return res.status(500).json({ success: false, error: exitErr.message });
      }
      if (!exit) {
        return res.status(404).json({ success: false, error: 'Exit record not found.' });
      }

      const emp = exit.employees as any;

      // Scoping enforcement
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && emp?.zone_id && emp.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot access exit record outside your assigned zone.',
          });
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_id && emp?.branch_id && emp.branch_id !== user.branch_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot access exit record outside your assigned branch.',
          });
        }
      }

      // Fetch the 6 clearance checkpoints
      const { data: clearanceItems, error: clErr } = await supabaseAdmin
        .from('exit_clearance_items')
        .select('id, item_key, status, detail, updated_by_id, updated_at')
        .eq('exit_id', id);

      if (clErr) {
        return res.status(500).json({ success: false, error: clErr.message });
      }

      // Ensure all 6 valid keys are present in canonical order
      const existingKeyMap = new Map((clearanceItems || []).map((ci: any) => [ci.item_key, ci]));
      const orderedItems = VALID_CLEARANCE_KEYS.map((key) => {
        const found = existingKeyMap.get(key);
        return {
          item_key: key,
          status: found?.status || 'pending',
          detail: found?.detail || null,
          updated_at: found?.updated_at || null,
        };
      });

      const clearanceFilled = orderedItems.filter((ci) => ci.status !== 'pending').length;
      const branchData = emp?.branches as any;
      const branchName = (Array.isArray(branchData) ? branchData[0]?.name : branchData?.name) || 'Unassigned Branch';
      const zoneData = emp?.zones as any;
      const zoneName = (Array.isArray(zoneData) ? zoneData[0]?.name : zoneData?.name) || '';

      return res.status(200).json({
        success: true,
        exit: {
          id: exit.id,
          employee_id: exit.employee_id,
          employee_code: emp?.employee_id || '',
          full_name: emp?.full_name || '',
          designation: emp?.designation_name || '',
          branch: branchName,
          branch_id: emp?.branch_id || null,
          branch_name: branchName,
          zone_id: emp?.zone_id || null,
          zone_name: zoneName,
          exit_type: exit.exit_type,
          last_working_date: exit.last_working_date,
          reason: exit.reason,
          notes: exit.notes || null,
          status: exit.status,
          clearance_filled: clearanceFilled,
          clearance_total: 6,
          pdf_generated_at: exit.pdf_generated_at || null,
          initiated_at: exit.initiated_at,
          initiated_by_name: exit.initiated_by_name || null,
          clearance_items: orderedItems,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. PUT /api/exits/:id/clearance
  // Updates exit clearance items atomically in one upsert call.
  // Allowed roles: super_admin, zonal_hr_manager, central_hr inside scope.
  // Branch manager: 403.
  // Exit must be 'in_progress' (409 otherwise).
  // Writes audit log 'exit_clearance_updated' with old and new values.
  // --------------------------------------------------------------------------
  router.put('/:id/clearance', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: ExitStaffContext = req.staffUser;
      const { id } = req.params;
      const { items } = req.body || {};

      // Role check: Branch Manager is strictly read-only (403)
      if (user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers have read-only access and cannot update clearance checkpoints.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'zonal_hr_manager' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges to update exit clearance.',
        });
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'Exit ID is required.' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Clearance items array is required.',
        });
      }

      // Validate each item strictly
      for (const item of items) {
        if (!item || typeof item !== 'object') {
          return res.status(400).json({ success: false, error: 'Each clearance item must be an object.' });
        }

        const { item_key, status, detail } = item;

        // 1. item_key must be one of office_files, keys, mobile_sim, id_card, company_car, others; anything else returns 400.
        if (!VALID_CLEARANCE_KEYS.includes(item_key as any)) {
          return res.status(400).json({
            success: false,
            error: `Invalid clearance item key: "${item_key}". Allowed keys: ${VALID_CLEARANCE_KEYS.join(', ')}.`,
          });
        }

        // 2. 'pending' cannot be sent by the client.
        if (status === 'pending') {
          return res.status(400).json({
            success: false,
            error: 'Clearance status "pending" cannot be submitted by the client.',
          });
        }

        if (!VALID_CLEARANCE_STATUSES.includes(status as any)) {
          return res.status(400).json({
            success: false,
            error: `Invalid clearance status "${status}" for item "${item_key}". Allowed values: ${VALID_CLEARANCE_STATUSES.join(', ')}.`,
          });
        }

        // 3. detail (trimmed, max 200 chars) is allowed only for mobile_sim, company_car, others; for other keys return 400.
        const detailHasValue = detail !== undefined && detail !== null && String(detail).trim().length > 0;
        if (!DETAIL_ALLOWED_KEYS.includes(item_key as any) && detailHasValue) {
          return res.status(400).json({
            success: false,
            error: `Detail text is not permitted for item key "${item_key}". Detail is only allowed for: ${DETAIL_ALLOWED_KEYS.join(', ')}.`,
          });
        }

        if (DETAIL_ALLOWED_KEYS.includes(item_key as any) && detailHasValue) {
          const trimmedDetail = String(detail).trim();
          if (trimmedDetail.length > 200) {
            return res.status(400).json({
              success: false,
              error: `Detail text for "${item_key}" exceeds maximum allowed length of 200 characters (got ${trimmedDetail.length}).`,
            });
          }
        }
      }

      // Fetch the exit and employee to verify status and geographic scope
      const { data: exitRow, error: exitErr } = await supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          status,
          employees (
            id,
            employee_id,
            full_name,
            zone_id,
            branch_id
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (exitErr) {
        return res.status(500).json({ success: false, error: exitErr.message });
      }
      if (!exitRow) {
        return res.status(404).json({ success: false, error: 'Exit record not found.' });
      }

      const emp = exitRow.employees as any;

      // Geographic scoping check
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && emp?.zone_id && emp.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot update clearance for employee outside your assigned zone.',
          });
        }
      }

      // The exit must be 'in_progress' (409 otherwise)
      if (exitRow.status !== 'in_progress') {
        return res.status(409).json({
          success: false,
          error: `Cannot update clearance: Exit status is '${exitRow.status}'. Only exits in 'in_progress' status can be modified.`,
        });
      }

      // Fetch current clearance items to compute old vs new diff for audit log
      const { data: currentItems } = await supabaseAdmin
        .from('exit_clearance_items')
        .select('item_key, status, detail')
        .eq('exit_id', id);

      const currentMap = new Map((currentItems || []).map((ci: any) => [ci.item_key, ci]));

      const itemChanges: Array<{
        item_key: string;
        old_status: string;
        new_status: string;
        old_detail: string | null;
        new_detail: string | null;
        old_value: string;
        new_value: string;
      }> = [];

      const nowIso = new Date().toISOString();
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;

      const upsertRows = items.map((item: any) => {
        const old = currentMap.get(item.item_key);
        const oldStatus = old?.status || 'pending';
        const oldDetail = old?.detail || null;
        const newDetail = DETAIL_ALLOWED_KEYS.includes(item.item_key as any) && item.detail !== undefined && item.detail !== null
          ? String(item.detail).trim() || null
          : null;

        itemChanges.push({
          item_key: item.item_key,
          old_status: oldStatus,
          new_status: item.status,
          old_detail: oldDetail,
          new_detail: newDetail,
          old_value: oldStatus,
          new_value: item.status,
        });

        return {
          exit_id: id,
          item_key: item.item_key,
          status: item.status,
          detail: newDetail,
          updated_by_id: actorId,
          updated_at: nowIso,
        };
      });

      // Save all items in one request atomically (single upsert call)
      const { data: savedItems, error: upsertErr } = await supabaseAdmin
        .from('exit_clearance_items')
        .upsert(upsertRows, { onConflict: 'exit_id, item_key' })
        .select('id, exit_id, item_key, status, detail, updated_at');

      if (upsertErr) {
        return res.status(500).json({ success: false, error: upsertErr.message });
      }

      // Write audit log 'exit_clearance_updated' with old and new values per changed item
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId,
        actor_type: 'staff',
        action: 'exit_clearance_updated',
        entity_type: 'employee_exits',
        entity_id: id,
        metadata: {
          employee_id: exitRow.employee_id,
          employee_code: emp?.employee_id || '',
          actor_name: user.name,
          actor_role: user.role,
          changes: itemChanges,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Exit clearance checkpoints updated successfully.',
        clearance_items: savedItems || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. GET /api/exits/:id/pdf
  // Generates and streams Employee Clearance Form (ECF) PDF.
  // Allowed roles: super_admin, zonal_hr_manager, central_hr inside scope.
  // Branch manager: 403. Candidate token: 401/403.
  // Works for 'in_progress' and 'completed' exits.
  // Returns 400 if all 6 clearance items are still 'pending'.
  // Sets employee_exits.pdf_generated_at and pdf_generated_by_id.
  // Writes audit log 'exit_pdf_generated'.
  // --------------------------------------------------------------------------
  router.get('/:id/pdf', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: ExitStaffContext = req.staffUser;
      const { id } = req.params;

      // Role check: Branch Manager is strictly forbidden (403)
      if (user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers do not have permission to download or generate Employee Clearance Form (ECF) PDFs.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'zonal_hr_manager' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges to generate ECF PDF.',
        });
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'Exit ID is required.' });
      }

      // Fetch exit record and employee
      const { data: exitRow, error: exitErr } = await supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          exit_type,
          last_working_date,
          reason,
          status,
          pdf_generated_at,
          employees (
            id,
            employee_id,
            full_name,
            designation_name,
            zone_id,
            branch_id,
            branches ( id, name ),
            zones ( id, name )
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (exitErr) {
        return res.status(500).json({ success: false, error: exitErr.message });
      }
      if (!exitRow) {
        return res.status(404).json({ success: false, error: 'Exit record not found.' });
      }

      const emp = exitRow.employees as any;

      // Geographic scoping check for zonal HR and central HR
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && emp?.zone_id && emp.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot generate clearance PDF for employee outside your assigned zone.',
          });
        }
      }

      // Allowed statuses: 'in_progress' and 'completed'
      if (exitRow.status !== 'in_progress' && exitRow.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: `Cannot generate PDF: Exit status is '${exitRow.status}'. Only 'in_progress' or 'completed' exits are eligible.`,
        });
      }

      // Fetch clearance items
      const { data: dbItems, error: itemsErr } = await supabaseAdmin
        .from('exit_clearance_items')
        .select('item_key, status, detail')
        .eq('exit_id', id);

      if (itemsErr) {
        return res.status(500).json({ success: false, error: itemsErr.message });
      }

      const itemsMap = new Map((dbItems || []).map((ci: any) => [ci.item_key, ci]));
      const orderedItems = VALID_CLEARANCE_KEYS.map((k) => {
        const found = itemsMap.get(k);
        return {
          item_key: k,
          status: found?.status || 'pending',
          detail: found?.detail || null,
        };
      });

      // Return 400 if all 6 clearance items are still 'pending'
      const nonPendingCount = orderedItems.filter((ci) => ci.status !== 'pending').length;
      if (nonPendingCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot generate ECF PDF: All 6 clearance items are still pending. At least one clearance checkpoint must be recorded.',
        });
      }

      // Check for active ECF template in storage
      let templateBuffer: Buffer | null = null;
      let templateMimeType: string | null = null;

      try {
        const { data: activeTemplate } = await supabaseAdmin
          .from('ecf_templates')
          .select('storage_path, mime_type')
          .eq('is_active', true)
          .maybeSingle();

        if (activeTemplate?.storage_path) {
          const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
            .from('ecf-templates')
            .download(activeTemplate.storage_path);

          if (!dlErr && fileBlob) {
            templateBuffer = Buffer.from(await fileBlob.arrayBuffer());
            templateMimeType = activeTemplate.mime_type;
          }
        }
      } catch (err) {
        console.warn('ECF Template retrieval failed, using standard fallback header:', err);
      }

      // Resolve branch name
      const branchData = emp?.branches as any;
      const branchName =
        (Array.isArray(branchData) ? branchData[0]?.name : branchData?.name) || 'Head Office';

      // Generate the PDF binary
      const pdfBytes = await generateEcfPdf({
        exitId: exitRow.id,
        employeeCode: emp?.employee_id || 'PX-EMP',
        fullName: emp?.full_name || 'PostEx Employee',
        designation: emp?.designation_name || 'Team Member',
        branch: branchName,
        exitType: exitRow.exit_type || 'resignation',
        lastWorkingDate: exitRow.last_working_date || '—',
        reason: exitRow.reason || '—',
        clearanceItems: orderedItems,
        preparedByName: user.name || 'HR Officer',
        generatedDate: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        templateBuffer,
        templateMimeType,
      });

      // Update exit record with pdf generation timestamp & actor
      const nowIso = new Date().toISOString();
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;

      await supabaseAdmin
        .from('employee_exits')
        .update({
          pdf_generated_at: nowIso,
          pdf_generated_by_id: actorId,
        })
        .eq('id', id);

      // Audit log 'exit_pdf_generated'
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: actorId,
        actor_type: 'staff',
        action: 'exit_pdf_generated',
        entity_type: 'employee_exits',
        entity_id: id,
        metadata: {
          employee_id: exitRow.employee_id,
          employee_code: emp?.employee_id || '',
          actor_name: user.name,
          actor_role: user.role,
          template_active: Boolean(templateBuffer),
          template_mime: templateMimeType || 'none',
        },
      });

      const safeEmployeeCode = (emp?.employee_id || 'UNKNOWN').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ECF_${safeEmployeeCode}.pdf"`);
      return res.status(200).send(Buffer.from(pdfBytes));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. POST /api/exits/:id/complete
  // Body: { confirm_outstanding?: boolean }
  // Roles: super_admin, zonal_hr_manager, central_hr (branch_manager & candidate: 403)
  // Scoped to assigned zone for zonal_hr_manager and central_hr.
  // Calls public.complete_employee_exit RPC atomically.
  // Error mapping:
  // - 400: pending items (with list)
  // - 409: outstanding items without confirmation (code OUTSTANDING_ITEMS with list)
  // - 409: already completed / not in progress
  // - 404: not found
  // - 403: out of scope / unauthorized role
  // - 500: missing RPC migration
  // --------------------------------------------------------------------------
  router.post('/:id/complete', requireStaffAccess, async (req: any, res: any) => {
    try {
      const user: ExitStaffContext = req.staffUser;
      const { id } = req.params;

      // Role check: Branch Manager is strictly read-only (403)
      if (user.role === 'branch_manager') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Branch managers have read-only access and cannot complete employee exits.',
        });
      }

      if (user.role !== 'super_admin' && user.role !== 'zonal_hr_manager' && user.role !== 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient privileges to complete employee exit.',
        });
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'Exit ID is required.' });
      }

      // Check exit existence and geographic scope
      const { data: exitRow, error: exitErr } = await supabaseAdmin
        .from('employee_exits')
        .select(`
          id,
          employee_id,
          status,
          employees (
            id,
            employee_id,
            full_name,
            zone_id,
            branch_id
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (exitErr) {
        return res.status(500).json({ success: false, error: exitErr.message });
      }
      if (!exitRow) {
        return res.status(404).json({ success: false, error: 'Exit record not found.' });
      }

      const emp = exitRow.employees as any;

      // Geographic scoping check for zonal HR and central HR
      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_id && emp?.zone_id && emp.zone_id !== user.zone_id) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Cannot complete exit for employee outside your assigned zone.',
          });
        }
      }

      // Check if already completed
      if (exitRow.status !== 'in_progress') {
        return res.status(409).json({
          success: false,
          error: `Cannot complete exit: Exit status is '${exitRow.status}'. Only 'in_progress' exits can be completed.`,
        });
      }

      const confirmOutstanding = Boolean(req.body?.confirm_outstanding);
      const actorId = user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null;

      // Call public.complete_employee_exit RPC
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('complete_employee_exit', {
        p_exit_id: id,
        p_actor_id: actorId,
        p_actor_name: user.name,
        p_confirm_outstanding: confirmOutstanding,
      });

      if (rpcErr) {
        const errMsg = rpcErr.message || '';

        // Missing RPC
        if (
          rpcErr.code === '42883' ||
          rpcErr.code === 'PGRST202' ||
          errMsg.includes('does not exist') ||
          errMsg.includes('schema cache')
        ) {
          return res.status(500).json({
            success: false,
            error: 'Database function complete_employee_exit is missing. Please ensure migration 20261003020000_complete_employee_exit_rpc.sql has been applied.',
          });
        }

        // Pending clearance items (400)
        if (errMsg.includes('PENDING_CLEARANCE_ITEMS')) {
          const match = errMsg.match(/PENDING_CLEARANCE_ITEMS:\s*\[(.*?)\]/);
          const pendingItems = match
            ? match[1].split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];
          return res.status(400).json({
            success: false,
            error: 'Cannot complete exit: All 6 clearance items must be resolved before completing the exit.',
            pending_items: pendingItems,
          });
        }

        // Outstanding items without confirmation (409)
        if (errMsg.includes('OUTSTANDING_ITEMS')) {
          const match = errMsg.match(/OUTSTANDING_ITEMS:\s*\[(.*?)\]/);
          const outstandingItems = match
            ? match[1].split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];
          return res.status(409).json({
            success: false,
            code: 'OUTSTANDING_ITEMS',
            error: 'There are outstanding clearance items that have not been received. Confirmation is required.',
            outstanding_items: outstandingItems,
          });
        }

        // Already completed or not in progress (409)
        if (errMsg.includes('EXIT_NOT_IN_PROGRESS')) {
          return res.status(409).json({
            success: false,
            error: `Cannot complete exit: Exit status is not 'in_progress'.`,
          });
        }

        // Not found (404)
        if (errMsg.includes('EXIT_NOT_FOUND') || errMsg.includes('EMPLOYEE_NOT_FOUND')) {
          return res.status(404).json({
            success: false,
            error: 'Exit record or employee not found.',
          });
        }

        return res.status(500).json({ success: false, error: rpcErr.message });
      }

      return res.status(200).json({
        success: true,
        message: 'Employee exit completed successfully.',
        exit_id: rpcData || id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
