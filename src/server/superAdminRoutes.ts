// ==============================================================================
// PostEx HR Onboarding Portal — Super Admin API Endpoints (Step 5)
// ==============================================================================

import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

      const { data, error } = await supabaseAdmin.from(entity).insert(req.body).select().single();
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `create_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: data.id,
        metadata: req.body,
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

      const { data, error } = await supabaseAdmin.from(entity).update(req.body).eq('id', id).select().single();
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `update_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: req.body,
      });

      return res.json({ success: true, data });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  // Delete Entity
  router.delete('/org/:entity/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { entity, id } = req.params;
      const allowed = ['zones', 'branches', 'departments', 'designations'];
      if (!allowed.includes(entity)) {
        return res.status(400).json({ success: false, error: 'Invalid entity type.' });
      }

      const { error } = await supabaseAdmin.from(entity).delete().eq('id', id);
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.superAdminUser.id,
        actor_type: 'staff',
        action: `delete_${entity.slice(0, -1)}`,
        entity_type: entity,
        entity_id: id,
        metadata: {},
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
          created_by: req.superAdminUser.id,
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
        actor_id: req.superAdminUser.id,
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

  // --------------------------------------------------------------------------
  // 4. Permission Override Screen (Grant/Revoke with MANDATORY reason)
  // --------------------------------------------------------------------------
  router.get('/permission-overrides/:staffId', requireSuperAdmin, async (req, res) => {
    try {
      const { staffId } = req.params;
      const [overridesRes, permissionsRes] = await Promise.all([
        supabaseAdmin
          .from('user_permission_overrides')
          .select('*, permissions(id, key, description)')
          .eq('staff_profile_id', staffId),
        supabaseAdmin.from('permissions').select('*').order('key'),
      ]);

      return res.json({
        success: true,
        overrides: overridesRes.data || [],
        allPermissions: permissionsRes.data || [],
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

  // --------------------------------------------------------------------------
  // 7. Organization Settings & Data Retention Policy
  // --------------------------------------------------------------------------
  let orgSettingsCache = {
    companyName: 'PostEx Logistics',
    dataRetentionDaysAfterRejection: 90,
    supportEmail: 'hr-support@postex.pk',
    autoArchiveEnabled: true,
    lastUpdated: new Date().toISOString(),
  };

  router.get('/settings', requireSuperAdmin, (req, res) => {
    return res.json({ success: true, settings: orgSettingsCache });
  });

  router.put('/settings', requireSuperAdmin, async (req, res) => {
    try {
      const { dataRetentionDaysAfterRejection, supportEmail, autoArchiveEnabled } = req.body;
      const days = parseInt(String(dataRetentionDaysAfterRejection), 10);

      if (isNaN(days) || days < 1) {
        return res.status(400).json({
          success: false,
          error: 'Data retention days must be a positive number.',
        });
      }

      orgSettingsCache = {
        ...orgSettingsCache,
        dataRetentionDaysAfterRejection: days,
        supportEmail: supportEmail || orgSettingsCache.supportEmail,
        autoArchiveEnabled: autoArchiveEnabled !== undefined ? Boolean(autoArchiveEnabled) : orgSettingsCache.autoArchiveEnabled,
        lastUpdated: new Date().toISOString(),
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

  return router;
}
