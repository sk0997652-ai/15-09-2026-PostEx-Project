import React, { useState, useMemo } from 'react';
import {
  Users,
  Bike,
  Briefcase,
  TrendingUp,
  Info,
  Building2,
  MapPin,
  ArrowRight,
  Search,
  BarChart3,
  UserCheck,
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
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
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
  pill?: boolean;
}> = ({ trend, pill = false }) => {
  if (!trend || !trend.has_historical_data || trend.direction === 'none') {
    if (pill) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200/80 font-mono tabular-nums"
          title="No prior-month historical data exists yet"
          data-testid="trend-indicator-empty"
        >
          <span>—</span>
          <span className="font-sans text-[10px] text-slate-500">Current baseline</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-400 tabular-nums"
        title="No prior-month historical data exists yet"
        data-testid="trend-indicator-empty"
      >
        —
      </span>
    );
  }

  if (trend.direction === 'up') {
    if (pill) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono tabular-nums"
          title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
          data-testid="trend-indicator-up"
        >
          <span>▲</span>
          {typeof trend.delta === 'number' && <span>+{trend.delta}</span>}
          <span className="font-sans text-[10px] font-medium text-emerald-600 ml-0.5">vs last mo</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 tabular-nums"
        title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
        data-testid="trend-indicator-up"
      >
        <span>▲</span>
        {typeof trend.delta === 'number' && <span>+{trend.delta}</span>}
      </span>
    );
  }

  if (trend.direction === 'down') {
    if (pill) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 font-mono tabular-nums"
          title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
          data-testid="trend-indicator-down"
        >
          <span>▼</span>
          {typeof trend.delta === 'number' && <span>{trend.delta}</span>}
          <span className="font-sans text-[10px] font-medium text-rose-600 ml-0.5">vs last mo</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-rose-600 tabular-nums"
        title={`Current Active (${trend.current_active}) vs Last Month (${trend.last_month_active})`}
        data-testid="trend-indicator-down"
      >
        <span>▼</span>
        {typeof trend.delta === 'number' && <span>{trend.delta}</span>}
      </span>
    );
  }

  if (pill) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/80 font-mono tabular-nums"
        title={`Unchanged vs Last Month (${trend.last_month_active})`}
        data-testid="trend-indicator-flat"
      >
        <span>— 0</span>
        <span className="font-sans text-[10px] text-slate-500 ml-0.5">vs last mo</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-500 tabular-nums"
      title={`Unchanged vs Last Month (${trend.last_month_active})`}
      data-testid="trend-indicator-flat"
    >
      — 0
    </span>
  );
};

// ============================================================================
// 3. Employment Category Badge (Rider = Sky, In-House Staff = Emerald)
// ============================================================================
export const EmploymentCategoryBadge: React.FC<{
  category: 'Rider' | 'In-House Staff' | string;
}> = ({ category }) => {
  const isRider = String(category).toLowerCase().includes('rider');
  return (
    <Badge variant={isRider ? 'sky' : 'success'} dot>
      {isRider ? 'Rider' : 'In-House Staff'}
    </Badge>
  );
};

// ============================================================================
// 4. Matched 3-Card KPI Row (Total Employees / Total Active Riders / Total In-House Staff)
//    Accent Families: Indigo (Employees), Sky (Riders), Emerald (In-House Staff)
// ============================================================================
export const HeadcountCategoryRollupCards: React.FC<{
  scopeLabel?: string;
  total: OverviewMetricBlock;
  rider: OverviewMetricBlock;
  inHouse: OverviewMetricBlock;
  extraCard?: React.ReactNode;
}> = ({ scopeLabel, total, rider, inHouse, extraCard }) => {
  const prefix = scopeLabel && scopeLabel !== 'Company' ? `${scopeLabel} · ` : '';

  return (
    <div className="space-y-4">
      <div
        id="headcount-category-rollup-cards"
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {/* KPI Card 1: Total Employees (Indigo Accent) */}
        <div
          id="kpi-card-total-employees"
          className="rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {prefix}Total Employees
              </span>
              <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono tabular-nums">
                {total.active}
              </span>
              <span className="text-xs font-medium text-slate-400 font-mono tabular-nums">
                / {total.approved} Approved
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <TrendIndicator trend={total.trend} pill />
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Fill: <strong className="text-indigo-600">{total.fill_rate_pct}%</strong>
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, total.fill_rate_pct))}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium">
                Open Vacancy:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">{total.vacancy}</strong>
              </span>
              <FillRateStatusBadge
                status={total.fill_rate_status}
                fillRatePct={total.fill_rate_pct}
              />
            </div>
          </div>
        </div>

        {/* KPI Card 2: Total Active Riders (Sky Accent) */}
        <div
          id="kpi-card-active-riders"
          className="rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {prefix}Total Active Riders
              </span>
              <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100/80 flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5" />
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-sky-700 font-mono tabular-nums">
                {rider.active}
              </span>
              <span className="text-xs font-medium text-slate-400 font-mono tabular-nums">
                / {rider.approved} Approved
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <TrendIndicator trend={rider.trend} pill />
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Fill: <strong className="text-sky-600">{rider.fill_rate_pct}%</strong>
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, rider.fill_rate_pct))}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium">
                Rider Vacancy:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">{rider.vacancy}</strong>
              </span>
              <FillRateStatusBadge
                status={rider.fill_rate_status}
                fillRatePct={rider.fill_rate_pct}
              />
            </div>
          </div>
        </div>

        {/* KPI Card 3: Total In-House Staff (Emerald Accent) */}
        <div
          id="kpi-card-inhouse-staff"
          className="rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {prefix}Total In-House Staff
              </span>
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5" />
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 mt-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-700 font-mono tabular-nums">
                {inHouse.active}
              </span>
              <span className="text-xs font-medium text-slate-400 font-mono tabular-nums">
                / {inHouse.approved} Approved
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <TrendIndicator trend={inHouse.trend} pill />
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Fill: <strong className="text-emerald-600">{inHouse.fill_rate_pct}%</strong>
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, inHouse.fill_rate_pct))}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 font-medium">
                In-House Vacancy:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">{inHouse.vacancy}</strong>
              </span>
              <FillRateStatusBadge
                status={inHouse.fill_rate_status}
                fillRatePct={inHouse.fill_rate_pct}
              />
            </div>
          </div>
        </div>
      </div>

      {extraCard && <div className="pt-1">{extraCard}</div>}
    </div>
  );
};

// ============================================================================
// 5. Zone / Branch Flashcards Row + Approved Summary Bar + Report Link
// ============================================================================
export const ZoneBranchFlashcardsSection: React.FC<{
  mode: 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';
  zoneRows: OverviewZoneRow[];
  branchRows: OverviewBranchRow[];
  summaryTotal: OverviewMetricBlock;
  summaryRider: OverviewMetricBlock;
  summaryInHouse: OverviewMetricBlock;
  selectedZoneId?: string;
  onSelectZoneFilter?: (zoneId: string) => void;
  onInspectZone?: (zone: OverviewZoneRow) => void;
  onInspectBranch?: (branch: OverviewBranchRow) => void;
  onNavigateToHeadcount?: () => void;
  fallbackZoneName?: string;
  fallbackBranchName?: string;
  designationsCount?: number;
}> = ({
  mode,
  zoneRows,
  branchRows,
  summaryTotal,
  summaryRider,
  summaryInHouse,
  selectedZoneId = 'all',
  onSelectZoneFilter,
  onInspectZone,
  onInspectBranch,
  onNavigateToHeadcount,
  fallbackZoneName = 'Assigned Zone',
  fallbackBranchName = 'Assigned Branch',
  designationsCount = 0,
}) => {
  const sectionTitle =
    mode === 'super_admin'
      ? 'Geographic Zone Flashcards'
      : mode === 'zonal_hr'
      ? 'Assigned Zone Headcount Flashcard'
      : mode === 'central_hr'
      ? 'Scoped Zone & Branch Flashcards'
      : 'Assigned Branch Hub Flashcard';

  const sectionSubtitle =
    mode === 'super_admin'
      ? 'Company-wide zones with branch counts, Rider vs. In-House Staff approved budgets, and live fill-rate health.'
      : mode === 'zonal_hr'
      ? 'Full-width rollup for your assigned geographic zone across all constituent operational branches.'
      : mode === 'central_hr'
      ? 'Real-time headcount capacity across the branches tagged to your Central HR profile.'
      : 'Approved vs. active headcount capacity for your operational branch hub.';

  return (
    <div id="overview-flashcards-section" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {sectionTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{sectionSubtitle}</p>
        </div>
        {mode === 'super_admin' && selectedZoneId !== 'all' && onSelectZoneFilter && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onSelectZoneFilter('all')}
          >
            Clear Zone Filter (Show All)
          </Button>
        )}
      </div>

      {/* Super Admin: Grid of Zone Flashcards */}
      {mode === 'super_admin' && (
        <div
          id="super-admin-zone-flashcards-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {zoneRows.map((z) => {
            const isSelected = selectedZoneId === z.zone_id;
            return (
              <div
                key={z.zone_id}
                id={`zone-flashcard-${z.zone_id}`}
                onClick={() => {
                  if (onSelectZoneFilter) {
                    onSelectZoneFilter(isSelected ? 'all' : z.zone_id);
                  } else if (onInspectZone) {
                    onInspectZone(z);
                  }
                }}
                className={`rounded-2xl p-5 bg-white border transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-600/15 shadow-sm'
                    : 'border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5'
                }`}
              >
                <div>
                  {/* Card Top Header + Top-Right "Branch – {count}" Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                          {z.zone_name}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono block truncate">
                          {z.zone_code || 'ZONE'} {z.region ? `· ${z.region}` : ''}
                        </span>
                      </div>
                    </div>
                    <Badge variant="primary" data-testid={`zone-branch-badge-${z.zone_id}`}>
                      Branch – {z.branches_count}
                    </Badge>
                  </div>

                  {/* Category Split Metrics */}
                  <div className="grid grid-cols-2 gap-3 my-3">
                    <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-100/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 block">
                        Riders (Act / Appr)
                      </span>
                      <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                        <span className="text-lg font-black text-sky-700">
                          {z.rider.active}
                        </span>
                        <span className="text-xs text-slate-500">
                          / {z.rider.approved}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/80">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 block">
                        In-House (Act / Appr)
                      </span>
                      <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
                        <span className="text-lg font-black text-emerald-700">
                          {z.in_house.active}
                        </span>
                        <span className="text-xs text-slate-500">
                          / {z.in_house.approved}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fill-Rate Progress Bar & Footer */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, z.total.fill_rate_pct))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <FillRateStatusBadge
                        status={z.total.fill_rate_status}
                        fillRatePct={z.total.fill_rate_pct}
                      />
                      <TrendIndicator trend={z.total.trend} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onInspectZone) onInspectZone(z);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Trend</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zonal HR: ONE Full-Width Zone Flashcard */}
      {mode === 'zonal_hr' && (
        <div
          id="zonal-fullwidth-zone-flashcard"
          onClick={() => {
            if (zoneRows[0] && onInspectZone) onInspectZone(zoneRows[0]);
          }}
          className="rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {zoneRows[0]?.zone_name || fallbackZoneName}
                  </h3>
                  {zoneRows[0]?.zone_code && (
                    <span className="text-xs font-mono text-slate-400">
                      ({zoneRows[0].zone_code})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {zoneRows[0]?.region || 'Pakistan'} · Zone-wide active enrollment vs. approved headcount target
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <FillRateStatusBadge
                status={summaryTotal.fill_rate_status}
                fillRatePct={summaryTotal.fill_rate_pct}
              />
              <Badge variant="primary" data-testid="zonal-branch-count-badge">
                Branch – {zoneRows[0]?.branches_count ?? branchRows.length}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Zone Total (Act / Appr)
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 font-mono tabular-nums">
                  {summaryTotal.active} / {summaryTotal.approved}
                </span>
                <TrendIndicator trend={summaryTotal.trend} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 block">
                Riders (Act / Appr)
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-sky-700 font-mono tabular-nums">
                  {summaryRider.active} / {summaryRider.approved}
                </span>
                <TrendIndicator trend={summaryRider.trend} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
                In-House (Act / Appr)
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-emerald-700 font-mono tabular-nums">
                  {summaryInHouse.active} / {summaryInHouse.approved}
                </span>
                <TrendIndicator trend={summaryInHouse.trend} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 block">
                Open Zone Vacancy
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-amber-700 font-mono tabular-nums">
                  {summaryTotal.vacancy}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {summaryTotal.fill_rate_pct}% Filled
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Central HR: Scoped Zone & Branch Flashcards */}
      {mode === 'central_hr' && (
        <div
          id="central-branch-flashcards-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {branchRows.map((b) => (
            <div
              key={b.branch_id}
              id={`central-branch-flashcard-${b.branch_id}`}
              onClick={() => onInspectBranch && onInspectBranch(b)}
              className="rounded-2xl p-5 bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                        {b.branch_name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono block truncate">
                        {b.branch_code || 'HUB'} · {b.zone_name}
                      </span>
                    </div>
                  </div>
                  <Badge variant="info">{b.branch_type || 'Hub'}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 my-3">
                  <div className="p-2.5 rounded-xl bg-sky-50/50 border border-sky-100/80">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 block">
                      Riders (Act / Appr)
                    </span>
                    <span className="text-base font-black text-sky-700 font-mono tabular-nums mt-0.5 block">
                      {b.rider.active} / {b.rider.approved}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100/80">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 block">
                      In-House (Act / Appr)
                    </span>
                    <span className="text-base font-black text-emerald-700 font-mono tabular-nums mt-0.5 block">
                      {b.in_house.active} / {b.in_house.approved}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <FillRateStatusBadge
                  status={b.total.fill_rate_status}
                  fillRatePct={b.total.fill_rate_pct}
                />
                <span className="text-slate-500 font-mono text-[11px]">
                  Vacancy: <strong className="text-slate-900">{b.total.vacancy}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branch Manager: Single Branch Hub Flashcard */}
      {mode === 'branch_manager' && (
        <div
          id="bm-branch-flashcard"
          onClick={() => {
            if (branchRows[0] && onInspectBranch) onInspectBranch(branchRows[0]);
          }}
          className="rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {branchRows[0]?.branch_name || fallbackBranchName}
                  </h3>
                  {branchRows[0]?.branch_code && (
                    <span className="text-xs font-mono text-slate-400">
                      ({branchRows[0].branch_code})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zone: {branchRows[0]?.zone_name || fallbackZoneName} ·{' '}
                  {branchRows[0]?.branch_type || 'Operational Hub'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <FillRateStatusBadge
                status={summaryTotal.fill_rate_status}
                fillRatePct={summaryTotal.fill_rate_pct}
              />
              <Badge variant="primary">
                Designations – {designationsCount}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 block">
                Branch Riders (Active / Approved)
              </span>
              <span className="text-xl font-black text-sky-700 font-mono tabular-nums mt-1 block">
                {summaryRider.active} / {summaryRider.approved}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
                Branch In-House Staff (Active / Approved)
              </span>
              <span className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-1 block">
                {summaryInHouse.active} / {summaryInHouse.approved}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Open Branch Vacancy
              </span>
              <span className="text-xl font-black text-slate-900 font-mono tabular-nums mt-1 block">
                {summaryTotal.vacancy}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Approved Riders / Approved In-House Staff Summary Strip + "View Full Headcount Report →" Link */}
      <div
        id="approved-headcount-summary-strip"
        className="rounded-2xl px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-slate-300">Approved Riders:</span>
            <strong className="font-mono text-sm font-black text-white tabular-nums">
              {summaryRider.approved}
            </strong>
            <span className="text-slate-400 font-mono text-[11px]">
              ({summaryRider.active} active)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300">Approved In-House Staff:</span>
            <strong className="font-mono text-sm font-black text-white tabular-nums">
              {summaryInHouse.approved}
            </strong>
            <span className="text-slate-400 font-mono text-[11px]">
              ({summaryInHouse.active} active)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-slate-300">Total Approved Budget:</span>
            <strong className="font-mono text-sm font-black text-white tabular-nums">
              {summaryTotal.approved}
            </strong>
          </div>
        </div>

        {onNavigateToHeadcount && (
          <button
            id="view-full-headcount-report-link"
            type="button"
            onClick={onNavigateToHeadcount}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white transition-colors duration-150 cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            <span>View Full Headcount Report</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 6. Unified Branch Headcount Table (with Search + Zone/Branch/Status Filters)
//    Columns: Zone | Branch | Branch Manager | Rider HC Approved | Active Riders |
//             In-House HC Approved | Active In-House | Vacancy | Fill-Rate Status | Trend | Drill-down
// ============================================================================
export const UnifiedBranchHeadcountTable: React.FC<{
  tableId: string;
  rowIdPrefix: string;
  title: string;
  description: string;
  branchRows: OverviewBranchRow[];
  zoneRows?: OverviewZoneRow[];
  showZoneColumn?: boolean;
  showZoneFilter?: boolean;
  externalZoneFilter?: string;
  onExternalZoneFilterChange?: (zoneId: string) => void;
  fallbackStaffList?: Array<{
    name: string;
    branches?: { id: string } | null;
    roles?: { name: string } | null;
  }>;
  onSelectBranch: (branch: OverviewBranchRow) => void;
}> = ({
  tableId,
  rowIdPrefix,
  title,
  description,
  branchRows,
  zoneRows = [],
  showZoneColumn = true,
  showZoneFilter = false,
  externalZoneFilter,
  onExternalZoneFilterChange,
  fallbackStaffList = [],
  onSelectBranch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalZoneFilter, setInternalZoneFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const activeZoneFilter =
    externalZoneFilter !== undefined ? externalZoneFilter : internalZoneFilter;

  const handleZoneChange = (val: string) => {
    if (onExternalZoneFilterChange) {
      onExternalZoneFilterChange(val);
    } else {
      setInternalZoneFilter(val);
    }
    setBranchFilter('all');
  };

  const zoneScopedBranches = useMemo(() => {
    if (activeZoneFilter === 'all') return branchRows;
    return branchRows.filter((b) => b.zone_id === activeZoneFilter);
  }, [branchRows, activeZoneFilter]);

  const filteredRows = useMemo(() => {
    return zoneScopedBranches.filter((b) => {
      if (branchFilter !== 'all' && b.branch_id !== branchFilter) return false;
      if (statusFilter !== 'all' && b.total.fill_rate_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const bmNames = b.branch_managers.map((m) => m.name.toLowerCase()).join(' ');
        const matches =
          b.branch_name.toLowerCase().includes(q) ||
          (b.branch_code || '').toLowerCase().includes(q) ||
          (b.zone_name || '').toLowerCase().includes(q) ||
          bmNames.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [zoneScopedBranches, branchFilter, statusFilter, searchQuery]);

  const resolveBranchManagerLabel = (branch: OverviewBranchRow) => {
    if (branch.branch_managers && branch.branch_managers.length > 0) {
      return branch.branch_managers.map((m) => m.name).join(', ');
    }
    if (fallbackStaffList.length > 0) {
      const matched = fallbackStaffList
        .filter(
          (s) =>
            s.branches?.id === branch.branch_id &&
            s.roles?.name === 'branch_manager'
        )
        .map((s) => s.name);
      if (matched.length > 0) return matched.join(', ');
    }
    return 'Unassigned';
  };

  const dropdownFilters = [
    ...(showZoneFilter
      ? [
          {
            id: 'super-admin-overview-zone-filter',
            label: 'Zone Filter',
            value: activeZoneFilter,
            onChange: handleZoneChange,
            options: [
              { value: 'all', label: 'All Zones (Company-Wide)' },
              ...zoneRows.map((z) => ({
                value: z.zone_id,
                label: `${z.zone_name}${z.zone_code ? ` (${z.zone_code})` : ''}`,
              })),
            ],
          },
        ]
      : []),
    {
      id: `${tableId}-branch-filter`,
      label: 'Branch Filter',
      value: branchFilter,
      onChange: setBranchFilter,
      options: [
        { value: 'all', label: 'All Branches' },
        ...zoneScopedBranches.map((b) => ({
          value: b.branch_id,
          label: `${b.branch_name}${b.branch_code ? ` (${b.branch_code})` : ''}`,
        })),
      ],
    },
  ];

  const hasFilters =
    Boolean(searchQuery.trim()) ||
    activeZoneFilter !== 'all' ||
    branchFilter !== 'all' ||
    statusFilter !== 'all';

  return (
    <Card
      title={title}
      description={description}
      action={
        <Badge variant="primary">
          {filteredRows.length} of {branchRows.length} Branch{branchRows.length === 1 ? '' : 'es'}
        </Badge>
      }
    >
      {/* Reusable Search + Dropdowns + Status Pill Toolbar */}
      <TableToolbar
        className="mb-4"
        searchInputId={`${tableId}-search`}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search branch, code, zone, or manager..."
        filters={dropdownFilters}
        statusSelectId={`${tableId}-status-filter`}
        activeStatus={statusFilter}
        onStatusChange={setStatusFilter}
        statusPills={[
          { value: 'all', label: 'All Fill-Rate Statuses', variant: 'info' },
          { value: 'On Target', label: 'On Target (≥95%)', variant: 'success' },
          { value: 'Understaffed', label: 'Understaffed (80–94%)', variant: 'warning' },
          { value: 'Critical', label: 'Critical (<80%)', variant: 'error' },
        ]}
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearchQuery('');
          handleZoneChange('all');
          setBranchFilter('all');
          setStatusFilter('all');
        }}
      />

      <Table id={tableId}>
        <TableHeader>
          <TableRow>
            {showZoneColumn && <TableHead hideOnTablet>Zone</TableHead>}
            <TableHead>Branch</TableHead>
            <TableHead>Branch Manager</TableHead>
            <TableHead className="text-right" hideOnTablet>Rider HC Approved</TableHead>
            <TableHead className="text-right">Active Riders</TableHead>
            <TableHead className="text-right" hideOnTablet>In-House HC Approved</TableHead>
            <TableHead className="text-right">Active In-House</TableHead>
            <TableHead className="text-right">Vacancy</TableHead>
            <TableHead>Fill-Rate Status</TableHead>
            <TableHead hideOnTablet>Trend</TableHead>
            <TableHead className="text-right">Drill-Down</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showZoneColumn ? 11 : 10}
                className="text-center py-10 text-xs text-slate-500"
              >
                No branches match the active search or filter criteria.
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((b) => {
              const bmLabel = resolveBranchManagerLabel(b);
              return (
                <TableRow
                  key={b.branch_id}
                  id={`${rowIdPrefix}-${b.branch_id}`}
                  onClick={() => onSelectBranch(b)}
                  className="cursor-pointer hover:bg-indigo-50/40"
                >
                  {showZoneColumn && (
                    <TableCell hideOnTablet mobileRole="field" mobileLabel="Zone">
                      <span className="text-xs font-semibold text-slate-800">
                        {b.zone_name}
                      </span>
                      {b.zone_code && (
                        <span className="block text-[11px] font-mono text-slate-400">
                          {b.zone_code}
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell mobileRole="primary">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{b.branch_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {b.branch_code || 'NO-CODE'} · {b.branch_type}
                    </div>
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Branch Manager">
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className={bmLabel === 'Unassigned' ? 'text-slate-400 italic' : 'font-medium'}>
                        {bmLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile className="text-right font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    {b.rider.approved}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Riders (Act / Appr)" className="md:text-right font-mono text-xs font-bold text-sky-700 tabular-nums">
                    <span>{b.rider.active}</span>
                    <span className="md:hidden text-slate-400 font-normal"> / {b.rider.approved}</span>
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile className="text-right font-mono text-xs font-semibold text-slate-700 tabular-nums">
                    {b.in_house.approved}
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="In-House (Act / Appr)" className="md:text-right font-mono text-xs font-bold text-emerald-700 tabular-nums">
                    <span>{b.in_house.active}</span>
                    <span className="md:hidden text-slate-400 font-normal"> / {b.in_house.approved}</span>
                  </TableCell>
                  <TableCell mobileRole="field" mobileLabel="Open Vacancy" className="md:text-right font-mono text-xs font-bold text-amber-700 tabular-nums">
                    {b.total.vacancy}
                  </TableCell>
                  <TableCell mobileRole="status">
                    <FillRateStatusBadge
                      status={b.total.fill_rate_status}
                      fillRatePct={b.total.fill_rate_pct}
                    />
                  </TableCell>
                  <TableCell hideOnTablet hideOnMobile>
                    <TrendIndicator trend={b.total.trend} />
                  </TableCell>
                  <TableCell mobileRole="actions" className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBranch(b);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
};

// ============================================================================
// 7. Active Definition Informational Note
// ============================================================================
export const ActiveDefinitionBanner: React.FC<{ note?: string }> = ({ note }) => (
  <div className="rounded-2xl px-4 py-3 bg-slate-50/90 border border-slate-200/80 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-600">
    <div className="flex items-center gap-2.5 min-w-0">
      <Info className="w-4 h-4 text-indigo-600 shrink-0" />
      <span className="leading-relaxed">
        <strong className="text-slate-800">Headcount Governance:</strong>{' '}
        {note ||
          'Active = any row in employees (approved/enrolled candidates); no offboarding flow exists yet, so all enrolled employees count as active. Vacancy = Approved − Active (floored at 0).'}
      </span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
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
);

// ============================================================================
// 8. Row Click Detail Modal with Full Historical Chart & Breakdown
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Employees
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                {totalBlock.active} / {totalBlock.approved}
              </span>
              <TrendIndicator trend={totalBlock.trend} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs">
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
            <Card className="p-4 bg-sky-50/40 border-sky-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-800">
                Rider Category
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-sky-700 font-mono tabular-nums">
                  {riderBlock.active} / {riderBlock.approved}
                </span>
                <TrendIndicator trend={riderBlock.trend} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
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
            <Card className="p-4 bg-emerald-50/40 border-emerald-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                In-House Staff Category
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700 font-mono tabular-nums">
                  {inHouseBlock.active} / {inHouseBlock.approved}
                </span>
                <TrendIndicator trend={inHouseBlock.trend} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs">
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
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
              {/* Visual Bar Chart */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
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
                        <div className="text-[11px] font-mono font-bold text-slate-800 tabular-nums">
                          {pt.total_active}
                        </div>
                        <div className="w-full max-w-[48px] h-28 bg-slate-200/70 rounded-t-lg flex flex-col justify-end overflow-hidden p-0.5">
                          <div
                            style={{ height: `${totalHeightPct}%` }}
                            className="w-full rounded-t-md overflow-hidden flex flex-col justify-end transition-all"
                          >
                            <div
                              style={{ height: `${riderSharePct}%` }}
                              className="w-full bg-sky-500"
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
                    <TableHead className="text-right">Rider Active</TableHead>
                    <TableHead className="text-right">In-House Active</TableHead>
                    <TableHead className="text-right">Total Active</TableHead>
                    <TableHead className="text-right" hideOnTablet>New Joiners</TableHead>
                    <TableHead className="text-right" hideOnTablet>Approved Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalSeries.map((pt) => (
                    <TableRow key={pt.month_key}>
                      <TableCell mobileRole="primary" className="font-semibold text-xs">{pt.month_label}</TableCell>
                      <TableCell mobileRole="field" mobileLabel="Rider Active" className="md:text-right font-mono text-xs text-sky-700">
                        {pt.rider_active}
                      </TableCell>
                      <TableCell mobileRole="field" mobileLabel="In-House Active" className="md:text-right font-mono text-xs text-emerald-700">
                        {pt.in_house_active}
                      </TableCell>
                      <TableCell mobileRole="status" className="md:text-right font-mono text-xs font-bold">
                        {pt.total_active}
                      </TableCell>
                      <TableCell hideOnTablet mobileRole="field" mobileLabel="New Joiners" className="md:text-right font-mono text-xs text-slate-600">
                        +{pt.new_enrollments}
                      </TableCell>
                      <TableCell hideOnTablet mobileRole="field" mobileLabel="Approved Target" className="md:text-right font-mono text-xs text-slate-600">
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
                  <TableHead className="text-right">Rider (Appr / Act / Vac)</TableHead>
                  <TableHead className="text-right">In-House (Appr / Act / Vac)</TableHead>
                  <TableHead className="text-right" hideOnTablet>Total (Appr / Act / Vac)</TableHead>
                  <TableHead>Fill-Rate Status</TableHead>
                  <TableHead hideOnTablet>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchBreakdown.map((b) => (
                  <TableRow key={b.branch_id}>
                    <TableCell mobileRole="primary">
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{b.branch_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {b.branch_code || 'No Code'} · {b.branch_type}
                      </div>
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="Riders (Appr/Act/Vac)" className="md:text-right font-mono text-xs">
                      {b.rider.approved} / <strong className="text-sky-700">{b.rider.active}</strong> / {b.rider.vacancy}
                    </TableCell>
                    <TableCell mobileRole="field" mobileLabel="In-House (Appr/Act/Vac)" className="md:text-right font-mono text-xs">
                      {b.in_house.approved} / <strong className="text-emerald-700">{b.in_house.active}</strong> / {b.in_house.vacancy}
                    </TableCell>
                    <TableCell hideOnTablet mobileRole="field" mobileLabel="Total (Appr/Act/Vac)" className="md:text-right font-mono text-xs font-semibold">
                      {b.total.approved} / {b.total.active} / {b.total.vacancy}
                    </TableCell>
                    <TableCell mobileRole="status">
                      <FillRateStatusBadge
                        status={b.total.fill_rate_status}
                        fillRatePct={b.total.fill_rate_pct}
                      />
                    </TableCell>
                    <TableCell hideOnTablet hideOnMobile>
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
                    <TableHead hideOnTablet>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Vacancy</TableHead>
                    <TableHead>Fill-Rate Status</TableHead>
                    <TableHead hideOnTablet>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designationBreakdown.map((d) => (
                    <TableRow key={d.designation_id}>
                      <TableCell mobileRole="primary" className="font-semibold text-xs text-slate-900">
                        {d.designation_name}
                      </TableCell>
                      <TableCell hideOnTablet mobileRole="field" mobileLabel="Department" className="text-xs text-slate-600">
                        {d.department_name}
                      </TableCell>
                      <TableCell mobileRole="field" mobileLabel="Category">
                        <EmploymentCategoryBadge category={d.employment_category} />
                      </TableCell>
                      <TableCell mobileRole="field" mobileLabel="Approved" className="md:text-right font-mono text-xs">{d.approved}</TableCell>
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
