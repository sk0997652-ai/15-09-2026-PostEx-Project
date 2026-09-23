import React, { useState } from 'react';
import {
  Search,
  ShieldCheck,
  Trash2,
  ChevronRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { StaffUserItem, superAdminApi } from '../../lib/superAdminApi';
import {
  Button,
  Card,
  PageHeader,
  Input,
  Badge,
} from '../ui';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';

// Friendly human-readable labels for all 18 system permissions
export const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  'applications.view': { label: 'View Candidates', description: 'View candidate applications in operational pipelines' },
  'applications.verify': { label: 'Review Applications', description: 'Review and verify candidate documents and credentials' },
  'applications.decide': { label: 'Approve Applications', description: 'Approve or reject candidate applications' },
  'candidates.view': { label: 'View Candidates', description: 'Inspect candidate profiles and basic registration details' },
  'candidates.create': { label: 'Create New Candidates', description: 'Create candidate invitations and initiate onboarding' },
  'candidates.edit': { label: 'Edit Candidate Details', description: 'Edit candidate profile and contact information' },
  'staff.manage': { label: 'Manage Users', description: 'Provision staff accounts and manage user statuses' },
  'audit.view': { label: 'View Audit Logs', description: 'Access immutable security audit logs and event history' },
  'applications.reassign': { label: 'Reassign Applications', description: 'Reassign applications between staff members' },
  'documents.view': { label: 'View Documents', description: 'View uploaded candidate identity and verification files' },
  'documents.download': { label: 'Download Documents', description: 'Download candidate dossiers and verification assets' },
  'employees.view': { label: 'View Enrolled Employees', description: 'View roster of enrolled employees and IDs' },
  'organization.manage': { label: 'Manage Organization Structure', description: 'Create and edit zones, branches, departments, and designations' },
  'form_builder.manage': { label: 'Edit Application Forms', description: 'Customize candidate wizard form fields and steps' },
  'settings.manage': { label: 'Manage System Settings', description: 'Configure organization settings and retention policy' },
  'permissions.manage': { label: 'Manage User Permissions', description: 'Manage permissions and role overrides for other users' },
  'reports.view': { label: 'View Reports', description: 'Access zone and branch operational analytics' },
  'reports.export': { label: 'Export Reports', description: 'Export operational data reports to CSV/Excel' },
};

export interface UserPermissionsViewProps {
  staff: StaffUserItem[];
  loading: boolean;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
  onAuditChange?: () => void;
}

export const UserPermissionsView: React.FC<UserPermissionsViewProps> = ({
  staff,
  loading,
  setNotification,
  onAuditChange,
}) => {
  const [permissionStaffSearch, setPermissionStaffSearch] = useState('');
  const [selectedStaffForOverride, setSelectedStaffForOverride] = useState<StaffUserItem | null>(null);
  const [staffOverrides, setStaffOverrides] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [roleDefaultPermKeys, setRoleDefaultPermKeys] = useState<string[]>([]);
  const [userPermissionsChecklist, setUserPermissionsChecklist] = useState<Record<string, boolean>>({});
  const [permissionReason, setPermissionReason] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Delete modal state for override
  const [deleteModalState, setDeleteModalState] = useState<{
    open: boolean;
    overrideId: string;
    permissionKey: string;
    isDeleting: boolean;
  }>({
    open: false,
    overrideId: '',
    permissionKey: '',
    isDeleting: false,
  });

  const handleSelectStaffForOverride = async (s: StaffUserItem) => {
    setSelectedStaffForOverride(s);
    setPermissionReason('');
    try {
      const data = await superAdminApi.getPermissionOverrides(s.id);

      setAvailablePermissions(data.allPermissions || []);
      setStaffOverrides(data.overrides || []);

      const roleDefaults: string[] = data.roleDefaultPermissionKeys || [];
      setRoleDefaultPermKeys(roleDefaults);

      const checklist: Record<string, boolean> = {};
      (data.allPermissions || []).forEach((perm: any) => {
        const hasExplicitOverride = (data.overrides || []).find(
          (ov: any) => ov.permissions?.key === perm.key || ov.permission_id === perm.id
        );

        if (hasExplicitOverride) {
          checklist[perm.key] = hasExplicitOverride.granted;
        } else {
          checklist[perm.key] = roleDefaults.includes(perm.key);
        }
      });

      setUserPermissionsChecklist(checklist);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleTogglePermission = (permKey: string) => {
    setUserPermissionsChecklist((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  };

  const handleSaveUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForOverride) return;

    if (!permissionReason.trim()) {
      setNotification({
        type: 'error',
        text: 'A mandatory justification reason is required for permission updates (Rule: Audit Trail Enforcement).',
      });
      return;
    }

    setSavingPermissions(true);
    try {
      await superAdminApi.saveUserPermissions({
        staff_profile_id: selectedStaffForOverride.id,
        permissionsState: userPermissionsChecklist,
        reason: permissionReason,
      });

      setNotification({
        type: 'success',
        text: `Successfully updated system permissions for ${selectedStaffForOverride.name}. Event logged to immutable audit trail.`,
      });

      setPermissionReason('');
      await handleSelectStaffForOverride(selectedStaffForOverride);
      if (onAuditChange) onAuditChange();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDeleteOverridePrompt = (overrideId: string, permKey: string) => {
    setDeleteModalState({
      open: true,
      overrideId,
      permissionKey: permKey,
      isDeleting: false,
    });
  };

  const handleConfirmDeleteOverride = async () => {
    if (!selectedStaffForOverride) return;
    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));
    try {
      await superAdminApi.deletePermissionOverride(deleteModalState.overrideId);
      setNotification({
        type: 'success',
        text: `Removed custom override for "${deleteModalState.permissionKey}". Reverted to default role permission.`,
      });
      setDeleteModalState({ open: false, overrideId: '', permissionKey: '', isDeleting: false });
      await handleSelectStaffForOverride(selectedStaffForOverride);
      if (onAuditChange) onAuditChange();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const filteredStaffList = staff.filter(
    (s) =>
      !permissionStaffSearch ||
      s.name.toLowerCase().includes(permissionStaffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(permissionStaffSearch.toLowerCase())
  );

  return (
    <div id="super-admin-user-permissions-view" className="space-y-6">
      <PageHeader
        title="Super Admin — User Permissions Management"
        description="View and configure granular system permissions for individual staff members. Mandatory reason logged to immutable audit trail."
        roleContext="Access Control"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Member Search & Selection Column */}
        <Card className="p-4 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900">Find Staff Member</h3>
            <span className="text-[11px] text-slate-400">
              {filteredStaffList.length} found
            </span>
          </div>

          <div className="mb-3">
            <Input
              id="staff-permission-search-input"
              type="text"
              placeholder="Search by staff name or email..."
              value={permissionStaffSearch}
              onChange={(e) => setPermissionStaffSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto pr-1">
            {filteredStaffList.map((s) => (
              <button
                key={s.id}
                id={`staff-select-btn-${s.id}`}
                onClick={() => handleSelectStaffForOverride(s)}
                className={`w-full p-2.5 text-left rounded-xl transition-colors flex items-center justify-between cursor-pointer my-0.5 ${
                  selectedStaffForOverride?.id === s.id
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <span className="text-xs block font-medium truncate">{s.name}</span>
                  <span className="text-[11px] text-slate-500 block truncate">{s.email}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="primary" size="sm">
                      {s.roles?.name || 'Staff'}
                    </Badge>
                    <Badge variant={s.is_active ? 'success' : 'error'} size="sm" dot>
                      {s.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}

            {filteredStaffList.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No staff members match "{permissionStaffSearch}".
              </div>
            )}
          </div>
        </Card>

        {/* User Profile & Permissions Checklist Column */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStaffForOverride ? (
            <>
              {/* Selected User Profile Card */}
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{selectedStaffForOverride.name}</h3>
                      <Badge variant={selectedStaffForOverride.is_active ? 'success' : 'error'} size="sm" dot>
                        {selectedStaffForOverride.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedStaffForOverride.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      Role: {selectedStaffForOverride.roles?.name || 'Staff'}
                    </Badge>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Role</span>
                    <span className="font-semibold text-slate-800">{selectedStaffForOverride.roles?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Zone</span>
                    <span className="font-semibold text-slate-800">{selectedStaffForOverride.zones?.name || 'All Zones (HQ)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Branch</span>
                    <span className="font-semibold text-slate-800">{selectedStaffForOverride.branches?.name || 'All Branches'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Active Overrides</span>
                    <span className="font-semibold text-indigo-600">{staffOverrides.length} customized</span>
                  </div>
                </div>
              </Card>

              {/* Permissions Checklist Form */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">System Permissions Checklist</h3>
                    <p className="text-[11px] text-slate-500">
                      Check to grant, uncheck to revoke. Overrides from role default are flagged automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Granted
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span> Revoked
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveUserPermissions} className="space-y-5">
                  {/* 18 Permissions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto p-1.5 border border-slate-100 rounded-xl bg-slate-50/50">
                    {availablePermissions.map((perm) => {
                      const isChecked = Boolean(userPermissionsChecklist[perm.key]);
                      const isRoleDefault = roleDefaultPermKeys.includes(perm.key);
                      const isOverride = isChecked !== isRoleDefault;
                      const meta = PERMISSION_LABELS[perm.key] || {
                        label: perm.key,
                        description: perm.description || '',
                      };

                      return (
                        <label
                          key={perm.id}
                          htmlFor={`perm-checkbox-${perm.key}`}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-white border-indigo-200 shadow-2xs ring-1 ring-indigo-50'
                              : 'bg-white/60 border-slate-200 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <input
                            id={`perm-checkbox-${perm.key}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(perm.key)}
                            className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 block truncate">{meta.label}</span>
                              {isOverride && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                                    isChecked
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {isChecked ? 'Override Grant' : 'Override Revoke'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                              {meta.description}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono block mt-1">
                              Key: {perm.key} {isRoleDefault ? '• (Role Default)' : ''}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Mandatory Reason Input */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Reason for permission change <span className="text-rose-600">* [MANDATORY]</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Every permission update creates an immutable entry in the system audit trail. Please provide a clear operational justification.
                    </p>
                    <Input
                      id="user-permission-reason-input"
                      type="text"
                      required
                      placeholder="e.g., Assigned special verification authority for Lahore South expansion"
                      value={permissionReason}
                      onChange={(e) => setPermissionReason(e.target.value)}
                    />
                  </div>

                  {/* Submit Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSelectStaffForOverride(selectedStaffForOverride)}
                    >
                      Reset to Current
                    </Button>
                    <Button
                      id="save-user-permissions-btn"
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={loading || savingPermissions}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{savingPermissions ? 'Saving...' : 'Save Permissions & Audit'}</span>
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Active Individual Overrides List */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-900">
                    Specific Overrides for {selectedStaffForOverride.name} ({staffOverrides.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    These explicit overrides deviate from role defaults
                  </span>
                </div>

                {staffOverrides.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {staffOverrides.map((ov) => (
                      <div key={ov.id} className="p-3 flex items-center justify-between text-xs bg-white">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{ov.permissions?.key}</span>
                            <Badge variant={ov.granted ? 'success' : 'error'} size="sm">
                              {ov.granted ? 'Explicit Grant' : 'Explicit Revoke'}
                            </Badge>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            <span className="font-semibold text-slate-700">Reason:</span> {ov.reason}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOverridePrompt(ov.id, ov.permissions?.key || 'override')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove Override and Revert to Role Default"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No specific overrides applied. Standard role permissions govern this user.
                  </p>
                )}
              </Card>
            </>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
              Select a staff member from the search list on the left to view their profile and manage their permissions.
            </div>
          )}
        </div>
      </div>

      {/* OVERRIDE DELETE CONFIRMATION MODAL */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.open}
        title="Remove Permission Override"
        itemName={deleteModalState.permissionKey}
        itemType="Override"
        contextInfo={`Staff Member: ${selectedStaffForOverride?.name || ''}`}
        warningMessage="Removing this override will revert the user's access for this permission to their role default."
        requireReason={true}
        reasonPlaceholder="State the justification for reverting this override (mandatory for audit log)..."
        confirmButtonLabel="Yes, Revert to Role Default"
        isDeleting={deleteModalState.isDeleting}
        onConfirm={handleConfirmDeleteOverride}
        onCancel={() => setDeleteModalState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
