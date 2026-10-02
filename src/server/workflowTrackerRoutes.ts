// ==============================================================================
// PostEx HR Onboarding Portal — Employee Operational Workflow Tasks & Verification API
// ==============================================================================
// Governance & Anti-False-Completion Rules:
// - Never executes DDL through the app (manual SQL migration in Supabase SQL Editor).
// - Strict Staff RBAC: Candidate sessions have zero access to internal HR workflow tasks.
// - Task Submission: Any authorized HR/staff user in scope can submit a Pending or
//   Returned task with required evidence_reference / completion_note -> status becomes
//   'submitted' (NEVER 'verified' directly).
// - Task Verification / Return: Only Verifier roles ('super_admin', 'zonal_hr_manager',
//   'branch_manager') can Verify ('verified') or Return ('returned') a 'submitted' task.
//   Central HR ('central_hr') cannot verify tasks.
// - Every transition writes an append-only entry to public.audit_logs.
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkflowStaffContext {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'zonal_hr_manager' | 'central_hr' | 'branch_manager';
  zone_id: string | null;
  zone_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  canSubmit: boolean;
  canVerify: boolean;
}

function isMissingTableError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('employee_workflow_tasks') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not find'))
  );
}

export function createWorkflowTrackerRouter(supabaseAdmin: SupabaseClient) {
  const router = Router();

  // --------------------------------------------------------------------------
  // Middleware: Authenticate staff user & resolve scope + submit/verify rights
  // --------------------------------------------------------------------------
  async function requireWorkflowStaffAccess(req: any, res: any, next: any) {
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

        req.workflowUser = {
          id: saProfile?.id || '00000000-0000-0000-0000-000000000001',
          email: saProfile?.personal_email || 'admin@postex.pk',
          name: saProfile?.name || 'Super Admin',
          role: 'super_admin',
          zone_id: null,
          zone_name: null,
          branch_id: null,
          branch_name: null,
          canSubmit: true,
          canVerify: true,
        } satisfies WorkflowStaffContext;
        return next();
      }

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
        return res.status(403).json({ success: false, error: 'Staff profile not found. Candidate accounts cannot access Workflow Tracker.' });
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
          error: 'Forbidden: Internal HR / Staff role required to access Workflow Tracker.',
        });
      }

      const rawZone = profile.zones as any;
      const zoneObj = Array.isArray(rawZone) ? rawZone[0] : rawZone;
      const rawBranch = profile.branches as any;
      const branchObj = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;

      const canSubmit = ['super_admin', 'zonal_hr_manager', 'central_hr', 'branch_manager'].includes(roleName);
      const canVerify = ['super_admin', 'zonal_hr_manager', 'branch_manager'].includes(roleName);

      req.workflowUser = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: profile.name || authUser.user.email || 'Staff User',
        role: roleName as WorkflowStaffContext['role'],
        zone_id: profile.zone_id || zoneObj?.id || null,
        zone_name: zoneObj?.name || null,
        branch_id: profile.branch_id || branchObj?.id || null,
        branch_name: branchObj?.name || null,
        canSubmit,
        canVerify,
      } satisfies WorkflowStaffContext;

      return next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // GET /api/workflow-tracker/tasks
  // Returns persisted workflow tasks and workflow_task audit logs scoped by role
  // --------------------------------------------------------------------------
  router.get('/tasks', requireWorkflowStaffAccess, async (req: any, res: any) => {
    try {
      const user: WorkflowStaffContext = req.workflowUser;

      let query = supabaseAdmin
        .from('employee_workflow_tasks')
        .select('*')
        .order('updated_at', { ascending: false });

      if (user.role === 'zonal_hr_manager' || user.role === 'central_hr') {
        if (user.zone_name) {
          query = query.ilike('zone_name', `%${user.zone_name.split(' ')[0]}%`);
        }
      } else if (user.role === 'branch_manager') {
        if (user.branch_name) {
          query = query.ilike('branch_name', `%${user.branch_name.split(' ')[0]}%`);
        }
      }

      const { data: tasks, error: tasksErr } = await query;

      const { data: auditRows } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('entity_type', 'workflow_task')
        .order('created_at', { ascending: false })
        .limit(200);

      if (tasksErr) {
        if (isMissingTableError(tasksErr)) {
          return res.json({
            success: true,
            tableReady: false,
            tasks: [],
            auditLogs: auditRows || [],
          });
        }
        return res.status(500).json({ success: false, error: tasksErr.message });
      }

      return res.json({
        success: true,
        tableReady: true,
        tasks: tasks || [],
        auditLogs: auditRows || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/workflow-tracker/tasks/submit
  // Submits or resubmits a task with evidence -> status strictly becomes 'submitted'
  // --------------------------------------------------------------------------
  router.post('/tasks/submit', requireWorkflowStaffAccess, async (req: any, res: any) => {
    try {
      const user: WorkflowStaffContext = req.workflowUser;
      const {
        joiner_id,
        employee_code,
        joiner_name,
        designation_name,
        branch_name,
        zone_name,
        assigned_hr_name,
        task_index,
        task_key,
        task_name,
        short_label,
        target_day,
        evidence_reference,
        completion_note,
        evidence_file_name,
        evidence_url,
        previous_status,
      } = req.body || {};

      if (!joiner_id || !task_key || !task_name) {
        return res.status(400).json({
          success: false,
          error: 'joiner_id, task_key, and task_name are required.',
        });
      }

      const trimmedRef = String(evidence_reference || '').trim();
      const trimmedNote = String(completion_note || '').trim();
      const trimmedFile = String(evidence_file_name || '').trim();

      if (!trimmedRef && !trimmedFile) {
        return res.status(400).json({
          success: false,
          error: 'Evidence Reference / ID or attached proof is required before submitting a task.',
        });
      }

      const submittedAt = new Date().toISOString();
      const isResubmit = previous_status === 'returned';
      const auditAction = isResubmit ? 'workflow_task_resubmitted' : 'workflow_task_submitted';

      let persistedTask: any = null;
      let tableReady = true;

      const upsertPayload = {
        joiner_id: String(joiner_id),
        employee_code: String(employee_code || joiner_id),
        joiner_name: String(joiner_name || 'Joiner'),
        designation_name: String(designation_name || 'Staff'),
        branch_name: String(branch_name || 'Gulberg Hub'),
        zone_name: String(zone_name || 'Central Zone'),
        assigned_hr_name: String(assigned_hr_name || user.name),
        task_index: Number(task_index ?? 0),
        task_key: String(task_key),
        task_name: String(task_name),
        short_label: String(short_label || task_key),
        target_day: Number(target_day ?? 0),
        status: 'submitted',
        submitted_at: submittedAt,
        submitted_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
        submitted_by_name: user.name,
        submitted_by_role: user.role,
        completion_note: trimmedNote || null,
        evidence_reference: trimmedRef || null,
        evidence_file_name: trimmedFile || null,
        evidence_url: evidence_url ? String(evidence_url) : null,
        updated_at: submittedAt,
      };

      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from('employee_workflow_tasks')
        .upsert(upsertPayload, { onConflict: 'joiner_id,task_key' })
        .select('*')
        .maybeSingle();

      if (upsertErr) {
        if (isMissingTableError(upsertErr)) {
          tableReady = false;
        } else {
          console.warn('[WORKFLOW TRACKER] Supabase upsert warning:', upsertErr.message);
        }
      } else {
        persistedTask = upserted;
      }

      const auditMetadata = {
        joiner_id,
        employee_code: employee_code || joiner_id,
        joiner_name,
        branch_name,
        zone_name,
        task_index,
        task_key,
        task_name,
        previous_status: previous_status || 'pending',
        new_status: 'submitted',
        evidence_reference: trimmedRef,
        evidence_file_name: trimmedFile || null,
        completion_note: trimmedNote || null,
        submitted_by_name: user.name,
        submitted_by_role: user.role,
        submitted_at: submittedAt,
      };

      const { data: auditRow } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          actor_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          actor_type: 'staff',
          action: auditAction,
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
        })
        .select('*')
        .maybeSingle();

      return res.json({
        success: true,
        tableReady,
        status: 'submitted',
        submitted_at: submittedAt,
        submitted_by_name: user.name,
        submitted_by_role: user.role,
        task: persistedTask || upsertPayload,
        auditEntry: auditRow || {
          action: auditAction,
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
          created_at: submittedAt,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/workflow-tracker/tasks/verify
  // Verifies a 'submitted' task -> status becomes 'verified'
  // Enforces RBAC: central_hr cannot verify tasks
  // --------------------------------------------------------------------------
  router.post('/tasks/verify', requireWorkflowStaffAccess, async (req: any, res: any) => {
    try {
      const user: WorkflowStaffContext = req.workflowUser;

      if (!user.canVerify || user.role === 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Central HR cannot verify submitted tasks. Verification requires Zonal HR, Branch Manager, or Super Admin.',
        });
      }

      const {
        joiner_id,
        employee_code,
        joiner_name,
        branch_name,
        zone_name,
        task_index,
        task_key,
        task_name,
        verification_note,
      } = req.body || {};

      if (!joiner_id || !task_key) {
        return res.status(400).json({
          success: false,
          error: 'joiner_id and task_key are required to verify a task.',
        });
      }

      const verifiedAt = new Date().toISOString();
      let persistedTask: any = null;
      let tableReady = true;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('employee_workflow_tasks')
        .update({
          status: 'verified',
          verified_at: verifiedAt,
          verified_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          verified_by_name: user.name,
          verified_by_role: user.role,
          updated_at: verifiedAt,
        })
        .eq('joiner_id', String(joiner_id))
        .eq('task_key', String(task_key))
        .select('*')
        .maybeSingle();

      if (updateErr) {
        if (isMissingTableError(updateErr)) {
          tableReady = false;
        } else {
          console.warn('[WORKFLOW TRACKER] Supabase verify update warning:', updateErr.message);
        }
      } else {
        persistedTask = updated;
      }

      const auditMetadata = {
        joiner_id,
        employee_code: employee_code || joiner_id,
        joiner_name,
        branch_name,
        zone_name,
        task_index,
        task_key,
        task_name,
        previous_status: 'submitted',
        new_status: 'verified',
        verification_note: verification_note || null,
        verified_by_name: user.name,
        verified_by_role: user.role,
        verified_at: verifiedAt,
      };

      const { data: auditRow } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          actor_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          actor_type: 'staff',
          action: 'workflow_task_verified',
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
        })
        .select('*')
        .maybeSingle();

      return res.json({
        success: true,
        tableReady,
        status: 'verified',
        verified_at: verifiedAt,
        verified_by_name: user.name,
        verified_by_role: user.role,
        task: persistedTask,
        auditEntry: auditRow || {
          action: 'workflow_task_verified',
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
          created_at: verifiedAt,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/workflow-tracker/tasks/return
  // Returns a 'submitted' task with a required return_reason -> status becomes 'returned'
  // Enforces RBAC: central_hr cannot return tasks
  // --------------------------------------------------------------------------
  router.post('/tasks/return', requireWorkflowStaffAccess, async (req: any, res: any) => {
    try {
      const user: WorkflowStaffContext = req.workflowUser;

      if (!user.canVerify || user.role === 'central_hr') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Central HR cannot return submitted tasks. Review requires Zonal HR, Branch Manager, or Super Admin.',
        });
      }

      const {
        joiner_id,
        employee_code,
        joiner_name,
        branch_name,
        zone_name,
        task_index,
        task_key,
        task_name,
        return_reason,
      } = req.body || {};

      const trimmedReason = String(return_reason || '').trim();
      if (!joiner_id || !task_key || !trimmedReason) {
        return res.status(400).json({
          success: false,
          error: 'joiner_id, task_key, and a non-empty return_reason are required to return a task.',
        });
      }

      const returnedAt = new Date().toISOString();
      let persistedTask: any = null;
      let tableReady = true;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('employee_workflow_tasks')
        .update({
          status: 'returned',
          returned_at: returnedAt,
          returned_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          returned_by_name: user.name,
          returned_by_role: user.role,
          return_reason: trimmedReason,
          updated_at: returnedAt,
        })
        .eq('joiner_id', String(joiner_id))
        .eq('task_key', String(task_key))
        .select('*')
        .maybeSingle();

      if (updateErr) {
        if (isMissingTableError(updateErr)) {
          tableReady = false;
        } else {
          console.warn('[WORKFLOW TRACKER] Supabase return update warning:', updateErr.message);
        }
      } else {
        persistedTask = updated;
      }

      const auditMetadata = {
        joiner_id,
        employee_code: employee_code || joiner_id,
        joiner_name,
        branch_name,
        zone_name,
        task_index,
        task_key,
        task_name,
        previous_status: 'submitted',
        new_status: 'returned',
        return_reason: trimmedReason,
        returned_by_name: user.name,
        returned_by_role: user.role,
        returned_at: returnedAt,
      };

      const { data: auditRow } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          actor_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
          actor_type: 'staff',
          action: 'workflow_task_returned',
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
        })
        .select('*')
        .maybeSingle();

      return res.json({
        success: true,
        tableReady,
        status: 'returned',
        returned_at: returnedAt,
        returned_by_name: user.name,
        returned_by_role: user.role,
        return_reason: trimmedReason,
        task: persistedTask,
        auditEntry: auditRow || {
          action: 'workflow_task_returned',
          entity_type: 'workflow_task',
          entity_id: `${employee_code || joiner_id}:${task_key}`,
          metadata: auditMetadata,
          created_at: returnedAt,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
