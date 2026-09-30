import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  UserCheck,
  FileCheck,
  Download,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
} from '../ui';
import {
  useHrPortalStore,
  PortalEmployee,
  exportRowsToExcel,
  canSuperAdminUndoExit,
  undoEmployeeExit,
} from '../../lib/hrPortalStore';
import { MarkExitModal } from '../common/MarkExitModal';

interface EnrolledRosterViewProps {
  enrolledEmployees: any[];
  loading: boolean;
  zoneName: string;
  onRefresh: () => void;
  onOpenPdfDossier: (emp: any) => void;
  role?: 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';
  actorName?: string;
}

export function EnrolledRosterView({
  enrolledEmployees,
  loading,
  zoneName,
  onRefresh,
  onOpenPdfDossier,
  role = 'central_hr',
  actorName = 'Central HR',
}: EnrolledRosterViewProps) {
  const [store] = useHrPortalStore();
  const [rosterSearch, setRosterSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [lifecycleTab, setLifecycleTab] = useState<'Active' | 'Exit In Progress' | 'Exited' | 'all'>('Active');
  const [exitTarget, setExitTarget] = useState<PortalEmployee | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isHrRole = role === 'super_admin' || role === 'zonal_hr' || role === 'central_hr';
  const isSuperAdmin = role === 'super_admin';

  // Combine backend enrolledEmployees with browser-store employees
  const combinedEmployees: Array<{
    portalEmp: PortalEmployee;
    rawDossierEmp?: any;
  }> = useMemo(() => {
    const result: Array<{ portalEmp: PortalEmployee; rawDossierEmp?: any }> = [];
    const seenCodes = new Set<string>();

    // First include all employees in hrPortalStore
    for (const emp of store.employees) {
      seenCodes.add(emp.employeeCode.toLowerCase());
      result.push({ portalEmp: emp });
    }

    // Merge any backend enrolledEmployees not already in store
    for (const raw of enrolledEmployees || []) {
      const code = (raw.employee_id || `PX-EMP-${String(raw.id).slice(0, 4)}`).trim();
      if (seenCodes.has(code.toLowerCase())) continue;
      seenCodes.add(code.toLowerCase());
      result.push({
        rawDossierEmp: raw,
        portalEmp: {
          id: raw.id,
          employeeCode: code,
          fullName: raw.candidate?.full_name || 'Enrolled Employee',
          cnic: (raw.candidate?.masked_cnic || '').replace(/[^0-9]/g, '').padEnd(13, '0'),
          contactNumber: raw.candidate?.mobile || '03000000000',
          designation: 'Delivery Courier I',
          branch: raw.candidate?.branch_name || 'Gulberg Hub',
          zone: zoneName || 'Central Zone',
          joiningDate: raw.enrolled_at
            ? new Date(raw.enrolled_at).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          status: 'Active',
          isNewJoiner: false,
        },
      });
    }

    return result;
  }, [store.employees, enrolledEmployees, zoneName]);

  const branchOptions = useMemo(() => {
    return Array.from(
      new Set(combinedEmployees.map((e) => e.portalEmp.branch).filter(Boolean))
    );
  }, [combinedEmployees]);

  const filteredEmployees = useMemo(() => {
    return combinedEmployees.filter(({ portalEmp }) => {
      if (lifecycleTab !== 'all' && portalEmp.status !== lifecycleTab) {
        return false;
      }
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const matchesName = portalEmp.fullName.toLowerCase().includes(q);
        const matchesEmpId = portalEmp.employeeCode.toLowerCase().includes(q);
        const matchesCnic = portalEmp.cnic.toLowerCase().includes(q);
        const matchesDesig = portalEmp.designation.toLowerCase().includes(q);
        if (!matchesName && !matchesEmpId && !matchesCnic && !matchesDesig) return false;
      }
      if (branchFilter && portalEmp.branch !== branchFilter) return false;
      return true;
    });
  }, [combinedEmployees, rosterSearch, branchFilter, lifecycleTab]);

  const handleExportToExcel = () => {
    const rows = filteredEmployees.map(({ portalEmp }) => ({
      'Employee Code*': portalEmp.employeeCode,
      'Full Name*': portalEmp.fullName,
      'CNIC*': portalEmp.cnic,
      'Contact Number*': portalEmp.contactNumber,
      'Designation*': portalEmp.designation,
      'Branch*': portalEmp.branch,
      Zone: portalEmp.zone,
      'Joining Date*': portalEmp.joiningDate,
      Status: portalEmp.status,
      ...(portalEmp.exitInfo
        ? {
            'Exit Type': portalEmp.exitInfo.exitType,
            'Last Working Date': portalEmp.exitInfo.lastWorkingDate,
            'Exit Reason': portalEmp.exitInfo.reason,
          }
        : {}),
    }));
    exportRowsToExcel('PostEx_Employees_Export.xlsx', 'Employees', rows, [
      'CNIC*',
      'Contact Number*',
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrolled Employee Directory"
        description={`Manage Active employees, Exit In Progress clearances, and Exited / Archive records (${zoneName}).`}
        badge={<Badge variant="success">Corporate Enrolled Roster</Badge>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              id="export-employees-excel-btn"
              variant="secondary"
              size="sm"
              onClick={handleExportToExcel}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export to Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Roster
            </Button>
          </div>
        }
      />

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <TableToolbar
        searchInputId="enrolled-roster-search-input"
        searchValue={rosterSearch}
        onSearchChange={setRosterSearch}
        searchPlaceholder="Search by Employee Code, name, designation, or CNIC..."
        filters={
          branchOptions.length > 0
            ? [
                {
                  id: 'enrolled-roster-branch-filter',
                  label: 'Filter by Branch',
                  value: branchFilter,
                  onChange: setBranchFilter,
                  options: [
                    { value: '', label: 'All Branches' },
                    ...branchOptions.map((b) => ({ value: b, label: b })),
                  ],
                },
              ]
            : []
        }
        statusPills={[
          {
            value: 'Active',
            label: 'Active Headcount',
            variant: 'success',
            count: combinedEmployees.filter((e) => e.portalEmp.status === 'Active').length,
          },
          {
            value: 'Exit In Progress',
            label: 'Exit In Progress',
            variant: 'warning',
            count: combinedEmployees.filter((e) => e.portalEmp.status === 'Exit In Progress').length,
          },
          {
            value: 'Exited',
            label: 'Exited / Archive',
            variant: 'neutral',
            count: combinedEmployees.filter((e) => e.portalEmp.status === 'Exited').length,
          },
          {
            value: 'all',
            label: 'All Records',
            variant: 'info',
            count: combinedEmployees.length,
          },
        ]}
        activeStatus={lifecycleTab}
        onStatusChange={(val) =>
          setLifecycleTab((val as 'Active' | 'Exit In Progress' | 'Exited' | 'all') || 'Active')
        }
        hasActiveFilters={Boolean(rosterSearch || branchFilter || lifecycleTab !== 'Active')}
        onReset={() => {
          setRosterSearch('');
          setBranchFilter('');
          setLifecycleTab('Active');
        }}
      />

      <Card className="overflow-hidden">
        <Table wrapperClassName="md:border-0 md:rounded-none md:shadow-none max-md:p-3">
          <TableHeader>
            <TableRow>
              <TableHead>Employee Code</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>CNIC / Contact</TableHead>
              <TableHead>Branch Hub</TableHead>
              <TableHead hideOnTablet>Joining Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span>Loading enrolled employees...</span>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No employees found in this view</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try switching status tabs (Active / Exit In Progress / Exited Archive) or adjusting filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map(({ portalEmp, rawDossierEmp }) => {
                const canUndo =
                  isSuperAdmin &&
                  portalEmp.status !== 'Active' &&
                  canSuperAdminUndoExit(portalEmp.exitInfo?.initiatedAt);

                return (
                  <TableRow key={portalEmp.id}>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Employee Code"
                      className="font-mono font-bold text-emerald-700"
                    >
                      {portalEmp.employeeCode}
                    </TableCell>
                    <TableCell mobileRole="primary" className="font-bold text-slate-900">
                      {portalEmp.fullName}
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Designation"
                      className="text-slate-700"
                    >
                      {portalEmp.designation}
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="CNIC / Contact"
                      className="font-mono text-slate-600 text-xs"
                    >
                      <div>{portalEmp.cnic}</div>
                      <div className="text-[11px] text-slate-400">{portalEmp.contactNumber}</div>
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Branch Hub"
                      className="text-slate-700"
                    >
                      <div>{portalEmp.branch}</div>
                      <div className="text-[11px] text-slate-400">{portalEmp.zone}</div>
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Joining Date"
                      hideOnTablet
                      className="text-slate-500 text-[11px] font-mono"
                    >
                      {portalEmp.joiningDate}
                    </TableCell>
                    <TableCell mobileRole="status">
                      {portalEmp.status === 'Active' && (
                        <Badge variant="success" dot>
                          Active
                        </Badge>
                      )}
                      {portalEmp.status === 'Exit In Progress' && (
                        <Badge variant="warning" dot>
                          Exit In Progress ({portalEmp.exitInfo?.exitType || 'ECF'})
                        </Badge>
                      )}
                      {portalEmp.status === 'Exited' && (
                        <Badge variant="neutral" dot>
                          Exited (Archive)
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell mobileRole="actions" className="text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {rawDossierEmp && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onOpenPdfDossier(rawDossierEmp)}
                            leftIcon={<FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                          >
                            Dossier
                          </Button>
                        )}
                        {isHrRole && portalEmp.status === 'Active' && (
                          <Button
                            variant="danger"
                            size="sm"
                            id={`mark-exit-btn-${portalEmp.employeeCode}`}
                            onClick={() => setExitTarget(portalEmp)}
                            leftIcon={<LogOut className="w-3.5 h-3.5" />}
                          >
                            Mark Exit
                          </Button>
                        )}
                        {canUndo && (
                          <Button
                            variant="secondary"
                            size="sm"
                            id={`undo-exit-btn-${portalEmp.employeeCode}`}
                            onClick={() => {
                              const res = undoEmployeeExit({
                                employeeId: portalEmp.id,
                                actorName,
                              });
                              if (res.success) {
                                setStatusNotice(
                                  `Restored ${portalEmp.fullName} (${portalEmp.employeeCode}) back to Active status and headcount.`
                                );
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
            )}
          </TableBody>
        </Table>
      </Card>

      <MarkExitModal
        isOpen={Boolean(exitTarget)}
        employee={exitTarget}
        actorName={actorName}
        onClose={() => setExitTarget(null)}
        onSuccess={(msg) => setStatusNotice(msg)}
      />
    </div>
  );
}
