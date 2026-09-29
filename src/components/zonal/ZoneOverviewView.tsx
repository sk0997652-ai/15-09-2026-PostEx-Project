import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  UserPlus,
  Shield,
} from 'lucide-react';
import { ZonalMetrics, ZonalStaffProfile } from '../../lib/zonalHrApi';
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

interface ZoneOverviewViewProps {
  metrics: ZonalMetrics | null;
  zoneInfo: { id: string; name: string } | null;
  zoneBranches: Array<{ id: string; name: string }>;
  staffList: ZonalStaffProfile[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToStaff: () => void;
  onOpenAddStaff: () => void;
  onNavigateToHeadcount?: () => void;
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
  onNavigateToHeadcount,
}: ZoneOverviewViewProps) {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const zoneDisplayName = metrics?.zoneName || zoneInfo?.name || 'Zonal HR Command';

  const fetchZoneOverview = async () => {
    const token = await getStaffAccessToken();
    if (!token) return;
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview(
        zoneInfo?.id ? { zoneId: zoneInfo.id } : undefined
      );
      setOverviewData(data);
    } catch {
      // Handled gracefully without triggering global console.error overlay
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchZoneOverview();
  }, [zoneInfo?.id]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchZoneOverview();
  };

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;
  const zoneRows = overviewData?.zone_rows || [];
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];

  return (
    <div id="zonal-hr-overview-view" className="space-y-8">
      {/* Header / Zone Hero */}
      <PageHeader
        title={`${zoneDisplayName} — Zone Overview`}
        description="Zone-scoped Rider vs. In-House Staff headcount rollups, full-width zone flashcard, branch fill-rate status, month-over-month trends, and onboarding pipeline metrics."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary" dot>
              Geographic Region: {metrics?.zoneName || zoneInfo?.name || 'Assigned Zone'}
            </Badge>
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

      {/* ROW 1: 3 Matched KPI Cards (Zone Total Employees / Total Active Riders / Total In-House Staff) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Zone"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
      />

      {/* ROW 2: ONE Full-Width Zone Card + Approved Summary Numbers + "View Full Headcount Report →" */}
      <ZoneBranchFlashcardsSection
        mode="zonal_hr"
        zoneRows={zoneRows}
        branchRows={branchRows}
        summaryTotal={summaryTotal}
        summaryRider={summaryRider}
        summaryInHouse={summaryInHouse}
        fallbackZoneName={zoneDisplayName}
        onInspectZone={(z) => setSelectedEntity({ type: 'zone', data: z })}
        onNavigateToHeadcount={onNavigateToHeadcount}
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* ROW 3: Unified Branch-Wise Headcount Table with Search + Branch/Status Filters */}
      <UnifiedBranchHeadcountTable
        tableId="zonal-branch-headcount-table"
        rowIdPrefix="zonal-branch-row"
        title="Branch-Wise Headcount & Fill-Rate Rollup in Zone"
        description="All operational branches in your assigned zone split by Employment Category (Rider vs. In-House Staff). Click any Branch row to open the Historical Trend Chart and Designation breakdown."
        branchRows={branchRows}
        zoneRows={zoneRows}
        showZoneColumn
        showZoneFilter={false}
        fallbackStaffList={staffList}
        onSelectBranch={(b) => setSelectedEntity({ type: 'branch', data: b })}
      />

      {/* ROW 4: Zone Designation Rollup & Zonal Staff Summary */}
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
                <TableHead hideOnTablet>Department</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Appr / Act / Vac</TableHead>
                <TableHead>Fill-Rate Status</TableHead>
                <TableHead hideOnTablet>Trend</TableHead>
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
                    <TableCell mobileRole="primary" className="font-semibold text-xs text-slate-900">
                      {d.designation_name}
                    </TableCell>
                    <TableCell hideOnTablet mobileRole="field" mobileLabel="Department" className="text-xs text-slate-600">
                      {d.department_name}
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Category">
                      <EmploymentCategoryBadge category={d.employment_category} />
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Appr / Act / Vac" className="md:text-right font-mono text-xs tabular-nums">
                      <span className="font-semibold">{d.approved}</span> /{' '}
                      <span className="font-bold text-indigo-700">{d.active}</span> /{' '}
                      <span className="font-bold text-amber-700">{d.vacancy}</span>
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

        {/* Zonal Staff Summary Card */}
        <Card
          title="Zone HR Staff"
          description="Active Central HR & Branch Manager accounts in this zone."
          action={
            <Button
              variant="link"
              size="small"
              onClick={onNavigateToStaff}
            >
              Manage →
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  CH
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-950">Central HR Reviewers</div>
                  <div className="text-[11px] text-indigo-700">Audit &amp; approve dossiers</div>
                </div>
              </div>
              <span className="text-lg font-black text-indigo-900 font-mono tabular-nums">
                {staffList.filter((s) => s.roles?.name === 'central_hr').length}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                  BM
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Branch Managers</div>
                  <div className="text-[11px] text-slate-500">In-person physical checks</div>
                </div>
              </div>
              <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                {staffList.filter((s) => s.roles?.name === 'branch_manager').length}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2 leading-relaxed">
            <Shield className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span>
              Zonal HR has authorization to create &amp; manage Central HR and Branch Managers in this zone.
            </span>
          </div>
        </Card>
      </div>

      {/* Secondary Zone Pipeline Strip (2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Zone Candidates
            </span>
            <span className="text-xl font-black text-slate-900 font-mono tabular-nums block mt-0.5">
              {metrics?.totalCandidates ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pending Review
            </span>
            <span className="text-xl font-black text-amber-600 font-mono tabular-nums block mt-0.5">
              {metrics?.pendingApplications ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Approved &amp; Onboarded
            </span>
            <span className="text-xl font-black text-emerald-600 font-mono tabular-nums block mt-0.5">
              {metrics?.approvedApplications ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Zone Pipeline &amp; SLA
            </span>
            <span className="text-xl font-black text-indigo-700 font-mono tabular-nums block mt-0.5">
              {metrics?.avgTurnaroundHours ?? 'N/A'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
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
