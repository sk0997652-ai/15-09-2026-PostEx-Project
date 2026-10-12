// ==============================================================================
// PostEx HR Onboarding Portal — Exited Employees Archive (Step 11A & Step 14D)
// Read-only company-wide exit archive restricted to Super Admin
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { exitsApi, CompletedExitItem } from '../../lib/exitsApi';
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  Badge,
} from '../ui';
import { toTitleCase } from '../../lib/formatText';

export interface ExitedEmployeesArchiveViewProps {
  onNotification?: (notif: { type: 'success' | 'error'; text: string }) => void;
}

export const ExitedEmployeesArchiveView: React.FC<ExitedEmployeesArchiveViewProps> = ({
  onNotification,
}) => {
  const [exits, setExits] = useState<CompletedExitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadCompletedExits = useCallback(
    async (page = 1, limit = 10) => {
      setLoading(true);
      setError(null);
      try {
        const res = await exitsApi.getCompletedExits({ page, limit });
        if (res.success) {
          setExits(res.exits || []);
          setPagination({
            page: res.pagination?.page || 1,
            limit: res.pagination?.limit || 10,
            total: res.pagination?.total || 0,
            totalPages: res.pagination?.totalPages || 1,
          });
        } else {
          throw new Error(res.error || 'Failed to load exited employees.');
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
    },
    [onNotification]
  );

  useEffect(() => {
    loadCompletedExits(pagination.page, pagination.limit);
  }, [loadCompletedExits]);

  const handleDownloadPdf = async (exit: CompletedExitItem) => {
    setDownloadingId(exit.id);
    try {
      await exitsApi.downloadExitPdf(exit.id, exit.employee_code);
      if (onNotification) {
        onNotification({
          type: 'success',
          text: `ECF PDF downloaded for ${exit.employee_code} (${exit.name}).`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (onNotification) {
        onNotification({ type: 'error', text: msg });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const getExitTypeBadge = (type: string) => {
    switch (type) {
      case 'resignation':
        return <Badge variant="neutral">Resignation</Badge>;
      case 'termination':
        return <Badge variant="error">Termination</Badge>;
      case 'absconding':
        return <Badge variant="warning">Absconding</Badge>;
      default:
        return <Badge variant="neutral">{type || 'Exit'}</Badge>;
    }
  };

  return (
    <div id="exited-employees-archive-view" className="space-y-3">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-[6px] border border-slate-200">
        <div>
          <h3 className="text-card-heading font-bold text-slate-900 flex items-center gap-2">
            <span>Exited Employees Archive</span>
            <Badge variant="neutral">
              {pagination.total} records
            </Badge>
          </h3>
          <p className="text-caption text-slate-500 mt-0.5">
            Permanent, read-only lifecycle record of all fully cleared and completed employee exits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="refresh-exited-archive-btn"
            variant="secondary"
            size="sm"
            onClick={() => loadCompletedExits(pagination.page, pagination.limit)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-center gap-2 text-rose-800 text-body">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <Table scroll="x">
        <TableHeader scroll="x">
          <TableRow scroll="x">
            <TableHead>Employee</TableHead>
            <TableHead>Branch / Zone</TableHead>
            <TableHead>Exit Type</TableHead>
            <TableHead>Last Working Date</TableHead>
            <TableHead>Completed Date</TableHead>
            <TableHead>Completed By</TableHead>
            <TableHead>ECF PDF</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody scroll="x">
          {loading && exits.length === 0 ? (
            <TableRow scroll="x">
              <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                <span>Loading exited records...</span>
              </TableCell>
            </TableRow>
          ) : exits.length === 0 ? (
            <TableRow scroll="x">
              <TableCell colSpan={8} className="py-12 text-center text-slate-400">
                <FileText className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                <p className="font-medium text-slate-600">No completed exit records found.</p>
                <p className="text-caption text-slate-400 mt-0.5">
                  Employees with fully completed clearance will be permanently archived here.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            exits.map((exit) => (
              <TableRow key={exit.id} id={`exited-row-${exit.employee_code}`} scroll="x">
                {/* Employee Code & Name */}
                <TableCell className="whitespace-nowrap">
                  <div>
                    <span className="font-bold text-slate-900 block text-body">
                      {toTitleCase(exit.name || exit.employee_name || '—')}
                    </span>
                    <span className="font-mono text-caption font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-[4px] border border-indigo-100 inline-block mt-0.5">
                      {exit.employee_code}
                    </span>
                    {exit.designation && (
                      <span className="text-caption text-slate-400 block mt-0.5">
                        {exit.designation}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Branch / Zone */}
                <TableCell className="whitespace-nowrap">
                  <div>
                    <span className="font-medium text-slate-800 block text-body">
                      {exit.branch || 'Head Office'}
                    </span>
                    <span className="text-caption text-slate-400 block">
                      {exit.zone || '—'}
                    </span>
                  </div>
                </TableCell>

                {/* Exit Type */}
                <TableCell className="whitespace-nowrap">
                  {getExitTypeBadge(exit.exit_type)}
                </TableCell>

                {/* Last Working Date */}
                <TableCell className="text-body text-slate-700 whitespace-nowrap">
                  {exit.last_working_date || '—'}
                </TableCell>

                {/* Completed At */}
                <TableCell className="text-body text-slate-600 whitespace-nowrap">
                  {exit.completed_at ? (
                    <div>
                      <span className="font-medium block">
                        {new Date(exit.completed_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-caption text-slate-400 block">
                        {new Date(exit.completed_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>

                {/* Completed By */}
                <TableCell className="text-body text-slate-700 font-medium whitespace-nowrap">
                  {exit.completed_by || 'Staff User'}
                </TableCell>

                {/* ECF PDF Status */}
                <TableCell className="whitespace-nowrap">
                  {exit.pdf_generated_at ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-tag font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Downloaded</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-tag font-medium bg-slate-50 text-slate-500 border border-slate-200">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Not downloaded</span>
                    </span>
                  )}
                </TableCell>

                {/* Action: Download ECF PDF */}
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    id={`download-ecf-btn-${exit.employee_code}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownloadPdf(exit)}
                    disabled={downloadingId === exit.id}
                    leftIcon={
                      downloadingId === exit.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    <span>{downloadingId === exit.id ? 'Downloading...' : 'Download ECF PDF'}</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {exits.length > 0 && (
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit}
          pageSizeOptions={[10, 25, 50]}
          onPageSizeChange={(newLimit) => {
            setPagination((p) => ({ ...p, limit: newLimit }));
            loadCompletedExits(1, newLimit);
          }}
          onPageChange={(newPage) => {
            loadCompletedExits(newPage, pagination.limit);
          }}
        />
      )}
    </div>
  );
};
