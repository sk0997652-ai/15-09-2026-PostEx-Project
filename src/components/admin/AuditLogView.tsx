import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { AuditLogItem, superAdminApi } from '../../lib/superAdminApi';
import { useHrPortalStore } from '../../lib/hrPortalStore';
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
  Badge,
} from '../ui';

export interface AuditLogViewProps {
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ setNotification }) => {
  const [store] = useHrPortalStore();
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('');
  const [categoryPill, setCategoryPill] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [auditPagination, setAuditPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  const loadAuditLogsData = async (page = 1, limit = 25, actionOverride?: string) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAuditLogs({
        page,
        limit,
        action: actionOverride !== undefined ? actionOverride : auditActionFilter,
      });
      setAuditLogs(res.logs || []);
      setAuditPagination({
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
    loadAuditLogsData(1, auditPagination.limit);
  }, []);

  const combinedAuditLogs = useMemo(() => {
    const localItems: AuditLogItem[] = (store.auditLogs || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor_id: null,
      actor_type: entry.actor_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      metadata: entry.metadata,
      created_at: entry.created_at,
    }));
    return [...localItems, ...auditLogs];
  }, [store.auditLogs, auditLogs]);

  const filteredLogs = useMemo(() => {
    return combinedAuditLogs.filter((log) => {
      if (
        auditActionFilter.trim() &&
        !(log.action || '').toLowerCase().includes(auditActionFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (actorTypeFilter && log.actor_type !== actorTypeFilter) return false;
      if (categoryPill) {
        const act = (log.action || '').toLowerCase();
        if (categoryPill === 'create' && !act.includes('create') && !act.includes('provision') && !act.includes('import')) return false;
        if (categoryPill === 'security' && !act.includes('password') && !act.includes('permission') && !act.includes('override') && !act.includes('auth')) return false;
        if (categoryPill === 'update' && !act.includes('update') && !act.includes('edit') && !act.includes('status') && !act.includes('exit')) return false;
        if (categoryPill === 'delete' && !act.includes('delete') && !act.includes('remove') && !act.includes('retention')) return false;
      }
      if (dateFrom) {
        const logDate = new Date(log.created_at).toISOString().slice(0, 10);
        if (logDate < dateFrom) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.created_at).toISOString().slice(0, 10);
        if (logDate > dateTo) return false;
      }
      return true;
    });
  }, [combinedAuditLogs, auditActionFilter, actorTypeFilter, categoryPill, dateFrom, dateTo]);

  const handleResetFilters = () => {
    setAuditActionFilter('');
    setActorTypeFilter('');
    setCategoryPill('');
    setDateFrom('');
    setDateTo('');
    loadAuditLogsData(1, auditPagination.limit, '');
  };

  return (
    <div id="super-admin-audit-log-view" className="space-y-6">
      <PageHeader
        title="Super Admin — System Activity Audit Trail"
        description="Immutable audit trail of all security actions, credential regenerations, and organizational updates. Strictly restricted to Super Admin."
        roleContext="Security & Audit"
        actions={
          <Button
            id="refresh-audit-logs-btn"
            variant="secondary"
            size="sm"
            onClick={() => loadAuditLogsData(1, auditPagination.limit)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit Logs</span>
          </Button>
        }
      />

      {/* Search, Actor Filter & Date Range Toolbar */}
      <TableToolbar
        searchInputId="audit-filter-input"
        searchValue={auditActionFilter}
        onSearchChange={setAuditActionFilter}
        onDebouncedSearchChange={(val) => loadAuditLogsData(1, auditPagination.limit, val)}
        onSearchSubmit={() => loadAuditLogsData(1, auditPagination.limit, auditActionFilter)}
        searchPlaceholder="Filter by action name (e.g., regenerate, create, override, data_retention)..."
        filters={[
          {
            id: 'audit-actor-filter-select',
            label: 'Actor Type',
            value: actorTypeFilter,
            onChange: setActorTypeFilter,
            options: [
              { value: '', label: 'All Actors' },
              { value: 'staff', label: 'Staff User' },
              { value: 'system', label: 'System' },
              { value: 'candidate', label: 'Candidate' },
            ],
          },
        ]}
        dateRange={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
          fromId: 'audit-date-from',
          toId: 'audit-date-to',
        }}
        statusPills={[
          { value: '', label: 'All Events', variant: 'info', count: auditLogs.length },
          { value: 'create', label: 'Provision / Create', variant: 'success' },
          { value: 'security', label: 'Security & Permissions', variant: 'warning' },
          { value: 'update', label: 'Updates & Status', variant: 'primary' },
          { value: 'delete', label: 'Deletion & Retention', variant: 'error' },
        ]}
        activeStatus={categoryPill}
        onStatusChange={setCategoryPill}
        hasActiveFilters={Boolean(
          auditActionFilter || actorTypeFilter || categoryPill || dateFrom || dateTo
        )}
        onReset={handleResetFilters}
        actions={
          <Button
            id="audit-filter-btn"
            variant="primary"
            size="sm"
            onClick={() => loadAuditLogsData(1, auditPagination.limit, auditActionFilter)}
            disabled={loading}
          >
            Filter Logs
          </Button>
        }
      />

      {/* Audit Logs Table */}
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead hideOnTablet>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead hideOnTablet>Metadata Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Timestamp"
                    hideOnTablet
                    className="text-slate-500 whitespace-nowrap font-mono text-caption"
                  >
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell mobileRole="primary">
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell mobileRole="status" className="text-slate-600 text-caption">
                    <Badge variant="info" size="sm">
                      {log.actor_type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Entity"
                    className="text-slate-700 font-mono text-caption"
                  >
                    {log.entity_type}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Metadata Details"
                    hideOnTablet
                    className="text-slate-500 max-w-md truncate font-mono text-caption"
                  >
                    {JSON.stringify(log.metadata)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                  {loading ? 'Loading audit trail logs...' : 'No audit logs found matching the filter.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredLogs.length > 0 && (
          <TablePagination
            page={auditPagination.page}
            totalPages={auditPagination.totalPages}
            total={auditPagination.total}
            pageSize={auditPagination.limit}
            pageSizeOptions={[10, 25, 50]}
            onPageSizeChange={(newLimit) => {
              setAuditPagination((p) => ({ ...p, limit: newLimit }));
              loadAuditLogsData(1, newLimit);
            }}
            onPageChange={(newPage) => {
              loadAuditLogsData(newPage, auditPagination.limit);
            }}
          />
        )}
      </div>
    </div>
  );
};
