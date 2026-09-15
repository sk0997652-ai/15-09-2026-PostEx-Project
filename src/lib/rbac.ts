// ==============================================================================
// PostEx HR Onboarding Portal — Role-Based Access Control (RBAC) Engine (Step 4)
// ==============================================================================
// Enforces dual-layer authorization:
// Layer 1: PostgreSQL RLS policies & scope filters
// Layer 2: Edge Function / Server Guards & Client Scoped Guards
//
// Roles:
// - super_admin: Full company-wide access, bypasses all zonal/branch boundaries
// - zonal_hr_manager: Scoped strictly to their assigned zone_id
// - central_hr: Scoped strictly to their assigned zone candidates
// - branch_manager: Scoped strictly to their assigned branch_id
// - candidate: Scoped strictly to their own application / candidate record
// ==============================================================================

import { RoleName } from '../types/database';

export interface UserScopeContext {
  userId: string;
  role: RoleName;
  zoneId: string | null;
  branchId: string | null;
  permissions: string[];
}

export type PermissionKey =
  | 'applications.view'
  | 'applications.verify'
  | 'applications.decide'
  | 'candidates.view'
  | 'candidates.create'
  | 'staff.manage'
  | 'audit.view';

/**
 * Checks whether the role or permissions permit a specific action.
 * Super Admin bypasses all checks.
 * Individual overrides (if provided) take highest precedence.
 */
export function hasPermission(
  ctx: UserScopeContext,
  requiredPermission: PermissionKey,
  overrides?: { [key: string]: boolean }
): boolean {
  if (ctx.role === 'super_admin') {
    return true;
  }

  // 1. Check individual user overrides first
  if (overrides && typeof overrides[requiredPermission] === 'boolean') {
    return overrides[requiredPermission];
  }

  // 2. Check role permissions list
  return ctx.permissions.includes(requiredPermission);
}

/**
 * Checks whether a user has authority to access a candidate or application
 * based on geographic zoning rules.
 *
 * Rules:
 * 1. super_admin: Allowed for any zone / branch.
 * 2. zonal_hr_manager: Allowed ONLY if candidate.zone_id matches user.zoneId.
 * 3. central_hr: Allowed ONLY if candidate.zone_id matches user.zoneId.
 * 4. branch_manager: Allowed ONLY if candidate.branch_id matches user.branchId.
 * 5. candidate: Allowed ONLY if candidate.id matches candidateId.
 */
export function canAccessRecord(
  ctx: UserScopeContext,
  target: {
    zoneId?: string | null;
    branchId?: string | null;
    candidateId?: string;
  }
): { allowed: boolean; reason?: string } {
  // Super Admin bypasses all geographic restrictions
  if (ctx.role === 'super_admin') {
    return { allowed: true };
  }

  // Candidate: isolated strictly to own record
  if (ctx.role === 'candidate') {
    if (target.candidateId && target.candidateId === ctx.userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Candidate access is strictly restricted to their own application.',
    };
  }

  // Zonal HR Manager: zone-restricted
  if (ctx.role === 'zonal_hr_manager') {
    if (!ctx.zoneId) {
      return { allowed: false, reason: 'Zonal HR Manager has no assigned zone.' };
    }
    if (target.zoneId !== ctx.zoneId) {
      return {
        allowed: false,
        reason: `Access Denied: Record belongs to another zone. Zonal HR is restricted to Zone ${ctx.zoneId}.`,
      };
    }
    return { allowed: true };
  }

  // Central HR: zone-restricted candidates
  if (ctx.role === 'central_hr') {
    if (!ctx.zoneId) {
      return { allowed: false, reason: 'Central HR has no assigned zone.' };
    }
    if (target.zoneId !== ctx.zoneId) {
      return {
        allowed: false,
        reason: `Access Denied: Candidate belongs to another zone. Central HR is restricted to Zone ${ctx.zoneId}.`,
      };
    }
    return { allowed: true };
  }

  // Branch Manager: branch-restricted
  if (ctx.role === 'branch_manager') {
    if (!ctx.branchId) {
      return { allowed: false, reason: 'Branch Manager has no assigned branch.' };
    }
    if (target.branchId !== ctx.branchId) {
      return {
        allowed: false,
        reason: `Access Denied: Candidate belongs to another branch. Branch Manager is restricted to Branch ${ctx.branchId}.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized role.' };
}

/**
 * Privileged Action Guards (Edge Function / Server Level)
 * Validates whether the caller can perform high-risk state changes.
 */
export function canPerformPrivilegedAction(
  ctx: UserScopeContext,
  action: 'regenerate_staff_password' | 'make_hr_decision' | 'create_candidate_invite' | 'manage_staff_roles'
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'regenerate_staff_password':
      // Only super_admin or zonal_hr_manager for staff in their zone
      if (ctx.role === 'super_admin' || ctx.role === 'zonal_hr_manager') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Only Super Admin or Zonal HR Manager may regenerate staff credentials.',
      };

    case 'manage_staff_roles':
      // Only super_admin can change roles or system-wide overrides
      if (ctx.role === 'super_admin') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Only Super Admin can manage staff roles and permission overrides.',
      };

    case 'make_hr_decision':
      // Requires applications.decide permission (super_admin, zonal_hr_manager, central_hr)
      if (ctx.role === 'super_admin' || ctx.permissions.includes('applications.decide')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Privilege Denied: Your role is not authorized to submit final HR decisions.',
      };

    case 'create_candidate_invite':
      // Requires candidates.create permission
      if (ctx.role === 'super_admin' || ctx.permissions.includes('candidates.create')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Privilege Denied: Your role is not authorized to invite new candidates.',
      };

    default:
      return { allowed: false, reason: 'Unknown privileged action.' };
  }
}
