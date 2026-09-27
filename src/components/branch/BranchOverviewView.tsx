import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Building2,
  MapPin,
  Shield,
  RefreshCw,
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

interface BranchOverviewViewProps {
  currentUser: {
    branch_name: string;
    branch_id: string;
    zone_name: string;
    zone_id: string;
  };
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

export function BranchOverviewView({ currentUser }: BranchOverviewViewProps) {
  const [overviewData, setOverviewData] = useState<HeadcountOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

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
  const designationRows = overviewData?.designation_rows || [];
  const primaryBranch = overviewData?.branch_rows?.[0] || null;

  return (
    <div id="branch-manager-overview-view" className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Branch Overview — Headcount & Governance"
        description="Branch-scoped Rider vs. In-House Staff headcount rollups, per-designation fill-rate status, month-over-month trends, and physical verification governance."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="primary">
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

      {/* Shared Headcount Definitions & Fill-Rate Thresholds Legend */}
      <ActiveDefinitionBanner note={overviewData?.active_definition_note} />

      {/* Branch Headcount Rollup Cards (Total, Rider, In-House Staff + Branch Identity) */}
      <HeadcountCategoryRollupCards
        scopeLabel="Branch"
        total={summaryTotal}
        rider={summaryRider}
        inHouse={summaryInHouse}
        extraCard={
          <Card className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
              <span>Branch Hub Scope</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-base font-bold text-slate-900 truncate mt-1">
              {primaryBranch?.branch_name || currentUser.branch_name}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {primaryBranch?.branch_code || 'HUB'} · {primaryBranch?.branch_type || 'Hub'}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Zone: <strong>{primaryBranch?.zone_name || currentUser.zone_name}</strong>
              </span>
              <Badge variant="info">{designationRows.length} Designations</Badge>
            </div>
          </Card>
        }
      />

      {/* SECTION 1: BRANCH DESIGNATION-WISE HEADCOUNT & FILL-RATE TABLE */}
      <Card
        title="Branch Designation-Wise Headcount & Fill-Rate Status"
        description="Approved headcount targets, live active enrolled employees, open vacancies, fill-rate status, and month-over-month trends for your branch. Click any row to open the Historical Trend Chart."
        action={
          <Badge variant="primary">
            {designationRows.length} Configured Designation{designationRows.length === 1 ? '' : 's'}
          </Badge>
        }
      >
        <Table id="branch-manager-designation-headcount-table">
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
                  No designation headcount entries configured for this branch yet.
                </TableCell>
              </TableRow>
            ) : (
              designationRows.map((d) => (
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

      {/* SECTION 2: BRANCH IDENTITY & VERIFICATION GOVERNANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Branch Identity & Database Scoping"
          description="Postgres RLS actively confines all read and write queries to this designated physical branch."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Branch Name &amp; ID
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {currentUser.branch_name}
              </p>
              <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {currentUser.branch_id}
              </code>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Zone Name &amp; ID
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1">
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
          <ul className="text-xs text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                CNIC Front &amp; Back: Inspect 13-digit Nadra number, expiry date, and official holographic seal.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Education &amp; Experience: Cross-check institution stamp and graduation certificate.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Driving License &amp; Utility Bill: Ensure address matches candidate&apos;s permanent or current domicile.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Digital Signature Hash: Cryptographic integrity seal applied to ensure anti-tamper compliance before Central HR review.
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
