import React, { useState, useEffect } from 'react';
import { LogOut, Sparkles } from 'lucide-react';
import { I18nProvider, LanguageSelector, useI18n } from '../../lib/i18n';
import { useBranding } from '../../lib/branding';
import { CandidateSessionState } from '../../lib/candidateAuth';
import { fetchCandidateApplication, CandidateApplicationResponse } from '../../lib/candidateApi';
import { LanguageScreen } from './LanguageScreen';
import { ConsentScreen } from './ConsentScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { CandidateWizard } from './CandidateWizard';
import { StatusTracker } from './StatusTracker';

interface CandidatePortalProps {
  session: CandidateSessionState;
  onSignOut: () => void;
}

const PortalInner: React.FC<CandidatePortalProps> = ({ session, onSignOut }) => {
  const { t } = useI18n();
  const { branding } = useBranding();
  const [appData, setAppData] = useState<CandidateApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'language' | 'consent' | 'welcome' | 'wizard' | 'tracker'>('language');

  const loadApplication = async () => {
    setLoading(true);
    const res = await fetchCandidateApplication();
    setAppData(res);
    setLoading(false);

    const hasSelectedLang = typeof window !== 'undefined' && sessionStorage.getItem('pex_candidate_lang_selected');

    if (res.success) {
      if (!hasSelectedLang) {
        setCurrentView('language');
      } else if (!res.consentGiven) {
        setCurrentView('consent');
      } else {
        // Strictly route to Welcome screen - never skip Welcome to tracker or wizard
        setCurrentView('welcome');
      }
    } else {
      if (!hasSelectedLang) {
        setCurrentView('language');
      } else {
        setCurrentView('consent');
      }
    }
  };

  useEffect(() => {
    loadApplication();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">{t('common.loading')}</p>
        <p className="text-xs text-slate-400 mt-1">Fetching candidate record &amp; joining dossier...</p>
      </div>
    );
  }

  const candidate = appData?.candidate || session.candidate;
  const application = appData?.application || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Application Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                {branding.companyName} <span className="text-slate-400 font-normal">| {t('app.title')}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentView !== 'language' && currentView !== 'consent' && currentView !== 'welcome' && (
              <button
                type="button"
                onClick={() => setCurrentView('welcome')}
                id="candidate-nav-welcome-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('welcome.portalHome', 'Welcome')}</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-bold text-slate-900">{session.candidate.full_name}</span>
              <span className="text-indigo-700 font-mono text-[11px] font-semibold">({session.candidate.joining_id})</span>
            </div>

            <LanguageSelector />

            <button
              onClick={onSignOut}
              id="candidate-portal-signout-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('common.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container View Switcher: Login -> Language -> Consent -> Welcome -> Wizard -> Tracker */}
      <main className="flex-1 w-full pb-12">
        {currentView === 'language' && (
          <LanguageScreen
            candidateName={candidate.full_name}
            joiningId={candidate.joining_id}
            onLanguageSelected={() => {
              if (appData && !appData.consentGiven) {
                setCurrentView('consent');
              } else {
                // Strictly route to Welcome screen next
                setCurrentView('welcome');
              }
            }}
          />
        )}

        {currentView === 'consent' && (
          <ConsentScreen
            candidate={candidate}
            onConsentAccepted={() => {
              // Strictly route to Welcome screen next
              setCurrentView('welcome');
            }}
          />
        )}

        {currentView === 'welcome' && (
          <WelcomeScreen
            candidate={candidate}
            application={application}
            onStartWizard={() => setCurrentView('wizard')}
            onViewStatusTracker={() => setCurrentView('tracker')}
          />
        )}

        {currentView === 'wizard' && (
          <CandidateWizard
            candidate={candidate}
            initialApplication={application}
            onSubmitted={() => {
              loadApplication();
              setCurrentView('tracker');
            }}
            onViewStatusTracker={() => setCurrentView('tracker')}
          />
        )}

        {currentView === 'tracker' && (
          <StatusTracker
            candidate={candidate}
            application={application}
            onBackToWizard={() => setCurrentView('wizard')}
            onBackToWelcome={() => setCurrentView('welcome')}
          />
        )}
      </main>
    </div>
  );
};

export const CandidatePortal: React.FC<CandidatePortalProps> = (props) => {
  return (
    <I18nProvider>
      <PortalInner {...props} />
    </I18nProvider>
  );
};
