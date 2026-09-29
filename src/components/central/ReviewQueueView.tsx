import React from 'react';
import {
  Search,
  RefreshCw,
  ClipboardList,
  FileText,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Card,
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
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchApplications(1)}
            title="Refresh Queue"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      {/* Search & Filter Toolbar */}
      <TableToolbar
        searchInputId="central-queue-search-input"
        searchValue={queueSearch}
        onSearchChange={setQueueSearch}
        onSearchSubmit={() => fetchApplications(1)}
        searchPlaceholder="Search candidate, CNIC, PX-ID..."
        filters={[
          {
            id: 'central-queue-branch-filter',
            label: 'Filter by Branch',
            value: queueBranchFilter,
            onChange: setQueueBranchFilter,
            options: [
              { value: '', label: 'All Branches' },
              ...formOptions.branches.map((b) => ({
                value: b.id,
                label: b.name,
              })),
            ],
          },
        ]}
        statusPills={[
          { value: 'all', label: 'All Statuses', variant: 'info', count: uniqueApplications.length },
          { value: 'hr_review', label: 'Awaiting HR Review', variant: 'warning' },
          { value: 'needs_correction', label: 'Returned for Correction', variant: 'warning' },
          { value: 'approved', label: 'Approved & Enrolled', variant: 'success' },
          { value: 'rejected', label: 'Rejected', variant: 'error' },
        ]}
        activeStatus={queueStatusFilter}
        onStatusChange={setQueueStatusFilter}
        statusSelectId="central-queue-status-select"
        hasActiveFilters={Boolean(
          queueSearch || queueStatusFilter !== 'all' || queueBranchFilter
        )}
        onReset={() => {
          setQueueSearch('');
          setQueueStatusFilter('all');
          setQueueBranchFilter('');
        }}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchApplications(1)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          >
            Search
          </Button>
        }
      />

      {/* Applications Table */}
      <Card className="overflow-hidden">
        <Table wrapperClassName="md:border-0 md:rounded-none md:shadow-none max-md:p-3">
          <TableHeader>
            <TableRow>
              <TableHead hideOnTablet>Joining ID</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Masked CNIC</TableHead>
              <TableHead>Branch Hub</TableHead>
              <TableHead>Status</TableHead>
              <TableHead hideOnTablet>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                  <span>Loading applications in your assigned zone...</span>
                </TableCell>
              </TableRow>
            ) : uniqueApplications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                  <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">No applications found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Try adjusting your search query or status filter.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              uniqueApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Joining ID"
                    hideOnTablet
                    className="font-mono font-bold text-indigo-700"
                  >
                    {app.candidate?.joining_id || 'N/A'}
                  </TableCell>
                  <TableCell mobileRole="primary">
                    <div className="font-bold text-slate-900">{app.candidate?.full_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{app.candidate?.mobile}</div>
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Masked CNIC"
                    className="font-mono text-slate-700"
                  >
                    {app.candidate?.masked_cnic || app.candidate?.cnic}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Branch Hub"
                    className="text-slate-700"
                  >
                    {app.candidate?.branch_name || 'Assigned Branch'}
                  </TableCell>
                  <TableCell mobileRole="status">
                    <div>
                      <StatusBadge status={app.status} />
                      {app.employee_id && (
                        <div className="text-[10px] font-mono text-emerald-700 font-bold mt-0.5">
                          {app.employee_id}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Submitted"
                    hideOnTablet
                    className="text-slate-500 text-[11px]"
                  >
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}
                  </TableCell>
                  <TableCell mobileRole="actions" className="text-right">
                    <Button
                      id={`view-dossier-btn-${app.id}`}
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenDossier(app.id)}
                      leftIcon={<FileText className="w-3.5 h-3.5" />}
                    >
                      View Dossier &amp; Decision
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {queuePagination.totalPages > 1 && (
          <TablePagination
            page={queuePagination.page}
            totalPages={queuePagination.totalPages}
            total={queuePagination.total}
            onPageChange={(newPage) => fetchApplications(newPage)}
          />
        )}
      </Card>
    </div>
  );
}
