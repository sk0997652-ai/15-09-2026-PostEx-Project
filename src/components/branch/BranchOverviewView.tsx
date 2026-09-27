import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Building2,
  MapPin,
  RefreshCw,
  Search,
  BarChart3,
} from 'lucide-react';
import {
  headcountApi,
  HeadcountOverviewResponse,
} from '../../lib/headcountApi';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
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
  ActiveDefinitionBanner,
  OverviewRowDetailModal,
  SelectedOverviewEntity,
} from '../common/OverviewHeadcountShared';

interface BranchOverviewViewProps {
  currentUser: {
    branch_name: string;
    branch_id: string;
    zone_name: string;
    zone_id: string;
  };
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

export function BranchOverviewView({
  currentUser,
  onNavigateToHeadcount,
}: BranchOverviewViewProps) {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchBranchOverview = async () => {
    setLoadingOverview(true);
    try {
      const data = await headcountApi.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Failed to load Branch Manager headcount overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchBranchOverview();
  }, [currentUser.branch_id]);

  const summaryTotal = overviewData?.summary?.total || EMPTY_METRIC_BLOCK;
  const summaryRider = overviewData?.summary?.rider || EMPTY_METRIC_BLOCK;
  const summaryInHouse = overviewData?.summary?.in_house || EMPTY_METRIC_BLOCK;
  const zoneRows = overviewData?.zone_rows || [];
  const branchRows = overviewData?.branch_rows || [];
  const designationRows = overviewData?.designation_rows || [];
  const primaryBranch = branchRows[0] || null;

  const filteredDesignations = useMemo(() => {
    return designationRows.filter((d) => {
      if (categoryFilter !== 'all' && d.employment_category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && d.fill_rate_status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          d.designation_name.toLowerCase().includes(q) ||
          d.department_name.toLowerCase().includes(q) ||
          (d.department_code || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [designationRows, categoryFilter, statusFilter, searchQuery]);

  return (
    <div id="branch-manager-overview-view" className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Branch Overview — Headcount & Governance"
        description="Branch-scoped Rider vs. In-House Staff headcount rollups, branch hub flashcard, per-designation fill-rate status, month-over-month trends, and physical verification governance."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary" dot>
              Branch Hub: {primaryBranch?.branch_name || currentUser.branch_name}
            </Badge>
            <Badge variant="info">
              Zone: {primaryBranch?.zone_name || currentUser.zone_name}
            </Badge>
          </div>
        }
        actions={
          <Button
            id="bm-overview-refresh-btn"
            variant="secondary"
            size="sm"
            onClick={fetchBranchOverview}
            disabled={loadingOverview}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`}
              />
            }
          >
            Refresh Headcount
          </Button>
        }
      />

      {/* ROW 1: 3 Matched KPI Cards (Branch Total Employees / Total Active Riders / Total In-House Staff) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Branch"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
      />

      {/* ROW 2: Assigned Branch Hub Flashcard + Approved Summary Numbers + "View Full Headcount Report →" */}
      <ZoneBranchFlashcardsSection
        mode="branch_manager"
        zoneRows={zoneRows}
        branchRows={branchRows}
        summaryTotal={summaryTotal}
        summaryRider={summaryRider}
        summaryInHouse={summaryInHouse}
        fallbackZoneName={currentUser.zone_name}
        fallbackBranchName={currentUser.branch_name}
        designationsCount={designationRows.length}
        onInspectBranch={(b) => setSelectedEntity({ type: 'branch', data: b })}
        onNavigateToHeadcount={onNavigateToHeadcount}
      />

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* ROW 3: Branch Designation-Wise Headcount & Fill-Rate Table with Search + Filters */}
      <Card
        title="Branch Designation-Wise Headcount & Fill-Rate Status"
        description="Approved headcount targets, live active enrolled employees, open vacancies, fill-rate status, and month-over-month trends for your branch. Click any row to open the Historical Trend Chart."
        action={
          <Badge variant="primary">
            {filteredDesignations.length} of {designationRows.length} Configured Designation
            {designationRows.length === 1 ? '' : 's'}
          </Badge>
        }
      >
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="bm-designation-search"
            placeholder="Search designation or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <Select
            id="bm-designation-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'Rider', label: 'Rider Only' },
              { value: 'In-House Staff', label: 'In-House Staff Only' },
            ]}
          />
          <Select
            id="bm-designation-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Fill-Rate Statuses' },
              { value: 'On Target', label: 'On Target (≥95%)' },
              { value: 'Understaffed', label: 'Understaffed (80–94%)' },
              { value: 'Critical', label: 'Critical (<80%)' },
            ]}
          />
        </div>

        <Table id="branch-manager-designation-headcount-table">
          <TableHeader>
            <TableRow>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employment Category</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Vacancy</TableHead>
              <TableHead>Fill-Rate Status</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead className="text-right">Drill-Down</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDesignations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-slate-500">
                  No designation headcount entries match the active search or filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredDesignations.map((d) => (
                <TableRow
                  key={d.designation_id}
                  id={`bm-designation-row-${d.designation_id}`}
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
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {d.approved}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-indigo-700 tabular-nums">
                    {d.active}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-amber-700 tabular-nums">
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
                  <TableCell className="text-right">
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

      {/* ROW 4: Branch Identity & Verification Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Branch Identity & Access Scope"
          description="You can only view and manage records for your assigned branch."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Branch Name &amp; ID
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1.5">
                {currentUser.branch_name}
              </p>
              <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {currentUser.branch_id}
              </code>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Zone Name &amp; ID
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1.5">
                {currentUser.zone_name}
              </p>
              <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {currentUser.zone_id}
              </code>
            </div>
          </div>
        </Card>

        <Card
          title="Verification Protocol Checklist"
          description="Mandatory physical inspection standards prior to digital signature seal."
        >
          <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                CNIC Front &amp; Back: Inspect 13-digit Nadra number, expiry date, and official holographic seal.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Education &amp; Experience: Cross-check institution stamp and graduation certificate.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Driving License &amp; Utility Bill: Ensure address matches candidate&apos;s permanent or current domicile.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Digital Signature: Official verification sign-off applied before forwarding the application to Central HR.
              </span>
            </li>
          </ul>
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
