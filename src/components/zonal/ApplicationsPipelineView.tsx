import React, { useMemo, useState } from 'react';
import {
  RefreshCw,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { ZonalApplication } from '../../lib/zonalHrApi';
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
import { toTitleCase } from '../../lib/formatText';

interface ApplicationsPipelineViewProps {
  applications: ZonalApplication[];
  loadingApps: boolean;
  zoneName: string;
  appSearchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  appStatusFilter: string;
  onStatusFilterChange: (status: string) => void;
  appPage: number;
  appTotalPages: number;
  appTotalCount: number;
  onPageChange: (p: number) => void;
  onRefresh: () => void;
  onOpenReassign: (app: ZonalApplication) => void;
  onOpenOverride: (app: ZonalApplication) => void;
}

export function ApplicationsPipelineView({
  applications,
  loadingApps,
  zoneName,
  appSearchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  appStatusFilter,
  onStatusFilterChange,
  appPage,
  appTotalPages,
  appTotalCount,
  onPageChange,
  onRefresh,
  onOpenReassign,
  onOpenOverride,
}: ApplicationsPipelineViewProps) {
  const [branchFilter, setBranchFilter] = useState('');

  // Deduplicate applications by id
  const uniqueApplications = useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((app) => {
      if (!app?.id || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    });
  }, [applications]);

  const branchOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        uniqueApplications
          .map((a) => a.candidate?.branches?.name)
          .filter(Boolean) as string[]
      )
    );
    return names;
  }, [uniqueApplications]);

  const filteredApplications = useMemo(() => {
    return uniqueApplications.filter((app) => {
      if (branchFilter && app.candidate?.branches?.name !== branchFilter) return false;
      return true;
    });
  }, [uniqueApplications, branchFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zone Applications Pipeline"
        description="Search candidates, inspect verification progress, reassign Central HR reviewers, or issue override decisions."
        badge={<Badge variant="primary">Active Pipeline: {zoneName}</Badge>}
        actions={
          <Button
            id="zonal-refresh-apps-btn"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loadingApps}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? 'animate-spin' : ''}`} />}
          >
            Refresh List
          </Button>
        }
      />

      {/* Search & Filter Toolbar */}
      <TableToolbar
        searchInputId="zonal-app-search-input"
        searchValue={appSearchQuery}
        onSearchChange={onSearchQueryChange}
        onSearchSubmit={() => {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          onSearchSubmit(fakeEvent);
        }}
        searchPlaceholder="Search candidate name, Joining ID, or CNIC..."
        filters={
          branchOptions.length > 0
            ? [
                {
                  id: 'zonal-app-branch-filter',
                  label: 'Filter by Branch',
                  value: branchFilter,
                  onChange: setBranchFilter,
                  options: [
                    { value: '', label: 'All Branches' },
                    ...branchOptions.map((b) => ({ value: b, label: b })),
                  ],
                },
              ]
            : []
        }
        statusPills={[
          { value: '', label: 'All Statuses', variant: 'info' },
          { value: 'draft', label: 'Draft', variant: 'info' },
          { value: 'submitted', label: 'Submitted', variant: 'warning' },
          { value: 'bm_verification', label: 'BM Verification', variant: 'warning' },
          { value: 'hr_review', label: 'HR Review', variant: 'warning' },
          { value: 'needs_correction', label: 'Needs Correction', variant: 'warning' },
          { value: 'approved', label: 'Approved', variant: 'success' },
          { value: 'rejected', label: 'Rejected', variant: 'error' },
        ]}
        activeStatus={appStatusFilter}
        onStatusChange={onStatusFilterChange}
        statusSelectId="zonal-app-status-filter"
        hasActiveFilters={Boolean(appSearchQuery || appStatusFilter || branchFilter)}
        onReset={() => {
          onSearchQueryChange('');
          onStatusFilterChange('');
          setBranchFilter('');
        }}
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
              onSearchSubmit(fakeEvent);
            }}
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
              <TableHead>Candidate</TableHead>
              <TableHead hideOnTablet>Masked CNIC</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Assigned Central HR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead hideOnTablet>Stage</TableHead>
              <TableHead className="text-right">Zonal Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingApps ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  <span>Loading applications in {zoneName}...</span>
                </TableCell>
              </TableRow>
            ) : filteredApplications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  No applications matching your filters in this zone.
                </TableCell>
              </TableRow>
            ) : (
              filteredApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell mobileRole="primary">
                    <div className="font-bold text-slate-900">
                      {toTitleCase(app.candidate?.full_name || 'Candidate')}
                    </div>
                    <div className="text-caption text-slate-500 font-mono">
                      {app.candidate?.joining_id}
                    </div>
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Masked CNIC"
                    hideOnTablet
                    className="font-mono text-slate-700"
                  >
                    {app.candidate?.masked_cnic || '*****'}
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Branch"
                    className="text-slate-700"
                  >
                    {app.candidate?.branches?.name || 'Assigned Branch'}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Assigned Central HR">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span>{toTitleCase(app.assigned_central_hr_name)}</span>
                    </div>
                  </TableCell>
                  <TableCell mobileRole="status">
                    <StatusBadge status={app.status} />
                  </TableCell>
                  <TableCell
                    mobileRole="field"
                    mobileLabel="Stage"
                    hideOnTablet
                    className="text-slate-600 font-mono"
                  >
                    Step {app.current_step}/4
                  </TableCell>
                  <TableCell mobileRole="actions" className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        id={`zonal-reassign-btn-${app.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenReassign(app)}
                        title="Reassign application to another Central HR staff member in zone"
                        leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                      >
                        Reassign
                      </Button>
                      <Button
                        id={`zonal-override-btn-${app.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenOverride(app)}
                        title="Issue Zonal HR override decision"
                        leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                      >
                        Override
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredApplications.length > 0 && (
          <TablePagination
            currentPage={appPage}
            totalPages={appTotalPages}
            totalItems={appTotalCount}
            pageSize={10}
            onPageChange={onPageChange}
          />
        )}
      </Card>
    </div>
  );
}
