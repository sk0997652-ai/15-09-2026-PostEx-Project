import React, { useState, useEffect } from 'react';
import {
  Key,
  Smartphone,
  CreditCard,
  Hash,
  AlertCircle,
  CheckCircle,
  Clock,
  RotateCw,
} from 'lucide-react';
import {
  requestCandidateOtp,
  verifyCandidateOtp,
  getCandidateSession,
  clearCandidateSession,
  CandidateSession,
} from '../lib/candidateAuth';
import { CandidatePortal } from './candidate/CandidatePortal';
import { I18nProvider, LanguageSelector } from '../lib/i18n';
import { useBranding } from '../lib/branding';
import { Button, Input } from './ui';

const CandidateLoginFormInner: React.FC = () => {
  const { companyName, logoUrl, loginTagline } = useBranding();

  // Step 1: Candidate Verification Inputs
  const [joiningId, setJoiningId] = useState('PEX-2026-001');
  const [cnic, setCnic] = useState('35201-1234567-1');
  const [mobile, setMobile] = useState('03001234567');

  // Step 2: OTP Verification Inputs
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [testOtpNotice, setTestOtpNotice] = useState<string | null>(null);

  // Expiry timer & attempt counters
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);

  // Status & session state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [session, setSession] = useState<CandidateSession | null>(null);

  // Load existing session on mount
  useEffect(() => {
    const existing = getCandidateSession();
    if (existing) {
      setSession(existing);
    }
  }, []);

  // 5-minute OTP countdown timer
  useEffect(() => {
    if (step !== 'otp' || !otpExpiresAt) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(otpExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff === 0) {
        setErrorMessage('OTP expired. Please request a new OTP code.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, otpExpiresAt]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setTestOtpNotice(null);
    setIsLoading(true);

    try {
      const res = await requestCandidateOtp({
        joining_id: joiningId,
        cnic: cnic,
        mobile: mobile,
      });

      if (!res.success) {
        // [HARD RULE] Always deny access on failure
        setErrorMessage(res.error || 'Candidate identification failed.');
        setIsLoading(false);
        return;
      }

      setCandidateId(res.candidate_id || null);
      setOtpExpiresAt(res.expires_at || null);
      setAttemptsRemaining(5);
      setStep('otp');
      setSuccessMessage(res.message || '6-digit OTP code sent.');

      if (res.test_otp) {
        setTestOtpNotice(res.test_otp);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Authentication error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await verifyCandidateOtp({
        candidate_id: candidateId,
        otp: otp,
      });

      if (!res.success) {
        if (res.attempts_remaining !== undefined) {
          setAttemptsRemaining(res.attempts_remaining);
        }
        setErrorMessage(res.error || 'Invalid OTP.');
        setIsLoading(false);
        return;
      }

      if (res.session) {
        setSession(res.session);
        setSuccessMessage('Authentication successful. Welcome to your onboarding dashboard.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Verification error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    clearCandidateSession();
    setSession(null);
    setStep('credentials');
    setOtp('');
    setTestOtpNotice(null);
    setErrorMessage(null);
    setSuccessMessage('Candidate signed out.');
  };

  // 1. Authenticated Candidate View -> Full Candidate Experience Portal
  if (session) {
    return <CandidatePortal session={session} onSignOut={handleLogout} />;
  }

  // 2. Step 2: OTP Verification Screen (Modern Glass Card Layout)
  if (step === 'otp') {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    const isExpired = secondsRemaining === 0;

    return (
      <div
        id="candidate-otp-entry-card"
        className="backdrop-blur-md bg-white/90 border border-white/60 shadow-xl rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
      >
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Enter Verification OTP</h3>
              <p className="text-xs text-slate-500">6-digit SMS code sent for Joining ID {joiningId}</p>
            </div>
          </div>
          <LanguageSelector />
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {testOtpNotice && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Test Mode (SMS Stub):</span>
              <code className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold text-sm tracking-wider">
                {testOtpNotice}
              </code>
            </div>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => setOtp(testOtpNotice)}
              className="text-amber-900 border-amber-300 hover:bg-amber-100"
            >
              Fill Code
            </Button>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">6-Digit OTP</label>
              <div className="flex items-center gap-1 text-xs font-mono text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span className={isExpired ? 'text-rose-600 font-bold' : ''}>
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <Input
              id="candidate-otp-input"
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              required
              placeholder="123456"
              className="text-center tracking-[0.4em] font-mono text-lg font-bold"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 py-1">
            <span>
              Remaining attempts: <strong className="text-slate-800">{attemptsRemaining} / 5</strong>
            </span>
            <span className="text-[11px] text-slate-400">Max 5 attempts allowed [HARD RULE]</span>
          </div>

          <Button
            id="candidate-verify-otp-btn"
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading || otp.length !== 6 || isExpired}
            className="w-full"
          >
            {isLoading ? 'Verifying OTP...' : 'Verify OTP & Enter Portal'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => {
              setStep('credentials');
              setOtp('');
              setErrorMessage(null);
            }}
            className="w-full"
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Back to Candidate Identification
          </Button>
        </form>
      </div>
    );
  }

  // 3. Step 1: Credentials Entry Screen (Modern Glass Card Layout)
  return (
    <div
      id="candidate-login-card"
      className="backdrop-blur-md bg-white/90 border border-white/60 shadow-xl rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
    >
      {/* Brand Header */}
      <div className="text-center pb-5 border-b border-slate-200/80">
        <div className="flex items-center justify-between mb-3">
          <div className="w-8"></div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="h-10 max-h-12 max-w-[180px] object-contain mx-auto"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-xs">
              <Smartphone className="w-6 h-6" />
            </div>
          )}
          <LanguageSelector />
        </div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Candidate Portal Sign In</h2>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          {loginTagline || 'OTP-based workforce authentication for onboarding & dossier verification.'}
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleRequestOtp} className="mt-5 space-y-3.5">
        <Input
          id="candidate-joining-id-input"
          label="Joining ID"
          type="text"
          value={joiningId}
          onChange={(e) => setJoiningId(e.target.value)}
          required
          placeholder="e.g. PEX-2026-001"
          className="uppercase font-mono"
          leftIcon={<Hash className="w-4 h-4" />}
        />

        <Input
          id="candidate-cnic-input"
          label="CNIC (National ID)"
          type="text"
          value={cnic}
          onChange={(e) => setCnic(e.target.value)}
          required
          placeholder="35201-1234567-1"
          className="font-mono"
          leftIcon={<CreditCard className="w-4 h-4" />}
        />

        <Input
          id="candidate-mobile-input"
          label="Registered Mobile Number"
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
          placeholder="03001234567"
          className="font-mono"
          leftIcon={<Smartphone className="w-4 h-4" />}
        />

        <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Seed Candidate Credentials:</p>
          <p>
            Joining ID: <code className="text-slate-800 font-mono font-medium">PEX-2026-001</code>
          </p>
          <p>
            CNIC: <code className="text-slate-800 font-mono font-medium">35201-1234567-1</code> | Mobile:{' '}
            <code className="text-slate-800 font-mono font-medium">03001234567</code>
          </p>
          <p className="text-[11px] text-slate-400">
            Rate limited to max 3 OTP requests per 15 minutes [HARD RULE].
          </p>
        </div>

        <Button
          id="candidate-request-otp-btn"
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="w-full"
        >
          {isLoading ? 'Verifying Candidate Record...' : 'Send 6-Digit OTP'}
        </Button>
      </form>
    </div>
  );
};

export const CandidateLoginForm: React.FC = () => {
  return (
    <I18nProvider>
      <CandidateLoginFormInner />
    </I18nProvider>
  );
};
