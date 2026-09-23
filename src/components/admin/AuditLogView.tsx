import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { AuditLogItem, superAdminApi } from '../../lib/superAdminApi';
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
  Badge,
} from '../ui';

export interface AuditLogViewProps {
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ setNotification }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditPagination, setAuditPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  const loadAuditLogsData = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAuditLogs({
        page,
        limit,
        action: auditActionFilter,
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

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <Input
              id="audit-filter-input"
              type="text"
              placeholder="Filter by action name (e.g., regenerate, create, override, data_retention)..."
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAuditLogsData(1, auditPagination.limit)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <Button
            id="audit-filter-btn"
            variant="primary"
            size="sm"
            onClick={() => loadAuditLogsData(1, auditPagination.limit)}
            disabled={loading}
          >
            Filter Logs
          </Button>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Metadata Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-slate-500 whitespace-nowrap font-mono text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 text-xs">{log.actor_type}</TableCell>
                  <TableCell className="text-slate-700 font-mono text-xs">{log.entity_type}</TableCell>
                  <TableCell className="text-slate-500 max-w-md truncate font-mono text-[11px]">
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

        {auditLogs.length > 0 && (
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
