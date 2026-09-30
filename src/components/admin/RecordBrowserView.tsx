import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download, LogOut, RotateCcw } from 'lucide-react';
import {
  OrgStructure,
  CandidateBrowserRecord,
  superAdminApi,
} from '../../lib/superAdminApi';
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableToolbar,
  PageHeader,
  StatusBadge,
  Badge,
} from '../ui';
import {
  useHrPortalStore,
  PortalEmployee,
  exportRowsToExcel,
  canSuperAdminUndoExit,
  undoEmployeeExit,
} from '../../lib/hrPortalStore';
import { MarkExitModal } from '../common/MarkExitModal';

export interface RecordBrowserViewProps {
  org: OrgStructure | null;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const RecordBrowserView: React.FC<RecordBrowserViewProps> = ({
  org,
  setNotification,
}) => {
  const [store] = useHrPortalStore();
  const [directoryMode, setDirectoryMode] = useState<'employees' | 'candidates'>('employees');

  // Employee Directory & Archive state
  const [empSearch, setEmpSearch] = useState('');
  const [empBranchFilter, setEmpBranchFilter] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'Active' | 'Exit In Progress' | 'Exited' | 'all'>('Active');
  const [exitTarget, setExitTarget] = useState<PortalEmployee | null>(null);

  // Candidate Browser state
  const [records, setRecords] = useState<CandidateBrowserRecord[]>([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordZoneFilter, setRecordZoneFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');
  const [recordPagination, setRecordPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  const loadRecordsData = async (
    page = 1,
    limit = 25,
    searchOverride?: string,
    zoneOverride?: string
  ) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getRecords({
        page,
        limit,
        search: searchOverride !== undefined ? searchOverride : recordSearch,
        zone_id: zoneOverride !== undefined ? zoneOverride : recordZoneFilter,
      });
      setRecords(res.records || []);
      setRecordPagination({
        page: res.pagination?.page || 1,
        limit: res.pagination?.limit || 25,
        total: res.pagination?.total || 0,
        totalPages: res.pagination?.totalPages || 1,
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordsData(1, recordPagination.limit, recordSearch, recordZoneFilter);
  }, [recordZoneFilter]);

  // Filtered Employees (from browser store + any imported/seeded employees)
  const filteredEmployees = useMemo(() => {
    return store.employees.filter((emp) => {
      if (empStatusFilter !== 'all' && emp.status !== empStatusFilter) return false;
      if (empBranchFilter && emp.branch !== empBranchFilter) return false;
      if (empSearch.trim()) {
        const q = empSearch.trim().toLowerCase();
        const matches =
          emp.fullName.toLowerCase().includes(q) ||
          emp.employeeCode.toLowerCase().includes(q) ||
          emp.cnic.toLowerCase().includes(q) ||
          emp.designation.toLowerCase().includes(q) ||
          emp.branch.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [store.employees, empStatusFilter, empBranchFilter, empSearch]);

  const branchOptions = useMemo(() => {
    return Array.from(new Set(store.employees.map((e) => e.branch).filter(Boolean)));
  }, [store.employees]);

  const uniqueRecords = useMemo(() => {
    const seen = new Set<string>();
    return records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [records]);

  const filteredRecords = useMemo(() => {
    return uniqueRecords.filter((r) => {
      const app = r.applications?.[0];
      const rawStatus = app?.status || 'draft';
      if (recordStatusFilter && rawStatus !== recordStatusFilter) return false;
      return true;
    });
  }, [uniqueRecords, recordStatusFilter]);

  const handleClearFilters = () => {
    setRecordSearch('');
    setRecordZoneFilter('');
    setRecordStatusFilter('');
    loadRecordsData(1, recordPagination.limit, '', '');
  };

  const handleExportEmployeesExcel = () => {
    const rows = filteredEmployees.map((emp) => ({
      'Employee Code*': emp.employeeCode,
      'Full Name*': emp.fullName,
      'CNIC*': emp.cnic,
      'Contact Number*': emp.contactNumber,
      'Designation*': emp.designation,
      'Branch*': emp.branch,
      Zone: emp.zone,
      'Joining Date*': emp.joiningDate,
      Status: emp.status,
      ...(emp.exitInfo
        ? {
            'Exit Type': emp.exitInfo.exitType,
            'Last Working Date': emp.exitInfo.lastWorkingDate,
            Reason: emp.exitInfo.reason,
          }
        : {}),
    }));
    exportRowsToExcel('PostEx_Employees_Export.xlsx', 'Employees', rows, [
      'CNIC*',
      'Contact Number*',
    ]);
  };

  const handleExportCandidatesExcel = () => {
    const rows = filteredRecords.map((r) => ({
      'Candidate Name': r.full_name,
      'Joining ID': r.joining_id,
      'Masked CNIC': r.masked_cnic,
      Mobile: r.mobile,
      Zone: r.zones?.name || '—',
      Branch: r.branches?.name || '—',
      'Application Status': r.applications?.[0]?.status || 'draft',
      Registered: new Date(r.created_at).toLocaleDateString(),
    }));
    exportRowsToExcel('PostEx_Candidates_Export.xlsx', 'Candidates', rows, [
      'Masked CNIC',
      'Mobile',
    ]);
  };

  return (
    <div id="super-admin-record-browser-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Company Record & Employee Directory"
        description="Manage Active employees, Exit In Progress clearances, Exited/Archive records, and inspect candidate applications across all zones."
        roleContext="Company Directory"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              id="export-directory-excel-btn"
              variant="secondary"
              size="sm"
              onClick={
                directoryMode === 'employees'
                  ? handleExportEmployeesExcel
                  : handleExportCandidatesExcel
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to Excel</span>
            </Button>
            {directoryMode === 'candidates' && (
              <Button
                id="refresh-records-btn"
                variant="secondary"
                size="sm"
                onClick={() => loadRecordsData(recordPagination.page, recordPagination.limit)}
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Directory</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Mode Switcher: Employees (with Exit Lifecycle & Exited/Archive) vs Candidate Directory */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          id="directory-subtab-employees"
          onClick={() => setDirectoryMode('employees')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            directoryMode === 'employees'
              ? 'text-indigo-700 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Employees &amp; Exit Lifecycle</span>
          <Badge variant={directoryMode === 'employees' ? 'primary' : 'neutral'} size="sm">
            {store.employees.length}
          </Badge>
        </button>
        <button
          type="button"
          id="directory-subtab-candidates"
          onClick={() => setDirectoryMode('candidates')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            directoryMode === 'candidates'
              ? 'text-indigo-700 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Candidate Onboarding Records</span>
          <Badge variant={directoryMode === 'candidates' ? 'primary' : 'neutral'} size="sm">
            {uniqueRecords.length}
          </Badge>
        </button>
      </div>

      {directoryMode === 'employees' ? (
        <div className="space-y-4">
          <TableToolbar
            searchInputId="employee-directory-search-input"
            searchValue={empSearch}
            onSearchChange={setEmpSearch}
            searchPlaceholder="Search employee by code, name, CNIC, designation, or branch..."
            filters={[
              {
                id: 'employee-directory-branch-filter',
                label: 'Filter by Branch',
                value: empBranchFilter,
                onChange: setEmpBranchFilter,
                options: [
                  { value: '', label: 'All Branches' },
                  ...branchOptions.map((b) => ({ value: b, label: b })),
                ],
              },
            ]}
            statusPills={[
              {
                value: 'Active',
                label: 'Active',
                variant: 'success',
                count: store.employees.filter((e) => e.status === 'Active').length,
              },
              {
                value: 'Exit In Progress',
                label: 'Exit In Progress',
                variant: 'warning',
                count: store.employees.filter((e) => e.status === 'Exit In Progress').length,
              },
              {
                value: 'Exited',
                label: 'Exited / Archive',
                variant: 'neutral',
                count: store.employees.filter((e) => e.status === 'Exited').length,
              },
              {
                value: 'all',
                label: 'All Employees',
                variant: 'info',
                count: store.employees.length,
              },
            ]}
            activeStatus={empStatusFilter}
            onStatusChange={(val) =>
              setEmpStatusFilter(
                (val as 'Active' | 'Exit In Progress' | 'Exited' | 'all') || 'Active'
              )
            }
            hasActiveFilters={Boolean(
              empSearch || empBranchFilter || empStatusFilter !== 'Active'
            )}
            onReset={() => {
              setEmpSearch('');
              setEmpBranchFilter('');
              setEmpStatusFilter('Active');
            }}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Code</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>CNIC / Phone</TableHead>
                <TableHead>Branch / Zone</TableHead>
                <TableHead hideOnTablet>Joining Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const canUndo =
                    emp.status !== 'Active' &&
                    canSuperAdminUndoExit(emp.exitInfo?.initiatedAt);

                  return (
                    <TableRow key={emp.id}>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Employee Code"
                        className="font-mono font-bold text-indigo-700 text-xs"
                      >
                        {emp.employeeCode}
                      </TableCell>
                      <TableCell mobileRole="primary">
                        <span className="font-bold text-slate-900 block">{emp.fullName}</span>
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Designation"
                        className="text-slate-700 text-xs"
                      >
                        {emp.designation}
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="CNIC / Phone"
                        className="font-mono text-xs text-slate-600"
                      >
                        <div>{emp.cnic}</div>
                        <div className="text-[11px] text-slate-400">{emp.contactNumber}</div>
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Branch / Zone"
                        className="text-slate-600"
                      >
                        <span className="font-medium text-slate-800 block text-xs">
                          {emp.branch}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{emp.zone}</span>
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Joining Date"
                        hideOnTablet
                        className="text-slate-500 font-mono text-xs"
                      >
                        {emp.joiningDate}
                      </TableCell>
                      <TableCell mobileRole="status">
                        {emp.status === 'Active' && (
                          <Badge variant="success" size="sm" dot>
                            Active
                          </Badge>
                        )}
                        {emp.status === 'Exit In Progress' && (
                          <Badge variant="warning" size="sm" dot>
                            Exit In Progress ({emp.exitInfo?.exitType || 'ECF'})
                          </Badge>
                        )}
                        {emp.status === 'Exited' && (
                          <Badge variant="neutral" size="sm" dot>
                            Exited (Archive)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell mobileRole="actions" className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {emp.status === 'Active' && (
                            <Button
                              variant="danger"
                              size="sm"
                              id={`sa-mark-exit-btn-${emp.employeeCode}`}
                              onClick={() => setExitTarget(emp)}
                              leftIcon={<LogOut className="w-3.5 h-3.5" />}
                            >
                              Mark Exit
                            </Button>
                          )}
                          {canUndo && (
                            <Button
                              variant="secondary"
                              size="sm"
                              id={`sa-undo-exit-btn-${emp.employeeCode}`}
                              onClick={() => {
                                const res = undoEmployeeExit({
                                  employeeId: emp.id,
                                  actorName: 'Super Admin',
                                });
                                if (res.success) {
                                  setNotification({
                                    type: 'success',
                                    text: `Undid exit for ${emp.fullName} (${emp.employeeCode}). Restored to Active headcount.`,
                                  });
                                } else {
                                  setNotification({
                                    type: 'error',
                                    text: res.error || 'Could not undo exit.',
                                  });
                                }
                              }}
                              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-indigo-600" />}
                            >
                              Undo exit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                    No employees match the current filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <MarkExitModal
            isOpen={Boolean(exitTarget)}
            employee={exitTarget}
            actorName="Super Admin"
            onClose={() => setExitTarget(null)}
            onSuccess={(msg) => setNotification({ type: 'success', text: msg })}
          />
        </div>
      ) : (
        <>
          {/* Search & Filter Toolbar */}
          <TableToolbar
            searchInputId="record-search-input"
            searchValue={recordSearch}
            onSearchChange={setRecordSearch}
            onDebouncedSearchChange={(val) => loadRecordsData(1, recordPagination.limit, val)}
            onSearchSubmit={() => loadRecordsData(1, recordPagination.limit, recordSearch)}
            searchPlaceholder="Search by candidate name, joining ID, CNIC..."
            filters={[
              {
                id: 'record-zone-filter-select',
                label: 'Filter by Zone',
                value: recordZoneFilter,
                onChange: (val) => setRecordZoneFilter(val),
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
              { value: '', label: 'All Statuses', variant: 'info', count: uniqueRecords.length },
              {
                value: 'enrolled',
                label: 'Enrolled',
                variant: 'success',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'enrolled'
                ).length,
              },
              {
                value: 'submitted',
                label: 'Submitted',
                variant: 'warning',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'submitted'
                ).length,
              },
              {
                value: 'under_review',
                label: 'Under Review',
                variant: 'warning',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'under_review'
                ).length,
              },
              {
                value: 'Action Required',
                label: 'Action Required',
                variant: 'warning',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'Action Required'
                ).length,
              },
              {
                value: 'rejected',
                label: 'Rejected',
                variant: 'error',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'rejected'
                ).length,
              },
              {
                value: 'draft',
                label: 'Draft',
                variant: 'info',
                count: uniqueRecords.filter(
                  (r) => (r.applications?.[0]?.status || 'draft') === 'draft'
                ).length,
              },
            ]}
            activeStatus={recordStatusFilter}
            onStatusChange={setRecordStatusFilter}
            hasActiveFilters={Boolean(recordSearch || recordZoneFilter || recordStatusFilter)}
            onReset={handleClearFilters}
            resetButtonId="record-clear-btn"
            actions={
              <Button
                id="record-search-btn"
                variant="primary"
                size="sm"
                onClick={() => loadRecordsData(1, recordPagination.limit, recordSearch)}
                disabled={loading}
              >
                Search
              </Button>
            }
          />

          {/* Candidates Table */}
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead hideOnTablet>Joining ID</TableHead>
                  <TableHead>Masked CNIC</TableHead>
                  <TableHead>Zone / Branch</TableHead>
                  <TableHead>Application Status</TableHead>
                  <TableHead hideOnTablet>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((r) => {
                    const app = r.applications?.[0];
                    const rawStatus = app?.status || 'draft';
                    return (
                      <TableRow key={r.id}>
                        <TableCell mobileRole="primary">
                          <div>
                            <span className="font-bold text-slate-900 block">{r.full_name}</span>
                            <span className="text-xs text-slate-500 font-mono">{r.mobile}</span>
                          </div>
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Joining ID" hideOnTablet>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {r.joining_id}
                          </span>
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Masked CNIC">
                          <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                            {r.masked_cnic}
                          </span>
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Zone / Branch"
                          className="text-slate-600"
                        >
                          <span className="font-medium text-slate-800 block text-xs">
                            {r.zones?.name || '—'}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {r.branches?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell mobileRole="status">
                          <StatusBadge status={rawStatus} dot />
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Registered"
                          hideOnTablet
                          className="text-slate-400 font-mono text-xs"
                        >
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                      {loading ? 'Loading candidates...' : 'No candidates found matching the query.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {filteredRecords.length > 0 && (
              <TablePagination
                page={recordPagination.page}
                totalPages={recordPagination.totalPages}
                total={recordPagination.total}
                pageSize={recordPagination.limit}
                pageSizeOptions={[10, 25, 50]}
                onPageSizeChange={(newLimit) => {
                  setRecordPagination((p) => ({ ...p, limit: newLimit }));
                  loadRecordsData(1, newLimit);
                }}
                onPageChange={(newPage) => {
                  loadRecordsData(newPage, recordPagination.limit);
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};
