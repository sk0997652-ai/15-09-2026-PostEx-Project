import React from 'react';
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
  const approvalRate =
    metrics?.totalApplications && metrics.totalApplications > 0
      ? `${Math.round((metrics.approvedApplications / metrics.totalApplications) * 100)}%`
      : '100%';

  const rejectionRate =
    metrics?.totalApplications && metrics.totalApplications > 0
      ? `${Math.round((metrics.rejectedApplications / metrics.totalApplications) * 100)}%`
      : '0%';

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
      <Card className="p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Branch Distribution in {zoneName}</h3>
        <Table>
          <thead>
            <tr>
              <th className="py-2.5 px-4 font-semibold text-left">Branch Name</th>
              <th className="py-2.5 px-4 font-semibold text-left">Assigned Branch Managers</th>
              <th className="py-2.5 px-4 font-semibold text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {zoneBranches.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-xs text-slate-500">
                  No branches configured for this zone.
                </td>
              </tr>
            ) : (
              zoneBranches.map((br) => {
                const managers = staffList.filter((s) => s.branches?.id === br.id);
                return (
                  <tr key={br.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{br.name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {managers.length > 0 ? (
                        managers.map((m) => m.name).join(', ')
                      ) : (
                        <span className="text-amber-600 italic">No Manager Assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status="active" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
