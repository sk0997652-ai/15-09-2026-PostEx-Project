import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  MapPin,
  RefreshCw,
  FileCheck,
  Clock,
  UserCheck,
  BarChart3,
} from 'lucide-react';
import { DashboardMetrics } from '../../lib/superAdminApi';
import { getStaffAccessToken } from '../../lib/staffAuth';
import {
  headcountApi,
  HeadcountOverviewResponse,
} from '../../lib/headcountApi';
import {
  Button,
  Card,
  PageHeader,
  Badge,
  Select,
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

export interface OverviewMetricsViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onRefresh: () => void;
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

export const OverviewMetricsView: React.FC<OverviewMetricsViewProps> = ({
  metrics,
  loading,
  onRefresh,
  onNavigateToHeadcount,
}) => {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const fetchOverviewRollup = async () => {
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
    fetchOverviewRollup();
  }, []);

  const handleRefreshAll = () => {
    onRefresh();
    fetchOverviewRollup();
  };

  const zoneRows = overviewData?.zone_rows || [];
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];

  const filteredDesignations = useMemo(() => {
    if (selectedCategoryFilter === 'all') return designationRows;
    return designationRows.filter((d) => d.employment_category === selectedCategoryFilter);
  }, [designationRows, selectedCategoryFilter]);

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;

  return (
    <div id="super-admin-overview-view" className="space-y-8">
      <PageHeader
        title="Executive Headcount & Operations Overview"
        description="Company-wide Rider vs. In-House Staff headcount rollups, zone flashcards, branch fill-rate status, month-over-month trends, and historical drill-downs."
        roleContext="Super Admin · Company-Wide"
        actions={
          <Button
            id="refresh-overview-metrics-btn"
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
            Refresh Counts
          </Button>
        }
      />

      {/* ROW 1: 3 Matched KPI Cards (Total Employees / Total Active Riders / Total In-House Staff) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Company"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
      />

      {/* ROW 2: Geographic Zone Flashcards + Approved Summary Strip + "View Full Headcount Report →" */}
      <ZoneBranchFlashcardsSection
        mode="super_admin"
        zoneRows={zoneRows}
        branchRows={branchRows}
        summaryTotal={summaryTotal}
        summaryRider={summaryRider}
        summaryInHouse={summaryInHouse}
        selectedZoneId={selectedZoneFilter}
        onSelectZoneFilter={setSelectedZoneFilter}
        onInspectZone={(z) => setSelectedEntity({ type: 'zone', data: z })}
        onNavigateToHeadcount={onNavigateToHeadcount}
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* ROW 3: Unified Branch-Wise Headcount Table with Search + Zone/Branch/Status Filters */}
      <UnifiedBranchHeadcountTable
        tableId="super-admin-branch-headcount-table"
        rowIdPrefix="super-admin-branch-row"
        title="Branch-Wise Headcount & Fill-Rate Rollup"
        description="Company-wide operational branches with Branch Manager assignment, Rider vs. In-House Staff approved & active counts, open vacancies, fill-rate status, and historical trend drill-down."
        branchRows={branchRows}
        zoneRows={zoneRows}
        showZoneColumn
        showZoneFilter
        externalZoneFilter={selectedZoneFilter}
        onExternalZoneFilterChange={setSelectedZoneFilter}
        onSelectBranch={(b) => setSelectedEntity({ type: 'branch', data: b })}
      />

      {/* ROW 4: Zone-Wise Rollup Summary Table */}
      <Card
        title="Zone-Wise Headcount & Fill-Rate Rollup"
        description="Company-wide Zone breakdown split by Employment Category (Rider vs. In-House Staff). Click any Zone row to open the Historical Trend Chart and Branch/Designation drill-down."
        action={
          <Badge variant="primary">
            {zoneRows.length} Geographic Zones
          </Badge>
        }
      >
        <Table id="super-admin-zone-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead className="text-right" hideOnTablet>Branches</TableHead>
              <TableHead className="text-right">Rider (Appr / Act / Vac)</TableHead>
              <TableHead className="text-right">In-House Staff (Appr / Act / Vac)</TableHead>
              <TableHead className="text-right" hideOnTablet>Total Approved</TableHead>
              <TableHead className="text-right">Total Active</TableHead>
              <TableHead className="text-right">Total Vacancy</TableHead>
              <TableHead>Fill-Rate Status</TableHead>
              <TableHead hideOnTablet>Trend</TableHead>
              <TableHead className="text-right">Drill-Down</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zoneRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-xs text-slate-500">
                  No zones configured yet. Create zones and headcount entries to view rollups.
                </TableCell>
              </TableRow>
            ) : (
              zoneRows.map((z) => (
                <TableRow
                  key={z.zone_id}
                  id={`super-admin-zone-row-${z.zone_id}`}
                  onClick={() => setSelectedEntity({ type: 'zone', data: z })}
                  className="cursor-pointer hover:bg-indigo-50/40"
                >
                  <TableCell mobileRole="primary">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{z.zone_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {z.zone_code || 'NO-CODE'} {z.region ? `· ${z.region}` : ''}
                    </div>
                  </TableCell>
                  <TableCell hideOnTablet mobileRole="field" mobileLabel="Branches" className="md:text-right font-mono text-xs text-slate-700">
                    {z.branches_count}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Rider (Appr / Act / Vac)" className="md:text-right font-mono text-xs">
                    <span className="text-slate-700">{z.rider.approved}</span> /{' '}
                    <span className="font-bold text-sky-700">{z.rider.active}</span> /{' '}
                    <span className="text-amber-700">{z.rider.vacancy}</span>
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="In-House (Appr / Act / Vac)" className="md:text-right font-mono text-xs">
                    <span className="text-slate-700">{z.in_house.approved}</span> /{' '}
                    <span className="font-bold text-emerald-700">{z.in_house.active}</span> /{' '}
                    <span className="text-amber-700">{z.in_house.vacancy}</span>
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile className="text-right font-mono text-xs font-semibold text-slate-900">
                    {z.total.approved}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Total Active" className="md:text-right font-mono text-xs font-bold text-indigo-700">
                    {z.total.active}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Total Vacancy" className="md:text-right font-mono text-xs font-bold text-amber-700">
                    {z.total.vacancy}
                  </TableCell>
                  <TableCell mobileRole="status">
                    <FillRateStatusBadge
                      status={z.total.fill_rate_status}
                      fillRatePct={z.total.fill_rate_pct}
                    />
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile>
                    <TrendIndicator trend={z.total.trend} />
                  </TableCell>
                  <TableCell mobileRole="actions" className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>History</span>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ROW 5: Designation-Wise Rollup Table */}
      <Card
        title="Designation-Wise Headcount Rollup"
        description="Company-wide headcount aggregated by Designation and Employment Category. Click any Designation row to inspect its historical trend chart."
        action={
          <div className="w-full sm:w-52">
            <Select
              id="super-admin-overview-category-filter"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'Rider', label: 'Rider Only' },
                { value: 'In-House Staff', label: 'In-House Staff Only' },
              ]}
            />
          </div>
        }
      >
        <Table id="super-admin-designation-headcount-table">
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
              <TableHead className="text-right">Drill-Down</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDesignations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-slate-500">
                  No designation headcount entries found for the selected category filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredDesignations.map((d) => (
                <TableRow
                  key={d.designation_id}
                  id={`super-admin-designation-row-${d.designation_id}`}
                  onClick={() => setSelectedEntity({ type: 'designation', data: d })}
                  className="cursor-pointer hover:bg-indigo-50/40"
                >
                  <TableCell mobileRole="primary" className="font-semibold text-xs text-slate-900">
                    {d.designation_name}
                  </TableCell>
                  <TableCell hideOnTablet mobileRole="field" mobileLabel="Department" className="text-xs text-slate-600">
                    {d.department_name}
                    {d.department_code ? ` (${d.department_code})` : ''}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Category">
                    <EmploymentCategoryBadge category={d.employment_category} />
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Approved" className="md:text-right font-mono text-xs font-semibold">
                    {d.approved}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Active" className="md:text-right font-mono text-xs font-bold text-indigo-700">
                    {d.active}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Vacancy" className="md:text-right font-mono text-xs font-bold text-amber-700">
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
                  <TableCell mobileRole="actions" className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>History</span>
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Secondary Operational Pipeline Strip (2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Candidates
            </span>
            <span className="text-xl font-black text-slate-900 font-mono tabular-nums block mt-0.5">
              {metrics?.totalCandidates ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
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
              Approved Applications
            </span>
            <span className="text-xl font-black text-emerald-600 font-mono tabular-nums block mt-0.5">
              {metrics?.approvedApplications ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active Staff Accounts
            </span>
            <span className="text-xl font-black text-indigo-700 font-mono tabular-nums block mt-0.5">
              {metrics?.totalStaff ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
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
};
