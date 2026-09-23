import React from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { PageHeader, Button, Card, Input, Select, Textarea, Badge } from '../ui';

interface CreateJoinerViewProps {
  joinerForm: {
    full_name: string;
    cnic: string;
    mobile: string;
    email: string;
    designation_id: string;
    branch_id: string;
    track: 'executive' | 'non_executive';
    allow_duplicate_override: boolean;
    override_reason: string;
  };
  setJoinerForm: React.Dispatch<
    React.SetStateAction<{
      full_name: string;
      cnic: string;
      mobile: string;
      email: string;
      designation_id: string;
      branch_id: string;
      track: 'executive' | 'non_executive';
      allow_duplicate_override: boolean;
      override_reason: string;
    }>
  >;
  handleCreateJoiner: (e: React.FormEvent) => void;
  handleCnicBlur: () => void;
  duplicateWarning: {
    exists: boolean;
    candidate?: any;
  } | null;
  createdJoinerResult: {
    joining_id: string;
    candidate_name: string;
    mobile: string;
    email?: string;
    track: string;
  } | null;
  setCreatedJoinerResult: React.Dispatch<
    React.SetStateAction<{
      joining_id: string;
      candidate_name: string;
      mobile: string;
      email?: string;
      track: string;
    } | null>
  >;
  formOptions: {
    designations: Array<{ id: string; name: string; departments?: { name: string } }>;
    branches: Array<{ id: string; name: string; address?: string }>;
  };
  loading: boolean;
  zoneName: string;
  onNavigateToReviewQueue: () => void;
}

export function CreateJoinerView({
  joinerForm,
  setJoinerForm,
  handleCreateJoiner,
  handleCnicBlur,
  duplicateWarning,
  createdJoinerResult,
  setCreatedJoinerResult,
  formOptions,
  loading,
  zoneName,
  onNavigateToReviewQueue,
}: CreateJoinerViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Central HR — Register Candidate Joiner"
        description="Register a new candidate joiner with automated Joining ID generation and validation."
        badge={<Badge variant="primary">Zone Scope: {zoneName}</Badge>}
      />

      <Card className="p-6 sm:p-8">
        <div className="border-b border-slate-100 pb-5 mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Step 1: Joiner Intake</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Register Candidate Joiner</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enforce strict CNIC, mobile, and duplicate checking. On creation, a unique Joining ID (<code className="font-mono text-indigo-600">PX-YYYY-XXXXXX</code>) is auto-generated and dispatched via SMS/email.
          </p>
        </div>

        {/* Created Joiner Success Banner */}
        {createdJoinerResult && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Joiner Registered Successfully</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900 font-mono text-xs font-bold">
                {createdJoinerResult.joining_id}
              </span>
            </div>
            <div className="text-xs text-emerald-900 space-y-1 bg-white/70 p-3 rounded-xl border border-emerald-100 font-mono">
              <p><strong>Candidate:</strong> {createdJoinerResult.candidate_name}</p>
              <p><strong>Assigned Joining ID:</strong> {createdJoinerResult.joining_id}</p>
              <p>
                <strong>Assigned Track:</strong>{' '}
                <span className="capitalize font-bold text-indigo-700">
                  {createdJoinerResult.track === 'non_executive' ? 'Non-Executive Track' : 'Executive Track'}
                </span>
              </p>
              <p><strong>SMS Notification:</strong> Dispatched to {createdJoinerResult.mobile}</p>
              {createdJoinerResult.email && <p><strong>Email Notification:</strong> Dispatched to {createdJoinerResult.email}</p>}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onNavigateToReviewQueue();
                  setCreatedJoinerResult(null);
                }}
              >
                View in Review Queue
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreatedJoinerResult(null)}
              >
                Register Another Joiner
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateJoiner} className="space-y-5">
          {/* Track Selector */}
          <div id="joiner-track-selection-container">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Onboarding Job Track <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-indigo-600 font-semibold">
                Required — Candidate never chooses their own track
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                id="track-option-executive"
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  joinerForm.track === 'executive'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="job_track"
                  value="executive"
                  checked={joinerForm.track === 'executive'}
                  onChange={() => setJoinerForm({ ...joinerForm, track: 'executive' })}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Executive Track</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-bold">Standard Form</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    For Corporate, Management, Operations Execs &amp; Office Staff. Includes Education, Employment, Benefits &amp; Referees.
                  </p>
                </div>
              </label>

              <label
                id="track-option-non-executive"
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  joinerForm.track === 'non_executive'
                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="radio"
                  name="job_track"
                  value="non_executive"
                  checked={joinerForm.track === 'non_executive'}
                  onChange={() => setJoinerForm({ ...joinerForm, track: 'non_executive' })}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Non-Executive Track</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">Rider / Field Form</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    For Operational Frontline &amp; Field Staff. 8 sections: Employee Info, Address &amp; Family, Experience, Academic, Employment Record, References, Current Job Info &amp; Declaration.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <Input
              id="joiner-name-input"
              label="Candidate Full Name *"
              type="text"
              required
              placeholder="e.g. Muhammad Usman Ali"
              value={joinerForm.full_name}
              onChange={(e) => setJoinerForm({ ...joinerForm, full_name: e.target.value })}
            />
          </div>

          {/* CNIC with Pakistani Format Validation */}
          <div>
            <Input
              id="joiner-cnic-input"
              label="Pakistani CNIC (13 Digits) *"
              type="text"
              required
              placeholder="35202-1234567-1 or 3520212345671"
              value={joinerForm.cnic}
              onChange={(e) => setJoinerForm({ ...joinerForm, cnic: e.target.value })}
              onBlur={handleCnicBlur}
              maxLength={15}
              helperText="Must contain exactly 13 numeric digits. Hyphens are formatted automatically."
            />
          </div>

          {/* Duplicate CNIC Warning & Override Box */}
          {duplicateWarning?.exists && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Duplicate CNIC Detected in System</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    A candidate record with this CNIC already exists:
                  </p>
                  <div className="mt-2 text-[11px] bg-white/80 p-2.5 rounded-lg border border-amber-200 text-amber-900 font-mono space-y-0.5">
                    <p><strong>Name:</strong> {duplicateWarning.candidate?.full_name}</p>
                    <p><strong>Joining ID:</strong> {duplicateWarning.candidate?.joining_id}</p>
                    <p><strong>Zone/Branch:</strong> {duplicateWarning.candidate?.zone_name} / {duplicateWarning.candidate?.branch_name}</p>
                    <p><strong>Registered:</strong> {duplicateWarning.candidate?.created_at ? new Date(duplicateWarning.candidate.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200">
                <label className="flex items-start gap-2 text-xs font-semibold text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinerForm.allow_duplicate_override}
                    onChange={(e) => setJoinerForm({ ...joinerForm, allow_duplicate_override: e.target.checked })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Override Duplicate Warning (Requires Mandatory Justification Reason)</span>
                </label>

                {joinerForm.allow_duplicate_override && (
                  <div className="mt-3">
                    <Textarea
                      label="Override Justification Reason *"
                      rows={2}
                      required
                      placeholder="e.g. Re-joining candidate after seasonal contract expiration; approved by Zonal Head."
                      value={joinerForm.override_reason}
                      onChange={(e) => setJoinerForm({ ...joinerForm, override_reason: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                id="joiner-mobile-input"
                label="Mobile Number (Pakistani) *"
                type="tel"
                required
                placeholder="03001234567"
                value={joinerForm.mobile}
                onChange={(e) => setJoinerForm({ ...joinerForm, mobile: e.target.value })}
                leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                helperText="e.g. 03XXXXXXXXX or +923XXXXXXXXX"
              />
            </div>

            <div>
              <Input
                id="joiner-email-input"
                label="Email Address (Optional)"
                type="email"
                placeholder="candidate@example.com"
                value={joinerForm.email}
                onChange={(e) => setJoinerForm({ ...joinerForm, email: e.target.value })}
                leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              />
            </div>
          </div>

          {/* Designation & Branch Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                id="joiner-designation-select"
                label="Designation / Role Track"
                value={joinerForm.designation_id}
                onChange={(e) => setJoinerForm({ ...joinerForm, designation_id: e.target.value })}
                options={[
                  { value: '', label: 'Select Designation...' },
                  ...formOptions.designations.map((d) => ({
                    value: d.id,
                    label: `${d.name} ${d.departments ? `(${d.departments.name})` : ''}`,
                  })),
                ]}
              />
            </div>

            <div>
              <Select
                id="joiner-branch-select"
                label={`Branch / Hub (Scoped to ${zoneName}) *`}
                required
                value={joinerForm.branch_id}
                onChange={(e) => setJoinerForm({ ...joinerForm, branch_id: e.target.value })}
                options={[
                  { value: '', label: 'Select Branch...' },
                  ...formOptions.branches.map((b) => ({
                    value: b.id,
                    label: b.name,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="submit"
              id="submit-create-joiner-btn"
              variant="primary"
              size="lg"
              disabled={loading}
              isLoading={loading}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              {loading ? 'Generating Joining ID & Registering...' : 'Register Joiner & Issue Joining ID'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
