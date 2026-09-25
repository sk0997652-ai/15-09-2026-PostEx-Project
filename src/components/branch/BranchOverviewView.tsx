import React from 'react';
import { CheckCircle2, Building2, MapPin, Shield } from 'lucide-react';
import { PageHeader, Card, Badge } from '../ui';

interface BranchOverviewViewProps {
  currentUser: {
    branch_name: string;
    branch_id: string;
    zone_name: string;
    zone_id: string;
  };
}

export function BranchOverviewView({ currentUser }: BranchOverviewViewProps) {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
      <PageHeader
        title="Branch Overview & Governance"
        description="Physical verification hub parameters and database scoping rules enforced under corporate compliance."
        badge={
          <Badge variant="primary" icon={<Shield className="w-3.5 h-3.5" />}>
            Scocation: {currentUser.branch_name}
          </Badge>
        }
      />

      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Branch Identity &amp; Database Scoping</h2>
        <p className="text-xs text-slate-500 mb-4">
          Postgres RLS actively confines all read and write queries to this designated physical branch.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Branch Name &amp; ID
            </span>
            <p className="text-sm font-bold text-slate-900 mt-1">{currentUser.branch_name}</p>
            <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">{currentUser.branch_id}</code>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Zone Name &amp; ID
            </span>
            <p className="text-sm font-bold text-slate-900 mt-1">{currentUser.zone_name}</p>
            <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">{currentUser.zone_id}</code>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Verification Protocol Checklist</h3>
        <ul className="text-xs text-slate-600 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>CNIC Front &amp; Back: Inspect 13-digit Nadra number, expiry date, and official holographic seal.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Education &amp; Experience: Cross-check institution stamp and graduation certificate.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Driving License &amp; Utility Bill: Ensure address matches candidate's permanent or current domicile.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Digital Signature Hash: Cryptographic integrity seal applied to ensure anti-tamper compliance before Central HR review.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
