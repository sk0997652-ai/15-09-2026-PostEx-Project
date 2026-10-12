// ==============================================================================
// PostEx HR Onboarding Portal — User Performance Tracker Sub-View (Step 11B & Step 14D)
// Replaces demo seed data with live computations from GET /api/performance/hr
// ==============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  AlertCircle,
  FileText,
  Filter,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  KpiCard,
  KpiGrid,
} from '../ui';
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
    <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
      <div
        className={`h-full transition-all duration-300 ${
          colorClass || (pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500')
        }`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );

  return (
    <div id="user-performance-subview" className="space-y-3">
      {/* Top Filter and Date Range Toolbar */}
      <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-caption text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Joining Date Filter:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              id="performance-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 h-7 text-caption border border-slate-300 rounded-[6px] bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
              placeholder="From"
            />
            <span className="text-caption text-slate-400">to</span>
            <input
              type="date"
              id="performance-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 h-7 text-caption border border-slate-300 rounded-[6px] bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-600"
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
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-center justify-between gap-3 text-rose-800 text-body">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchPerformance}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards using KpiGrid and KpiCard */}
      <KpiGrid columns={4}>
        <KpiCard
          label="Joiners Handled"
          value={kpi.joiners_handled}
          hint={`${kpi.items_provided}/${kpi.total_items} items provided`}
          tone="default"
        />
        <KpiCard
          label="On-Time Rate"
          value={`${kpi.on_time_rate}%`}
          hint={`${kpi.on_time_items} on-time out of ${kpi.total_items}`}
          tone={kpi.on_time_rate >= 85 ? 'success' : kpi.on_time_rate >= 65 ? 'warning' : 'danger'}
        />
        <KpiCard
          label="Overdue Items"
          value={kpi.overdue_items}
          hint="past SLA target day"
          tone={kpi.overdue_items > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Open Clearance Forms"
          value={kpi.open_clearance_forms}
          hint="in-progress exits"
          tone="default"
        />
      </KpiGrid>

      {/* Main Scorecard Table & Drilldown */}
      <Card
        title={toTitleCase(`Scorecard by ${lvl === 'HR' ? 'HR Officer' : lvl}`)}
        description="Performance scorecard showing items provided on or before target day (Code D0, Machine D1, Login D1, SIM D2, ID D3, Docs D5)."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div
              id="lv"
              className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-[6px] p-0.5 gap-1"
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
                    className={`px-2.5 py-1 rounded-[4px] text-caption font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isOn
                        ? 'bg-white text-indigo-700 shadow-2xs'
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
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export To Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-[6px] bg-indigo-50/80 border border-indigo-200/80 px-3 py-2 text-caption text-indigo-900">
            Threshold flags: <strong>On track</strong> (85%+), <strong>Watch</strong> (65%-84%),{' '}
            <strong>Needs action</strong> (&lt;65%). Fewer than 4 joiners is marked{' '}
            <strong>Low volume</strong>.
          </div>

          <Table scroll="x">
            <TableHeader scroll="x">
              <TableRow scroll="x">
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
            <TableBody scroll="x">
              {loading && rows.length === 0 ? (
                <TableRow scroll="x">
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-indigo-500" />
                    <span>Loading performance metrics...</span>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow scroll="x">
                  <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                    <FileText className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-medium text-slate-600">No performance records found.</p>
                    <p className="text-caption text-slate-400 mt-0.5">
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
                        scroll="x"
                        onClick={() => setSelectedRowId(isSelected ? null : r.id)}
                        className={`cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                      >
                        {/* Name & Scope */}
                        <TableCell className="whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {lvl === 'HR' ? toTitleCase(r.name) : r.name}
                          </div>
                          {r.scope ? (
                            <div className="text-caption text-slate-500">{r.scope}</div>
                          ) : null}
                        </TableCell>

                        {/* Joiners */}
                        <TableCell className="text-slate-700 whitespace-nowrap">
                          {r.joiners_count}
                        </TableCell>

                        {/* Asset Items Provided */}
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="neutral" className="text-tag">
                            {r.items_provided}/{r.total_items}
                          </Badge>
                        </TableCell>

                        {/* On-Time Rate */}
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            {renderProgressBar(r.on_time_rate, r.flag_color)}
                            <span className="text-caption font-bold text-slate-700 w-8 text-right">
                              {r.on_time_rate}%
                            </span>
                          </div>
                        </TableCell>

                        {/* Avg Days */}
                        <TableCell className="text-slate-700 whitespace-nowrap">
                          {r.avg_days !== null ? `${r.avg_days}d` : '—'}
                        </TableCell>

                        {/* Overdue Items */}
                        <TableCell className="whitespace-nowrap">
                          {r.overdue_items > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-[4px] border border-rose-200 text-tag">
                              {r.overdue_items}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>

                        {/* Emails Sent */}
                        <TableCell className="text-slate-700 whitespace-nowrap">
                          {r.emails_sent}/{r.emails_total}
                        </TableCell>

                        {/* Open ECFs */}
                        <TableCell className="text-slate-700 whitespace-nowrap">
                          {r.open_clearance_forms}
                        </TableCell>

                        {/* Flag Badge */}
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={
                              r.flag === 'On track'
                                ? 'success'
                                : r.flag === 'Watch'
                                ? 'warning'
                                : r.flag === 'Needs action'
                                ? 'error'
                                : 'neutral'
                            }
                            className="text-tag"
                          >
                            {r.flag}
                          </Badge>
                        </TableCell>

                        {/* Drill-down Toggle */}
                        <TableCell className="text-right whitespace-nowrap">
                          <span className="text-caption font-semibold text-indigo-600 hover:text-indigo-800">
                            {isSelected ? 'Hide breakdown' : 'View breakdown'}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* Drill-down Row */}
                      {isSelected && (
                        <TableRow scroll="x" className="bg-slate-50/70 border-y border-slate-200">
                          <TableCell colSpan={10} className="p-3">
                            <div className="space-y-2">
                              <div className="font-semibold text-body text-slate-900">
                                Item-level breakdown for {lvl === 'HR' ? toTitleCase(r.name) : r.name}:
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                {Object.entries(r.item_breakdown || {}).map(([key, item]) => (
                                  <div
                                    key={key}
                                    className="p-2 bg-white rounded-[6px] border border-slate-200 space-y-1"
                                  >
                                    <div className="text-caption font-medium text-slate-500 uppercase tracking-wide truncate">
                                      {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-body font-bold text-slate-900">
                                      {item.provided}/{item.total}
                                    </div>
                                    <div className="text-caption text-slate-400 flex items-center justify-between">
                                      <span>On-time:</span>
                                      <span className="font-semibold text-slate-700">{item.on_time}</span>
                                    </div>
                                    {item.overdue > 0 && (
                                      <div className="text-caption text-rose-600 font-semibold flex items-center justify-between">
                                        <span>Overdue:</span>
                                        <span>{item.overdue}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
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
