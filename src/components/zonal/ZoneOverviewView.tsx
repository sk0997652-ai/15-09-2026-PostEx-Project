import React, { useState, useEffect } from 'react';
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
import {
  headcountApi,
  HeadcountOverviewResponse,
} from '../../lib/headcountApi';
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';
import {
  FillRateStatusBadge,
  TrendIndicator,
  EmploymentCategoryBadge,
  HeadcountCategoryRollupCards,
  ActiveDefinitionBanner,
  OverviewRowDetailModal,
  SelectedOverviewEntity,
} from '../common/OverviewHeadcountShared';

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

const EMPTY_METRIC_BLOCK = {
  approved: 0,
  active: 0,
  vacancy: 0,
  fill_rate_pct: 0,
  fill_rate_status: 'Critical' as const,
  trend: {
    direction: 'none' as const,
    display: '—',
    delta: null,
    current_active: 0,
    last_month_active: null,
    has_historical_data: false,
  },
};

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
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const zoneDisplayName = metrics?.zoneName || zoneInfo?.name || 'Zonal HR Command';

  const fetchZoneOverview = async () => {
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview(
        zoneInfo?.id ? { zoneId: zoneInfo.id } : undefined
      );
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load Zonal HR headcount overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchZoneOverview();
  }, [zoneInfo?.id, metrics]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchZoneOverview();
  };

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];

  return (
    <div id="zonal-hr-overview-view" className="space-y-6">
      {/* Header / Zone Hero */}
      <PageHeader
        title={zoneDisplayName}
        description="Zone-scoped Rider vs. In-House Staff headcount rollups, branch fill-rate status, month-over-month trends, and onboarding pipeline metrics."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary">
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
              onClick={handleRefreshAll}
              disabled={loading || loadingOverview}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loading || loadingOverview ? 'animate-spin' : ''
                  }`}
                />
              }
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

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* Zone Headcount Rollup Cards (Total, Rider, In-House Staff + Pipeline Turnaround) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Zone"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
        extraCard={
          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Zone Pipeline &amp; SLA</span>
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div className="text-2xl font-black text-indigo-700">
                {metrics?.avgTurnaroundHours ?? 'N/A'}
              </div>
              <Badge variant="warning">{metrics?.pendingApplications ?? 0} Pending</Badge>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Candidates: <strong className="font-mono">{metrics?.totalCandidates ?? 0}</strong>
              </span>
              <span>
                Approved: <strong className="text-emerald-700 font-mono">{metrics?.approvedApplications ?? 0}</strong>
              </span>
            </div>
          </Card>
        }
      />

      {/* Secondary Zone Pipeline Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Zone Candidates</span>
            <span className="text-xl font-black text-slate-900 font-mono block mt-0.5">
              {metrics?.totalCandidates ?? 0}
            </span>
          </div>
          <Users className="w-5 h-5 text-indigo-600" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Pending Review</span>
            <span className="text-xl font-black text-amber-600 font-mono block mt-0.5">
              {metrics?.pendingApplications ?? 0}
            </span>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Approved &amp; Onboarded</span>
            <span className="text-xl font-black text-emerald-600 font-mono block mt-0.5">
              {metrics?.approvedApplications ?? 0}
            </span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </Card>
      </div>

      {/* SECTION 1: ZONE BRANCH-WISE HEADCOUNT & FILL-RATE TABLE */}
      <Card
        title="Branch-Wise Headcount & Fill-Rate Rollup in Zone"
        description="All operational branches in your assigned zone split by Employment Category (Rider vs. In-House Staff). Click any Branch row to open the Historical Trend Chart and Designation breakdown."
        action={
          <Badge variant="primary">
            {branchRows.length || zoneBranches.length} Zone Branches
          </Badge>
        }
      >
        <Table id="zonal-branch-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Branch Manager</TableHead>
              <TableHead>Rider (Appr / Act / Vac)</TableHead>
              <TableHead>In-House Staff (Appr / Act / Vac)</TableHead>
              <TableHead>Total Approved</TableHead>
              <TableHead>Total Active</TableHead>
              <TableHead>Total Vacancy</TableHead>
              <TableHead>Fill-Rate Status</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branchRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-slate-500">
                  No branches currently configured for this zone.
                </TableCell>
              </TableRow>
            ) : (
              branchRows.map((branch) => {
                const localBms =
                  branch.branch_managers.length > 0
                    ? branch.branch_managers.map((m) => m.name).join(', ')
                    : staffList
                        .filter(
                          (s) =>
                            s.branches?.id === branch.branch_id &&
                            s.roles?.name === 'branch_manager'
                        )
                        .map((s) => s.name)
                        .join(', ') || 'No BM assigned';

                return (
                  <TableRow
                    key={branch.branch_id}
                    id={`zonal-branch-row-${branch.branch_id}`}
                    onClick={() => setSelectedEntity({ type: 'branch', data: branch })}
                    className="cursor-pointer hover:bg-indigo-50/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{branch.branch_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {branch.branch_code || 'NO-CODE'} · {branch.branch_type}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">{localBms}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="text-slate-700">{branch.rider.approved}</span> /{' '}
                      <span className="font-bold text-indigo-700">{branch.rider.active}</span> /{' '}
                      <span className="text-amber-700">{branch.rider.vacancy}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="text-slate-700">{branch.in_house.approved}</span> /{' '}
                      <span className="font-bold text-emerald-700">{branch.in_house.active}</span> /{' '}
                      <span className="text-amber-700">{branch.in_house.vacancy}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900">
                      {branch.total.approved}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-indigo-700">
                      {branch.total.active}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-700">
                      {branch.total.vacancy}
                    </TableCell>
                    <TableCell>
                      <FillRateStatusBadge
                        status={branch.total.fill_rate_status}
                        fillRatePct={branch.total.fill_rate_pct}
                      />
                    </TableCell>
                    <TableCell>
                      <TrendIndicator trend={branch.total.trend} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* SECTION 2: ZONE DESIGNATION ROLLUP & ZONAL STAFF SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="lg:col-span-2"
          title="Zone Designation-Wise Headcount Rollup"
          description="Aggregated headcount across all branches in this zone by Designation. Click any row for historical trend details."
        >
          <Table id="zonal-designation-headcount-table">
            <TableHeader>
              <TableRow>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Appr / Act / Vac</TableHead>
                <TableHead>Fill-Rate Status</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {designationRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    No designation headcount entries configured in this zone yet.
                  </TableCell>
                </TableRow>
              ) : (
                designationRows.map((d) => (
                  <TableRow
                    key={d.designation_id}
                    id={`zonal-designation-row-${d.designation_id}`}
                    onClick={() => setSelectedEntity({ type: 'designation', data: d })}
                    className="cursor-pointer hover:bg-indigo-50/40"
                  >
                    <TableCell className="font-semibold text-xs text-slate-900">
                      {d.designation_name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {d.department_name}
                    </TableCell>
                    <TableCell>
                      <EmploymentCategoryBadge category={d.employment_category} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="font-semibold">{d.approved}</span> /{' '}
                      <span className="font-bold text-indigo-700">{d.active}</span> /{' '}
                      <span className="font-bold text-amber-700">{d.vacancy}</span>
                    </TableCell>
                    <TableCell>
                      <FillRateStatusBadge
                        status={d.fill_rate_status}
                        fillRatePct={d.fill_rate_pct}
                      />
                    </TableCell>
                    <TableCell>
                      <TrendIndicator trend={d.trend} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Zonal Staff Summary Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Zone HR Staff</h3>
            <Button
              variant="link"
              size="small"
              onClick={onNavigateToStaff}
              className="text-xs text-indigo-600 font-bold p-0 h-auto"
            >
              Manage
            </Button>
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
            <span>
              Zonal HR has authorization to create &amp; manage Central HR and Branch Managers in this zone.
            </span>
          </div>
        </Card>
      </div>

      {/* Row Click Detail Modal with Full Historical Chart */}
      <OverviewRowDetailModal
        selected={selectedEntity}
        onClose={() => setSelectedEntity(null)}
      />
    </div>
  );
}
