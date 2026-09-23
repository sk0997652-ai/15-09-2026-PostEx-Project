import React, { useMemo } from 'react';
import {
  RefreshCw,
  Search,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { ZonalApplication } from '../../lib/zonalHrApi';
import {
  PageHeader,
  Button,
  Card,
  Input,
  Select,
  StatusBadge,
  Badge,
  Table,
  TablePagination,
} from '../ui';

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
  // Deduplicate applications by id
  const uniqueApplications = useMemo(() => {
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
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={onSearchSubmit} className="flex-1 w-full relative flex gap-2">
            <div className="flex-1">
              <Input
                id="zonal-app-search-input"
                placeholder="Search candidate name, Joining ID, or CNIC..."
                value={appSearchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="shrink-0"
            >
              Search
            </Button>
          </form>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-56 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status:</span>
            <Select
              id="zonal-app-status-filter"
              value={appStatusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'bm_verification', label: 'BM Verification' },
                { value: 'hr_review', label: 'HR Review' },
                { value: 'needs_correction', label: 'Needs Correction' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <th className="py-3 px-4 font-semibold text-left">Candidate</th>
              <th className="py-3 px-4 font-semibold text-left">Masked CNIC</th>
              <th className="py-3 px-4 font-semibold text-left">Branch</th>
              <th className="py-3 px-4 font-semibold text-left">Assigned Central HR</th>
              <th className="py-3 px-4 font-semibold text-left">Status</th>
              <th className="py-3 px-4 font-semibold text-left">Stage</th>
              <th className="py-3 px-4 font-semibold text-right">Zonal Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loadingApps ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                  <span>Loading applications in {zoneName}...</span>
                </td>
              </tr>
            ) : uniqueApplications.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No applications matching your filters in this zone.
                </td>
              </tr>
            ) : (
              uniqueApplications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{app.candidate?.full_name || 'Candidate'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{app.candidate?.joining_id}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">
                    {app.candidate?.masked_cnic || '*****'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {app.candidate?.branches?.name || 'Assigned Branch'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span>{app.assigned_central_hr_name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">
                    Step {app.current_step}/4
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        {uniqueApplications.length > 0 && (
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
