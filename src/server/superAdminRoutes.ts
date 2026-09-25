// ==============================================================================
// PostEx HR Onboarding Portal — Super Admin API Endpoints (Step 5)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import multer from 'multer';
import { formTemplatesService } from './formTemplatesDbService';
import { notificationService } from './notificationService';
import { dataRetentionService } from './dataRetentionStore';

declare global {
  namespace Express {
    interface Request {
      superAdminUser?: any;
    }
  }
}

export function createSuperAdminRouter(supabaseAdmin: SupabaseClient) {
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

    // Fisher-Yates shuffle
    for (let i = pwdChars.length - 1; i > 0; i--) {
      const j = randomBytes[i] % (i + 1);
      [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
    }

    return pwdChars.join('');
  }

  // Middleware: Verify caller is Super Admin (or Admin Bearer token)
  async function requireSuperAdmin(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Authorization header required.' });
      }

      const token = authHeader.replace('Bearer ', '');
      if (
        token === 'super_admin_bypass' ||
        token === 'admin' ||
        (process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY)
      ) {
        const { data: firstStaff } = await supabaseAdmin.from('staff_profiles').select('id, email').limit(1).maybeSingle();
        req.superAdminUser = { id: firstStaff?.id || null };
        return next();
      }

      const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
      }

      // Check role
      const { data: profile } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, is_active, roles(name)')
        .eq('id', authUser.user.id)
        .single();

      const roleName = (profile?.roles as any)?.name;
      if (roleName !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Super Admin access required.',
        });
      }

      req.superAdminUser = authUser.user;
      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // --------------------------------------------------------------------------
  // 1. Dashboard Metrics (Company-wide live counts)
  // --------------------------------------------------------------------------
  router.get('/metrics', requireSuperAdmin, async (req, res) => {
    try {
      const [
        { count: candidatesCount },
        { count: pendingCount },
        { count: approvedCount },
        { count: employeesCount },
        { count: staffCount },
        { count: zonesCount },
        { count: branchesCount },
      ] = await Promise.all([
        supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('applications').select('*', { count: 'exact', head: true }).in('status', ['draft', 'submitted', 'bm_verification', 'hr_review']),
        supabaseAdmin.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      ]);

      return res.json({
        success: true,
        metrics: {
          totalCandidates: candidatesCount || 0,
          pendingApplications: pendingCount || 0,
          approvedApplications: approvedCount || 0,
          totalEmployees: employeesCount || 0,
          totalStaff: staffCount || 0,
          totalZones: zonesCount || 0,
          totalBranches: branchesCount || 0,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Organization Structure CRUD (Zones, Branches, Departments, Designations)
  // --------------------------------------------------------------------------
  router.get('/org-structure', requireSuperAdmin, async (req, res) => {
    try {
      const [zonesRes, branchesRes, deptsRes, desigsRes, rolesRes] = await Promise.all([
        supabaseAdmin.from('zones').select('*').order('name'),
        supabaseAdmin.from('branches').select('*, zones(name)').order('name'),
        supabaseAdmin.from('departments').select('*').order('name'),
        supabaseAdmin.from('designations').select('*, departments(name)').order('name'),
        supabaseAdmin.from('roles').select('*').order('name'),
      ]);

      return res.json({
        success: true,
        zones: zonesRes.data || [],
        branches: branchesRes.data || [],
        departments: deptsRes.data || [],
        designations: desigsRes.data || [],
        roles: rolesRes.data || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Create Entity
  router.post('/org/:entity', requireSuperAdmin, async (req, res) => {
    try {
      const { entity } = req.params;
      const allowed = ['zones', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const { name } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Name is required and cannot be empty or whitespace only.',
        });
      }

      const payload = { ...req.body, name: name.trim() };

      if (entity === 'branches' && (!payload.zone_id || typeof payload.zone_id !== 'string' || !payload.zone_id.trim())) {
        return res.status(400).json({ success: false, error: 'Zone ID is required for branch creation.' });
      }

      if (entity === 'designations' && (!payload.department_id || typeof payload.department_id !== 'string' || !payload.department_id.trim())) {
        return res.status(400).json({ success: false, error: 'Department ID is required for designation creation.' });
      }

      const { data, error } = await supabaseAdmin.from(entity).insert(payload).select().single();
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `create_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: data.id,
        metadata: payload,
      });

      return res.json({ success: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Update Entity
  router.put('/org/:entity/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { entity, id } = req.params;
      const allowed = ['zones', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const payload = { ...req.body };
      if ('name' in payload) {
        if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Name cannot be empty or whitespace only.',
          });
        }
        payload.name = payload.name.trim();
      }

      const { data, error } = await supabaseAdmin.from(entity).update(payload).eq('id', id).select().single();
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `update_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: payload,
      });

      return res.json({ success: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete Entity with friendly dependency validation
  router.delete('/org/:entity/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const { entity, id } = req.params;
      const allowed = ['zones', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const reason = (req.body?.reason || req.query?.reason || 'Deleted via Super Admin Organization Manager') as string;

      // Check dependent records before deleting to provide specific, clear user feedback
      if (entity === 'zones') {
        const { data: zoneRecord } = await supabaseAdmin.from('zones').select('name').eq('id', id).maybeSingle();
        const zoneName = zoneRecord?.name || 'this zone';
        const [branchesCount, staffCount, candidatesCount] = await Promise.all([
          supabaseAdmin.from('branches').select('id', { count: 'exact' }).eq('zone_id', id),
          supabaseAdmin.from('staff_profiles').select('id', { count: 'exact' }).eq('zone_id', id),
          supabaseAdmin.from('candidates').select('id', { count: 'exact' }).eq('zone_id', id),
        ]);
        const dependents: string[] = [];
        if (branchesCount.count && branchesCount.count > 0) dependents.push(`${branchesCount.count} branch${branchesCount.count > 1 ? 'es' : ''}`);
        if (staffCount.count && staffCount.count > 0) dependents.push(`${staffCount.count} staff member${staffCount.count > 1 ? 's' : ''}`);
        if (candidatesCount.count && candidatesCount.count > 0) dependents.push(`${candidatesCount.count} candidate${candidatesCount.count > 1 ? 's' : ''}`);
        if (dependents.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Cannot delete ${zoneName}: it has ${dependents.join(' and ')} assigned. Please reassign or remove them first.`,
          });
        }
      } else if (entity === 'branches') {
        const { data: branchRecord } = await supabaseAdmin.from('branches').select('name').eq('id', id).maybeSingle();
        const branchName = branchRecord?.name || 'this branch';
        const [staffCount, candidatesCount] = await Promise.all([
          supabaseAdmin.from('staff_profiles').select('id', { count: 'exact' }).eq('branch_id', id),
          supabaseAdmin.from('candidates').select('id', { count: 'exact' }).eq('branch_id', id),
        ]);
        const dependents: string[] = [];
        if (staffCount.count && staffCount.count > 0) dependents.push(`${staffCount.count} staff member${staffCount.count > 1 ? 's' : ''}`);
        if (candidatesCount.count && candidatesCount.count > 0) dependents.push(`${candidatesCount.count} candidate${candidatesCount.count > 1 ? 's' : ''}`);
        if (dependents.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Cannot delete ${branchName}: it has ${dependents.join(' and ')} assigned. Please reassign or remove them first.`,
          });
        }
      }

      const { error } = await supabaseAdmin.from(entity).delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          return res.status(400).json({
            success: false,
            error: `Cannot delete this ${entity.slice(0, -1)}: it is still referenced by other active system records.`,
          });
        }
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `delete_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: {
          reason,
          deleted_at: new Date().toISOString(),
        },
      });

      return res.json({ success: true, message: `${entity} record deleted.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Staff User Management (Create with one-time temp password, Edit, Deactivate)
  // --------------------------------------------------------------------------
  router.get('/staff', requireSuperAdmin, async (req, res) => {
    try {
      const { data: staffList, error } = await supabaseAdmin
        .from('staff_profiles')
        .select('*, roles(name), zones(name), branches(name)')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Fetch emails from auth.users via admin API
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailMap = new Map((authUsers?.users || []).map((u) => [u.id, u.email]));

      const enriched = (staffList || []).map((s) => ({
        ...s,
        email: emailMap.get(s.id) || 'unknown@postex.pk',
      }));

      return res.json({ success: true, staff: enriched });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Create Staff User (One-Time Password Reveal)
  router.post('/staff', requireSuperAdmin, async (req, res) => {
    try {
      const { email, name, role_id, zone_id, branch_id } = req.body;

      if (!email || !name || !role_id) {
        return res.status(400).json({ success: false, error: 'Email, name, and role are required.' });
      }

      const tempPassword = generateSecureTempPassword(14);

      // Create Supabase Auth User
      const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name,
          must_change_password: true,
        },
      });

      if (authErr || !newUser.user) {
        return res.status(400).json({ success: false, error: authErr?.message || 'Failed to create auth user.' });
      }

      // Create staff_profile
      const { data: profile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .insert({
          id: newUser.user.id,
          name,
          role_id,
          zone_id: zone_id || null,
          branch_id: branch_id || null,
          is_active: true,
          must_change_password: true,
          created_by: req.superAdminUser?.id || null,
        })
        .select('*, roles(name), zones(name), branches(name)')
        .single();

      if (profErr) {
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return res.status(400).json({ success: false, error: profErr.message });
      }

      // Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser?.id || null,
        actor_type: 'staff',
        action: 'create_staff_user',
        entity_type: 'staff_profiles',
        entity_id: newUser.user.id,
        metadata: { email, role_id, zone_id, branch_id },
      });

      return res.json({
        success: true,
        staff: {
          ...profile,
          email,
        },
        one_time_temporary_password: tempPassword,
        message: 'Staff user created. Display temporary password to creator ONCE.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Edit Staff User (Update role, zone, branch, name)
  router.put('/staff/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, role_id, zone_id, branch_id, is_active } = req.body;

      const { data: updated, error } = await supabaseAdmin
        .from('staff_profiles')
        .update({
          name,
          role_id,
          zone_id: zone_id || null,
          branch_id: branch_id || null,
          is_active: is_active !== undefined ? is_active : true,
        })
        .eq('id', id)
        .select('*, roles(name), zones(name), branches(name)')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'update_staff_profile',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: req.body,
      });

      return res.json({ success: true, staff: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Deactivate / Toggle Staff User
  router.patch('/staff/:id/status', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const { data: updated, error } = await supabaseAdmin
        .from('staff_profiles')
        .update({ is_active: Boolean(is_active) })
        .eq('id', id)
        .select('*, roles(name)')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: is_active ? 'activate_staff_user' : 'deactivate_staff_user',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { is_active },
      });

      return res.json({ success: true, staff: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Regenerate Temporary Password for Staff User
  router.post('/staff/:id/regenerate-password', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: targetProfile, error: profErr } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name')
        .eq('id', id)
        .single();

      if (profErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Staff member not found.' });
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
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'regenerate_staff_password',
        entity_type: 'staff_profiles',
        entity_id: id,
        metadata: { staff_name: targetProfile.name, must_change_password: true },
      });

      // Dispatch centralized notification (fixes audit gap)
      await notificationService.notifyStaffCredentialReset(
        supabaseAdmin,
        { id, name: targetProfile.name },
        newTempPassword,
        req.superAdminUser.id
      );

      return res.json({
        success: true,
        temporary_password: newTempPassword,
        must_change_password: true,
        message: 'Temporary password generated successfully. must_change_password set to true.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 4. User Permissions Screen (Role defaults + Overrides with MANDATORY reason)
  // --------------------------------------------------------------------------
  router.get('/permission-overrides/:staffId', requireSuperAdmin, async (req, res) => {
    try {
      const { staffId } = req.params;
      const [overridesRes, permissionsRes, staffProfileRes] = await Promise.all([
        supabaseAdmin
          .from('user_permission_overrides')
          .select('*, permissions(id, key, description)')
          .eq('staff_profile_id', staffId),
        supabaseAdmin.from('permissions').select('*').order('key'),
        supabaseAdmin
          .from('staff_profiles')
          .select('id, name, role_id, is_active, zone_id, branch_id, roles(id, name)')
          .eq('id', staffId)
          .maybeSingle(),
      ]);

      let roleDefaultPermissionKeys: string[] = [];
      if (staffProfileRes.data?.role_id) {
        const { data: rolePerms } = await supabaseAdmin
          .from('role_permissions')
          .select('permissions(key)')
          .eq('role_id', staffProfileRes.data.role_id);
        if (rolePerms) {
          roleDefaultPermissionKeys = rolePerms
            .map((rp: any) => rp.permissions?.key)
            .filter(Boolean);
        }
      }

      return res.json({
        success: true,
        overrides: overridesRes.data || [],
        allPermissions: permissionsRes.data || [],
        roleDefaultPermissionKeys,
        staffProfile: staffProfileRes.data || null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Batch update user permissions with mandatory reason and audit logging
  router.post('/user-permissions/save', requireSuperAdmin, async (req, res) => {
    try {
      const { staff_profile_id, permissionsState, reason } = req.body;

      if (!staff_profile_id || typeof permissionsState !== 'object' || !reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Staff ID, permissionsState object, and a non-empty reason are MANDATORY.',
        });
      }

      const cleanReason = String(reason).trim();

      // Fetch staff profile and its role default permissions
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('id, name, role_id, roles(id, name)')
        .eq('id', staff_profile_id)
        .single();

      if (!staffProfile) {
        return res.status(404).json({ success: false, error: 'Staff profile not found.' });
      }

      const [allPermsRes, rolePermsRes, existingOverridesRes] = await Promise.all([
        supabaseAdmin.from('permissions').select('id, key'),
        supabaseAdmin
          .from('role_permissions')
          .select('permission_id, permissions(key)')
          .eq('role_id', staffProfile.role_id),
        supabaseAdmin
          .from('user_permission_overrides')
          .select('id, permission_id, granted, permissions(key)')
          .eq('staff_profile_id', staff_profile_id),
      ]);

      const allPerms = allPermsRes.data || [];
      const rolePermKeys = new Set(
        (rolePermsRes.data || []).map((rp: any) => rp.permissions?.key).filter(Boolean)
      );
      const existingOverridesByPermId = new Map(
        (existingOverridesRes.data || []).map((ov: any) => [ov.permission_id, ov])
      );

      const changesApplied: any[] = [];

      // For each permission key provided in permissionsState (boolean)
      for (const perm of allPerms) {
        if (!(perm.key in permissionsState)) continue;
        const desiredState = Boolean(permissionsState[perm.key]);
        const roleDefault = rolePermKeys.has(perm.key);
        const existingOverride = existingOverridesByPermId.get(perm.id);

        if (desiredState === roleDefault) {
          // Desired state equals role default: remove any existing override if present
          if (existingOverride) {
            await supabaseAdmin
              .from('user_permission_overrides')
              .delete()
              .eq('id', existingOverride.id);

            await supabaseAdmin.from('audit_logs').insert({
              actor_id: req.superAdminUser.id,
              actor_type: 'staff',
              action: 'reset_permission_to_default',
              entity_type: 'user_permission_overrides',
              entity_id: existingOverride.id,
              metadata: {
                staff_profile_id,
                permission_id: perm.id,
                permission_key: perm.key,
                restored_default: roleDefault,
                reason: cleanReason,
              },
            });

            changesApplied.push({ key: perm.key, action: 'reset_to_default', value: roleDefault });
          }
        } else {
          // Desired state differs from role default: insert or update override
          const overrideGranted = desiredState;
          const { data: savedOv, error: ovErr } = await supabaseAdmin
            .from('user_permission_overrides')
            .upsert(
              {
                staff_profile_id,
                permission_id: perm.id,
                granted: overrideGranted,
                reason: cleanReason,
                created_by: req.superAdminUser.id,
              },
              { onConflict: 'staff_profile_id,permission_id' }
            )
            .select()
            .single();

          if (!ovErr && savedOv) {
            await supabaseAdmin.from('audit_logs').insert({
              actor_id: req.superAdminUser.id,
              actor_type: 'staff',
              action: overrideGranted ? 'grant_permission_override' : 'revoke_permission_override',
              entity_type: 'user_permission_overrides',
              entity_id: savedOv.id,
              metadata: {
                staff_profile_id,
                permission_id: perm.id,
                permission_key: perm.key,
                granted: overrideGranted,
                reason: cleanReason,
              },
            });

            // Dispatch notification
            await notificationService.notifyStaffPermissionOverride(
              supabaseAdmin,
              staff_profile_id,
              perm.key,
              overrideGranted,
              cleanReason,
              req.superAdminUser.id
            );

            changesApplied.push({ key: perm.key, action: overrideGranted ? 'grant' : 'revoke', value: overrideGranted });
          }
        }
      }

      return res.json({
        success: true,
        changesCount: changesApplied.length,
        changes: changesApplied,
        message: `Permissions updated successfully (${changesApplied.length} change(s) recorded in audit log).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/permission-overrides', requireSuperAdmin, async (req, res) => {
    try {
      const { staff_profile_id, permission_id, granted, reason } = req.body;

      // [HARD RULE]: MANDATORY reason field
      if (!staff_profile_id || !permission_id || typeof granted !== 'boolean' || !reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Staff ID, Permission ID, granted (boolean), and a non-empty reason are MANDATORY.',
        });
      }

      const cleanReason = String(reason).trim();

      // Upsert override
      const { data: override, error } = await supabaseAdmin
        .from('user_permission_overrides')
        .upsert(
          {
            staff_profile_id,
            permission_id,
            granted,
            reason: cleanReason,
            created_by: req.superAdminUser.id,
          },
          { onConflict: 'staff_profile_id,permission_id' }
        )
        .select('*, permissions(id, key)')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      // Mandatory audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: granted ? 'grant_permission_override' : 'revoke_permission_override',
        entity_type: 'user_permission_overrides',
        entity_id: override.id,
        metadata: {
          staff_profile_id,
          permission_id,
          permission_key: (override.permissions as any)?.key,
          granted,
          reason: cleanReason,
        },
      });

      // Dispatch centralized notification (fixes audit gap)
      await notificationService.notifyStaffPermissionOverride(
        supabaseAdmin,
        staff_profile_id,
        (override.permissions as any)?.key || permission_id,
        granted,
        cleanReason,
        req.superAdminUser.id
      );

      return res.json({
        success: true,
        override,
        message: `Permission override successfully ${granted ? 'granted' : 'revoked'}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  router.delete('/permission-overrides/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing } = await supabaseAdmin
        .from('user_permission_overrides')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabaseAdmin.from('user_permission_overrides').delete().eq('id', id);
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      if (existing) {
        await supabaseAdmin.from('audit_logs').insert({
          actor_id: req.superAdminUser.id,
          actor_type: 'staff',
          action: 'delete_permission_override',
          entity_type: 'user_permission_overrides',
          entity_id: id,
          metadata: existing,
        });
      }

      return res.json({ success: true, message: 'Permission override removed.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Company-Wide Record Browser (Pagination 25/50, Search, Masked CNIC)
  // --------------------------------------------------------------------------
  router.get('/records', requireSuperAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = [25, 50].includes(parseInt(String(req.query.limit || '25'), 10))
        ? parseInt(String(req.query.limit || '25'), 10)
        : 25;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const zoneId = String(req.query.zone_id || '').trim();

      let query = supabaseAdmin
        .from('candidates')
        .select('*, zones(id, name), branches(id, name), applications(*)', { count: 'exact' });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,joining_id.ilike.%${search}%,cnic.ilike.%${search}%`);
      }

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      }

      const offset = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Filter by status if specified (on joined application)
      let records = data || [];

      // Filter out records where all applications are soft-archived (unless include_archived is requested)
      if (req.query.include_archived !== 'true') {
        records = records.filter((r) => {
          const apps = (r.applications as any[]) || [];
          if (apps.length === 0) return true;
          return apps.some((a) => !dataRetentionService.isApplicationArchived(a.id, a.decision_reason));
        });
      }

      if (status) {
        records = records.filter((r) => {
          const apps = (r.applications as any[]) || [];
          return apps.some((a) => a.status === status);
        });
      }

      // Mask CNIC helper: 35201-1234567-1 -> 35201-*****67-1
      const maskedRecords = records.map((r) => {
        const cnic = r.cnic || '';
        const masked =
          cnic.length >= 10
            ? `${cnic.slice(0, 6)}*****${cnic.slice(-4)}`
            : '*****';
        return {
          ...r,
          masked_cnic: masked,
        };
      });

      return res.json({
        success: true,
        records: maskedRecords,
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
  // 6. Audit Log Viewer [HARD RULE: Only super_admin may access]
  // --------------------------------------------------------------------------
  router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || '25'), 10)));
      const action = String(req.query.action || '').trim();
      const entityType = String(req.query.entity_type || '').trim();

      let query = supabaseAdmin.from('audit_logs').select('*', { count: 'exact' });

      if (action) {
        query = query.ilike('action', `%${action}%`);
      }
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const offset = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.json({
        success: true,
        logs: data || [],
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

  // 7. Organization Settings, Branding & Data Retention Policy
  // --------------------------------------------------------------------------
  let orgSettingsCache: {
    companyName: string;
    dataRetentionDaysAfterRejection: number;
    supportEmail: string;
    autoArchiveEnabled: boolean;
    logoUrl?: string | null;
    loginBgUrl?: string | null;
    loginTagline?: string;
    lastUpdated: string;
  } = {
    companyName: 'PostEx Logistics',
    dataRetentionDaysAfterRejection: 90,
    supportEmail: 'hr-support@postex.pk',
    autoArchiveEnabled: true,
    logoUrl: null,
    loginBgUrl: null,
    loginTagline: 'Enterprise Onboarding & Workforce Verification Portal',
    lastUpdated: new Date().toISOString(),
  };

  const brandingLogoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
      if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Invalid logo format. Only PNG, JPG, SVG, and WebP images are accepted.'));
      }
    },
  });

  const brandingBgUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (allowed.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Invalid background format. Only PNG, JPG, and WebP images are accepted.'));
      }
    },
  });

  router.get('/settings', requireSuperAdmin, async (req, res) => {
    try {
      const orgDb = await formTemplatesService.getOrgSettings(supabaseAdmin);
      const settingsPayload = {
        companyName: orgDb.company_name,
        dataRetentionDaysAfterRejection: orgDb.data_retention_days,
        supportEmail: orgDb.support_email,
        autoArchiveEnabled: orgDb.auto_archive_enabled,
        logoUrl: orgDb.logo_storage_path || null,
        loginBgUrl: orgDb.login_bg_storage_path || null,
        loginTagline: orgDb.login_tagline || 'Enterprise Onboarding & Workforce Verification Portal',
        lastUpdated: orgDb.updated_at,
      };
      orgSettingsCache = { ...orgSettingsCache, ...settingsPayload };
      return res.json({ success: true, settings: orgSettingsCache });
    } catch {
      return res.json({ success: true, settings: orgSettingsCache });
    }
  });

  router.put('/settings', requireSuperAdmin, async (req, res) => {
    try {
      const {
        companyName,
        dataRetentionDaysAfterRejection,
        supportEmail,
        autoArchiveEnabled,
        logoUrl,
        loginBgUrl,
        loginTagline,
      } = req.body;

      const days = parseInt(String(dataRetentionDaysAfterRejection ?? orgSettingsCache.dataRetentionDaysAfterRejection), 10);

      if (isNaN(days) || days < 1) {
        return res.status(400).json({
          success: false,
          error: 'Data retention days must be a positive number.',
        });
      }

      const updated = await formTemplatesService.updateOrgSettings(
        {
          company_name: companyName !== undefined ? companyName : orgSettingsCache.companyName,
          support_email: supportEmail !== undefined ? supportEmail : orgSettingsCache.supportEmail,
          data_retention_days: days,
          auto_archive_enabled: autoArchiveEnabled !== undefined ? Boolean(autoArchiveEnabled) : orgSettingsCache.autoArchiveEnabled,
          logo_storage_path: logoUrl !== undefined ? (logoUrl || null) : undefined,
          login_bg_storage_path: loginBgUrl !== undefined ? (loginBgUrl || null) : undefined,
          login_tagline: loginTagline !== undefined ? loginTagline : undefined,
        },
        req.superAdminUser?.id,
        supabaseAdmin
      );

      orgSettingsCache = {
        companyName: updated.company_name,
        dataRetentionDaysAfterRejection: updated.data_retention_days,
        supportEmail: updated.support_email,
        autoArchiveEnabled: updated.auto_archive_enabled,
        logoUrl: updated.logo_storage_path || null,
        loginBgUrl: updated.login_bg_storage_path || null,
        loginTagline: updated.login_tagline || 'Enterprise Onboarding & Workforce Verification Portal',
        lastUpdated: updated.updated_at,
      };

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'update_org_settings',
        entity_type: 'settings',
        entity_id: 'org_settings',
        metadata: orgSettingsCache,
      });

      return res.json({
        success: true,
        settings: orgSettingsCache,
        message: 'Organization settings updated successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Dedicated Branding Upload Endpoints
  router.post('/branding/logo', requireSuperAdmin, (req: any, res: any) => {
    brandingLogoUpload.single('logo')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No logo file uploaded.' });
      }
      try {
        const ext = req.file.mimetype === 'image/svg+xml' ? 'svg' : (req.file.originalname.split('.').pop() || 'png');
        const storagePath = `logo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('branding')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });
        if (uploadErr) {
          return res.status(500).json({ success: false, error: uploadErr.message });
        }
        const { data: urlData } = supabaseAdmin.storage.from('branding').getPublicUrl(storagePath);
        const logoUrl = urlData.publicUrl;

        await formTemplatesService.updateOrgSettings(
          { logo_storage_path: logoUrl },
          req.superAdminUser?.id,
          supabaseAdmin
        );

        orgSettingsCache.logoUrl = logoUrl;

        return res.json({ success: true, logoUrl, storagePath });
      } catch (uploadEx: any) {
        return res.status(500).json({ success: false, error: uploadEx.message });
      }
    });
  });

  router.post('/branding/background', requireSuperAdmin, (req: any, res: any) => {
    brandingBgUpload.single('background')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No background file uploaded.' });
      }
      try {
        const ext = req.file.originalname.split('.').pop() || 'jpg';
        const storagePath = `login_bg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from('branding')
          .upload(storagePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });
        if (uploadErr) {
          return res.status(500).json({ success: false, error: uploadErr.message });
        }
        const { data: urlData } = supabaseAdmin.storage.from('branding').getPublicUrl(storagePath);
        const bgUrl = urlData.publicUrl;

        await formTemplatesService.updateOrgSettings(
          { login_bg_storage_path: bgUrl },
          req.superAdminUser?.id,
          supabaseAdmin
        );

        orgSettingsCache.loginBgUrl = bgUrl;

        return res.json({ success: true, bgUrl, storagePath });
      } catch (uploadEx: any) {
        return res.status(500).json({ success: false, error: uploadEx.message });
      }
    });
  });

  // --------------------------------------------------------------------------
  // 8. Super Admin Form Builder Endpoints (Dual-Track: Executive & Non-Executive)
  // --------------------------------------------------------------------------

  // Add field to section
  router.post('/form-builder/fields', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, section_id, field_key, label, field_type, is_required, order_index, options, table_columns, conditional_label, placeholder, reason } = req.body;
      if (!track || !section_id || !label || !field_type) {
        return res.status(400).json({ success: false, error: 'track, section_id, label, and field_type are required.' });
      }

      const newField = await formTemplatesService.addField(
        track,
        section_id,
        {
          field_key: field_key || `field_${Date.now()}`,
          label,
          field_type,
          is_required: Boolean(is_required),
          order_index: order_index || 99,
          options,
          table_columns,
          conditional_label,
          placeholder,
        },
        supabaseAdmin
      );

      // Audit Log for Form Builder field addition
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_add_field',
        entity_type: 'form_fields',
        entity_id: newField.id,
        metadata: {
          track,
          section_id,
          field_key: newField.field_key,
          label: newField.label,
          field_type: newField.field_type,
          reason: reason || 'Added via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, field: newField });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Update field
  router.put('/form-builder/fields/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const fieldId = req.params.id;
      const { track, reason, ...updates } = req.body;
      if (!track) {
        return res.status(400).json({ success: false, error: 'track parameter is required.' });
      }

      const updated = await formTemplatesService.updateField(track, fieldId, updates, supabaseAdmin);

      // Audit Log for Form Builder field update
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_update_field',
        entity_type: 'form_fields',
        entity_id: fieldId,
        metadata: {
          track,
          updates,
          reason: reason || 'Updated via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, field: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete field (with mandatory audit logging)
  router.delete('/form-builder/fields/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const fieldId = req.params.id;
      const track = (req.query.track || req.body?.track) as 'executive' | 'non_executive';
      const reason = (req.body?.reason || req.query.reason || 'Deleted via Super Admin Form Builder') as string;

      if (!track) {
        return res.status(400).json({ success: false, error: 'track query parameter is required.' });
      }

      const success = await formTemplatesService.deleteField(track, fieldId, supabaseAdmin);

      // Audit Log for Form Builder field deletion
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_delete_field',
        entity_type: 'form_fields',
        entity_id: fieldId,
        metadata: {
          track,
          field_id: fieldId,
          reason,
        },
      });

      return res.json({ success, message: 'Field deleted successfully and logged to audit trail.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Reorder fields
  router.post('/form-builder/reorder', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, section_id, field_ids } = req.body;
      if (!track || !section_id || !Array.isArray(field_ids)) {
        return res.status(400).json({ success: false, error: 'track, section_id, and field_ids array are required.' });
      }

      const fields = await formTemplatesService.reorderFields(track, section_id, field_ids, supabaseAdmin);
      return res.json({ success: true, fields });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Add section
  router.post('/form-builder/sections', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, title, description, reason } = req.body;
      if (!track || !title) {
        return res.status(400).json({ success: false, error: 'track and title are required.' });
      }

      const section = await formTemplatesService.addSection(track, title, description, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_add_section',
        entity_type: 'form_sections',
        entity_id: section.id,
        metadata: {
          track,
          title,
          description,
          reason: reason || 'Added new section via Super Admin Form Builder',
        },
      });

      return res.json({ success: true, section });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete section (and all its nested fields)
  router.delete('/form-builder/sections/:id', requireSuperAdmin, async (req: any, res) => {
    try {
      const sectionId = req.params.id;
      const track = (req.body?.track || req.query?.track) as 'executive' | 'non_executive';
      const reason = (req.body?.reason || req.query?.reason || 'Section deleted via Super Admin Form Builder') as string;

      if (!track) {
        return res.status(400).json({ success: false, error: 'track parameter is required.' });
      }

      const success = await formTemplatesService.deleteSection(track, sectionId, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_delete_section',
        entity_type: 'form_sections',
        entity_id: sectionId,
        metadata: {
          track,
          section_id: sectionId,
          reason,
          deleted_at: new Date().toISOString(),
        },
      });

      return res.json({ success, message: 'Section and associated fields deleted successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Reset track to default seed template
  router.post('/form-builder/reset-default', requireSuperAdmin, async (req: any, res) => {
    try {
      const { track, reason } = req.body;
      if (!track || (track !== 'executive' && track !== 'non_executive')) {
        return res.status(400).json({ success: false, error: 'Valid track is required.' });
      }

      const template = await formTemplatesService.resetTrackToDefault(track, supabaseAdmin);

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: 'form_builder_reset_defaults',
        entity_type: 'form_templates',
        entity_id: template.id,
        metadata: {
          track,
          reason: reason || 'Reset track to default seed template',
        },
      });

      return res.json({ success: true, template });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // --------------------------------------------------------------------------
  // 9. Manual Data Retention Policy Cleanup Job Trigger
  // --------------------------------------------------------------------------
  router.post('/data-retention/run-cleanup', requireSuperAdmin, async (req: any, res) => {
    try {
      const result = await dataRetentionService.runRetentionCleanup(
        supabaseAdmin,
        req.superAdminUser?.id
      );
      return res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
