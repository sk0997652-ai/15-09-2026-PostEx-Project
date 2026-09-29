import React, { useState, useMemo } from 'react';
import {
  UserPlus,
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
  StatusBadge,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableToolbar,
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
        staff.email?.toLowerCase().includes(query) ||
        (staff.staff_employee_id || '').toLowerCase().includes(query);

      const matchesRole = !staffRoleFilter || staff.roles?.name === staffRoleFilter;

      const matchesStatus =
        !staffStatusFilter ||
        (staffStatusFilter === 'active' ? staff.is_active : !staff.is_active);

      const matchesBranch =
        !staffBranchFilter ||
        staff.branches?.id === staffBranchFilter ||
        (staff.branch_ids && staff.branch_ids.includes(staffBranchFilter));

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
        description="Create accounts strictly within your assigned zone across 4 structured sections with one-time temporary credentials."
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
      <TableToolbar
        searchInputId="zonal-staff-search-input"
        searchValue={staffSearch}
        onSearchChange={(val) => {
          setStaffSearch(val);
          setStaffPage(1);
        }}
        searchPlaceholder="Search by name, email, or PX-STAFF ID..."
        filters={[
          {
            id: 'zonal-staff-role-filter',
            label: 'Filter by Role',
            value: staffRoleFilter,
            onChange: (val) => {
              setStaffRoleFilter(val);
              setStaffPage(1);
            },
            options: [
              { value: '', label: 'All Roles' },
              { value: 'central_hr', label: 'Central HR' },
              { value: 'branch_manager', label: 'Branch Manager' },
            ],
          },
          {
            id: 'zonal-staff-branch-filter',
            label: 'Filter by Branch',
            value: staffBranchFilter,
            onChange: (val) => {
              setStaffBranchFilter(val);
              setStaffPage(1);
            },
            options: [
              { value: '', label: 'All Branches' },
              ...zoneBranches.map((b) => ({ value: b.id, label: b.name })),
            ],
          },
        ]}
        statusPills={[
          { value: '', label: 'All Statuses', variant: 'info', count: uniqueStaffList.length },
          {
            value: 'active',
            label: 'Active',
            variant: 'success',
            count: uniqueStaffList.filter((s) => s.is_active).length,
          },
          {
            value: 'inactive',
            label: 'Inactive',
            variant: 'error',
            count: uniqueStaffList.filter((s) => !s.is_active).length,
          },
        ]}
        activeStatus={staffStatusFilter}
        onStatusChange={(val) => {
          setStaffStatusFilter(val);
          setStaffPage(1);
        }}
        hasActiveFilters={Boolean(
          staffSearch || staffRoleFilter || staffStatusFilter || staffBranchFilter
        )}
        onReset={() => {
          setStaffSearch('');
          setStaffRoleFilter('');
          setStaffStatusFilter('');
          setStaffBranchFilter('');
          setStaffPage(1);
        }}
      />

      {/* Staff Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">
            Staff Directory ({filteredStaffList.length} of {uniqueStaffList.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Policy: Min 10 chars, forced password change on first login
          </span>
        </div>

        <Table wrapperClassName="md:border-0 md:rounded-none md:shadow-none max-md:p-3">
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member &amp; Contact</TableHead>
              <TableHead hideOnTablet>Employment Identity</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Tagged Branches</TableHead>
              <TableHead hideOnTablet>Password Status</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStaffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  No staff accounts matching your search or filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedStaffList.map((staff) => {
                const taggedList =
                  staff.tagged_branches && staff.tagged_branches.length > 0
                    ? staff.tagged_branches
                    : staff.branches?.name
                    ? [{ id: staff.branches.id, name: staff.branches.name }]
                    : [];

                return (
                  <TableRow key={staff.id}>
                    <TableCell mobileRole="primary">
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-600 font-mono">{staff.email}</div>
                      {(staff.personal_email || staff.phone_number || staff.phone) && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {[staff.personal_email, staff.phone_number || staff.phone]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Employment Identity" hideOnTablet>
                      <div className="font-mono text-xs font-bold text-indigo-950">
                        {staff.staff_employee_id || '—'}
                      </div>
                      <div className="text-xs text-slate-700">
                        {staff.designations?.name || 'No Designation'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {staff.departments?.name || 'No Department'}
                      </div>
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Assigned Role">
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
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Tagged Branches"
                      className="text-slate-700 text-xs"
                    >
                      {taggedList.length > 0 ? (
                        <span>
                          {taggedList.length === 1
                            ? taggedList[0].name
                            : `${taggedList.length} branches: ${taggedList.map((b) => b.name).join(', ')}`}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Zone-Wide (Central)</span>
                      )}
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Password Status" hideOnTablet>
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
                    </TableCell>
                    <TableCell mobileRole="status">
                      <StatusBadge status={staff.is_active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell mobileRole="actions" className="text-right">
                      <div className="inline-flex flex-wrap items-center gap-1.5">
                        <Button
                          id={`zonal-edit-staff-${staff.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEditStaff(staff)}
                          leftIcon={<Edit className="w-3 h-3" />}
                        >
                          Edit
                        </Button>
                        <Button
                          id={`zonal-toggle-staff-${staff.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleStaffStatus(staff)}
                          className={
                            staff.is_active
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }
                          leftIcon={
                            staff.is_active ? (
                              <UserX className="w-3 h-3" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )
                          }
                        >
                          {staff.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          id={`zonal-regen-password-${staff.id}`}
                          variant="secondary"
                          size="sm"
                          onClick={() => onRegeneratePassword(staff)}
                          leftIcon={<KeyRound className="w-3 h-3" />}
                        >
                          Reset Password
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Staff Pagination */}
        {filteredStaffList.length > 0 && (
          <TablePagination
            page={staffPage}
            totalPages={Math.max(1, Math.ceil(filteredStaffList.length / staffLimit))}
            total={filteredStaffList.length}
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
