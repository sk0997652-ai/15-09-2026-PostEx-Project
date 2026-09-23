import React from 'react';
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
import { PageHeader, Button, Card, Badge } from '../ui';

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
  onRefresh: () => void;
}

export function CentralOverviewView({
  metrics,
  zoneName,
  onNavigateToCreateJoiner,
  onNavigateToReviewQueue,
  onRefresh,
}: CentralOverviewViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central HR — Operations Overview"
        description="Monitor zone joiner throughput, pending reviews, and recent enrollment actions."
        badge={<Badge variant="primary">Operational Zone: {zoneName}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Metrics
            </Button>
            <Button
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

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Awaiting HR Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {metrics?.pendingReviewCount ?? 0}
            </div>
            <p className="text-[11px] text-amber-700 mt-1 font-medium">Needs Central HR Decision</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Returned for Correction</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {metrics?.needsCorrectionCount ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Candidate Fixing Sections</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Enrolled Employees</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {metrics?.enrolledCount ?? 0}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Assigned EMP-ID &amp; Dossier</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Zone Branches</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {metrics?.branchesCount ?? 0}
            </div>
            <p className="text-[11px] text-indigo-700 mt-1 font-medium">Operational Hubs in Zone</p>
          </div>
        </Card>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <UserPlus className="w-4 h-4" />
              <span>Candidate Intake</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Issue Joining ID &amp; Trigger Onboarding</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Create new joiner profile with mandatory Pakistani CNIC (13 digits), mobile, email, and designation. Automated system assigns unique <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">PX-YYYY-XXXXXX</code> Joining ID and sends instant SMS/email notifications.
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
            <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
              <ClipboardList className="w-4 h-4" />
              <span>Dossier Decision Desk</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Review BM-Verified Candidates</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
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
    </div>
  );
}
