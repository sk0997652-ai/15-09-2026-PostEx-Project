import React from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  FileText,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { BranchApplicationSummary } from './types';
import { PageHeader, Card, Button, StatusBadge, Badge, TablePagination, Input } from '../ui';

interface ApplicationsQueueViewProps {
  applications: BranchApplicationSummary[];
  totalApps: number;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (e: React.FormEvent) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectApp: (id: string) => void;
  onSeedSample: () => void;
  actionLoading: boolean;
  activeTabTitle: string;
}

export function ApplicationsQueueView({
  applications,
  totalApps,
  loading,
  searchQuery,
  setSearchQuery,
  onSearch,
  currentPage,
  totalPages,
  onPageChange,
  onSelectApp,
  onSeedSample,
  actionLoading,
  activeTabTitle,
}: ApplicationsQueueViewProps) {
  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto w-full">
      <PageHeader
        title={activeTabTitle}
        description="Physical verification queue for candidate credentials and digital attestation."
        badge={
          <Badge variant="primary" icon={<Shield className="w-3.5 h-3.5" />}>
            Branch Verification Queue
          </Badge>
        }
      />

      {/* Search & Filter Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={onSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-80">
            <Input
              type="text"
              placeholder="Search name, masked CNIC, or joining ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="default"
          >
            Search
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                onPageChange(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{applications.length}</span> of {totalApps} applications
          </span>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-600 font-medium">Querying branch applications via Postgres RLS...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No applications in this queue</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no candidates awaiting action in this branch queue. Click below to generate a test candidate.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onSeedSample}
              disabled={actionLoading}
              isLoading={actionLoading}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Generate Test Candidate Application
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Joining ID</th>
                  <th className="px-5 py-3">Masked CNIC</th>
                  <th className="px-5 py-3">Documents</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {applications.map((app) => {
                  const cand = app.candidate;
                  const isPending = app.status === 'bm_verification';

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 block">{cand?.full_name || 'Unnamed'}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{cand?.mobile || 'No mobile'}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-800 font-semibold">
                        {cand?.joining_id || 'PX-PENDING'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {cand?.masked_cnic || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          {app.documents_verified} / {app.documents_total} Verified
                        </span>
                        {app.documents_correction_required > 0 && (
                          <span className="block text-[10px] text-rose-600 font-semibold">
                            {app.documents_correction_required} flagged
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant={isPending ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => onSelectApp(app.id)}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          {isPending ? 'Review & Verify' : 'View Details'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalApps}
            pageSize={10}
            onPageChange={onPageChange}
          />
        )}
      </Card>
    </div>
  );
}
