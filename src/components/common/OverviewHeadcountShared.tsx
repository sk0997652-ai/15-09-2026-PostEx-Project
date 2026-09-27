import React from 'react';
import {
  Users,
  Bike,
  Briefcase,
  TrendingUp,
  Info,
  Building2,
  MapPin,
} from 'lucide-react';
import {
  FillRateStatus,
  OverviewMetricBlock,
  OverviewTrendInfo,
  OverviewHistoricalPoint,
  OverviewZoneRow,
  OverviewBranchRow,
  OverviewDesignationRow,
} from '../../lib/headcountApi';
import {
  Card,
  Badge,
  Modal,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';

// ============================================================================
// 1. Fill-Rate Status Badge (On Target >=95%, Understaffed >=80% & <95%, Critical <80%)
// ============================================================================
export const FillRateStatusBadge: React.FC<{
  status: FillRateStatus;
  fillRatePct?: number;
  showPct?: boolean;
}> = ({ status, fillRatePct, showPct = true }) => {
  const variant =
    status === 'On Target'
      ? 'success'
      : status === 'Understaffed'
      ? 'warning'
      : 'error';

  const pctText =
    typeof fillRatePct === 'number' && showPct ? `${fillRatePct}% · ` : '';

  return (
    <Badge variant={variant} dot data-testid="fill-rate-status-badge">
      {pctText}
      {status}
    </Badge>
  );
};

// ============================================================================
// 2. Inline Trend Indicator (▲ emerald / ▼ rose / — if no historical data)
// ============================================================================
export const TrendIndicator: React.FC<{
  trend?: OverviewTrendInfo | null;
}> = ({ trend }) => {
  if (!trend || !trend.has_historical_data || trend.direction === 'none') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-400"
        title="No prior-month historical data exists yet"
        data-testid="trend-indicator-empty"
      >
        —
      </span>
    );
  }

  if (trend.direction === 'up') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600"
        title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
        data-testid="trend-indicator-up"
      >
        <span>▲</span>
        {typeof trend.delta === 'number' && <span>+{trend.delta}</span>}
      </span>
    );
  }

  if (trend.direction === 'down') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-rose-600"
        title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
        data-testid="trend-indicator-down"
      >
        <span>▼</span>
        {typeof trend.delta === 'number' && <span>{trend.delta}</span>}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-500"
      title={`Unchanged vs Last Month (${trend.last_month_active})`}
      data-testid="trend-indicator-flat"
    >
      — 0
    </span>
  );
};

// ============================================================================
// 3. Employment Category Badge (Rider vs In-House Staff)
// ============================================================================
export const EmploymentCategoryBadge: React.FC<{
  category: 'Rider' | 'In-House Staff' | string;
}> = ({ category }) => {
  const isRider = String(category).toLowerCase().includes('rider');
  return (
    <Badge variant={isRider ? 'primary' : 'info'}>
      {isRider ? 'Rider' : 'In-House Staff'}
    </Badge>
  );
};

// ============================================================================
// 4. Category Rollup KPI Cards (Total, Rider, In-House Staff)
// ============================================================================
export const HeadcountCategoryRollupCards: React.FC<{
  scopeLabel: string;
  total: OverviewMetricBlock;
  rider: OverviewMetricBlock;
  inHouse: OverviewMetricBlock;
  extraCard?: React.ReactNode;
}> = ({ scopeLabel, total, rider, inHouse, extraCard }) => {
  return (
    <div
      id="headcount-category-rollup-cards"
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        extraCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
      } gap-4`}
    >
      {/* Card 1: Total Headcount */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">
            {scopeLabel} Total Headcount
          </span>
          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {total.active}
            </span>
            <span className="text-xs text-slate-500 font-mono ml-1">
              / {total.approved} Approved
            </span>
          </div>
          <TrendIndicator trend={total.trend} />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium">
            Vacancy: <strong className="text-amber-700 font-mono">{total.vacancy}</strong>
          </span>
          <FillRateStatusBadge
            status={total.fill_rate_status}
            fillRatePct={total.fill_rate_pct}
          />
        </div>
      </Card>

      {/* Card 2: Rider Headcount */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">
            Rider Headcount
          </span>
          <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Bike className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div>
            <span className="text-2xl font-black text-indigo-700 font-mono">
              {rider.active}
            </span>
            <span className="text-xs text-slate-500 font-mono ml-1">
              / {rider.approved} Approved
            </span>
          </div>
          <TrendIndicator trend={rider.trend} />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium">
            Vacancy: <strong className="text-amber-700 font-mono">{rider.vacancy}</strong>
          </span>
          <FillRateStatusBadge
            status={rider.fill_rate_status}
            fillRatePct={rider.fill_rate_pct}
          />
        </div>
      </Card>

      {/* Card 3: In-House Staff Headcount */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">
            In-House Staff Headcount
          </span>
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {inHouse.active}
            </span>
            <span className="text-xs text-slate-500 font-mono ml-1">
              / {inHouse.approved} Approved
            </span>
          </div>
          <TrendIndicator trend={inHouse.trend} />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium">
            Vacancy: <strong className="text-amber-700 font-mono">{inHouse.vacancy}</strong>
          </span>
          <FillRateStatusBadge
            status={inHouse.fill_rate_status}
            fillRatePct={inHouse.fill_rate_pct}
          />
        </div>
      </Card>

      {/* Optional 4th Card (Pipeline / Operational KPI) */}
      {extraCard}
    </div>
  );
};

// ============================================================================
// 5. Active Definition Informational Note
// ============================================================================
export const ActiveDefinitionBanner: React.FC<{ note?: string }> = ({ note }) => (
  <Card className="p-3.5 bg-slate-50/80">
    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-indigo-600 shrink-0" />
        <span>
          <strong>Headcount Definitions:</strong>{' '}
          {note ||
            'Active = any row in employees (approved/enrolled candidates); no offboarding flow exists yet, so all enrolled employees count as active. Vacancy = Approved − Active (floored at 0).'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="success" dot>
          On Target (&ge;95%)
        </Badge>
        <Badge variant="warning" dot>
          Understaffed (80–94%)
        </Badge>
        <Badge variant="error" dot>
          Critical (&lt;80%)
        </Badge>
      </div>
    </div>
  </Card>
);

// ============================================================================
// 6. Row Click Detail Modal with Full Historical Chart & Breakdown
// ============================================================================
export type SelectedOverviewEntity =
  | { type: 'zone'; data: OverviewZoneRow }
  | { type: 'branch'; data: OverviewBranchRow }
  | { type: 'designation'; data: OverviewDesignationRow };

export const OverviewRowDetailModal: React.FC<{
  selected: SelectedOverviewEntity | null;
  onClose: () => void;
}> = ({ selected, onClose }) => {
  if (!selected) return null;

  const isZone = selected.type === 'zone';
  const isBranch = selected.type === 'branch';
  const isDesig = selected.type === 'designation';

  const title = isZone
    ? `Zone Headcount & Historical Trend — ${selected.data.zone_name}`
    : isBranch
    ? `Branch Headcount & Historical Trend — ${selected.data.branch_name}`
    : `Designation Headcount & Historical Trend — ${selected.data.designation_name}`;

  const description = isZone
    ? `Zone Code: ${selected.data.zone_code || 'N/A'} · Region: ${
        selected.data.region || 'Pakistan'
      } · ${selected.data.branches_count} Branches`
    : isBranch
    ? `Branch Code: ${selected.data.branch_code || 'N/A'} · Type: ${
        selected.data.branch_type || 'Hub'
      } · Zone: ${selected.data.zone_name}`
    : `Department: ${selected.data.department_name} (${
        selected.data.department_code || 'N/A'
      }) · Employment Category: ${selected.data.employment_category}`;

  const totalBlock: OverviewMetricBlock = isDesig
    ? selected.data
    : selected.data.total;

  const riderBlock: OverviewMetricBlock | null = isDesig
    ? null
    : selected.data.rider;

  const inHouseBlock: OverviewMetricBlock | null = isDesig
    ? null
    : selected.data.in_house;

  const historicalSeries: OverviewHistoricalPoint[] =
    selected.data.historical_series || [];
  const hasPriorHistory = selected.data.has_prior_months_history;

  const maxChartVal = Math.max(
    1,
    totalBlock.approved,
    ...historicalSeries.map((pt) => Math.max(pt.total_active, pt.approved_target))
  );

  const designationBreakdown: OverviewDesignationRow[] = isDesig
    ? []
    : selected.data.designation_breakdown || [];

  const branchBreakdown: OverviewBranchRow[] = isZone
    ? selected.data.branch_breakdown || []
    : [];

  return (
    <Modal
      isOpen={Boolean(selected)}
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
      footer={
        <Button id="overview-detail-modal-close-btn" variant="secondary" onClick={onClose}>
          Close Detail Panel
        </Button>
      }
    >
      <div id="overview-row-detail-modal-body" className="space-y-6">
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-slate-50/70">
            <div className="text-xs font-semibold text-slate-500">Total Headcount</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {totalBlock.active} / {totalBlock.approved}
              </span>
              <TrendIndicator trend={totalBlock.trend} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Vacancy: <strong className="font-mono">{totalBlock.vacancy}</strong>
              </span>
              <FillRateStatusBadge
                status={totalBlock.fill_rate_status}
                fillRatePct={totalBlock.fill_rate_pct}
              />
            </div>
          </Card>

          {riderBlock && (
            <Card className="p-4 bg-indigo-50/30">
              <div className="text-xs font-semibold text-indigo-900">
                Rider Category
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-700 font-mono">
                  {riderBlock.active} / {riderBlock.approved}
                </span>
                <TrendIndicator trend={riderBlock.trend} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Vacancy: <strong className="font-mono">{riderBlock.vacancy}</strong>
                </span>
                <FillRateStatusBadge
                  status={riderBlock.fill_rate_status}
                  fillRatePct={riderBlock.fill_rate_pct}
                />
              </div>
            </Card>
          )}

          {inHouseBlock && (
            <Card className="p-4 bg-emerald-50/30">
              <div className="text-xs font-semibold text-emerald-900">
                In-House Staff Category
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {inHouseBlock.active} / {inHouseBlock.approved}
                </span>
                <TrendIndicator trend={inHouseBlock.trend} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Vacancy: <strong className="font-mono">{inHouseBlock.vacancy}</strong>
                </span>
                <FillRateStatusBadge
                  status={inHouseBlock.fill_rate_status}
                  fillRatePct={inHouseBlock.fill_rate_pct}
                />
              </div>
            </Card>
          )}

          {isDesig && (
            <>
              <Card className="p-4 bg-slate-50/70">
                <div className="text-xs font-semibold text-slate-500">
                  Employment Category
                </div>
                <div className="mt-2">
                  <EmploymentCategoryBadge category={selected.data.employment_category} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Department: {selected.data.department_name}
                </div>
              </Card>
              <Card className="p-4 bg-slate-50/70">
                <div className="text-xs font-semibold text-slate-500">
                  Month-over-Month Trend
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <TrendIndicator trend={totalBlock.trend} />
                  <span className="text-xs text-slate-500">
                    {totalBlock.trend.has_historical_data
                      ? `Last month: ${totalBlock.trend.last_month_active} active`
                      : 'No prior month historical data yet'}
                  </span>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Full Historical Active Headcount Chart */}
        <Card
          title="Historical Active Headcount Chart"
          description="Monthly cumulative active headcount vs approved headcount target based on actual employee enrollment timestamps."
          action={
            <Badge variant={hasPriorHistory ? 'success' : 'info'} dot>
              {hasPriorHistory ? 'Multi-Month History' : 'Current Month Snapshot'}
            </Badge>
          }
        >
          {!hasPriorHistory && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                No prior-month historical employee records exist for this scope yet — displaying live current state only (inline trend shows <strong>—</strong> rather than fabricating historical data).
              </span>
            </div>
          )}

          {historicalSeries.length === 0 ? (
            <div
              id="overview-historical-chart-empty"
              className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl"
            >
              0 active employees enrolled in this scope so far. Approved target:{' '}
              <strong className="font-mono text-slate-800">{totalBlock.approved}</strong>.
            </div>
          ) : (
            <div id="overview-historical-chart" className="space-y-4">
              {/* Visual SVG Bar Chart */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                      <span>Rider Active</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                      <span>In-House Staff Active</span>
                    </span>
                  </div>
                  <span className="font-mono">
                    Approved Target: <strong>{totalBlock.approved}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 items-end pt-4 min-h-[160px]">
                  {historicalSeries.map((pt) => {
                    const totalHeightPct = Math.min(
                      100,
                      Math.max(8, Math.round((pt.total_active / maxChartVal) * 100))
                    );
                    const riderSharePct =
                      pt.total_active > 0
                        ? Math.round((pt.rider_active / pt.total_active) * 100)
                        : 0;

                    return (
                      <div
                        key={pt.month_key}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div className="text-[11px] font-mono font-bold text-slate-800">
                          {pt.total_active}
                        </div>
                        <div className="w-full max-w-[48px] h-28 bg-slate-200/70 rounded-t-lg flex flex-col justify-end overflow-hidden p-0.5">
                          <div
                            style={{ height: `${totalHeightPct}%` }}
                            className="w-full rounded-t-md overflow-hidden flex flex-col justify-end transition-all"
                          >
                            <div
                              style={{ height: `${riderSharePct}%` }}
                              className="w-full bg-indigo-600"
                              title={`Rider Active: ${pt.rider_active}`}
                            />
                            <div
                              style={{ height: `${100 - riderSharePct}%` }}
                              className="w-full bg-emerald-600"
                              title={`In-House Active: ${pt.in_house_active}`}
                            />
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700">
                          {pt.month_label}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          +{pt.new_enrollments} joined
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Historical Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Rider Active</TableHead>
                    <TableHead>In-House Active</TableHead>
                    <TableHead>Total Active</TableHead>
                    <TableHead>New Joiners</TableHead>
                    <TableHead>Approved Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalSeries.map((pt) => (
                    <TableRow key={pt.month_key}>
                      <TableCell className="font-semibold text-xs">{pt.month_label}</TableCell>
                      <TableCell className="font-mono text-xs text-indigo-700">
                        {pt.rider_active}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-700">
                        {pt.in_house_active}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">
                        {pt.total_active}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        +{pt.new_enrollments}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {pt.approved_target}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Zone Branch Breakdown (if Zone selected) */}
        {isZone && branchBreakdown.length > 0 && (
          <Card
            title="Branches in Zone"
            description="Branch-level Rider vs In-House Staff headcount breakdown."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Rider (Appr / Act / Vac)</TableHead>
                  <TableHead>In-House (Appr / Act / Vac)</TableHead>
                  <TableHead>Total (Appr / Act / Vac)</TableHead>
                  <TableHead>Fill-Rate Status</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchBreakdown.map((b) => (
                  <TableRow key={b.branch_id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{b.branch_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {b.branch_code || 'No Code'} · {b.branch_type}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {b.rider.approved} / {b.rider.active} / {b.rider.vacancy}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {b.in_house.approved} / {b.in_house.active} / {b.in_house.vacancy}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {b.total.approved} / {b.total.active} / {b.total.vacancy}
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
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Designation Breakdown (if Zone or Branch selected) */}
        {!isDesig && (
          <Card
            title="Designation-Wise Headcount Breakdown"
            description="Per-designation Approved, Active, Vacancy, and Fill-Rate Status."
          >
            {designationBreakdown.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No designation headcount entries configured for this scope yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Vacancy</TableHead>
                    <TableHead>Fill-Rate Status</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designationBreakdown.map((d) => (
                    <TableRow key={d.designation_id}>
                      <TableCell className="font-semibold text-xs text-slate-900">
                        {d.designation_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {d.department_name}
                      </TableCell>
                      <TableCell>
                        <EmploymentCategoryBadge category={d.employment_category} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.approved}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </Modal>
  );
};
