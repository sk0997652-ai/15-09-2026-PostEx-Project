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
} from 'lucide-react';
import {
  signInStaff,
  updateStaffPassword,
  checkStaffSession,
  signOutStaff,
} from '../lib/staffAuth';
import { validateStaffPassword } from '../lib/passwordPolicy';

interface StaffLoginFormProps {
  onLoginSuccess?: () => void;
  isEmbedded?: boolean;
}

export const StaffLoginForm: React.FC<StaffLoginFormProps> = ({ onLoginSuccess }) => {
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
        // [HARD RULE] Deny access on failure
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

  // Forced Password Change Screen
  if (isForcedChange) {
    return (
      <div id="staff-forced-password-card" className="bg-white rounded-xl border border-amber-200 p-6 shadow-xs max-w-lg mx-auto">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Set Permanent Password</h3>
            <p className="text-xs text-amber-700">Initial temporary password change is strictly required [HARD RULE].</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input
                id="new-staff-password-input"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg pr-10 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <input
              id="confirm-staff-password-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Password Policy Live Requirements */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
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

          <button
            id="submit-new-password-btn"
            type="submit"
            disabled={isLoading || !policyCheck.isValid || newPassword !== confirmPassword}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'Updating Password...' : 'Save New Password & Continue'}
          </button>
        </form>
      </div>
    );
  }

  // Authenticated State View (If already signed in)
  if (sessionUser && !isForcedChange) {
    return (
      <div id="staff-auth-session-card" className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-lg mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Staff Authenticated</h3>
              <span className="text-xs text-slate-500 font-mono">8-Hour Active Session</span>
            </div>
          </div>
          <button
            id="staff-logout-btn"
            onClick={handleLogout}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Name</span>
            <span className="text-slate-900 font-semibold">{sessionUser.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Email</span>
            <span className="text-slate-900 font-mono">{sessionUser.email}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Staff ID</span>
            <span className="text-slate-900 font-mono truncate max-w-[200px]">{sessionUser.id}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Assigned Role</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-medium uppercase text-[11px] border border-emerald-200">
              {sessionUser.role}
            </span>
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
            <button
              onClick={() => onLoginSuccess()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Open Role Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Identity verified via Supabase Auth</span>
          </p>
          <p className="text-emerald-700 mt-0.5">
            Session governed by 8-hour maximum lifetime without guest or impersonation bypasses.
          </p>
        </div>
      </div>
    );
  }

  // Standard Login Screen
  return (
    <div id="staff-login-card" className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs max-w-lg mx-auto">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Staff &amp; Admin Sign In</h3>
          <p className="text-xs text-slate-500">Super Admin, Zonal HR, Central HR, Branch Managers</p>
        </div>
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

      <form onSubmit={handleLogin} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
          <div className="relative">
            <input
              id="staff-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="e.g. syedwaqarahmed@postex.pk"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <input
              id="staff-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter account password"
              className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Seed Super Admin Credentials:</p>
          <p>
            Email: <code className="text-slate-800 font-mono font-medium">admin@postex.pk</code>
          </p>
          <p>
            Temp Password: <code className="text-slate-800 font-mono font-medium">PostExAdmin2026!</code>
          </p>
        </div>

        <button
          id="staff-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? 'Verifying Identity...' : 'Sign In as Staff'}
        </button>
      </form>
    </div>
  );
};
