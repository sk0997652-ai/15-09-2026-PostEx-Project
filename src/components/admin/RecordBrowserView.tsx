import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download } from 'lucide-react';
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
import { exportRowsToExcel } from '../../lib/hrPortalStore';
import { toTitleCase } from '../../lib/formatText';
import { EmployeesTableView } from '../common/EmployeesTableView';
import { ExitedEmployeesArchiveView } from './ExitedEmployeesArchiveView';

export interface RecordBrowserViewProps {
  org: OrgStructure | null;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const RecordBrowserView: React.FC<RecordBrowserViewProps> = ({
  org,
  setNotification,
}) => {
  const [directoryMode, setDirectoryMode] = useState<'employees' | 'candidates'>('employees');
  const [employeeSubTab, setEmployeeSubTab] = useState<'active_and_exiting' | 'exited_archive'>('active_and_exiting');

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
            {directoryMode === 'candidates' && (
              <Button
                id="export-directory-excel-btn"
                variant="secondary"
                size="sm"
                onClick={handleExportCandidatesExcel}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export to Excel</span>
              </Button>
            )}
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
      <div className="flex border-b border-slate-200 gap-6 text-body font-semibold overflow-x-auto">
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
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              id="subtab-active-employees"
              onClick={() => setEmployeeSubTab('active_and_exiting')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                employeeSubTab === 'active_and_exiting'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Active &amp; Exiting Employees
            </button>
            <button
              type="button"
              id="subtab-exited-archive"
              onClick={() => setEmployeeSubTab('exited_archive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                employeeSubTab === 'exited_archive'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Exited Employees Archive</span>
            </button>
          </div>

          {employeeSubTab === 'active_and_exiting' ? (
            <EmployeesTableView
              role="super_admin"
              actorName="Super Admin"
              onNotification={(notif) => setNotification(notif)}
            />
          ) : (
            <ExitedEmployeesArchiveView
              onNotification={(notif) => setNotification(notif)}
            />
          )}
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
                            <span className="font-bold text-slate-900 block">{toTitleCase(r.full_name)}</span>
                            <span className="text-caption text-slate-500 font-mono">{r.mobile}</span>
                          </div>
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Joining ID" hideOnTablet>
                          <span className="font-mono font-bold text-slate-800 text-body">
                            {r.joining_id}
                          </span>
                        </TableCell>
                        <TableCell mobileRole="field" mobileLabel="Masked CNIC">
                          <span className="font-mono text-body text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                            {r.masked_cnic}
                          </span>
                        </TableCell>
                        <TableCell
                          mobileRole="field"
                          mobileLabel="Zone / Branch"
                          className="text-slate-600"
                        >
                          <span className="font-medium text-slate-800 block text-body">
                            {r.zones?.name || '—'}
                          </span>
                          <span className="text-caption text-slate-400 block">
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
                          className="text-slate-400 font-mono text-body"
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
