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
import { getStaffAccessToken } from '../../lib/staffAuth';
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
  ZoneBranchFlashcardsSection,
  UnifiedBranchHeadcountTable,
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
  onNavigateToHeadcount?: () => void;
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
  onNavigateToHeadcount,
  onRefresh,
}: CentralOverviewViewProps) {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const fetchCentralOverview = async () => {
    const token = await getStaffAccessToken();
    if (!token) return;
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview();
      setOverviewData(data);
    } catch {
      // Handled gracefully without triggering global console.error overlay
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchCentralOverview();
  }, []);

  const handleRefreshAll = () => {
    onRefresh();
    fetchCentralOverview();
  };

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;
  const zoneRows = overviewData?.zone_rows || [];
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];
  const taggedCount = overviewData?.user?.tagged_branch_ids?.length || 0;

  return (
    <div id="central-hr-overview-view" className="space-y-8">
      <PageHeader
        title="Central HR — Headcount & Operations Overview"
        description="Zone and branch-scoped Rider vs. In-House Staff headcount rollups, branch flashcards, fill-rate status, month-over-month trends, and dossier review queue."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary" dot>
              Operational Zone: {zoneName}
            </Badge>
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

      {/* ROW 1: 3 Matched KPI Cards (Scoped Total Employees / Total Active Riders / Total In-House Staff) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Scoped"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
      />

      {/* ROW 2: Scoped Branch Flashcards + Approved Summary Strip + "View Full Headcount Report →" */}
      <ZoneBranchFlashcardsSection
        mode="central_hr"
        zoneRows={zoneRows}
        branchRows={branchRows}
        summaryTotal={summaryTotal}
        summaryRider={summaryRider}
        summaryInHouse={summaryInHouse}
        fallbackZoneName={zoneName}
        onInspectBranch={(b) => setSelectedEntity({ type: 'branch', data: b })}
        onNavigateToHeadcount={onNavigateToHeadcount}
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* ROW 3: Unified Scoped Branch-Wise Headcount Table with Search + Branch/Status Filters */}
      <UnifiedBranchHeadcountTable
        tableId="central-branch-headcount-table"
        rowIdPrefix="central-branch-row"
        title="Branch-Wise Headcount & Fill-Rate Rollup"
        description="Branches within your assigned scope split by Employment Category (Rider vs. In-House Staff). Click any Branch row to open the Historical Trend Chart and Designation breakdown."
        branchRows={branchRows}
        zoneRows={zoneRows}
        showZoneColumn
        showZoneFilter={false}
        onSelectBranch={(b) => setSelectedEntity({ type: 'branch', data: b })}
      />

      {/* ROW 4: Designation-Wise Headcount Rollup Table */}
      <Card
        title="Designation-Wise Headcount Rollup"
        description="Aggregated Approved, Active, Vacancy, Fill-Rate Status, and Trend by Designation across your scoped branches. Click any row for historical trend details."
      >
        <Table id="central-designation-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Designation</TableHead>
              <TableHead hideOnTablet>Department</TableHead>
              <TableHead>Employment Category</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Vacancy</TableHead>
              <TableHead>Fill-Rate Status</TableHead>
              <TableHead hideOnTablet>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {designationRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-caption text-slate-500">
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
                  <TableCell mobileRole="primary" className="font-semibold text-body text-slate-900">
                    {d.designation_name}
                  </TableCell>
                  <TableCell hideOnTablet mobileRole="field" mobileLabel="Department" className="text-body text-slate-600">
                    {d.department_name}
                    {d.department_code ? ` (${d.department_code})` : ''}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Category">
                    <EmploymentCategoryBadge category={d.employment_category} />
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Approved" className="md:text-right font-mono text-body font-semibold">
                    {d.approved}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Active" className="md:text-right font-mono text-body font-bold text-indigo-700">
                    {d.active}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Vacancy" className="md:text-right font-mono text-body font-bold text-amber-700">
                    {d.vacancy}
                  </TableCell>
                  <TableCell mobileRole="status">
                    <FillRateStatusBadge
                      status={d.fill_rate_status}
                      fillRatePct={d.fill_rate_pct}
                    />
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile>
                    <TrendIndicator trend={d.trend} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Secondary Pipeline Metric Strip (2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-table-header uppercase text-slate-500">
              Dossier Review Queue
            </span>
            <span className="text-kpi-number text-amber-600 font-mono tabular-nums block mt-0.5">
              {metrics?.pendingReviewCount ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-table-header uppercase text-slate-500">
              Returned For Correction
            </span>
            <span className="text-kpi-number text-rose-600 font-mono tabular-nums block mt-0.5">
              {metrics?.needsCorrectionCount ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <RotateCcw className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-table-header uppercase text-slate-500">
              Enrolled Employees
            </span>
            <span className="text-kpi-number text-emerald-600 font-mono tabular-nums block mt-0.5">
              {metrics?.enrolledCount ?? summaryTotal.active}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-table-header uppercase text-slate-500">
              Scoped Operational Branches
            </span>
            <span className="text-kpi-number text-indigo-700 font-mono tabular-nums block mt-0.5">
              {branchRows.length || (metrics?.branchesCount ?? 0)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 text-tag uppercase mb-2">
              <UserPlus className="w-4 h-4" />
              <span>Candidate Intake</span>
            </div>
            <h3 className="text-card-heading text-slate-900">
              Issue Joining ID &amp; Trigger Onboarding
            </h3>
            <p className="text-body text-slate-600 mt-2">
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
            <div className="flex items-center gap-2 text-amber-700 text-tag uppercase mb-2">
              <ClipboardList className="w-4 h-4" />
              <span>Dossier Decision Desk</span>
            </div>
            <h3 className="text-card-heading text-slate-900">
              Review BM-Verified Candidates
            </h3>
            <p className="text-body text-slate-600 mt-2">
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
