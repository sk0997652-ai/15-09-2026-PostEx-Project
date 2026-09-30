/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ConnectivityStatus } from './components/ConnectivityStatus';
import { StaffLoginForm } from './components/StaffLoginForm';
import { CandidateLoginForm } from './components/CandidateLoginForm';
import { RbacTestingPanel } from './components/RbacTestingPanel';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { ZonalHrDashboard } from './components/ZonalHrDashboard';
import { CentralHrDashboard } from './components/CentralHrDashboard';
import { BranchManagerDashboard } from './components/BranchManagerDashboard';
import { checkStaffSession, signOutStaff } from './lib/staffAuth';
import { supabase } from './lib/supabase';
import { Building2, Shield, Users, Smartphone, Activity, Lock, Wrench, ChevronDown, UserCheck, LogOut, Sparkles, Menu, Bell } from 'lucide-react';
import { ComponentLibraryShowcase } from './components/ui/ComponentLibraryShowcase';
import { Button } from './components/ui';
import { useBranding } from './lib/branding';
import { toTitleCase } from './lib/formatText';

export default function App() {
  const { companyName, portalName, logoUrl, loginBgUrl, defaultLoginBg } = useBranding();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name?: string;
    role?: string;
    zone_id?: string;
    zone_name?: string;
    branch_id?: string;
    branch_name?: string;
  } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeDevTab, setActiveDevTab] = useState<'none' | 'rbac' | 'auth' | 'connectivity' | 'ui-library'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('view=ui-library') || search.includes('tab=ui-library')) {
        return 'ui-library';
      }
    }
    return 'none';
  });
  const [authPortalType, setAuthPortalType] = useState<'staff' | 'candidate'>('staff');
  const [showDevMenu, setShowDevMenu] = useState(false);

  const [isDevToolsEnabled, setIsDevToolsEnabled] = useState(
    ['true', '1', 'yes'].includes(
      String(import.meta.env.VITE_ENABLE_DEV_TOOLS || '').trim().toLowerCase()
    )
  );

  // Sync staff auth session
  const refreshSession = async () => {
    const session = await checkStaffSession();
    if (session.isAuthenticated && session.user) {
      setCurrentUser(session.user);
      setIsSuperAdmin(session.user.role === 'super_admin' || session.user.email === 'admin@postex.pk');
    } else {
      setCurrentUser(null);
      setIsSuperAdmin(false);
    }
  };

  useEffect(() => {
    fetch('/api/organization-settings')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data?.enableDevTools === 'boolean') {
          setIsDevToolsEnabled(data.enableDevTools);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event) => {
      refreshSession();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setCurrentUser(null);
    setIsSuperAdmin(false);
    setActiveDevTab('none');
    await signOutStaff();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col overflow-x-hidden">
      {/* Top Application Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {currentUser && activeDevTab === 'none' && (
              <button
                id="mobile-nav-hamburger-btn"
                type="button"
                aria-label="Toggle navigation menu"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                className="sm:hidden p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName || 'Company Logo'}
                className="h-8 sm:h-9 max-w-[110px] sm:max-w-[140px] object-contain rounded bg-white/10 p-1 border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-card-heading tracking-tight text-white flex items-center gap-2 truncate">
                <span className="truncate">{companyName || portalName}</span>
                <span className="text-slate-400 font-normal hidden md:inline">| HR Onboarding Portal</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Icon & Role/Avatar Badge */}
            {currentUser && (
              <>
                <button
                  id="top-bar-notification-btn"
                  type="button"
                  aria-label="Notifications"
                  className="relative p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <Bell className="w-4 h-4" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1.5 right-1.5" />
                </button>

                <div className="flex items-center gap-2 px-2 sm:px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-caption max-w-[160px] sm:max-w-none">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-tag flex items-center justify-center shrink-0">
                    {(currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-200 truncate hidden sm:inline">
                    {currentUser.name ? toTitleCase(currentUser.name) : currentUser.email}
                  </span>
                  <span className="text-indigo-400 font-mono text-tag uppercase truncate">
                    {currentUser.role?.replace(/_/g, ' ')}
                  </span>
                  {currentUser.zone_name && (
                    <span className="text-slate-400 text-caption hidden lg:inline">
                      ({currentUser.zone_name})
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Developer Verification Tools Menu - Gated behind VITE_ENABLE_DEV_TOOLS flag (off by default in production) */}
            {isDevToolsEnabled && (
              <div className="relative">
                <Button
                  id="dev-tools-menu-btn"
                  variant="secondary"
                  size="small"
                  onClick={() => setShowDevMenu(!showDevMenu)}
                  leftIcon={<Wrench className="w-3.5 h-3.5 text-slate-400" />}
                  rightIcon={<ChevronDown className="w-3 h-3 text-slate-400" />}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border-slate-700"
                >
                  <span className="hidden sm:inline">Dev Verification Tools</span>
                  <span className="sm:hidden">Dev</span>
                </Button>

                {showDevMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-1.5 z-40 text-caption space-y-1">
                    <div className="px-2 py-1 text-table-header text-slate-400 uppercase tracking-wider">
                      Step Diagnostics (Super Admin Only)
                    </div>
                    <Button
                      variant={activeDevTab === 'none' ? 'primary' : 'secondary'}
                      size="small"
                      onClick={() => {
                        setActiveDevTab('none');
                        setShowDevMenu(false);
                      }}
                      leftIcon={<Building2 className="w-3.5 h-3.5" />}
                      className={`w-full justify-start ${
                        activeDevTab === 'none'
                          ? 'font-bold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-700 hover:text-white shadow-none'
                      }`}
                    >
                      Real App Dashboard
                    </Button>
                    <Button
                      variant={activeDevTab === 'ui-library' ? 'primary' : 'secondary'}
                      size="small"
                      onClick={() => {
                        setActiveDevTab('ui-library');
                        setShowDevMenu(false);
                      }}
                      leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                      className={`w-full justify-start ${
                        activeDevTab === 'ui-library'
                          ? 'font-bold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-700 hover:text-white shadow-none'
                      }`}
                    >
                      Design Step 1: UI Library
                    </Button>
                    <Button
                      variant={activeDevTab === 'rbac' ? 'primary' : 'secondary'}
                      size="small"
                      onClick={() => {
                        setActiveDevTab('rbac');
                        setShowDevMenu(false);
                      }}
                      leftIcon={<Lock className="w-3.5 h-3.5" />}
                      className={`w-full justify-start ${
                        activeDevTab === 'rbac'
                          ? 'font-bold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-700 hover:text-white shadow-none'
                      }`}
                    >
                      Step 4: RBAC &amp; RLS Tests
                    </Button>
                    <Button
                      variant={activeDevTab === 'auth' ? 'primary' : 'secondary'}
                      size="small"
                      onClick={() => {
                        setActiveDevTab('auth');
                        setShowDevMenu(false);
                      }}
                      leftIcon={<Shield className="w-3.5 h-3.5" />}
                      className={`w-full justify-start ${
                        activeDevTab === 'auth'
                          ? 'font-bold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-700 hover:text-white shadow-none'
                      }`}
                    >
                      Step 3: Auth System Test
                    </Button>
                    <Button
                      variant={activeDevTab === 'connectivity' ? 'primary' : 'secondary'}
                      size="small"
                      onClick={() => {
                        setActiveDevTab('connectivity');
                        setShowDevMenu(false);
                      }}
                      leftIcon={<Activity className="w-3.5 h-3.5" />}
                      className={`w-full justify-start ${
                        activeDevTab === 'connectivity'
                          ? 'font-bold'
                          : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-700 hover:text-white shadow-none'
                      }`}
                    >
                      Step 1: Diagnostics
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeDevTab === 'ui-library' ? (
          <div className="w-full">
            <ComponentLibraryShowcase />
          </div>
        ) : activeDevTab === 'rbac' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <RbacTestingPanel />
          </div>
        ) : activeDevTab === 'connectivity' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-4">
              <h2 className="text-card-heading text-slate-900">Backend Diagnostics &amp; Status</h2>
              <p className="text-caption text-slate-500">Live connection check for database and authentication services.</p>
            </div>
            <ConnectivityStatus />
          </div>
        ) : activeDevTab === 'auth' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center max-w-xl mx-auto mb-6">
              <h2 className="text-page-title text-slate-900">Portal Access Verification</h2>
              <div className="mt-5 inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300 gap-1">
                <Button
                  variant={authPortalType === 'staff' ? 'secondary' : 'secondary'}
                  size="small"
                  onClick={() => setAuthPortalType('staff')}
                  leftIcon={<Users className="w-4 h-4 text-indigo-600" />}
                  className={
                    authPortalType === 'staff'
                      ? 'bg-white text-slate-900 border-slate-200 font-bold shadow-xs'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-none'
                  }
                >
                  Staff &amp; Admin Flow
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setAuthPortalType('candidate')}
                  leftIcon={<Smartphone className="w-4 h-4 text-indigo-600" />}
                  className={
                    authPortalType === 'candidate'
                      ? 'bg-white text-slate-900 border-slate-200 font-bold shadow-xs'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-none'
                  }
                >
                  Candidate OTP Flow
                </Button>
              </div>
            </div>
            <div className="mt-4">
              {authPortalType === 'staff' ? (
                <StaffLoginForm onLoginSuccess={refreshSession} />
              ) : (
                <CandidateLoginForm />
              )}
            </div>
          </div>
        ) : (
          /* REAL APP EXPERIENCE: Route to respective role dashboard or show Login */
          currentUser && isSuperAdmin ? (
            <SuperAdminDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
            />
          ) : currentUser && currentUser.role === 'zonal_hr_manager' ? (
            <ZonalHrDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
            />
          ) : currentUser && currentUser.role === 'central_hr' ? (
            <CentralHrDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
            />
          ) : currentUser && currentUser.role === 'branch_manager' ? (
            <BranchManagerDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
            />
          ) : currentUser ? (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-card-heading text-slate-900">Welcome, {toTitleCase(currentUser.name)}</h2>
                  <p className="text-caption text-slate-500 font-mono mt-1">{currentUser.email}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-tag">
                  <span>Role: {currentUser.role?.replace(/_/g, ' ').toUpperCase()}</span>
                  {currentUser.zone_name && <span>&bull; {currentUser.zone_name}</span>}
                </div>
                <p className="text-caption text-slate-600 max-w-md mx-auto">
                  You are authenticated with an active enterprise session. Your account does not have a designated workstation role assigned. Please contact the Super Admin for role assignment.
                </p>
                <div className="pt-4 border-t border-slate-100 flex justify-center">
                  <Button
                    variant="danger"
                    size="small"
                    onClick={handleSignOut}
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
              {/* Full-bleed background image with soft fade */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-700 pointer-events-none"
                style={{
                  backgroundImage: `url(${loginBgUrl || defaultLoginBg})`,
                }}
              />
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] pointer-events-none" />

              {/* Centered glass card login */}
              <div className="relative z-10 max-w-xl mx-auto px-4 py-8 sm:py-12 w-full flex-1 flex flex-col justify-center">
                {/* Switcher segmented tabs */}
                <div className="text-center mb-6">
                  <div className="inline-flex p-1 bg-slate-900/75 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl gap-1">
                    <Button
                      id="portal-toggle-candidate"
                      variant="secondary"
                      size="small"
                      onClick={() => setAuthPortalType('candidate')}
                      leftIcon={<Smartphone className="w-4 h-4 text-indigo-600" />}
                      className={`px-5 py-2.5 h-auto font-bold ${
                        authPortalType === 'candidate'
                          ? 'bg-white text-indigo-950 border-white shadow-md hover:bg-white'
                          : 'bg-transparent border-transparent text-slate-300 hover:text-white hover:bg-slate-800/60 shadow-none'
                      }`}
                    >
                      Candidate Onboarding
                    </Button>
                    <Button
                      id="portal-toggle-staff"
                      variant="secondary"
                      size="small"
                      onClick={() => setAuthPortalType('staff')}
                      leftIcon={<Users className="w-4 h-4 text-indigo-600" />}
                      className={`px-5 py-2.5 h-auto font-bold ${
                        authPortalType === 'staff'
                          ? 'bg-white text-slate-950 border-white shadow-md hover:bg-white'
                          : 'bg-transparent border-transparent text-slate-300 hover:text-white hover:bg-slate-800/60 shadow-none'
                      }`}
                    >
                      Staff &amp; Admin Sign In
                    </Button>
                  </div>
                </div>

                {/* Form Card */}
                <div className="w-full">
                  {authPortalType === 'candidate' ? (
                    <CandidateLoginForm />
                  ) : (
                    <StaffLoginForm onLoginSuccess={refreshSession} />
                  )}
                </div>
              </div>

              {/* Subtle Footer Bar */}
              <div className="relative z-10 py-3 text-center text-caption text-slate-300/80 bg-slate-950/40 backdrop-blur-xs border-t border-white/10">
                {companyName || 'PostEx'} &bull; Enterprise HR Onboarding &amp; Dossier Verification Portal
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer (shown when authenticated) */}
      {currentUser && (
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-caption text-slate-500">
          {companyName || 'PostEx'} HR Onboarding Portal &bull; Enterprise HR System
        </footer>
      )}
    </div>
  );
}
