import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  KeyRound,
  FilterX,
  User,
  Briefcase,
  Lock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { StaffUserItem, OrgStructure, superAdminApi } from '../../lib/superAdminApi';
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableToolbar,
  PageHeader,
  Modal,
  Input,
  Select,
  Badge,
} from '../ui';

export interface StaffManagementViewProps {
  staff: StaffUserItem[];
  org: OrgStructure | null;
  loading: boolean;
  onReloadStaff: () => Promise<void>;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  zonal_hr_manager: 'Zonal HR Manager',
  central_hr: 'Central HR',
  branch_manager: 'Branch Manager',
};

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  staff,
  org,
  loading,
  onReloadStaff,
  setNotification,
}) => {
  // Filters & Pagination
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');
  const [staffZoneFilter, setStaffZoneFilter] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const [staffLimit, setStaffLimit] = useState(10);

  // Modals
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [bmSingleBranchMode, setBmSingleBranchMode] = useState(true);

  const [newStaffForm, setNewStaffForm] = useState<{
    // Section A — Personal
    name: string;
    personal_email: string;
    phone_number: string;
    // Section B — Employment Identity
    staff_employee_id: string;
    department_id: string;
    designation_id: string;
    // Section C — System Access
    email: string;
    // Section D — Role & Scope Assignment
    role_id: string;
    zone_id: string;
    branch_ids: string[];
  }>({
    name: '',
    personal_email: '',
    phone_number: '',
    staff_employee_id: 'PX-STAFF-1001',
    department_id: '',
    designation_id: '',
    email: '',
    role_id: '',
    zone_id: '',
    branch_ids: [],
  });

  const [editingStaff, setEditingStaff] = useState<
    | (StaffUserItem & {
        branch_ids_edit: string[];
      })
    | null
  >(null);

  const [oneTimePasswordModal, setOneTimePasswordModal] = useState<{
    open: boolean;
    staffName: string;
    email: string;
    tempPassword?: string;
    title: string;
    isRegenerate?: boolean;
  }>({
    open: false,
    staffName: '',
    email: '',
    title: '',
  });

  const [copiedPassword, setCopiedPassword] = useState(false);

  // System roles excluding 'candidate' (Candidate is a separate flow)
  const staffRoles = useMemo(() => {
    return (org?.roles || []).filter((r) => r.name !== 'candidate');
  }, [org?.roles]);

  // Selected Role Object in Create Modal
  const selectedCreateRole = useMemo(() => {
    return staffRoles.find((r) => r.id === newStaffForm.role_id) || null;
  }, [staffRoles, newStaffForm.role_id]);

  const selectedCreateRoleName = selectedCreateRole?.name || '';
  const isZoneRequiredForCreate = ['zonal_hr_manager', 'central_hr', 'branch_manager'].includes(
    selectedCreateRoleName
  );
  const isCreateBranchManager = selectedCreateRoleName === 'branch_manager';

  // Filtered designations by selected department (Create Form)
  const filteredCreateDesignations = useMemo(() => {
    if (!newStaffForm.department_id) return [];
    return (org?.designations || []).filter(
      (d) => d.department_id === newStaffForm.department_id && d.is_active !== false
    );
  }, [org?.designations, newStaffForm.department_id]);

  // Filtered branches in selected zone (Create Form)
  const createZoneBranches = useMemo(() => {
    if (!newStaffForm.zone_id) return [];
    return (org?.branches || []).filter(
      (b) => b.zone_id === newStaffForm.zone_id && b.is_active !== false
    );
  }, [org?.branches, newStaffForm.zone_id]);

  // Filtered designations by selected department (Edit Form)
  const filteredEditDesignations = useMemo(() => {
    if (!editingStaff?.department_id) return [];
    return (org?.designations || []).filter(
      (d) => d.department_id === editingStaff.department_id
    );
  }, [org?.designations, editingStaff?.department_id]);

  // Filtered branches in selected zone (Edit Form)
  const editZoneBranches = useMemo(() => {
    if (!editingStaff?.zone_id) return [];
    return (org?.branches || []).filter((b) => b.zone_id === editingStaff.zone_id);
  }, [org?.branches, editingStaff?.zone_id]);

  // Auto-fetch next Staff Employee ID when Create Staff modal opens
  const refreshNextEmployeeId = async () => {
    try {
      const nextId = await superAdminApi.getNextStaffEmployeeId();
      setNewStaffForm((prev) => ({ ...prev, staff_employee_id: nextId }));
    } catch {
      // fallback already set
    }
  };

  useEffect(() => {
    if (showCreateStaffModal) {
      refreshNextEmployeeId();
    }
  }, [showCreateStaffModal]);

  // Filter and deduplicate staff
  const uniqueStaff = useMemo(() => {
    const seen = new Set<string>();
    return staff.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return uniqueStaff.filter((s) => {
      if (staffSearch) {
        const query = staffSearch.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesEmail = s.email.toLowerCase().includes(query);
        const matchesEmpId = (s.staff_employee_id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesEmpId) return false;
      }
      if (staffRoleFilter && s.role_id !== staffRoleFilter) return false;
      if (staffStatusFilter !== '') {
        const isActive = staffStatusFilter === 'active';
        if (s.is_active !== isActive) return false;
      }
      if (staffZoneFilter && s.zone_id !== staffZoneFilter) return false;
      return true;
    });
  }, [uniqueStaff, staffSearch, staffRoleFilter, staffStatusFilter, staffZoneFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / staffLimit));
  const paginatedStaff = useMemo(() => {
    const startIndex = (staffPage - 1) * staffLimit;
    return filteredStaff.slice(startIndex, startIndex + staffLimit);
  }, [filteredStaff, staffPage, staffLimit]);

  const handleResetFilters = () => {
    setStaffSearch('');
    setStaffRoleFilter('');
    setStaffStatusFilter('');
    setStaffZoneFilter('');
    setStaffPage(1);
  };

  // Toggle branch checkbox in Create Form
  const handleToggleCreateBranch = (branchId: string) => {
    setNewStaffForm((prev) => {
      const exists = prev.branch_ids.includes(branchId);
      if (isCreateBranchManager && bmSingleBranchMode) {
        return {
          ...prev,
          branch_ids: exists ? [] : [branchId],
        };
      }
      return {
        ...prev,
        branch_ids: exists
          ? prev.branch_ids.filter((id) => id !== branchId)
          : [...prev.branch_ids, branchId],
      };
    });
  };

  // Select All / Deselect All branches in Create Form
  const handleSelectAllCreateBranches = () => {
    if (createZoneBranches.length === 0) return;
    const allIds = createZoneBranches.map((b) => b.id);
    if (isCreateBranchManager && bmSingleBranchMode) {
      if (allIds.length === 1) {
        setNewStaffForm((prev) => ({
          ...prev,
          branch_ids: prev.branch_ids.length === 1 ? [] : [allIds[0]],
        }));
        return;
      }
      setBmSingleBranchMode(false);
    }
    const allSelected = allIds.every((id) => newStaffForm.branch_ids.includes(id));
    setNewStaffForm((prev) => ({
      ...prev,
      branch_ids: allSelected ? [] : allIds,
    }));
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name.trim()) {
      setNotification({ type: 'error', text: 'Full Name is required in Section A.' });
      return;
    }
    if (!newStaffForm.staff_employee_id.trim()) {
      setNotification({ type: 'error', text: 'Staff Employee ID is required in Section B.' });
      return;
    }
    if (!newStaffForm.department_id) {
      setNotification({ type: 'error', text: 'Department is required in Section B.' });
      return;
    }
    if (!newStaffForm.designation_id) {
      setNotification({ type: 'error', text: 'Designation is required in Section B.' });
      return;
    }
    if (!newStaffForm.email.trim()) {
      setNotification({ type: 'error', text: 'Official/Work Email is required in Section C.' });
      return;
    }
    if (!newStaffForm.role_id) {
      setNotification({ type: 'error', text: 'System Role is required in Section D.' });
      return;
    }
    if (isZoneRequiredForCreate && !newStaffForm.zone_id) {
      setNotification({
        type: 'error',
        text: `Zone Assignment is required for ${ROLE_LABELS[selectedCreateRoleName] || selectedCreateRoleName}.`,
      });
      return;
    }
    if (isCreateBranchManager && newStaffForm.branch_ids.length === 0) {
      setNotification({
        type: 'error',
        text: 'Please tag at least one branch for the Branch Manager.',
      });
      return;
    }

    setSubmittingCreate(true);
    try {
      const res = await superAdminApi.createStaff({
        name: newStaffForm.name.trim(),
        personal_email: newStaffForm.personal_email.trim() || null,
        phone_number: newStaffForm.phone_number.trim() || null,
        staff_employee_id: newStaffForm.staff_employee_id.trim(),
        department_id: newStaffForm.department_id,
        designation_id: newStaffForm.designation_id,
        email: newStaffForm.email.trim().toLowerCase(),
        role_id: newStaffForm.role_id,
        zone_id: newStaffForm.zone_id || null,
        branch_id: newStaffForm.branch_ids[0] || null,
        branch_ids: newStaffForm.branch_ids,
      });

      setShowCreateStaffModal(false);
      setNewStaffForm({
        name: '',
        personal_email: '',
        phone_number: '',
        staff_employee_id: 'PX-STAFF-1001',
        department_id: '',
        designation_id: '',
        email: '',
        role_id: '',
        zone_id: '',
        branch_ids: [],
      });
      setBmSingleBranchMode(true);
      await onReloadStaff();

      setOneTimePasswordModal({
        open: true,
        staffName: res.staff.name,
        email: res.staff.email,
        tempPassword: res.one_time_temporary_password,
        title: 'Staff Account Created Successfully',
        isRegenerate: false,
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleRegeneratePassword = async (id: string, name: string, email: string) => {
    try {
      const res = await superAdminApi.regenerateStaffPassword(id);
      setOneTimePasswordModal({
        open: true,
        staffName: name,
        email: email,
        tempPassword: res.temporary_password,
        title: 'New Temporary Password Generated',
        isRegenerate: true,
      });
      setNotification({ type: 'success', text: `Generated new temporary credentials for ${name}.` });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleToggleStaffStatus = async (id: string, currentStatus: boolean, name: string) => {
    try {
      await superAdminApi.toggleStaffStatus(id, !currentStatus);
      setNotification({
        type: 'success',
        text: `Staff user "${name}" has been ${!currentStatus ? 'activated' : 'suspended'}.`,
      });
      await onReloadStaff();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  const handleOpenEditModal = (s: StaffUserItem) => {
    const initialBranchIds =
      s.branch_ids && s.branch_ids.length > 0
        ? [...s.branch_ids]
        : s.branch_id
        ? [s.branch_id]
        : [];
    setEditingStaff({
      ...s,
      branch_ids_edit: initialBranchIds,
    });
  };

  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await superAdminApi.updateStaff(editingStaff.id, {
        name: editingStaff.name,
        personal_email: editingStaff.personal_email || null,
        phone_number: editingStaff.phone_number || null,
        staff_employee_id: editingStaff.staff_employee_id || null,
        department_id: editingStaff.department_id || null,
        designation_id: editingStaff.designation_id || null,
        role_id: editingStaff.role_id,
        zone_id: editingStaff.zone_id || null,
        branch_id: editingStaff.branch_ids_edit[0] || null,
        branch_ids: editingStaff.branch_ids_edit,
      });
      setEditingStaff(null);
      setNotification({ type: 'success', text: `Updated staff profile for "${editingStaff.name}".` });
      await onReloadStaff();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  return (
    <div id="super-admin-staff-management-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Staff Account Management"
        description="Provision new staff accounts across 4 structured identity & scope sections with one-time temporary passwords."
        roleContext="Access & Staff"
        actions={
          <Button
            id="create-staff-user-btn"
            variant="primary"
            size="sm"
            onClick={() => setShowCreateStaffModal(true)}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Staff User</span>
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <TableToolbar
        searchInputId="staff-search-input"
        searchValue={staffSearch}
        onSearchChange={(val) => {
          setStaffSearch(val);
          setStaffPage(1);
        }}
        searchPlaceholder="Search by name, official email, or PX-STAFF ID..."
        filters={[
          {
            id: 'staff-role-filter-select',
            label: 'Filter by Role',
            value: staffRoleFilter,
            onChange: (val) => {
              setStaffRoleFilter(val);
              setStaffPage(1);
            },
            options: [
              { value: '', label: 'All Roles' },
              ...staffRoles.map((r) => ({
                value: r.id,
                label: ROLE_LABELS[r.name] || r.name,
              })),
            ],
          },
          {
            id: 'staff-zone-filter-select',
            label: 'Filter by Zone',
            value: staffZoneFilter,
            onChange: (val) => {
              setStaffZoneFilter(val);
              setStaffPage(1);
            },
            options: [
              { value: '', label: 'All Zones' },
              ...(org?.zones || []).map((z) => ({
                value: z.id,
                label: z.name,
              })),
            ],
          },
        ]}
        statusPills={[
          { value: '', label: 'All Statuses', variant: 'info', count: uniqueStaff.length },
          {
            value: 'active',
            label: 'Active',
            variant: 'success',
            count: uniqueStaff.filter((s) => s.is_active).length,
          },
          {
            value: 'suspended',
            label: 'Suspended',
            variant: 'error',
            count: uniqueStaff.filter((s) => !s.is_active).length,
          },
        ]}
        activeStatus={staffStatusFilter}
        onStatusChange={(val) => {
          setStaffStatusFilter(val);
          setStaffPage(1);
        }}
        statusSelectId="staff-status-filter-select"
        hasActiveFilters={Boolean(
          staffSearch || staffRoleFilter || staffStatusFilter || staffZoneFilter
        )}
        onReset={handleResetFilters}
        resetButtonId="reset-staff-filters-btn"
      />

      {/* Staff Table */}
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member &amp; Contact</TableHead>
              <TableHead hideOnTablet>Employment Identity</TableHead>
              <TableHead>System Role</TableHead>
              <TableHead hideOnTablet>Zone &amp; Tagged Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStaff.length > 0 ? (
              paginatedStaff.map((s) => {
                const taggedList =
                  s.tagged_branches && s.tagged_branches.length > 0
                    ? s.tagged_branches
                    : s.branches?.name
                    ? [{ id: s.branch_id || '', name: s.branches.name }]
                    : [];

                return (
                  <TableRow key={s.id}>
                    <TableCell mobileRole="primary">
                      <div>
                        <span className="font-bold text-slate-900 block">{s.name}</span>
                        <span className="text-xs text-slate-600 font-mono block">{s.email}</span>
                        {(s.personal_email || s.phone_number) && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {[s.personal_email, s.phone_number].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Employment Identity" hideOnTablet>
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-indigo-950 block">
                          {s.staff_employee_id || '—'}
                        </span>
                        <span className="text-xs text-slate-700 block">
                          {s.designations?.name || 'No Designation'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {s.departments?.name || 'No Department'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="System Role">
                      <Badge variant="primary" size="sm">
                        {ROLE_LABELS[s.roles?.name || ''] || s.roles?.name || 'Staff'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Zone & Branches"
                      hideOnTablet
                      className="text-slate-600"
                    >
                      <span className="font-medium text-slate-800 block text-xs">
                        {s.zones?.name || 'All Zones (HQ)'}
                      </span>
                      {taggedList.length > 0 ? (
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {taggedList.length === 1
                            ? taggedList[0].name
                            : `${taggedList.length} branches: ${taggedList.map((b) => b.name).join(', ')}`}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 block">Zone-Wide / All Branches</span>
                      )}
                    </TableCell>
                    <TableCell mobileRole="status">
                      <Badge variant={s.is_active ? 'success' : 'error'} size="sm" dot>
                        {s.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell mobileRole="actions" className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          id={`regen-pwd-btn-${s.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegeneratePassword(s.id, s.name, s.email)}
                          title="Regenerate Temporary Password"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          id={`edit-staff-btn-${s.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(s)}
                          title="Edit Profile"
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          id={`toggle-status-btn-${s.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStaffStatus(s.id, s.is_active, s.name)}
                          title={s.is_active ? 'Suspend Account' : 'Activate Account'}
                          className={`p-1.5 ${
                            s.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {s.is_active ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                  {staffSearch || staffRoleFilter || staffStatusFilter || staffZoneFilter
                    ? 'No staff members match the selected filter criteria.'
                    : 'No staff profiles created yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredStaff.length > 0 && (
          <TablePagination
            page={staffPage}
            totalPages={totalPages}
            total={filteredStaff.length}
            pageSize={staffLimit}
            pageSizeOptions={[10, 25, 50]}
            onPageSizeChange={(newSize) => {
              setStaffLimit(newSize);
              setStaffPage(1);
            }}
            onPageChange={(newPage) => setStaffPage(newPage)}
          />
        )}
      </div>

      {/* ===================================================================== */}
      {/* CREATE STAFF MODAL — 4 CLEAR SECTIONS (Part C of 4)                   */}
      {/* ===================================================================== */}
      <Modal
        isOpen={showCreateStaffModal}
        onClose={() => setShowCreateStaffModal(false)}
        title="Create Staff Account"
        description="Complete all 4 sections to provision a staff account with an admin-generated one-time temporary password."
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateStaffModal(false)}
            >
              Cancel
            </Button>
            <Button
              id="submit-create-staff-btn"
              type="submit"
              form="super-admin-create-staff-form"
              variant="primary"
              size="sm"
              disabled={loading || submittingCreate}
              isLoading={submittingCreate}
            >
              Create Staff Account
            </Button>
          </>
        }
      >
        <form id="super-admin-create-staff-form" onSubmit={handleCreateStaff} className="space-y-5">
          {/* SECTION A — Personal */}
          <div
            id="staff-form-section-a"
            className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
              <User className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                Section A — Personal
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  id="new-staff-name"
                  label="Full Name *"
                  type="text"
                  required
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  placeholder="e.g. Asad Khan"
                />
              </div>

              <Input
                id="new-staff-personal-email"
                label="Personal Contact Email (Optional)"
                type="email"
                value={newStaffForm.personal_email}
                onChange={(e) =>
                  setNewStaffForm({ ...newStaffForm, personal_email: e.target.value })
                }
                placeholder="e.g. asad.personal@gmail.com"
              />

              <Input
                id="new-staff-phone"
                label="Phone Number (Optional)"
                type="text"
                value={newStaffForm.phone_number}
                onChange={(e) =>
                  setNewStaffForm({ ...newStaffForm, phone_number: e.target.value })
                }
                placeholder="e.g. 0300-1234567"
              />
            </div>
          </div>

          {/* SECTION B — Employment Identity */}
          <div
            id="staff-form-section-b"
            className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Section B — Employment Identity
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Staff ID sequence (separate from EMP-branch candidate IDs)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      id="new-staff-employee-id"
                      label="Employee ID *"
                      type="text"
                      required
                      value={newStaffForm.staff_employee_id}
                      onChange={(e) =>
                        setNewStaffForm({ ...newStaffForm, staff_employee_id: e.target.value })
                      }
                      placeholder="e.g. PX-STAFF-1042"
                      className="font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={refreshNextEmployeeId}
                    title="Auto-generate next PX-STAFF ID"
                    className="h-10 px-3 shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Auto-Generate</span>
                  </Button>
                </div>
              </div>

              <Select
                id="new-staff-department"
                label="Department *"
                required
                value={newStaffForm.department_id}
                onChange={(e) =>
                  setNewStaffForm({
                    ...newStaffForm,
                    department_id: e.target.value,
                    designation_id: '',
                  })
                }
              >
                <option value="">Select Department</option>
                {(org?.departments || [])
                  .filter((d) => d.is_active !== false)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.department_code ? `(${d.department_code})` : ''}
                    </option>
                  ))}
              </Select>

              <Select
                id="new-staff-designation"
                label="Designation *"
                required
                disabled={!newStaffForm.department_id}
                value={newStaffForm.designation_id}
                onChange={(e) =>
                  setNewStaffForm({ ...newStaffForm, designation_id: e.target.value })
                }
                hint={!newStaffForm.department_id ? 'Select a Department first to filter designations.' : undefined}
              >
                <option value="">Select Designation</option>
                {filteredCreateDesignations.map((desig) => (
                  <option key={desig.id} value={desig.id}>
                    {desig.name}
                    {desig.employment_category ? ` — ${desig.employment_category}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* SECTION C — System Access */}
          <div
            id="staff-form-section-c"
            className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Section C — System Access
                </span>
              </div>
              <span className="text-xs text-slate-500">
                One-time temporary password generated on creation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Input
                id="new-staff-email"
                label="Official / Work Email (Login Username) *"
                type="email"
                required
                value={newStaffForm.email}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                placeholder="e.g. asad.khan@postex.pk"
              />

              <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 leading-relaxed md:mt-6">
                Login uses this official work email. A random 14-character temporary password will be shown once upon creation and forced to change on first sign-in.
              </div>
            </div>
          </div>

          {/* SECTION D — Role & Scope Assignment */}
          <div
            id="staff-form-section-d"
            className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Section D — Role &amp; Scope Assignment
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Candidate intake is handled via Central HR separate flow
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                id="new-staff-role"
                label="System Role *"
                required
                value={newStaffForm.role_id}
                onChange={(e) => {
                  const nextRoleId = e.target.value;
                  const roleObj = staffRoles.find((r) => r.id === nextRoleId);
                  const isBm = roleObj?.name === 'branch_manager';
                  setBmSingleBranchMode(true);
                  setNewStaffForm((prev) => ({
                    ...prev,
                    role_id: nextRoleId,
                    branch_ids:
                      isBm && prev.branch_ids.length > 1
                        ? [prev.branch_ids[0]]
                        : prev.branch_ids,
                  }));
                }}
              >
                <option value="">Select System Role</option>
                {staffRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_LABELS[r.name] || r.name}
                  </option>
                ))}
              </Select>

              <Select
                id="new-staff-zone"
                label={isZoneRequiredForCreate ? 'Zone Assignment *' : 'Zone Assignment (Optional for Super Admin)'}
                required={isZoneRequiredForCreate}
                value={newStaffForm.zone_id}
                onChange={(e) =>
                  setNewStaffForm({
                    ...newStaffForm,
                    zone_id: e.target.value,
                    branch_ids: [],
                  })
                }
              >
                <option value="">
                  {isZoneRequiredForCreate ? 'Select Zone Assignment' : 'All Zones (HQ)'}
                </option>
                {(org?.zones || [])
                  .filter((z) => z.is_active !== false)
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} {z.zone_code ? `(${z.zone_code})` : ''}
                    </option>
                  ))}
              </Select>
            </div>

            {/* Branch Tagging Checklist */}
            {newStaffForm.zone_id ? (
              <div
                id="new-staff-branch-tagging-box"
                className="mt-3 p-4 rounded-lg bg-white border border-slate-200 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      Branch Tagging Checklist
                    </span>
                    <span
                      id="branch-tag-counter"
                      className="text-xs font-semibold text-indigo-700"
                    >
                      {newStaffForm.branch_ids.length} of {createZoneBranches.length} branches selected
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {isCreateBranchManager && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          id="bm-single-branch-toggle"
                          type="checkbox"
                          checked={bmSingleBranchMode}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBmSingleBranchMode(checked);
                            if (checked && newStaffForm.branch_ids.length > 1) {
                              setNewStaffForm((prev) => ({
                                ...prev,
                                branch_ids: [prev.branch_ids[0]],
                              }));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Single-branch default</span>
                      </label>
                    )}

                    {createZoneBranches.length > 0 && (
                      <Button
                        id="branch-tag-select-all-btn"
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSelectAllCreateBranches}
                        className="py-1.5 px-3 text-xs"
                      >
                        {createZoneBranches.every((b) => newStaffForm.branch_ids.includes(b.id))
                          ? 'Clear All'
                          : 'Select All'}
                      </Button>
                    )}
                  </div>
                </div>

                {createZoneBranches.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-xs">
                    No active branches found in the selected zone.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pt-1">
                    {createZoneBranches.map((b) => {
                      const isChecked = newStaffForm.branch_ids.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          htmlFor={`branch-tag-checkbox-${b.id}`}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-semibold'
                              : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                          }`}
                        >
                          <input
                            id={`branch-tag-checkbox-${b.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCreateBranch(b.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{b.name}</span>
                            {b.branch_code && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {b.branch_code} {b.branch_type ? `· ${b.branch_type}` : ''}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic pt-1">
                Select a Zone above to view and tag branches in that zone.
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* EDIT STAFF MODAL                                                      */}
      {/* ===================================================================== */}
      <Modal
        isOpen={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
        title="Edit Staff Member"
        description="Update personal details, employment identity, system role, and branch tagging."
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditingStaff(null)}
            >
              Cancel
            </Button>
            <Button
              id="submit-edit-staff-btn"
              type="submit"
              form="super-admin-edit-staff-form"
              variant="primary"
              size="sm"
              disabled={loading}
            >
              Save Profile
            </Button>
          </>
        }
      >
        {editingStaff && (
          <form id="super-admin-edit-staff-form" onSubmit={handleSaveStaffEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  id="edit-staff-name"
                  label="Full Name *"
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                />
              </div>

              <Input
                id="edit-staff-personal-email"
                label="Personal Contact Email"
                type="email"
                value={editingStaff.personal_email || ''}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, personal_email: e.target.value })
                }
              />

              <Input
                id="edit-staff-phone"
                label="Phone Number"
                type="text"
                value={editingStaff.phone_number || ''}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, phone_number: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  id="edit-staff-employee-id"
                  label="Employee ID *"
                  type="text"
                  required
                  value={editingStaff.staff_employee_id || ''}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, staff_employee_id: e.target.value })
                  }
                  className="font-mono"
                />
              </div>

              <Select
                id="edit-staff-department"
                label="Department"
                value={editingStaff.department_id || ''}
                onChange={(e) =>
                  setEditingStaff({
                    ...editingStaff,
                    department_id: e.target.value,
                    designation_id: '',
                  })
                }
              >
                <option value="">Select Department</option>
                {org?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>

              <Select
                id="edit-staff-designation"
                label="Designation"
                disabled={!editingStaff.department_id}
                value={editingStaff.designation_id || ''}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, designation_id: e.target.value })
                }
              >
                <option value="">Select Designation</option>
                {filteredEditDesignations.map((desig) => (
                  <option key={desig.id} value={desig.id}>
                    {desig.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                id="edit-staff-email"
                label="Official/Work Email"
                type="email"
                disabled
                value={editingStaff.email}
                hint="Official login email is locked."
              />

              <Select
                id="edit-staff-role"
                label="System Role *"
                required
                value={editingStaff.role_id}
                onChange={(e) => setEditingStaff({ ...editingStaff, role_id: e.target.value })}
              >
                {staffRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_LABELS[r.name] || r.name}
                  </option>
                ))}
              </Select>

              <Select
                id="edit-staff-zone"
                label="Assigned Zone"
                value={editingStaff.zone_id || ''}
                onChange={(e) =>
                  setEditingStaff({
                    ...editingStaff,
                    zone_id: e.target.value,
                    branch_id: '',
                    branch_ids_edit: [],
                  })
                }
              >
                <option value="">All Zones (HQ)</option>
                {org?.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>
            </div>

            {editingStaff.zone_id && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    Branch Tagging ({editingStaff.branch_ids_edit.length} of {editZoneBranches.length} branches selected)
                  </span>
                  {editZoneBranches.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const allIds = editZoneBranches.map((b) => b.id);
                        const allSelected = allIds.every((id) =>
                          editingStaff.branch_ids_edit.includes(id)
                        );
                        setEditingStaff({
                          ...editingStaff,
                          branch_ids_edit: allSelected ? [] : allIds,
                        });
                      }}
                      className="py-1 px-2.5 text-xs"
                    >
                      {editZoneBranches.every((b) => editingStaff.branch_ids_edit.includes(b.id))
                        ? 'Clear All'
                        : 'Select All'}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {editZoneBranches.map((b) => {
                    const checked = editingStaff.branch_ids_edit.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-white cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const exists = editingStaff.branch_ids_edit.includes(b.id);
                            setEditingStaff({
                              ...editingStaff,
                              branch_ids_edit: exists
                                ? editingStaff.branch_ids_edit.filter((id) => id !== b.id)
                                : [...editingStaff.branch_ids_edit, b.id],
                            });
                          }}
                          className="rounded border-slate-300 text-indigo-600 shrink-0"
                        />
                        <span className="truncate">{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* ONE-TIME PASSWORD MODAL */}
      <Modal
        isOpen={oneTimePasswordModal.open}
        onClose={() => {
          setOneTimePasswordModal((prev) => ({ ...prev, open: false }));
          setCopiedPassword(false);
        }}
        title={oneTimePasswordModal.title}
        description="Provide these credentials to the staff user. The temporary password will not be shown again."
        size="small"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-slate-500 block text-[11px]">Recipient</span>
            <span className="font-bold text-slate-900 block">{oneTimePasswordModal.staffName}</span>
            <span className="font-mono text-slate-600 block text-[11px]">{oneTimePasswordModal.email}</span>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-amber-800 font-bold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Temporary Password:
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (oneTimePasswordModal.tempPassword) {
                    navigator.clipboard.writeText(oneTimePasswordModal.tempPassword);
                    setCopiedPassword(true);
                    setTimeout(() => setCopiedPassword(false), 2500);
                  }
                }}
                className="py-1 px-2.5 text-[11px]"
              >
                {copiedPassword ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-600" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="p-2.5 bg-white border border-amber-300 rounded font-mono font-bold text-sm tracking-wide text-amber-950 select-all text-center">
              {oneTimePasswordModal.tempPassword || '—'}
            </div>
            <span className="text-[10px] text-amber-700 block leading-tight">
              Staff will be prompted to choose a permanent password upon first login.
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setOneTimePasswordModal((prev) => ({ ...prev, open: false }));
                setCopiedPassword(false);
              }}
            >
              I Have Recorded This Password
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
