import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle,
  LogOut,
  UserCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
} from 'lucide-react';
import {
  signInStaff,
  updateStaffPassword,
  checkStaffSession,
  signOutStaff,
} from '../lib/staffAuth';
import { validateStaffPassword } from '../lib/passwordPolicy';
import { useBranding } from '../lib/branding';
import { Badge, Button, Input } from './ui';
import { toTitleCase } from '../lib/formatText';

interface StaffLoginFormProps {
  onLoginSuccess?: () => void;
  isEmbedded?: boolean;
}

export const StaffLoginForm: React.FC<StaffLoginFormProps> = ({ onLoginSuccess }) => {
  const { companyName, logoUrl, loginTagline } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forced password change state
  const [isForcedChange, setIsForcedChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & session state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<{
    id: string;
    email: string;
    name?: string;
    role?: string;
    zone_id?: string;
    zone_name?: string;
  } | null>(null);

  // Check existing session
  useEffect(() => {
    async function loadSession() {
      const state = await checkStaffSession();
      if (state.isAuthenticated && state.user) {
        setSessionUser(state.user);
        setIsForcedChange(state.mustChangePassword);
      }
    }
    loadSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const result = await signInStaff(email, password);

      if (!result.success) {
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
        setIsLoading(false);
        return;
      }

      if (result.mustChangePassword) {
        setIsForcedChange(true);
        setSuccessMessage('First-time login detected. You must set a permanent password before continuing.');
      } else {
        const session = await checkStaffSession();
        setSessionUser(session.user);
        setSuccessMessage('Authentication successful. Redirecting to your dashboard...');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Login error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const policy = validateStaffPassword(newPassword);
    if (!policy.isValid) {
      setErrorMessage(policy.errors.join(' '));
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateStaffPassword(newPassword);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update password.');
        setIsLoading(false);
        return;
      }

      setIsForcedChange(false);
      setSuccessMessage('Password updated successfully. Access granted.');
      const session = await checkStaffSession();
      setSessionUser(session.user);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Password change failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await signOutStaff();
    setSessionUser(null);
    setIsForcedChange(false);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage('Signed out successfully.');
    setIsLoading(false);
  };

  // Password policy live verification for forced change
  const policyCheck = validateStaffPassword(newPassword);

  // Forced Password Change Screen (Glass Card)
  if (isForcedChange) {
    return (
      <div
        id="staff-forced-password-card"
        className="backdrop-blur-md bg-white/90 border border-white/60 shadow-xl rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200/80">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-card-heading text-slate-900">Set Permanent Password</h3>
            <p className="text-caption text-amber-700">For your security, please set a permanent password before continuing.</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-caption rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-caption rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-4 space-y-4">
          <Input
            id="new-staff-password-input"
            label="New Password"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter new password"
            rightIcon={
              <span
                role="button"
                tabIndex={0}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowNewPassword(!showNewPassword)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowNewPassword(!showNewPassword);
                  }
                }}
                className="pointer-events-auto text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </span>
            }
          />

          <Input
            id="confirm-staff-password-input"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Re-enter new password"
          />

          {/* Password Policy Live Requirements */}
          <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 text-caption space-y-1.5">
            <span className="font-semibold text-slate-700 block mb-1">Password Policy Requirements:</span>
            <div className={`flex items-center gap-1.5 ${policyCheck.rules.minLength ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle className={`w-3.5 h-3.5 ${policyCheck.rules.minLength ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>Minimum 10 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${policyCheck.rules.hasLetter ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle className={`w-3.5 h-3.5 ${policyCheck.rules.hasLetter ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>At least one letter (a-z, A-Z)</span>
            </div>
            <div className={`flex items-center gap-1.5 ${policyCheck.rules.hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
              <CheckCircle className={`w-3.5 h-3.5 ${policyCheck.rules.hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>At least one number (0-9)</span>
            </div>
          </div>

          <Button
            id="submit-new-password-btn"
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading || !policyCheck.isValid || newPassword !== confirmPassword}
            className="w-full"
          >
            Save New Password &amp; Continue
          </Button>
        </form>
      </div>
    );
  }

  // Authenticated State View (If already signed in) (Glass Card)
  if (sessionUser && !isForcedChange) {
    return (
      <div
        id="staff-auth-session-card"
        className="backdrop-blur-md bg-white/90 border border-white/60 shadow-xl rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-card-heading text-slate-900">Staff Authenticated</h3>
              <span className="text-caption text-slate-500 font-mono">Active Corporate Session</span>
            </div>
          </div>
          <Button
            id="staff-logout-btn"
            variant="secondary"
            size="small"
            onClick={handleLogout}
            disabled={isLoading}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>

        <div className="mt-4 space-y-2.5 text-caption">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Name</span>
            <span className="text-slate-900 font-semibold">{toTitleCase(sessionUser.name)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Email</span>
            <span className="text-slate-900 font-mono">{sessionUser.email}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Staff ID</span>
            <span className="text-slate-900 font-mono truncate max-w-[200px]">{sessionUser.id}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Assigned Role</span>
            <Badge variant="primary">{sessionUser.role?.replace(/_/g, ' ')}</Badge>
          </div>
          {sessionUser.zone_name && (
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-medium">Assigned Zone</span>
              <span className="text-slate-900 font-semibold">{sessionUser.zone_name}</span>
            </div>
          )}
        </div>

        {onLoginSuccess && (
          <div className="mt-5">
            <Button
              onClick={() => onLoginSuccess()}
              variant="primary"
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Role Dashboard
            </Button>
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-caption">
          <p className="font-medium flex items-center gap-1.5 text-slate-900">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Corporate account verified</span>
          </p>
          <p className="text-slate-500 mt-0.5">
            Your active session remains valid for up to 8 hours.
          </p>
        </div>
      </div>
    );
  }

  // Standard Login Screen (Modern Glass Card Layout)
  return (
    <div
      id="staff-login-card"
      className="backdrop-blur-md bg-white/90 border border-white/60 shadow-xl rounded-2xl p-6 sm:p-8 max-w-lg mx-auto"
    >
      {/* Brand Header */}
      <div className="text-center pb-5 border-b border-slate-200/80">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="h-10 max-h-12 max-w-[180px] object-contain mx-auto mb-2"
          />
        ) : (
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 mb-2 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
        )}
        <h2 className="text-card-heading text-slate-900 tracking-tight">Staff &amp; Admin Sign In</h2>
        <p className="text-caption text-slate-600 mt-1 leading-relaxed">
          {loginTagline || 'Sign in with your corporate credentials to manage your team and operations.'}
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-caption rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-caption rounded-lg flex items-start gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="mt-5 space-y-4">
        <Input
          id="staff-email-input"
          label="Corporate Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="e.g. name@postex.pk"
          leftIcon={<Mail className="w-4 h-4" />}
        />

        <Input
          id="staff-password-input"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter account password"
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <span
              role="button"
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowPassword(!showPassword);
                }
              }}
              className="pointer-events-auto text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </span>
          }
        />

        <Button
          id="staff-submit-btn"
          type="submit"
          variant="primary"
          isLoading={isLoading}
          className="w-full"
        >
          Sign In as Staff
        </Button>
      </form>
    </div>
  );
};
