import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  MapPin,
  RefreshCw,
  FileCheck,
  Clock,
  UserCheck,
} from 'lucide-react';
import { DashboardMetrics } from '../../lib/superAdminApi';
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
  ActiveDefinitionBanner,
  OverviewRowDetailModal,
  SelectedOverviewEntity,
} from '../common/OverviewHeadcountShared';

export interface OverviewMetricsViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
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

export const OverviewMetricsView: React.FC<OverviewMetricsViewProps> = ({
  metrics,
  loading,
  onRefresh,
}) => {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  const fetchOverviewRollup = async () => {
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load Super Admin headcount overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchOverviewRollup();
  }, [metrics]);

  const handleRefreshAll = () => {
    onRefresh();
    fetchOverviewRollup();
  };

  const zoneRows = overviewData?.zone_rows || [];
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];

  const filteredBranches = useMemo(() => {
    if (selectedZoneFilter === 'all') return branchRows;
    return branchRows.filter((b) => b.zone_id === selectedZoneFilter);
  }, [branchRows, selectedZoneFilter]);

  const filteredDesignations = useMemo(() => {
    if (selectedCategoryFilter === 'all') return designationRows;
    return designationRows.filter((d) => d.employment_category === selectedCategoryFilter);
  }, [designationRows, selectedCategoryFilter]);

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;

  return (
    <div id="super-admin-overview-view" className="space-y-6">
      <PageHeader
        title="Super Admin — Executive Headcount & Operations Overview"
        description="Company-wide Rider vs. In-House Staff headcount rollups, fill-rate status, month-over-month trends, and zone/branch drill-downs."
        roleContext="Executive Overview"
        actions={
          <Button
            id="refresh-overview-metrics-btn"
            variant="secondary"
            size="sm"
            onClick={handleRefreshAll}
            disabled={loading || loadingOverview}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loading || loadingOverview ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh Counts</span>
          </Button>
        }
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* Primary Headcount Rollup Cards (Total, Rider, In-House Staff + Pipeline Summary) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Company"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
        extraCard={
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">
                Onboarding Pipeline
              </span>
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <div>
                <span className="text-2xl font-black text-amber-600 font-mono">
                  {metrics?.pendingApplications ?? 0}
                </span>
                <span className="text-xs text-slate-500 ml-1">Pending Review</span>
              </div>
              <Badge variant="info">
                {metrics?.totalCandidates ?? 0} Candidates
              </Badge>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Enrolled: <strong className="text-emerald-700 font-mono">{metrics?.totalEmployees ?? summaryTotal.active}</strong>
              </span>
              <span>
                <strong>{metrics?.totalZones ?? zoneRows.length}</strong> Zones ·{' '}
                <strong>{metrics?.totalBranches ?? branchRows.length}</strong> Hubs
              </span>
            </div>
          </Card>
        }
      />

      {/* Secondary Operational Pipeline Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total Candidates</span>
            <span className="text-xl font-bold text-slate-900 font-mono block mt-0.5">
              {metrics?.totalCandidates ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Approved Applications</span>
            <span className="text-xl font-bold text-emerald-600 font-mono block mt-0.5">
              {metrics?.approvedApplications ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Active Staff Accounts</span>
            <span className="text-xl font-bold text-slate-900 font-mono block mt-0.5">
              {metrics?.totalStaff ?? 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Zones &amp; Branch Hubs</span>
            <span className="text-xl font-bold text-slate-900 font-mono block mt-0.5">
              {metrics?.totalZones ?? zoneRows.length} / {metrics?.totalBranches ?? branchRows.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* SECTION 1: ZONE-WISE HEADCOUNT & FILL-RATE ROLLUP TABLE */}
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
              <TableHead>Branches</TableHead>
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
            {zoneRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-slate-500">
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
                  <TableCell>
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{z.zone_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {z.zone_code || 'NO-CODE'} {z.region ? `· ${z.region}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">
                    {z.branches_count}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-slate-700">{z.rider.approved}</span> /{' '}
                    <span className="font-bold text-indigo-700">{z.rider.active}</span> /{' '}
                    <span className="text-amber-700">{z.rider.vacancy}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-slate-700">{z.in_house.approved}</span> /{' '}
                    <span className="font-bold text-emerald-700">{z.in_house.active}</span> /{' '}
                    <span className="text-amber-700">{z.in_house.vacancy}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {z.total.approved}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-indigo-700">
                    {z.total.active}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-700">
                    {z.total.vacancy}
                  </TableCell>
                  <TableCell>
                    <FillRateStatusBadge
                      status={z.total.fill_rate_status}
                      fillRatePct={z.total.fill_rate_pct}
                    />
                  </TableCell>
                  <TableCell>
                    <TrendIndicator trend={z.total.trend} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* SECTION 2: BRANCH-WISE HEADCOUNT & FILL-RATE ROLLUP TABLE */}
      <Card
        title="Branch-Wise Headcount & Fill-Rate Rollup"
        description="Operational Hub & Branch rollup split by Rider vs. In-House Staff. Click any Branch row to open the Historical Trend Chart and Designation breakdown."
        action={
          <div className="w-56">
            <Select
              id="super-admin-overview-zone-filter"
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Zones (Company-Wide)' },
                ...zoneRows.map((z) => ({
                  value: z.zone_id,
                  label: `${z.zone_name}${z.zone_code ? ` (${z.zone_code})` : ''}`,
                })),
              ]}
            />
          </div>
        }
      >
        <Table id="super-admin-branch-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Branch Hub</TableHead>
              <TableHead>Zone</TableHead>
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
            {filteredBranches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-slate-500">
                  No branches found for the selected zone filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredBranches.map((b) => (
                <TableRow
                  key={b.branch_id}
                  id={`super-admin-branch-row-${b.branch_id}`}
                  onClick={() => setSelectedEntity({ type: 'branch', data: b })}
                  className="cursor-pointer hover:bg-indigo-50/40"
                >
                  <TableCell>
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{b.branch_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {b.branch_code || 'NO-CODE'} · {b.branch_type}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {b.zone_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-slate-700">{b.rider.approved}</span> /{' '}
                    <span className="font-bold text-indigo-700">{b.rider.active}</span> /{' '}
                    <span className="text-amber-700">{b.rider.vacancy}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-slate-700">{b.in_house.approved}</span> /{' '}
                    <span className="font-bold text-emerald-700">{b.in_house.active}</span> /{' '}
                    <span className="text-amber-700">{b.in_house.vacancy}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {b.total.approved}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-indigo-700">
                    {b.total.active}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-700">
                    {b.total.vacancy}
                  </TableCell>
                  <TableCell>
                    <FillRateStatusBadge
                      status={b.total.fill_rate_status}
                      fillRatePct={b.total.fill_rate_pct}
                    />
                  </TableCell>
                  <TableCell>
                    <TrendIndicator trend={b.total.trend} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* SECTION 3: DESIGNATION-WISE ROLLUP TABLE */}
      <Card
        title="Designation-Wise Headcount Rollup"
        description="Company-wide headcount aggregated by Designation and Employment Category. Click any Designation row to inspect its historical trend chart."
        action={
          <div className="w-52">
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
            {filteredDesignations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-500">
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

      {/* Row Click Detail Modal with Full Historical Chart */}
      <OverviewRowDetailModal
        selected={selectedEntity}
        onClose={() => setSelectedEntity(null)}
      />
    </div>
  );
};
