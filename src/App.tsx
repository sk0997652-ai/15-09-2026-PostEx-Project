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
import { Building2, Shield, Users, Smartphone, Activity, Lock, Wrench, ChevronDown, UserCheck, LogOut } from 'lucide-react';

export default function App() {
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
  const [activeDevTab, setActiveDevTab] = useState<'none' | 'rbac' | 'auth' | 'connectivity'>('none');
  const [authPortalType, setAuthPortalType] = useState<'staff' | 'candidate'>('staff');
  const [showDevMenu, setShowDevMenu] = useState(false);

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
    refreshSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event) => {
      refreshSession();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await signOutStaff();
    setCurrentUser(null);
    setIsSuperAdmin(false);
    setActiveDevTab('none');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Top Application Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                PostEx <span className="text-slate-400 font-normal">| HR Onboarding Portal</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real App Mode Indicator / Role Badge */}
            {currentUser && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-slate-200">{currentUser.name || currentUser.email}</span>
                <span className="text-emerald-400 font-mono text-[11px] font-bold uppercase">
                  {currentUser.role?.replace(/_/g, ' ')}
                </span>
                {currentUser.zone_name && (
                  <span className="text-slate-400 text-[10px]">({currentUser.zone_name})</span>
                )}
              </div>
            )}

            {/* Separated Developer Verification Tools Menu */}
            <div className="relative">
              <button
                id="dev-tools-menu-btn"
                onClick={() => setShowDevMenu(!showDevMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Dev Verification Tools</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDevMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-1.5 z-40 text-xs space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Step Diagnostics (Dev Only)
                  </div>
                  <button
                    onClick={() => {
                      setActiveDevTab('none');
                      setShowDevMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                      activeDevTab === 'none' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Real App Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveDevTab('rbac');
                      setShowDevMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                      activeDevTab === 'rbac' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Step 4: RBAC &amp; RLS Tests</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveDevTab('auth');
                      setShowDevMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                      activeDevTab === 'auth' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Step 3: Auth System Test</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveDevTab('connectivity');
                      setShowDevMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                      activeDevTab === 'connectivity' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Step 1: Diagnostics</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeDevTab === 'rbac' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <RbacTestingPanel />
          </div>
        ) : activeDevTab === 'connectivity' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Backend Diagnostics &amp; Status</h2>
              <p className="text-xs text-slate-500">Live connection check for Supabase Postgres and Auth endpoints.</p>
            </div>
            <ConnectivityStatus />
          </div>
        ) : activeDevTab === 'auth' ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center max-w-xl mx-auto mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Portal Access Verification</h2>
              <div className="mt-5 inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300">
                <button
                  onClick={() => setAuthPortalType('staff')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authPortalType === 'staff' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Staff &amp; Admin Flow</span>
                </button>
                <button
                  onClick={() => setAuthPortalType('candidate')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authPortalType === 'candidate' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Candidate OTP Flow</span>
                </button>
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
            />
          ) : currentUser && currentUser.role === 'zonal_hr_manager' ? (
            <ZonalHrDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
            />
          ) : currentUser && currentUser.role === 'central_hr' ? (
            <CentralHrDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
            />
          ) : currentUser && currentUser.role === 'branch_manager' ? (
            <BranchManagerDashboard
              currentUser={currentUser}
              onSignOut={handleSignOut}
            />
          ) : currentUser ? (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
              <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Welcome, {currentUser.name}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-1">{currentUser.email}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <span>Role: {currentUser.role?.replace(/_/g, ' ').toUpperCase()}</span>
                  {currentUser.zone_name && <span>&bull; {currentUser.zone_name}</span>}
                </div>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  You are authenticated with an active enterprise session. Your account does not have a designated workstation role assigned. Please contact the Super Admin for role assignment.
                </p>
                <div className="pt-4 border-t border-slate-100 flex justify-center">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <div className="text-center max-w-xl mx-auto mb-6">
                <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300 mb-4">
                  <button
                    id="portal-toggle-candidate"
                    onClick={() => setAuthPortalType('candidate')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      authPortalType === 'candidate' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Candidate Onboarding</span>
                  </button>
                  <button
                    id="portal-toggle-staff"
                    onClick={() => setAuthPortalType('staff')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      authPortalType === 'staff' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Staff &amp; Admin Login</span>
                  </button>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {authPortalType === 'candidate' ? 'Candidate Onboarding Portal' : 'Staff & Super Admin Login'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {authPortalType === 'candidate'
                    ? 'Log in with your Joining ID and Mobile Number to complete onboarding.'
                    : 'Log in with your PostEx staff credentials to access your administrative dashboard.'}
                </p>
              </div>
              <div className={authPortalType === 'candidate' ? 'max-w-4xl mx-auto' : 'max-w-md mx-auto'}>
                {authPortalType === 'candidate' ? (
                  <CandidateLoginForm />
                ) : (
                  <StaffLoginForm onLoginSuccess={refreshSession} />
                )}
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        PostEx HR Onboarding Portal &bull; Enterprise HR System
      </footer>
    </div>
  );
}
