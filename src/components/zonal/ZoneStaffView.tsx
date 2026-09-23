import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  KeyRound,
  Check,
  Edit,
  UserCheck,
  UserX,
} from 'lucide-react';
import { ZonalStaffProfile } from '../../lib/zonalHrApi';
import {
  PageHeader,
  Button,
  Card,
  Input,
  Select,
  StatusBadge,
  Badge,
  Table,
  TablePagination,
} from '../ui';

interface ZoneStaffViewProps {
  staffList: ZonalStaffProfile[];
  zoneBranches: Array<{ id: string; name: string }>;
  zoneName: string;
  onOpenAddStaff: () => void;
  onOpenEditStaff: (staff: ZonalStaffProfile) => void;
  onToggleStaffStatus: (staff: ZonalStaffProfile) => void;
  onRegeneratePassword: (staff: ZonalStaffProfile) => void;
}

export function ZoneStaffView({
  staffList,
  zoneBranches,
  zoneName,
  onOpenAddStaff,
  onOpenEditStaff,
  onToggleStaffStatus,
  onRegeneratePassword,
}: ZoneStaffViewProps) {
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');
  const [staffBranchFilter, setStaffBranchFilter] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const [staffLimit, setStaffLimit] = useState(10);

  // Deduplicate staffList by id
  const uniqueStaffList = useMemo(() => {
    const seen = new Set<string>();
    return staffList.filter((s) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [staffList]);

  // Filtered staff list
  const filteredStaffList = useMemo(() => {
    return uniqueStaffList.filter((staff) => {
      const query = staffSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        staff.name?.toLowerCase().includes(query) ||
        staff.email?.toLowerCase().includes(query);

      const matchesRole = !staffRoleFilter || staff.roles?.name === staffRoleFilter;

      const matchesStatus =
        !staffStatusFilter ||
        (staffStatusFilter === 'active' ? staff.is_active : !staff.is_active);

      const matchesBranch =
        !staffBranchFilter || staff.branches?.id === staffBranchFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesBranch;
    });
  }, [uniqueStaffList, staffSearch, staffRoleFilter, staffStatusFilter, staffBranchFilter]);

  const paginatedStaffList = useMemo(() => {
    const startIndex = (staffPage - 1) * staffLimit;
    return filteredStaffList.slice(startIndex, startIndex + staffLimit);
  }, [filteredStaffList, staffPage, staffLimit]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central HR & Branch Manager Accounts"
        description="Create accounts strictly within your assigned zone with automated temporary credential generation."
        badge={<Badge variant="primary">Zone-Scoped Staff: {zoneName}</Badge>}
        actions={
          <Button
            id="zonal-add-staff-btn"
            variant="primary"
            size="sm"
            onClick={onOpenAddStaff}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Add Staff Member
          </Button>
        }
      />

      {/* Staff Search & Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
          <div className="w-full md:w-72">
            <Input
              placeholder="Search staff by name or email..."
              value={staffSearch}
              onChange={(e) => {
                setStaffSearch(e.target.value);
                setStaffPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="w-36">
              <Select
                value={staffRoleFilter}
                onChange={(e) => {
                  setStaffRoleFilter(e.target.value);
                  setStaffPage(1);
                }}
                options={[
                  { value: '', label: 'All Roles' },
                  { value: 'central_hr', label: 'Central HR' },
                  { value: 'branch_manager', label: 'Branch Manager' },
                ]}
              />
            </div>

            <div className="w-36">
              <Select
                value={staffStatusFilter}
                onChange={(e) => {
                  setStaffStatusFilter(e.target.value);
                  setStaffPage(1);
                }}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>

            <div className="w-40">
              <Select
                value={staffBranchFilter}
                onChange={(e) => {
                  setStaffBranchFilter(e.target.value);
                  setStaffPage(1);
                }}
                options={[
                  { value: '', label: 'All Branches' },
                  ...zoneBranches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </div>

            {(staffSearch || staffRoleFilter || staffStatusFilter || staffBranchFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStaffSearch('');
                  setStaffRoleFilter('');
                  setStaffStatusFilter('');
                  setStaffBranchFilter('');
                  setStaffPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Staff Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Staff Directory ({filteredStaffList.length} of {uniqueStaffList.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Policy: Min 10 chars, forced password change on first login
          </span>
        </div>

        <Table>
          <thead>
            <tr>
              <th className="py-3 px-4 font-semibold text-left">Staff Member</th>
              <th className="py-3 px-4 font-semibold text-left">Assigned Role</th>
              <th className="py-3 px-4 font-semibold text-left">Branch Assignment</th>
              <th className="py-3 px-4 font-semibold text-left">Password Status</th>
              <th className="py-3 px-4 font-semibold text-left">Account Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedStaffList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No staff accounts matching your search or filters.
                </td>
              </tr>
            ) : (
              paginatedStaffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{staff.name}</div>
                    <div className="text-[11px] text-slate-500">{staff.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        staff.roles?.name === 'central_hr'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : staff.roles?.name === 'branch_manager'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {staff.roles?.name?.replace(/_/g, ' ') || 'Staff'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {staff.branches?.name || <span className="text-slate-400 italic">Zone-Wide (Central)</span>}
                  </td>
                  <td className="py-3.5 px-4">
                    {staff.must_change_password ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <KeyRound className="w-3 h-3 text-amber-600" />
                        <span>Change Pending</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Active &amp; Set</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={staff.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <Button
                        id={`zonal-edit-staff-${staff.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenEditStaff(staff)}
                        title="Edit staff details and role track"
                        leftIcon={<Edit className="w-3 h-3 text-indigo-600" />}
                      >
                        Edit
                      </Button>
                      <Button
                        id={`zonal-toggle-status-${staff.id}`}
                        variant={staff.is_active ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => onToggleStaffStatus(staff)}
                        title={staff.is_active ? 'Deactivate staff account' : 'Reactivate staff account'}
                        leftIcon={
                          staff.is_active ? (
                            <UserX className="w-3 h-3 text-rose-600" />
                          ) : (
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                          )
                        }
                      >
                        {staff.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        id={`zonal-regen-pwd-${staff.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => onRegeneratePassword(staff)}
                        title="Generate new temporary password"
                        leftIcon={<KeyRound className="w-3 h-3 text-amber-600" />}
                      >
                        Reset Password
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        {filteredStaffList.length > 0 && (
          <TablePagination
            currentPage={staffPage}
            totalPages={Math.ceil(filteredStaffList.length / staffLimit)}
            totalItems={filteredStaffList.length}
            pageSize={staffLimit}
            onPageChange={setStaffPage}
            onPageSizeChange={(size) => {
              setStaffLimit(size);
              setStaffPage(1);
            }}
          />
        )}
      </Card>
    </div>
  );
}
