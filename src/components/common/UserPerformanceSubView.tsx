// ==============================================================================
// PostEx HR Onboarding Portal — User Performance Tracker Sub-View (Step 11B)
// Replaces demo seed data with live computations from GET /api/performance/hr
// ==============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  AlertCircle,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
} from 'lucide-react';
import { Card, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui';
import { toTitleCase } from '../../lib/formatText';
import { exportRowsToExcel } from '../../lib/hrPortalStore';
import {
  performanceApi,
  GetHrPerformanceResponse,
  PerformanceScorecardRow,
} from '../../lib/performanceApi';
import { WorkflowTrackerRole } from './ExitTrackerSubView';

export interface UserPerformanceSubViewProps {
  role: WorkflowTrackerRole;
  zoneName?: string;
  branchName?: string;
  assignedBranches?: string[];
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export const UserPerformanceSubView: React.FC<UserPerformanceSubViewProps> = ({
  role,
  zoneName,
  branchName,
}) => {
  const [data, setData] = useState<GetHrPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down level: 'Zone' | 'Branch' | 'HR'
  const [lvl, setLvl] = useState<'Zone' | 'Branch' | 'HR'>('HR');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await performanceApi.getHrPerformance({
        zone: role === 'zonal_hr' ? zoneName : undefined,
        branch: branchName || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      if (res.success) {
        setData(res);
      } else {
        throw new Error(res.error || 'Failed to load performance metrics.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [role, zoneName, branchName, startDate, endDate]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const kpi = data?.kpi || {
    joiners_handled: 0,
    total_items: 0,
    items_provided: 0,
    on_time_items: 0,
    on_time_rate: 0,
    overdue_items: 0,
    open_clearance_forms: 0,
    avg_days: 0,
    emails_sent: 0,
    emails_total: 0,
  };

  const rows: PerformanceScorecardRow[] = useMemo(() => {
    if (!data?.scorecard) return [];
    if (lvl === 'Zone') return data.scorecard.zones || [];
    if (lvl === 'Branch') return data.scorecard.branches || [];
    return data.scorecard.officers || [];
  }, [data, lvl]);

  const handleExportExcel = () => {
    const exportData = rows.map((r) => ({
      [lvl === 'HR' ? 'HR Officer' : lvl]: r.name,
      Scope: r.scope || 'All',
      Joiners: r.joiners_count,
      'Items Provided': `${r.items_provided}/${r.total_items}`,
      'On-time Rate (%)': `${r.on_time_rate}%`,
      'Avg Days': r.avg_days !== null ? r.avg_days : '—',
      'Overdue Items': r.overdue_items,
      'Emails Sent': `${r.emails_sent}/${r.emails_total}`,
      'Open Clearance Forms': r.open_clearance_forms,
      Flag: r.flag,
    }));
    exportRowsToExcel(
      `PostEx_User_Performance_${lvl}_Export.xlsx`,
      'User Performance',
      exportData
    );
  };

  const renderProgressBar = (pct: number, colorClass?: string) => (
    <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden flex">
      <div
        className={`h-full transition-all duration-300 ${
          colorClass || (pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500')
        }`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );

  return (
    <div id="user-performance-subview" className="space-y-6">
      {/* Top Filter and Date Range Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Joining Date Filter:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              id="performance-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-600 font-mono"
              placeholder="From"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              id="performance-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-600 font-mono"
              placeholder="To"
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="refresh-performance-btn"
            variant="secondary"
            size="sm"
            onClick={fetchPerformance}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error state with Retry */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchPerformance}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Joiners Handled */}
        <Card className="p-5">
          <div className="text-table-header uppercase text-slate-500">Joiners Handled</div>
          <div className="text-kpi-number font-mono tabular-nums mt-1 text-slate-900">
            {kpi.joiners_handled}
          </div>
          <div className="text-caption text-slate-500 mt-0.5">
            {kpi.items_provided}/{kpi.total_items} items provided
          </div>
        </Card>

        {/* 2. On-Time Task Rate */}
        <Card className="p-5">
          <div className="text-table-header uppercase text-slate-500">On-Time Rate</div>
          <div
            className={`text-kpi-number font-mono tabular-nums mt-1 ${
              kpi.on_time_rate >= 85
                ? 'text-emerald-600'
                : kpi.on_time_rate >= 65
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {kpi.on_time_rate}%
          </div>
          <div className="text-caption text-slate-500 mt-0.5">
            {kpi.on_time_items} on-time out of {kpi.total_items}
          </div>
        </Card>

        {/* 3. Overdue Items */}
        <Card className="p-5">
          <div className="text-table-header uppercase text-slate-500">Overdue Items</div>
          <div className="text-kpi-number text-rose-600 font-mono tabular-nums mt-1">
            {kpi.overdue_items}
          </div>
          <div className="text-caption text-slate-500 mt-0.5">past SLA target day</div>
        </Card>

        {/* 4. Open Clearance Forms */}
        <Card className="p-5">
          <div className="text-table-header uppercase text-slate-500">Open Clearance Forms</div>
          <div className="text-kpi-number text-slate-900 font-mono tabular-nums mt-1">
            {kpi.open_clearance_forms}
          </div>
          <div className="text-caption text-slate-500 mt-0.5">in-progress exits</div>
        </Card>
      </div>

      {/* Main Scorecard Table & Drilldown */}
      <Card
        title={toTitleCase(`Scorecard by ${lvl === 'HR' ? 'HR Officer' : lvl}`)}
        description="Performance scorecard showing items provided on or before target day (Code D0, Machine D1, Login D1, SIM D2, ID D3, Docs D5)."
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              id="lv"
              className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1"
            >
              {(['HR officer', 'Zone', 'Branch'] as const).map((l) => {
                const dataKey = l === 'HR officer' ? 'HR' : l;
                const isOn = lvl === dataKey;
                return (
                  <button
                    key={l}
                    type="button"
                    data-l={dataKey}
                    onClick={() => {
                      setLvl(dataKey);
                      setSelectedRowId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-caption font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isOn
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {toTitleCase(l)}
                  </button>
                );
              })}
            </div>

            <Button
              id="export-hr-performance-excel-btn"
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export To Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50/80 border border-indigo-200/80 px-4 py-2.5 text-caption text-indigo-900">
            Threshold flags: <strong>On track</strong> (85%+), <strong>Watch</strong> (65%-84%),{' '}
            <strong>Needs action</strong> (&lt;65%). Fewer than 4 joiners is marked{' '}
            <strong>Low volume</strong>.
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lvl === 'HR' ? 'HR Officer' : lvl}</TableHead>
                <TableHead>Joiners</TableHead>
                <TableHead>Asset Items Provided</TableHead>
                <TableHead>On-Time Rate</TableHead>
                <TableHead>Avg Days</TableHead>
                <TableHead>Overdue Items</TableHead>
                <TableHead>Emails Sent</TableHead>
                <TableHead>Open ECFs</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead className="text-right">Drill-Down</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading performance metrics...</span>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">No performance records found.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      No employees or tasks matched the selected scope and date range.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const isSelected = selectedRowId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow
                        onClick={() => setSelectedRowId(isSelected ? null : r.id)}
                        className={`cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                      >
                        {/* Name & Scope */}
                        <TableCell mobileRole="primary">
                          <div className="font-semibold text-slate-900">
                            {lvl === 'HR' ? toTitleCase(r.name) : r.name}
                          </div>
                          {r.scope ? (
                            <div className="text-caption text-slate-500">{r.scope}</div>
                          ) : null}
                        </TableCell>

                        {/* Joiners */}
                        <TableCell mobileRole="field" mobileLabel="Joiners" className="font-mono text-slate-700">
                          {r.joiners_count}
                        </TableCell>

                        {/* Asset Items Provided */}
                        <TableCell mobileRole="field" mobileLabel="Provided">
                          <Badge variant="neutral" className="font-mono">
                            {r.items_provided}/{r.total_items}
                          </Badge>
                        </TableCell>

                        {/* On-Time Rate */}
                        <TableCell mobileRole="field" mobileLabel="On-Time Rate">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            {renderProgressBar(r.on_time_rate, r.flag_color)}
                            <span className="text-caption font-bold font-mono text-slate-700 w-10 text-right">
                              {r.on_time_rate}%
                            </span>
                          </div>
                        </TableCell>

                        {/* Avg Days */}
                        <TableCell mobileRole="field" mobileLabel="Avg Days" className="font-mono text-slate-700">
                          {r.avg_days !== null ? r.avg_days : '—'}
                        </TableCell>

                        {/* Overdue */}
                        <TableCell mobileRole="field" mobileLabel="Overdue" className="font-mono text-slate-700">
                          <span className={r.overdue_items > 0 ? 'text-rose-600 font-bold' : ''}>
                            {r.overdue_items}
                          </span>
                        </TableCell>

                        {/* Emails Sent */}
                        <TableCell mobileRole="field" mobileLabel="Emails" className="font-mono text-slate-700">
                          {r.emails_sent}/{r.emails_total}
                        </TableCell>

                        {/* Open ECFs */}
                        <TableCell mobileRole="field" mobileLabel="Open ECFs" className="font-mono text-slate-700">
                          {r.open_clearance_forms}
                        </TableCell>

                        {/* Flag Badge */}
                        <TableCell mobileRole="status">
                          <Badge variant={r.flag_variant}>{r.flag}</Badge>
                        </TableCell>

                        {/* Drill-Down Action Button */}
                        <TableCell className="text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowId(isSelected ? null : r.id);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <ChevronUp className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>

                      {/* Drill-Down Expansion Row */}
                      {isSelected && (
                        <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                          <TableCell colSpan={10} className="p-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                  Scope Breakdown: {r.name}
                                </h4>
                                <span className="text-caption text-slate-500 font-mono">
                                  {r.joiners_count} total joiners • {r.open_clearance_forms} open clearance exits
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Total Items Target</span>
                                  <span className="font-mono font-bold text-slate-800 text-sm">
                                    {r.total_items}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Items On-Time</span>
                                  <span className="font-mono font-bold text-emerald-700 text-sm">
                                    {r.on_time_items}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Overdue Items</span>
                                  <span className="font-mono font-bold text-rose-700 text-sm">
                                    {r.overdue_items}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 block">Avg Completion Days</span>
                                  <span className="font-mono font-bold text-indigo-700 text-sm">
                                    {r.avg_days !== null ? `${r.avg_days} days` : 'In progress'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
