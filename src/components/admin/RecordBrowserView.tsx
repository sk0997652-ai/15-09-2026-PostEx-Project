import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, FilterX } from 'lucide-react';
import {
  OrgStructure,
  CandidateBrowserRecord,
  superAdminApi,
} from '../../lib/superAdminApi';
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
  Input,
  Select,
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
  const [recordPagination, setRecordPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  const loadRecordsData = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getRecords({
        page,
        limit,
        search: recordSearch,
        zone_id: recordZoneFilter,
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
    loadRecordsData(1, recordPagination.limit);
  }, [recordZoneFilter]);

  const uniqueRecords = useMemo(() => {
    const seen = new Set<string>();
    return records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [records]);

  const handleClearFilters = () => {
    setRecordSearch('');
    setRecordZoneFilter('');
    loadRecordsData(1, recordPagination.limit);
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
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[240px]">
            <Input
              id="record-search-input"
              type="text"
              placeholder="Search by candidate name, joining ID, CNIC..."
              value={recordSearch}
              onChange={(e) => setRecordSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRecordsData(1, recordPagination.limit)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="w-44">
            <Select
              id="record-zone-filter-select"
              value={recordZoneFilter}
              onChange={(e) => setRecordZoneFilter(e.target.value)}
            >
              <option value="">All Zones</option>
              {org?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
          </div>

          <Button
            id="record-search-btn"
            variant="primary"
            size="sm"
            onClick={() => loadRecordsData(1, recordPagination.limit)}
            disabled={loading}
          >
            Search
          </Button>

          {(recordSearch || recordZoneFilter) && (
            <Button
              id="record-clear-btn"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-slate-500 hover:text-slate-900"
            >
              <FilterX className="w-4 h-4" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Candidates Table */}
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead>Joining ID</TableHead>
              <TableHead>Masked CNIC</TableHead>
              <TableHead>Zone / Branch</TableHead>
              <TableHead>Application Status</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueRecords.length > 0 ? (
              uniqueRecords.map((r) => {
                const app = r.applications?.[0];
                const rawStatus = app?.status || 'draft';
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <span className="font-bold text-slate-900 block">{r.full_name}</span>
                        <span className="text-xs text-slate-500 font-mono">{r.mobile}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {r.joining_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                        {r.masked_cnic}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <span className="font-medium text-slate-800 block text-xs">
                        {r.zones?.name || '—'}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {r.branches?.name || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rawStatus} dot />
                    </TableCell>
                    <TableCell className="text-slate-400 font-mono text-xs">
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

        {uniqueRecords.length > 0 && (
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
