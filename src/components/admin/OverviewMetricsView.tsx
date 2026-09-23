import React from 'react';
import {
  Building2,
  Users,
  MapPin,
  RefreshCw,
  FileCheck,
  Clock,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { DashboardMetrics } from '../../lib/superAdminApi';
import { Button, Card, CardContent, PageHeader, Badge } from '../ui';

export interface OverviewMetricsViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onRefresh: () => void;
}

export const OverviewMetricsView: React.FC<OverviewMetricsViewProps> = ({
  metrics,
  loading,
  onRefresh,
}) => {
  return (
    <div id="super-admin-overview-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Executive HR Dashboard"
        description="Live operational counts, headcounts, and organizational metrics from PostEx onboarding backend."
        roleContext="Executive Overview"
        actions={
          <Button
            id="refresh-overview-metrics-btn"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Counts</span>
          </Button>
        }
      />

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 block">Total Candidates</span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <span className="text-3xl font-black text-slate-900 mt-2 block tracking-tight">
            {metrics?.totalCandidates ?? '...'}
          </span>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Company-wide registry</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 block">Pending Applications</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <span className="text-3xl font-black text-amber-600 mt-2 block tracking-tight">
            {metrics?.pendingApplications ?? '...'}
          </span>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>Awaiting verification or decision</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 block">Approved Applications</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <span className="text-3xl font-black text-emerald-600 mt-2 block tracking-tight">
            {metrics?.approvedApplications ?? '...'}
          </span>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>Ready for employee dossiers</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 block">Total Employees</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <span className="text-3xl font-black text-indigo-600 mt-2 block tracking-tight">
            {metrics?.totalEmployees ?? '...'}
          </span>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>Onboarded staff headcount</span>
          </div>
        </Card>
      </div>

      {/* Secondary Operational Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4.5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Active Staff Accounts</span>
            <span className="text-xl font-bold text-slate-900 block mt-0.5">
              {metrics?.totalStaff ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4.5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Geographic Zones</span>
            <span className="text-xl font-bold text-slate-900 block mt-0.5">
              {metrics?.totalZones ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4.5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Branch Hubs</span>
            <span className="text-xl font-bold text-slate-900 block mt-0.5">
              {metrics?.totalBranches ?? 0}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </Card>
      </div>
    </div>
  );
};
