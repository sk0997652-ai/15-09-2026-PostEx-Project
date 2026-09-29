import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
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
} from '../ui';

export interface RecordBrowserViewProps {
  org: OrgStructure | null;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const RecordBrowserView: React.FC<RecordBrowserViewProps> = ({
  org,
  setNotification,
}) => {
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

  return (
    <div id="super-admin-record-browser-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Candidate Directory Browser"
        description="Search and inspect candidates across all zones with pagination and masked CNIC privacy protection."
        roleContext="Company Directory"
        actions={
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
        }
      />

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
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'enrolled').length,
          },
          {
            value: 'submitted',
            label: 'Submitted',
            variant: 'warning',
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'submitted').length,
          },
          {
            value: 'under_review',
            label: 'Under Review',
            variant: 'warning',
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'under_review').length,
          },
          {
            value: 'Action Required',
            label: 'Action Required',
            variant: 'warning',
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'Action Required').length,
          },
          {
            value: 'rejected',
            label: 'Rejected',
            variant: 'error',
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'rejected').length,
          },
          {
            value: 'draft',
            label: 'Draft',
            variant: 'info',
            count: uniqueRecords.filter((r) => (r.applications?.[0]?.status || 'draft') === 'draft').length,
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
                    <TableCell mobileRole="field" mobileLabel="Zone / Branch" className="text-slate-600">
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
    </div>
  );
};
