import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ZonalMetrics, ZonalStaffProfile } from '../../lib/zonalHrApi';
import {
  PageHeader,
  Card,
  StatusBadge,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
} from '../ui';

interface ZoneAnalyticsViewProps {
  metrics: ZonalMetrics | null;
  zoneBranches: Array<{ id: string; name: string }>;
  staffList: ZonalStaffProfile[];
  zoneName: string;
}

export function ZoneAnalyticsView({
  metrics,
  zoneBranches,
  staffList,
  zoneName,
}: ZoneAnalyticsViewProps) {
  const [branchSearch, setBranchSearch] = useState('');
  const [managerStatusFilter, setManagerStatusFilter] = useState('');

  const approvalRate =
    metrics?.totalApplications && metrics.totalApplications > 0
      ? `${Math.round((metrics.approvedApplications / metrics.totalApplications) * 100)}%`
      : '100%';

  const rejectionRate =
    metrics?.totalApplications && metrics.totalApplications > 0
      ? `${Math.round((metrics.rejectedApplications / metrics.totalApplications) * 100)}%`
      : '0%';

  const filteredBranches = useMemo(() => {
    return zoneBranches.filter((br) => {
      const managers = staffList.filter(
        (s) => s.branches?.id === br.id || (s.branch_ids && s.branch_ids.includes(br.id))
      );
      if (branchSearch.trim()) {
        const q = branchSearch.toLowerCase();
        const matchesBranch = br.name.toLowerCase().includes(q);
        const matchesManager = managers.some((m) => m.name.toLowerCase().includes(q));
        if (!matchesBranch && !matchesManager) return false;
      }
      if (managerStatusFilter === 'assigned' && managers.length === 0) return false;
      if (managerStatusFilter === 'unassigned' && managers.length > 0) return false;
      return true;
    });
  }, [zoneBranches, staffList, branchSearch, managerStatusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zone Operational SLA & Analytics"
        description={`Key performance metrics, turnaround benchmarks, and branch breakdown for ${zoneName}.`}
        badge={<Badge variant="primary">Performance Analytics: {zoneName}</Badge>}
      />

      {/* Turnaround & SLA Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold">Average Turnaround</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-indigo-900">{metrics?.avgTurnaroundHours ?? 'N/A'}</div>
          <p className="text-xs text-slate-600 mt-2">
            Calculated from submission timestamp to final HR decision timestamp across all candidates in this zone.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold">Approval Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600">{approvalRate}</div>
          <p className="text-xs text-slate-600 mt-2">
            {metrics?.approvedApplications ?? 0} approved applications out of {metrics?.totalApplications ?? 0} total applications.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold">Rejection Rate</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-600">{rejectionRate}</div>
          <p className="text-xs text-slate-600 mt-2">
            {metrics?.rejectedApplications ?? 0} rejected applications out of {metrics?.totalApplications ?? 0} total applications.
          </p>
        </Card>
      </div>

      {/* Branch Summary Breakdown */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Branch Distribution in {zoneName}</h3>

        <TableToolbar
          searchValue={branchSearch}
          onSearchChange={setBranchSearch}
          searchPlaceholder="Search branch or manager name..."
          statusPills={[
            { value: '', label: 'All Branches', variant: 'info', count: zoneBranches.length },
            { value: 'assigned', label: 'Manager Assigned', variant: 'success' },
            { value: 'unassigned', label: 'Unassigned', variant: 'warning' },
          ]}
          activeStatus={managerStatusFilter}
          onStatusChange={setManagerStatusFilter}
          hasActiveFilters={Boolean(branchSearch || managerStatusFilter)}
          onReset={() => {
            setBranchSearch('');
            setManagerStatusFilter('');
          }}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Assigned Branch Managers</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBranches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-xs text-slate-500">
                  No branches match the selected filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredBranches.map((br) => {
                const managers = staffList.filter(
                  (s) => s.branches?.id === br.id || (s.branch_ids && s.branch_ids.includes(br.id))
                );
                return (
                  <TableRow key={br.id}>
                    <TableCell mobileRole="primary" className="font-bold text-slate-900">
                      {br.name}
                    </TableCell>
                    <TableCell
                      mobileRole="field"
                      mobileLabel="Assigned Branch Managers"
                      className="text-slate-600"
                    >
                      {managers.length > 0 ? (
                        managers.map((m) => m.name).join(', ')
                      ) : (
                        <span className="text-amber-600 italic">No Manager Assigned</span>
                      )}
                    </TableCell>
                    <TableCell mobileRole="status">
                      <StatusBadge status="active" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
