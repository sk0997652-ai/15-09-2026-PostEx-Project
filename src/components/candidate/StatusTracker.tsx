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

  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('tracker.statusApproved')}</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>{t('tracker.statusRejected')}</span>
          </span>
        );
      case 'needs_correction':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>{t('tracker.statusNeedsCorrection')}</span>
          </span>
        );
      case 'hr_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('tracker.statusHrReview')}</span>
          </span>
        );
      case 'bm_verification':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{status === 'bm_verification' ? t('tracker.statusBmVerification') : t('tracker.statusSubmitted')}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>{t('tracker.statusDraft')}</span>
          </span>
        );
    }
  };

  return (
    <div id="candidate-status-tracker-card" className="max-w-3xl mx-auto px-4 py-8">
      {/* Top Bar with Language Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {onBackToWelcome && (
              <button
                onClick={onBackToWelcome}
                id="tracker-back-to-welcome-btn"
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Welcome</span>
              </button>
            )}
            <button
              onClick={onBackToWizard}
              id="tracker-back-to-form-btn"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('common.backToForm')}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              {candidate.joining_id}
            </span>
            {getStatusBadge()}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-2">{t('tracker.title')}</h2>
          <p className="text-xs text-slate-600 mt-0.5">{t('tracker.subtitle')}</p>
        </div>
        <LanguageSelector />
      </div>

      {/* Action Required Banner if Needs Correction */}
      {status === 'approved' && (
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-white to-indigo-50/50 border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <VerificationStampSeal
            stage="central_approval"
            signerName="PostEx Central HR"
            code={candidate.joining_id}
            size="md"
            showDetails={false}
          />
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              {t('tracker.statusApproved')}
            </span>
            <h3 className="text-base font-black text-slate-900">
              Welcome to the PostEx Team!
            </h3>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed">
              Your onboarding application has been formally approved and enrolled. Official corporate seals and verification stamps have been applied to your permanent employee record.
            </p>
          </div>
        </div>
      )}

      {status === 'needs_correction' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                {t('tracker.correctionNotice')}
              </h3>
              {application?.decision_reason && (
                <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-slate-800 mt-2">
                  <span className="font-semibold text-amber-900 block mb-1">{t('tracker.remarksTitle')}</span>
                  <p className="font-medium text-slate-700">{application.decision_reason}</p>
                </div>
              )}
              <button
                onClick={onBackToWizard}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Update Application Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Stage Stepper Progression */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-6">
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
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Verified &bull; Complete
                      </span>
                    )}
                    {stg.isCurrent && !stg.isCompleted && (
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                        In Progress
                      </span>
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
      </div>

      {/* Branch Physical Verification Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-6">
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
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onBackToWizard}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.backToForm')}</span>
        </button>
      </div>
    </div>
  );
};
