import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  ClipboardList,
  UserCheck,
  Building2,
  Clock,
  RotateCcw,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
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

interface CentralOverviewViewProps {
  metrics: {
    zoneId?: string;
    zoneName: string;
    totalCandidates: number;
    totalApplications: number;
    pendingReviewCount: number;
    needsCorrectionCount: number;
    approvedCount: number;
    rejectedCount: number;
    enrolledCount: number;
    branchesCount: number;
    branches: Array<{ id: string; name: string }>;
  } | null;
  zoneName: string;
  onNavigateToCreateJoiner: () => void;
  onNavigateToReviewQueue: () => void;
  onRefresh: () => void;
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

export function CentralOverviewView({
  metrics,
  zoneName,
  onNavigateToCreateJoiner,
  onNavigateToReviewQueue,
  onRefresh,
}: CentralOverviewViewProps) {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const fetchCentralOverview = async () => {
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load Central HR headcount overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchCentralOverview();
  }, [metrics]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchCentralOverview();
  };

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];
  const taggedCount = overviewData?.user?.tagged_branch_ids?.length || 0;

  return (
    <div id="central-hr-overview-view" className="space-y-6">
      <PageHeader
        title="Central HR — Headcount & Operations Overview"
        description="Zone and branch-scoped Rider vs. In-House Staff headcount rollups, fill-rate status, month-over-month trends, and dossier review queue."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary">Operational Zone: {zoneName}</Badge>
            {taggedCount > 0 && (
              <Badge variant="info">
                {taggedCount} Tagged Branch{taggedCount === 1 ? '' : 'es'}
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              id="central-refresh-metrics-btn"
              variant="secondary"
              size="sm"
              onClick={handleRefreshAll}
              disabled={loadingOverview}
              leftIcon={
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`}
                />
              }
            >
              Refresh Metrics
            </Button>
            <Button
              id="central-quick-create-joiner-btn"
              variant="primary"
              size="sm"
              onClick={onNavigateToCreateJoiner}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Register New Joiner
            </Button>
          </div>
        }
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* Primary Headcount Rollup Cards (Total, Rider, In-House Staff + Review Queue) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Scoped"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
        extraCard={
          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
              <span>Dossier Review Queue</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div className="text-2xl font-black text-slate-900 font-mono">
                {metrics?.pendingReviewCount ?? 0}
              </div>
              <Badge variant="warning">Awaiting HR Review</Badge>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Correction: <strong className="text-rose-600 font-mono">{metrics?.needsCorrectionCount ?? 0}</strong>
              </span>
              <span>
                Enrolled: <strong className="text-emerald-700 font-mono">{metrics?.enrolledCount ?? summaryTotal.active}</strong>
              </span>
            </div>
          </Card>
        }
      />

      {/* Secondary Pipeline Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Returned for Correction</span>
            <span className="text-xl font-black text-slate-900 font-mono block mt-0.5">
              {metrics?.needsCorrectionCount ?? 0}
            </span>
          </div>
          <RotateCcw className="w-5 h-5 text-rose-600" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Enrolled Employees</span>
            <span className="text-xl font-black text-slate-900 font-mono block mt-0.5">
              {metrics?.enrolledCount ?? summaryTotal.active}
            </span>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Scoped Operational Branches</span>
            <span className="text-xl font-black text-slate-900 font-mono block mt-0.5">
              {branchRows.length || (metrics?.branchesCount ?? 0)}
            </span>
          </div>
          <Building2 className="w-5 h-5 text-indigo-600" />
        </Card>
      </div>

      {/* SECTION 1: SCOPED BRANCH-WISE HEADCOUNT & FILL-RATE TABLE */}
      <Card
        title="Branch-Wise Headcount & Fill-Rate Rollup"
        description="Branches within your assigned scope split by Employment Category (Rider vs. In-House Staff). Click any Branch row to open the Historical Trend Chart and Designation breakdown."
        action={
          <Badge variant="primary">
            {branchRows.length} Scoped Branch{branchRows.length === 1 ? '' : 'es'}
          </Badge>
        }
      >
        <Table id="central-branch-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
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
                <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-500">
                  No branches currently configured in your assigned scope.
                </TableCell>
              </TableRow>
            ) : (
              branchRows.map((branch) => (
                <TableRow
                  key={branch.branch_id}
                  id={`central-branch-row-${branch.branch_id}`}
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* SECTION 2: DESIGNATION-WISE HEADCOUNT ROLLUP TABLE */}
      <Card
        title="Designation-Wise Headcount Rollup"
        description="Aggregated Approved, Active, Vacancy, Fill-Rate Status, and Trend by Designation across your scoped branches. Click any row for historical trend details."
      >
        <Table id="central-designation-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employment Category</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Vacancy</TableHead>
              <TableHead>Fill-Rate Status</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {designationRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-500">
                  No designation headcount entries configured in your scope yet.
                </TableCell>
              </TableRow>
            ) : (
              designationRows.map((d) => (
                <TableRow
                  key={d.designation_id}
                  id={`central-designation-row-${d.designation_id}`}
                  onClick={() => setSelectedEntity({ type: 'designation', data: d })}
                  className="cursor-pointer hover:bg-indigo-50/40"
                >
                  <TableCell className="font-semibold text-xs text-slate-900">
                    {d.designation_name}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {d.department_name}
                    {d.department_code ? ` (${d.department_code})` : ''}
                  </TableCell>
                  <TableCell>
                    <EmploymentCategoryBadge category={d.employment_category} />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">
                    {d.approved}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-indigo-700">
                    {d.active}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-700">
                    {d.vacancy}
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

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <UserPlus className="w-4 h-4" />
              <span>Candidate Intake</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Issue Joining ID &amp; Trigger Onboarding
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Create new joiner profile with mandatory Pakistani CNIC (13 digits), mobile, email, and designation. Automated system assigns unique{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">
                PX-YYYY-XXXXXX
              </code>{' '}
              Joining ID and sends instant SMS/email notifications.
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              className="w-full"
              onClick={onNavigateToCreateJoiner}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Open Registration Form
            </Button>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
              <ClipboardList className="w-4 h-4" />
              <span>Dossier Decision Desk</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Review BM-Verified Candidates
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Inspect physical verification marks from Branch Managers, uploaded documents, career &amp; education histories, and issue formal decision: <strong>Approve &amp; Enrol</strong> (generates Employee ID and compiled PDF Dossier), <strong>Return for Correction</strong> (select unlock sections), or <strong>Reject</strong>.
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              className="w-full"
              onClick={onNavigateToReviewQueue}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Open Review Queue ({metrics?.pendingReviewCount ?? 0} Pending)
            </Button>
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
