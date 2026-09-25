import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  FilterX,
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
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    role_id: '',
    zone_id: '',
    branch_id: '',
  });

  const [editingStaff, setEditingStaff] = useState<StaffUserItem | null>(null);

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
        if (!matchesName && !matchesEmail) return false;
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminApi.createStaff(newStaffForm);
      setShowCreateStaffModal(false);
      setNewStaffForm({ name: '', email: '', role_id: '', zone_id: '', branch_id: '' });
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

  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await superAdminApi.updateStaff(editingStaff.id, {
        name: editingStaff.name,
        role_id: editingStaff.role_id,
        zone_id: editingStaff.zone_id || null,
        branch_id: editingStaff.branch_id || null,
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
        description="Provision new staff accounts with auto-generated passwords, assign zones/branches, and manage status."
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
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px]">
            <Input
              id="staff-search-input"
              type="text"
              placeholder="Search by name or email..."
              value={staffSearch}
              onChange={(e) => {
                setStaffSearch(e.target.value);
                setStaffPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="w-44">
            <Select
              id="staff-role-filter-select"
              value={staffRoleFilter}
              onChange={(e) => {
                setStaffRoleFilter(e.target.value);
                setStaffPage(1);
              }}
            >
              <option value="">All Roles</option>
              {org?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Select
              id="staff-status-filter-select"
              value={staffStatusFilter}
              onChange={(e) => {
                setStaffStatusFilter(e.target.value);
                setStaffPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          <div className="w-40">
            <Select
              id="staff-zone-filter-select"
              value={staffZoneFilter}
              onChange={(e) => {
                setStaffZoneFilter(e.target.value);
                setStaffPage(1);
              }}
            >
              <option value="">All Zones</option>
              {org?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
          </div>

          {(staffSearch || staffRoleFilter || staffStatusFilter || staffZoneFilter) && (
            <Button
              id="reset-staff-filters-btn"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              title="Clear Filters"
              className="text-slate-500 hover:text-slate-900"
            >
              <FilterX className="w-4 h-4" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Staff Table */}
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>System Role</TableHead>
              <TableHead>Assigned Zone / Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStaff.length > 0 ? (
              paginatedStaff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <span className="font-bold text-slate-900 block">{s.name}</span>
                      <span className="text-xs text-slate-500 block">{s.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary" size="sm">
                      {s.roles?.name || 'Staff'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    <span className="font-medium text-slate-800 block text-xs">
                      {s.zones?.name || 'All Zones (HQ)'}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {s.branches?.name || 'All Branches'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? 'success' : 'error'} size="sm" dot>
                      {s.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 font-mono text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
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
                        onClick={() => setEditingStaff({ ...s })}
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
              ))
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

      {/* CREATE STAFF MODAL */}
      <Modal
        isOpen={showCreateStaffModal}
        onClose={() => setShowCreateStaffModal(false)}
        title="Create Staff Account"
        description="A secure temporary password will be generated for initial login."
        size="default"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
          <Input
            id="new-staff-name"
            label="Full Name"
            type="text"
            required
            value={newStaffForm.name}
            onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
            placeholder="e.g. Asad Khan"
          />

          <Input
            id="new-staff-email"
            label="Email Address"
            type="email"
            required
            value={newStaffForm.email}
            onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
            placeholder="e.g. asad.khan@postex.pk"
          />

          <Select
            id="new-staff-role"
            label="System Role"
            required
            value={newStaffForm.role_id}
            onChange={(e) => setNewStaffForm({ ...newStaffForm, role_id: e.target.value })}
          >
            <option value="">Select Role...</option>
            {org?.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select
              id="new-staff-zone"
              label="Assigned Zone (Optional)"
              value={newStaffForm.zone_id}
              onChange={(e) =>
                setNewStaffForm({ ...newStaffForm, zone_id: e.target.value, branch_id: '' })
              }
            >
              <option value="">All Zones (HQ)</option>
              {org?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>

            <Select
              id="new-staff-branch"
              label="Assigned Branch (Optional)"
              value={newStaffForm.branch_id}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, branch_id: e.target.value })}
            >
              <option value="">All Branches</option>
              {org?.branches
                .filter((b) => !newStaffForm.zone_id || b.zone_id === newStaffForm.zone_id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </Select>
          </div>

          <div className="pt-3 flex gap-2 justify-end">
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
              variant="primary"
              size="sm"
              disabled={loading}
            >
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT STAFF MODAL */}
      <Modal
        isOpen={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
        title="Edit Staff Member"
        description="Update profile attributes, system role, and assigned operational zone."
        size="default"
      >
        {editingStaff && (
          <form onSubmit={handleSaveStaffEdit} className="space-y-4 text-xs">
            <Input
              id="edit-staff-name"
              label="Full Name"
              type="text"
              required
              value={editingStaff.name}
              onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
            />

            <Input
              id="edit-staff-email"
              label="Email Address"
              type="email"
              disabled
              value={editingStaff.email}
              hint="Email is locked for security integrity."
            />

            <Select
              id="edit-staff-role"
              label="System Role"
              required
              value={editingStaff.role_id}
              onChange={(e) => setEditingStaff({ ...editingStaff, role_id: e.target.value })}
            >
              {org?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Select
                id="edit-staff-zone"
                label="Assigned Zone"
                value={editingStaff.zone_id || ''}
                onChange={(e) =>
                  setEditingStaff({ ...editingStaff, zone_id: e.target.value, branch_id: '' })
                }
              >
                <option value="">All Zones (HQ)</option>
                {org?.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </Select>

              <Select
                id="edit-staff-branch"
                label="Assigned Branch"
                value={editingStaff.branch_id || ''}
                onChange={(e) => setEditingStaff({ ...editingStaff, branch_id: e.target.value })}
              >
                <option value="">All Branches</option>
                {org?.branches
                  .filter((b) => !editingStaff.zone_id || b.zone_id === editingStaff.zone_id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="pt-3 flex gap-2 justify-end">
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
                variant="primary"
                size="sm"
                disabled={loading}
              >
                Save Profile
              </Button>
            </div>
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
