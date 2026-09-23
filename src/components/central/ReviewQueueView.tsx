import React from 'react';
import {
  Search,
  RefreshCw,
  ClipboardList,
  FileText,
} from 'lucide-react';
import { PageHeader, Button, Card, StatusBadge, Badge } from '../ui';

interface ReviewQueueViewProps {
  applications: any[];
  loading: boolean;
  queueSearch: string;
  setQueueSearch: (s: string) => void;
  queueStatusFilter: string;
  setQueueStatusFilter: (s: string) => void;
  queueBranchFilter: string;
  setQueueBranchFilter: (b: string) => void;
  queuePagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  fetchApplications: (page?: number) => void;
  formOptions: {
    branches: Array<{ id: string; name: string }>;
  };
  zoneName: string;
  onOpenDossier: (applicationId: string) => void;
}

export function ReviewQueueView({
  applications,
  loading,
  queueSearch,
  setQueueSearch,
  queueStatusFilter,
  setQueueStatusFilter,
  queueBranchFilter,
  setQueueBranchFilter,
  queuePagination,
  fetchApplications,
  formOptions,
  zoneName,
  onOpenDossier,
}: ReviewQueueViewProps) {
  // Deduplicate applications
  const uniqueApplications = React.useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((app) => {
      if (!app?.id || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    });
  }, [applications]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Verification Review Queue"
        description={`Applications from candidates in ${zoneName}. Inspect branch verifications and issue enrollment decisions.`}
        badge={<Badge variant="primary">Operational Zone: {zoneName}</Badge>}
      />

      <Card className="p-4 sm:p-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search candidate, CNIC, PX-ID..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchApplications(1)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchApplications(1)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          >
            Search
          </Button>

          <select
            value={queueStatusFilter}
            onChange={(e) => setQueueStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="hr_review">Awaiting HR Review</option>
            <option value="needs_correction">Returned for Correction</option>
            <option value="approved">Approved &amp; Enrolled</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={queueBranchFilter}
            onChange={(e) => setQueueBranchFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="">All Branches</option>
            {formOptions.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {(queueSearch || queueStatusFilter !== 'all' || queueBranchFilter) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQueueSearch('');
                setQueueStatusFilter('all');
                setQueueBranchFilter('');
              }}
            >
              Clear Filters
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchApplications(1)}
            title="Refresh Queue"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Joining ID</th>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Masked CNIC</th>
                <th className="py-3 px-4">Branch Hub</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading applications in your assigned zone...</span>
                  </td>
                </tr>
              ) : uniqueApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">No applications found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try adjusting your search query or status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                uniqueApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {app.candidate?.joining_id || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{app.candidate?.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{app.candidate?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {app.candidate?.masked_cnic || app.candidate?.cnic}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {app.candidate?.branch_name || 'Assigned Branch'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={app.status} />
                      {app.employee_id && (
                        <div className="text-[10px] font-mono text-emerald-700 font-bold mt-0.5">
                          {app.employee_id}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        id={`view-dossier-btn-${app.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenDossier(app.id)}
                        leftIcon={<FileText className="w-3.5 h-3.5" />}
                      >
                        View Dossier &amp; Decision
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {queuePagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {queuePagination.page} of {queuePagination.totalPages} ({queuePagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={queuePagination.page <= 1}
                onClick={() => fetchApplications(queuePagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={queuePagination.page >= queuePagination.totalPages}
                onClick={() => fetchApplications(queuePagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
