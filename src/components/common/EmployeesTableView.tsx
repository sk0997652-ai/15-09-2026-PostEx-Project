import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, AlertCircle, LogOut } from 'lucide-react';
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui';
import { employeesApi, EmployeeListItem } from '../../lib/employeesApi';
import { PortalEmployee } from '../../lib/hrPortalStore';
import { MarkExitModal } from './MarkExitModal';
import { toTitleCase } from '../../lib/formatText';

export interface EmployeesTableViewProps {
  role?: 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';
  actorName?: string;
  onNotification?: (notif: { type: 'success' | 'error'; text: string }) => void;
}

export const EmployeesTableView: React.FC<EmployeesTableViewProps> = ({
  role = 'super_admin',
  actorName = 'Staff User',
  onNotification,
}) => {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'exit_in_progress'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [counts, setCounts] = useState<{ all: number; active: number; exit_in_progress: number }>({
    all: 0,
    active: 0,
    exit_in_progress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mark exit modal state
  const [exitTarget, setExitTarget] = useState<PortalEmployee | null>(null);

  // Can this role mark exits? Today only Super Admin and Central HR initiate employee exit
  const canMarkExit = role === 'super_admin' || role === 'central_hr';

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeesApi.getEmployees({
        status: statusFilter,
        search: debouncedSearch || undefined,
      });
      if (res.success) {
        setEmployees(res.employees || []);
        if (res.counts) {
          setCounts(res.counts);
        }
      } else {
        throw new Error(res.error || 'Failed to load employees.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (onNotification) {
        onNotification({ type: 'error', text: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, onNotification]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleOpenExitModal = (emp: EmployeeListItem) => {
    const portalEmp: PortalEmployee = {
      id: emp.id,
      employeeCode: emp.employee_id,
      fullName: emp.full_name,
      cnic: emp.cnic,
      contactNumber: emp.contact_number,
      designation: emp.designation_name,
      branch: emp.branches?.name || 'HQ / Field',
      zone: emp.zones?.name || '',
      joiningDate: emp.joining_date,
      status: emp.status === 'active' ? 'Active' : 'Exit In Progress',
      isNewJoiner: false,
    };
    setExitTarget(portalEmp);
  };

  return (
    <div className="space-y-3">
      {/* Top Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-[6px] border border-slate-200">
        {/* Status Filter Bar with 3 Options and live counts */}
        <div
          role="tablist"
          aria-label="Filter employees by status"
          className="inline-flex items-center p-0.5 bg-slate-100 rounded-[6px] border border-slate-200 gap-1 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 text-body font-semibold rounded-[4px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>All Employees</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-caption ${
                statusFilter === 'all'
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'active'}
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 text-body font-semibold rounded-[4px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-caption ${
                statusFilter === 'active'
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {counts.active}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'exit_in_progress'}
            onClick={() => setStatusFilter('exit_in_progress')}
            className={`px-2.5 py-1 text-body font-semibold rounded-[4px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'exit_in_progress'
                ? 'bg-white text-amber-800 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-amber-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Exit In Progress</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-caption ${
                statusFilter === 'exit_in_progress'
                  ? 'bg-amber-100 text-amber-800 font-bold'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {counts.exit_in_progress}
            </span>
          </button>
        </div>

        {/* Search by Name or Code */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="employees-table-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full pl-8 pr-2.5 h-7 text-body bg-slate-50 border border-slate-300 rounded-[6px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-caption text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadEmployees}
            disabled={loading}
            aria-label="Refresh employees list"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table Content */}
      {error ? (
        <div className="p-6 text-center bg-rose-50/70 border border-rose-200 rounded-[6px]">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-1.5" />
          <p className="text-card-heading font-semibold text-rose-900 mb-0.5">Failed to load employees</p>
          <p className="text-caption text-rose-700 max-w-md mx-auto mb-3">{error}</p>
          <Button
            variant="primary"
            size="sm"
            onClick={loadEmployees}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2 bg-white border border-slate-200 rounded-[6px]">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-caption font-medium">Loading employee records...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-[6px]">
          <p className="text-card-heading font-semibold text-slate-700">No employees found</p>
          <p className="text-caption text-slate-400 mt-0.5">
            {debouncedSearch
              ? `No employee records match "${debouncedSearch}".`
              : 'There are currently no employees in this view.'}
          </p>
        </div>
      ) : (
        <Table scroll="x">
          <TableHeader scroll="x">
            <TableRow scroll="x">
              <TableHead>Employee Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody scroll="x">
            {employees.map((emp) => (
              <TableRow key={emp.id} scroll="x">
                {/* 1. Employee code */}
                <TableCell className="font-mono font-bold text-slate-900 whitespace-nowrap">
                  {emp.employee_id}
                </TableCell>

                {/* 2. Name */}
                <TableCell className="whitespace-nowrap">
                  <div className="font-semibold text-slate-900">{toTitleCase(emp.full_name)}</div>
                  {emp.cnic && (
                    <div className="text-caption text-slate-400 font-mono">{emp.cnic}</div>
                  )}
                </TableCell>

                {/* 3. Designation */}
                <TableCell className="text-slate-700 whitespace-nowrap">
                  {emp.designation_name || '—'}
                </TableCell>

                {/* 4. Branch */}
                <TableCell className="text-slate-700 whitespace-nowrap">
                  {emp.branches?.name || '—'}
                </TableCell>

                {/* 5. Joining date */}
                <TableCell className="text-slate-600 whitespace-nowrap">
                  {emp.joining_date || '—'}
                </TableCell>

                {/* 6. Status */}
                <TableCell className="whitespace-nowrap">
                  {emp.status === 'active' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-tag font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-tag font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Exit In Progress
                    </span>
                  )}
                </TableCell>

                {/* 7. Action */}
                <TableCell className="text-right whitespace-nowrap">
                  {emp.status === 'active' ? (
                    canMarkExit ? (
                      <Button
                        variant="danger"
                        size="sm"
                        id={`exit-btn-${emp.employee_id}`}
                        onClick={() => handleOpenExitModal(emp)}
                        leftIcon={<LogOut className="w-3.5 h-3.5" />}
                      >
                        Exit
                      </Button>
                    ) : (
                      <span className="text-slate-400 text-caption">—</span>
                    )
                  ) : (
                    <span className="text-tag font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200/60">
                      In Exit Tracker
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Mark Exit Modal */}
      <MarkExitModal
        isOpen={Boolean(exitTarget)}
        employee={exitTarget}
        actorName={actorName}
        onClose={() => setExitTarget(null)}
        onSuccess={(msg) => {
          setExitTarget(null);
          loadEmployees();
          if (onNotification) {
            onNotification({ type: 'success', text: msg });
          }
        }}
      />
    </div>
  );
};
