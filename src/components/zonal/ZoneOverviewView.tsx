import React from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  BarChart3,
  Building2,
  RefreshCw,
  UserPlus,
  Shield,
} from 'lucide-react';
import { ZonalMetrics, ZonalStaffProfile } from '../../lib/zonalHrApi';
import { PageHeader, Button, Card, Badge } from '../ui';

interface ZoneOverviewViewProps {
  metrics: ZonalMetrics | null;
  zoneInfo: { id: string; name: string } | null;
  zoneBranches: Array<{ id: string; name: string }>;
  staffList: ZonalStaffProfile[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToStaff: () => void;
  onOpenAddStaff: () => void;
}

export function ZoneOverviewView({
  metrics,
  zoneInfo,
  zoneBranches,
  staffList,
  loading,
  onRefresh,
  onNavigateToStaff,
  onOpenAddStaff,
}: ZoneOverviewViewProps) {
  const zoneDisplayName = metrics?.zoneName || zoneInfo?.name || 'Zonal HR Command';

  return (
    <div className="space-y-6">
      {/* Header / Zone Hero */}
      <PageHeader
        title={zoneDisplayName}
        description="Managing onboarding pipelines, Central HR allocations, and Branch Manager operations in this zone."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="neutral">
              Geographic Region: {metrics?.zoneName || zoneInfo?.name || 'Assigned Zone'}
            </Badge>
            {metrics?.zoneId && (
              <span className="text-xs text-slate-500 font-mono">ID: {metrics.zoneId}</span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              id="zonal-refresh-btn"
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refresh Metrics
            </Button>
            <Button
              id="zonal-quick-add-staff-btn"
              variant="primary"
              size="sm"
              onClick={onOpenAddStaff}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Create Zone Staff
            </Button>
          </div>
        }
      />

      {/* Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Candidates</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-slate-900">{metrics?.totalCandidates ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Registered in {metrics?.zoneName || 'this zone'}</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600">{metrics?.pendingApplications ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Awaiting branch/HR decision</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Approved Onboarded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-600">{metrics?.approvedApplications ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Completed &amp; dossiers locked</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Avg Turnaround Time</span>
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{metrics?.avgTurnaroundHours ?? 'N/A'}</div>
          <div className="mt-1 text-[11px] text-slate-500">Submission to final decision</div>
        </Card>
      </div>

      {/* Zone Branches & Operational Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branches in Zone */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Operational Branches in Zone</h3>
              <p className="text-xs text-slate-500">Branches authorized for local candidate document verification.</p>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
              {zoneBranches.length} Branches
            </span>
          </div>

          {zoneBranches.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No branches currently configured for this zone.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {zoneBranches.map((branch) => {
                const branchStaff = staffList.filter((s) => s.branches?.id === branch.id);
                return (
                  <div
                    key={branch.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <span>{branch.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {branchStaff.length} Staff
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>
                        BM:{' '}
                        {branchStaff.length > 0
                          ? branchStaff.map((s) => s.name).join(', ')
                          : 'No BM assigned'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Zonal Staff Summary Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Zone HR Staff</h3>
            <button
              onClick={onNavigateToStaff}
              className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  CH
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-900">Central HR Reviewers</div>
                  <div className="text-[11px] text-indigo-700">Audit &amp; approve dossiers</div>
                </div>
              </div>
              <span className="text-sm font-black text-indigo-900 font-mono">
                {staffList.filter((s) => s.roles?.name === 'central_hr').length}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                  BM
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Branch Managers</div>
                  <div className="text-[11px] text-slate-500">In-person physical checks</div>
                </div>
              </div>
              <span className="text-sm font-black text-slate-800 font-mono">
                {staffList.filter((s) => s.roles?.name === 'branch_manager').length}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span>Zonal HR has authorization to create &amp; manage Central HR and Branch Managers in this zone.</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
