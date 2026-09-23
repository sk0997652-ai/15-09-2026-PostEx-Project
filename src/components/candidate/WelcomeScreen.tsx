import React from 'react';
import {
  Sparkles,
  Building2,
  MapPin,
  Briefcase,
  Clock,
  CheckCircle2,
  ArrowRight,
  Shield,
  FileCheck,
  Layers,
  FileText,
  UploadCloud,
  IdCard,
  GraduationCap,
  Camera,
  Check,
} from 'lucide-react';
import { useI18n, LanguageSelector } from '../../lib/i18n';
import { useBranding } from '../../lib/branding';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, PageHeader } from '../ui';

interface WelcomeScreenProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
    mobile: string;
    track?: string;
    designation?: string;
    branches?: { name: string; address?: string };
    zones?: { name: string };
  };
  application: {
    id: string;
    status: string;
    current_step: number;
    submitted_at?: string;
  } | null;
  onStartWizard: () => void;
  onViewStatusTracker: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  candidate,
  application,
  onStartWizard,
  onViewStatusTracker,
}) => {
  const { t, isRTL } = useI18n();
  const { branding } = useBranding();

  const isSubmitted = application && application.status !== 'draft';
  const hasStarted = application && application.current_step > 1;
  const isExecutive = candidate.track === 'executive' || !candidate.track;

  const roleTitle =
    candidate.designation ||
    (isExecutive ? 'Operations Executive' : 'Courier & Logistics Associate');

  return (
    <div id="candidate-welcome-screen" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-in fade-in-50 duration-300">
      {/* Top Header Card */}
      <Card className="rounded-3xl border-slate-200/80 p-6 sm:p-8 mb-6 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />

        <PageHeader
          title={isRTL ? `خوش آمدید، ${candidate.full_name}!` : `Welcome aboard, ${candidate.full_name}!`}
          description={
            t('welcome.subtitle') ||
            `Congratulations on joining the team! We are thrilled to welcome you. Please take a few moments to review your offer profile snapshot and complete your digital joining dossier.`
          }
          roleContext={`${branding.companyName} Onboarding • ${candidate.joining_id}`}
          actions={<LanguageSelector />}
          className="mb-6 pb-6 border-b border-slate-100"
        />

        {/* Profile Snapshot Grid */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Profile Snapshot (Central HR Verified)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
            <div className="p-2">
              <span className="text-slate-500 font-medium block">{t('welcome.joiningId')}</span>
              <p className="font-mono font-bold text-indigo-700 text-sm mt-0.5">{candidate.joining_id}</p>
            </div>

            <div className="p-2">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Role</span>
              </span>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate" title={roleTitle}>
                {roleTitle}
              </p>
            </div>

            <div className="p-2">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Track</span>
              </span>
              <span id="candidate-welcome-track-badge">
                <Badge
                  variant={isExecutive ? 'primary' : 'success'}
                  size="sm"
                  className="mt-1 font-bold inline-block"
                >
                  {isExecutive ? 'Executive Track' : 'Non-Executive Track'}
                </Badge>
              </span>
            </div>

            <div className="p-2">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Hub</span>
              </span>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate" title={candidate.branches?.name}>
                {candidate.branches?.name || 'Assigned Branch Hub'}
              </p>
            </div>

            <div className="p-2">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Region / Zone</span>
              </span>
              <p className="font-bold text-slate-800 text-sm mt-0.5 truncate" title={candidate.zones?.name}>
                {candidate.zones?.name || 'Assigned Zone'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Two Column Section: Document Checklist & Process Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Document Checklist (Span 2) */}
        <Card className="md:col-span-2 rounded-3xl border-slate-200/80 p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <UploadCloud className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Required Documents Checklist</h3>
                <p className="text-xs text-slate-500">Prepare these files before you proceed with the wizard</p>
              </div>
            </div>
            <Badge variant="outline" size="sm" className="font-semibold text-slate-500">
              Max 5MB each &bull; JPG, PNG, PDF
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <IdCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">1. CNIC (Front &amp; Back)</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">NADRA computerized National Identity Card</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">2. Recent Photograph</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Passport-size formal photo (camera supported)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">3. Educational Certificates</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Highest degree, diploma, or matric transcript</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">4. Work Experience / Other Docs</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Previous employer letters or resume</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Process & Time Card (Span 1) */}
        <Card className="rounded-3xl border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">Estimated Time</h3>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 mb-4">
              <span className="text-2xl font-black text-indigo-900 block">10 &ndash; 15 mins</span>
              <span className="text-xs text-indigo-700 font-medium">To complete all form sections and upload documents</span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Continuous autosave protects your progress at each step</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Digital touch/mouse signature at final submission</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Instant status tracking once forwarded for review</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Encrypted under NADRA &amp; ETO 2002 guidelines</span>
          </div>
        </Card>
      </div>

      {/* Action Footer Card */}
      <Card className="rounded-3xl border-slate-200/80 p-6">
        {isSubmitted ? (
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Application Submitted</p>
                <p className="text-xs text-slate-500">Your joining dossier is currently in review.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="primary"
                size="md"
                onClick={onViewStatusTracker}
                id="candidate-view-tracker-btn"
                leftIcon={<FileCheck className="w-4 h-4" />}
                className="flex-1 sm:flex-initial"
              >
                View Status Tracker
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={onStartWizard}
                id="candidate-review-form-btn"
                className="flex-1 sm:flex-initial"
              >
                Review Form
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">
                {hasStarted
                  ? `You have already begun Step ${application?.current_step || 1}. Pick up right where you left off.`
                  : `Ready to get started? Fill in your bio, contact info, and upload your documents.`}
              </p>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              {application && hasStarted && (
                <button
                  type="button"
                  onClick={onViewStatusTracker}
                  id="candidate-check-status-btn"
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer underline underline-offset-4"
                >
                  View Status
                </button>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={onStartWizard}
                id="candidate-start-wizard-btn"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto shadow-md shadow-indigo-600/20"
              >
                {hasStarted ? 'Continue Digital Onboarding' : 'Begin Application'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
