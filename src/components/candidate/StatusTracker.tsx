import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  MapPin,
  Calendar,
  FileText,
  ArrowLeft,
  Stamp,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { useI18n, LanguageSelector } from '../../lib/i18n';
import { VerificationStampSeal } from '../common/VerificationStampSeal';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, StatusBadge, PageHeader } from '../ui';

interface StatusTrackerProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
    mobile: string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  application: {
    id: string;
    status: string;
    current_step: number;
    submitted_at?: string;
    decision_reason?: string;
  } | null;
  onBackToWizard: () => void;
  onBackToWelcome?: () => void;
}

export const StatusTracker: React.FC<StatusTrackerProps> = ({
  candidate,
  application,
  onBackToWizard,
  onBackToWelcome,
}) => {
  const { t } = useI18n();

  const status = application?.status || 'draft';

  // Determine stage progression
  // Stages: 1 = Submitted, 2 = Branch Verification, 3 = Central HR Audit, 4 = Final Approval
  let currentStageIndex = 0;
  if (status === 'draft') currentStageIndex = 0;
  else if (status === 'submitted') currentStageIndex = 1;
  else if (status === 'bm_verification') currentStageIndex = 2;
  else if (status === 'needs_correction') currentStageIndex = 2; // Needs correction at verification stage
  else if (status === 'hr_review') currentStageIndex = 3;
  else if (status === 'approved') currentStageIndex = 4;
  else if (status === 'rejected') currentStageIndex = 4;

  const stages = [
    {
      id: 1,
      title: t('tracker.stage1Title'),
      desc: t('tracker.stage1Desc'),
      icon: FileText,
      isCompleted: currentStageIndex >= 1,
      isCurrent: currentStageIndex === 0 || (currentStageIndex === 1 && status === 'submitted'),
    },
    {
      id: 2,
      title: t('tracker.stage2Title'),
      desc: t('tracker.stage2Desc'),
      icon: Stamp,
      isCompleted: currentStageIndex > 2,
      isCurrent: currentStageIndex === 2,
    },
    {
      id: 3,
      title: t('tracker.stage3Title'),
      desc: t('tracker.stage3Desc'),
      icon: UserCheck,
      isCompleted: currentStageIndex > 3,
      isCurrent: currentStageIndex === 3,
    },
    {
      id: 4,
      title: t('tracker.stage4Title'),
      desc: t('tracker.stage4Desc'),
      icon: CheckCircle,
      isCompleted: status === 'approved',
      isCurrent: currentStageIndex === 4 && status !== 'approved',
    },
  ];

  return (
    <div id="candidate-status-tracker-card" className="max-w-3xl mx-auto px-4 py-8">
      {/* Top Bar with Language Selector and Navigation */}
      <PageHeader
        title={t('tracker.title')}
        description={t('tracker.subtitle')}
        roleContext={`Candidate ${candidate.joining_id}`}
        breadcrumbs={[
          ...(onBackToWelcome ? [{ label: 'Welcome', onClick: onBackToWelcome }] : []),
          { label: 'Joining Dossier', onClick: onBackToWizard },
          { label: 'Status Tracker' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <LanguageSelector />
          </div>
        }
        className="mb-6 pb-6 border-b border-slate-200"
      />

      {/* Action Required Banner if Approved */}
      {status === 'approved' && (
        <Card className="mb-6 p-6 rounded-2xl bg-linear-to-r from-emerald-50/70 via-white to-indigo-50/50 border-emerald-200 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <VerificationStampSeal
            stage="central_approval"
            signerName="PostEx Central HR"
            code={candidate.joining_id}
            size="md"
            showDetails={false}
          />
          <div className="space-y-1">
            <StatusBadge status="approved" size="sm" />
            <h3 className="text-base font-black text-slate-900">
              Welcome to the PostEx Team!
            </h3>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed">
              Your onboarding application has been formally approved and enrolled. Official corporate seals and verification stamps have been applied to your permanent employee record.
            </p>
          </div>
        </Card>
      )}

      {/* Action Required Banner if Needs Correction */}
      {status === 'needs_correction' && (
        <Card className="mb-6 p-4 rounded-2xl bg-amber-50 border-amber-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                {t('tracker.correctionNotice')}
              </h3>
              {application?.decision_reason && (
                <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-slate-800 mt-2">
                  <span className="font-semibold text-amber-900 block mb-1">{t('tracker.remarksTitle')}</span>
                  <p className="font-medium text-slate-700">{application.decision_reason}</p>
                </div>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={onBackToWizard}
                className="mt-2 bg-amber-600 hover:bg-amber-700"
              >
                Update Application Details
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 4-Stage Stepper Progression */}
      <Card className="rounded-2xl border-slate-200 p-6 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
          Onboarding Lifecycle Stages
        </h3>

        <div className="space-y-6">
          {stages.map((stg, idx) => {
            const Icon = stg.icon;
            const isLast = idx === stages.length - 1;

            return (
              <div key={stg.id} className="relative flex items-start gap-4">
                {/* Connecting Vertical Line */}
                {!isLast && (
                  <div
                    className={`absolute left-5 top-10 bottom-0 w-0.5 -mb-6 ${
                      stg.isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Stage Icon Node */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 ${
                    stg.isCompleted
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : stg.isCurrent
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {stg.isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Stage Details */}
                <div className="flex-1 pt-1 pb-4">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`text-sm font-bold ${
                        stg.isCurrent
                          ? 'text-indigo-900'
                          : stg.isCompleted
                          ? 'text-slate-900'
                          : 'text-slate-400'
                      }`}
                    >
                      {stg.title}
                    </h4>
                    {stg.isCompleted && (
                      <StatusBadge status="approved" customLabel="Verified • Complete" />
                    )}
                    {stg.isCurrent && !stg.isCompleted && (
                      <StatusBadge
                        status={status === 'needs_correction' && stg.id === 2 ? 'needs_correction' : 'hr_review'}
                        customLabel={status === 'needs_correction' && stg.id === 2 ? 'Needs Correction' : 'In Progress'}
                      />
                    )}
                    {!stg.isCompleted && !stg.isCurrent && (
                      <StatusBadge status="draft" customLabel="Pending" dot={false} />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {stg.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Branch Physical Verification Instructions */}
      <Card className="rounded-2xl border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">{t('tracker.assignedBranch')}</h3>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 text-sm">
                {candidate.branches?.name || 'PostEx Regional Branch Hub'}
              </span>
              <p className="text-slate-500 mt-0.5">
                {candidate.branches?.address || 'Main Commercial Boulevard, Near Hub Depot, Lahore, Pakistan'}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Working Hours: Mon–Sat, 9:00 AM – 6:00 PM</span>
            </span>
            <span className="font-semibold text-indigo-700">Bring Original CNIC &amp; Degrees</span>
          </div>
        </div>
      </Card>

      {/* Bottom Navigation */}
      <div className="flex justify-between items-center pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={onBackToWizard}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          {t('common.backToForm')}
        </Button>
      </div>
    </div>
  );
};
