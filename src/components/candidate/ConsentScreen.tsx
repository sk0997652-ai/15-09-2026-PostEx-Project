import React, { useState } from 'react';
import { ShieldCheck, FileText, AlertTriangle, Lock, Check } from 'lucide-react';
import { useI18n, LanguageSelector } from '../../lib/i18n';
import { useBranding } from '../../lib/branding';
import { logCandidateConsent } from '../../lib/candidateApi';

interface ConsentScreenProps {
  candidate: {
    id: string;
    full_name: string;
    joining_id: string;
    cnic: string;
  };
  onConsentAccepted: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ candidate, onConsentAccepted }) => {
  const { t, isRTL } = useI18n();
  const { branding } = useBranding();
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canProceed = check1 && check2 && check3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) {
      setErrorMessage(t('consent.mustCheckAll'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await logCandidateConsent(true);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to record consent. Please try again.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onConsentAccepted();
  };

  return (
    <div id="candidate-consent-screen" className="max-w-3xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
              {candidate.joining_id}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              CNIC: {candidate.cnic}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">{t('consent.title')}</h2>
          <p className="text-xs text-slate-600 mt-0.5">{t('consent.subtitle')}</p>
        </div>
        <LanguageSelector />
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Legal Disclosure Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">{t('consent.legalNotice')}</h3>
            <p className="text-[11px] text-slate-400">{branding.companyName} HR Corporate Policy &bull; Legal Compliance</p>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
          {/* Term 1 */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>1. {t('consent.term1Title')}</span>
            </div>
            <p className="text-slate-600 ps-6">{t('consent.term1Desc')}</p>
          </div>

          {/* Term 2 */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
              <Check className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>2. {t('consent.term2Title')}</span>
            </div>
            <p className="text-slate-600 ps-6">{t('consent.term2Desc')}</p>
          </div>

          {/* Term 3 */}
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 font-bold text-rose-700 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>3. {t('consent.term3Title')}</span>
            </div>
            <p className="text-slate-600 ps-6">{t('consent.term3Desc')}</p>
          </div>

          {/* Term 4 */}
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>4. {t('consent.term4Title')}</span>
            </div>
            <p className="text-slate-600 ps-6">{t('consent.term4Desc')}</p>
          </div>
        </div>
      </div>

      {/* Checkbox Agreements */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
          Declaration &amp; Electronic Signature
        </h4>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            id="consent-check-1"
            checked={check1}
            onChange={(e) => setCheck1(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-800 font-medium leading-snug">
            {t('consent.check1')}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            id="consent-check-2"
            checked={check2}
            onChange={(e) => setCheck2(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-800 font-medium leading-snug">
            {t('consent.check2')}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            id="consent-check-3"
            checked={check3}
            onChange={(e) => setCheck3(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-800 font-medium leading-snug">
            {t('consent.check3')}
          </span>
        </label>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Candidate: <strong className="text-slate-800">{candidate.full_name}</strong>
          </span>
          <button
            type="submit"
            id="candidate-accept-consent-btn"
            disabled={!canProceed || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
          >
            {isSubmitting ? (
              <span>{t('common.loading')}</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{t('consent.acceptButton')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
