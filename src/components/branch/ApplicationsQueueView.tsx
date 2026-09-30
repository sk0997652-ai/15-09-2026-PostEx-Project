import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  Clock,
  Sparkles,
  FileText,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { BranchApplicationSummary } from './types';
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
  TableToolbar,
} from '../ui';
import { toTitleCase } from '../../lib/formatText';

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
  const [docStatusFilter, setDocStatusFilter] = useState('');

  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      if (docStatusFilter === 'flagged' && app.documents_correction_required === 0) return false;
      if (
        docStatusFilter === 'all_verified' &&
        (app.documents_total === 0 || app.documents_verified < app.documents_total)
      )
        return false;
      if (
        docStatusFilter === 'pending_docs' &&
        app.documents_verified >= app.documents_total &&
        app.documents_correction_required === 0
      )
        return false;
      return true;
    });
  }, [applications, docStatusFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto w-full">
      <PageHeader
        title={activeTabTitle}
        description="Physical verification queue for candidate credentials and digital attestation."
        badge={
          <Badge variant="primary" icon={<Shield className="w-3.5 h-3.5" />}>
            Branch Verification Queue
          </Badge>
        }
      />

      {/* Search & Filter Toolbar */}
      <TableToolbar
        searchInputId="branch-queue-search-input"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          onSearch(fakeEvent);
        }}
        searchPlaceholder="Search name, masked CNIC, or joining ID..."
        statusPills={[
          { value: '', label: 'All Candidates', variant: 'info', count: applications.length },
          {
            value: 'pending_docs',
            label: 'Docs Pending Review',
            variant: 'warning',
            count: applications.filter(
              (a) => a.documents_verified < a.documents_total && a.documents_correction_required === 0
            ).length,
          },
          {
            value: 'all_verified',
            label: 'All Docs Verified',
            variant: 'success',
            count: applications.filter(
              (a) => a.documents_total > 0 && a.documents_verified >= a.documents_total
            ).length,
          },
          {
            value: 'flagged',
            label: 'Correction Flagged',
            variant: 'error',
            count: applications.filter((a) => a.documents_correction_required > 0).length,
          },
        ]}
        activeStatus={docStatusFilter}
        onStatusChange={setDocStatusFilter}
        hasActiveFilters={Boolean(searchQuery || docStatusFilter)}
        onReset={() => {
          setSearchQuery('');
          setDocStatusFilter('');
          onPageChange(1);
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                onSearch(fakeEvent);
              }}
            >
              Search
            </Button>
            <span className="text-caption text-slate-500 hidden sm:inline">
              Showing <span className="font-bold text-slate-800">{filteredApps.length}</span> of{' '}
              {totalApps}
            </span>
          </div>
        }
      />

      {/* Applications Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-caption text-slate-600 font-medium">Loading branch applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-card-heading text-slate-900">{toTitleCase('No Applications In This Queue')}</h3>
            <p className="text-caption text-slate-500 max-w-sm mx-auto">
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
          <Table wrapperClassName="md:border-0 md:rounded-none md:shadow-none max-md:p-3">
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead hideOnTablet>Joining ID</TableHead>
                <TableHead>Masked CNIC</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    No applications match the selected filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredApps.map((app) => {
                  const cand = app.candidate;
                  const isPending = app.status === 'bm_verification';

                  return (
                    <TableRow key={app.id}>
                      <TableCell mobileRole="primary">
                        <span className="font-bold text-slate-900 block">
                          {toTitleCase(cand?.full_name || 'Unnamed')}
                        </span>
                        <span className="text-caption text-slate-500 font-mono">
                          {cand?.mobile || 'No mobile'}
                        </span>
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Joining ID"
                        hideOnTablet
                        className="font-mono text-slate-800 font-semibold"
                      >
                        {cand?.joining_id || 'PX-PENDING'}
                      </TableCell>
                      <TableCell
                        mobileRole="field"
                        mobileLabel="Masked CNIC"
                        className="font-mono text-slate-600"
                      >
                        {cand?.masked_cnic || 'N/A'}
                      </TableCell>
                      <TableCell mobileRole="field" mobileLabel="Documents">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          {app.documents_verified} / {app.documents_total} Verified
                        </span>
                        {app.documents_correction_required > 0 && (
                          <span className="block text-tag text-rose-600">
                            {app.documents_correction_required} flagged
                          </span>
                        )}
                      </TableCell>
                      <TableCell mobileRole="status">
                        <StatusBadge status={app.status} size="sm" />
                      </TableCell>
                      <TableCell mobileRole="actions" className="text-right">
                        <Button
                          variant={isPending ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => onSelectApp(app.id)}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          {isPending ? 'Review & Verify' : 'View Details'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
