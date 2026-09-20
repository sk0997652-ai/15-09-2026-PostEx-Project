import React from 'react';
import {
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { VerificationStampSeal } from '../common/VerificationStampSeal';

interface SubmissionConfirmationModalProps {
  candidate: {
    full_name: string;
    joining_id: string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  submittedAt: string;
  onProceedToTracker: () => void;
}

export const SubmissionConfirmationModal: React.FC<SubmissionConfirmationModalProps> = ({
  candidate,
  submittedAt,
  onProceedToTracker,
}) => {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="candidate-submission-confirmation-card"
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100"
      >
        {/* Top Header Banner */}
        <div className="p-8 bg-gradient-to-b from-indigo-50/60 to-white text-center border-b border-indigo-100 flex flex-col items-center">
          <div className="mb-4">
            <VerificationStampSeal
              stage="candidate_signature"
              signerName={candidate.full_name}
              code={candidate.joining_id}
              timestamp={submittedAt}
              size="md"
              showDetails={false}
            />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold mb-2">
            Application Dossier Locked &amp; Submitted
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Congratulations, {candidate.full_name}!
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            Your onboarding application has been successfully attested and routed for official branch verification.
          </p>
        </div>

        {/* Dossier Routing Summary Card */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Joining Reference ID</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">{candidate.joining_id}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Verification Branch</span>
              </span>
              <span className="font-bold text-slate-800">{candidate.branches?.name || 'Assigned Branch Hub'}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Submission Timestamp</span>
              </span>
              <span className="font-mono text-slate-700">
                {new Date(submittedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Current Status</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Branch Manager Verification
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>Next Verification Milestone:</span>
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Your assigned Branch Manager will review your digital application and physically verify your original CNIC and academic credentials at the hub.
            </p>
          </div>

          <button
            type="button"
            id="modal-proceed-to-tracker-btn"
            onClick={onProceedToTracker}
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>Track Application Progress</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
