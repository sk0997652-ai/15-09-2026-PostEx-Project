// ==============================================================================
// PostEx HR Onboarding Portal — Branch Manager Dashboard Component (Step 8)
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchBranchProfile,
  fetchBranchMetrics,
  fetchBranchApplications,
  fetchBranchApplicationDetail,
  verifyBranchDocument,
  signBranchApplication,
  forwardApplicationToCentralHr,
  returnApplicationToCandidate,
  seedSampleBranchApplication,
  simulateCandidateResubmission,
  BranchMetrics,
  BranchApplicationSummary,
  BranchApplicationDetail,
  BranchDocument,
} from '../lib/branchManagerApi';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  RotateCcw,
  LogOut,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react';
import { HeadcountManagementView } from './common/HeadcountManagementView';
import { WorkflowTrackerView } from './common/WorkflowTrackerView';
import {
  BranchOverviewView,
  ApplicationsQueueView,
  DocumentReviewWorkspaceView,
  DocumentPreviewModal,
  ReturnToCandidateModal,
} from './branch';

interface BranchManagerDashboardProps {
  currentUser: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    zone_id?: string;
    zone_name?: string;
    branch_id?: string;
    branch_name?: string;
  };
  onSignOut: () => void;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

export function BranchManagerDashboard({
  currentUser,
  onSignOut,
  mobileNavOpen,
  setMobileNavOpen,
}: BranchManagerDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'pending_queue' | 'corrections_queue' | 'forwarded_queue' | 'branch_overview' | 'headcount' | 'workflow_tracker'>('pending_queue');
  const [internalNavOpen, setInternalNavOpen] = useState(false);
  const isNavOpen = mobileNavOpen !== undefined ? mobileNavOpen : internalNavOpen;
  const setNavOpen = setMobileNavOpen || setInternalNavOpen;

  // Dashboard state
  const [metrics, setMetrics] = useState<BranchMetrics | null>(null);
  const [applications, setApplications] = useState<BranchApplicationSummary[]>([]);

  // Memoized unique applications to prevent duplicate row rendering
  const uniqueApplications = useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((app) => {
      if (!app?.id || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    });
  }, [applications]);

  const [totalApps, setTotalApps] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected application for document review workspace
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [appDetail, setAppDetail] = useState<BranchApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Document review inline state: { [docId]: { isOpen: boolean, reason: string } }
  const [correctionForms, setCorrectionForms] = useState<Record<string, { isOpen: boolean; reason: string }>>({});

  // Digital signature state
  const [signerName, setSignerName] = useState(currentUser.name || 'Branch Manager');
  const [signatureConfirm, setSignatureConfirm] = useState(false);

  // Document preview lightbox modal
  const [previewDoc, setPreviewDoc] = useState<BranchDocument | null>(null);

  // Return to candidate modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const loadMetrics = async () => {
    try {
      const data = await fetchBranchMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  const loadApplications = async (page = 1) => {
    setLoading(true);
    try {
      let statusParam = 'all';
      if (activeTab === 'pending_queue') statusParam = 'pending';
      else if (activeTab === 'corrections_queue') statusParam = 'corrections';
      else if (activeTab === 'forwarded_queue') statusParam = 'forwarded';
      else if (statusFilter !== 'all') statusParam = statusFilter;

      const res = await fetchBranchApplications({
        status: statusParam,
        search: searchQuery,
        page,
        limit: 10,
      });

      setApplications(res.applications);
      setTotalApps(res.total);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to load applications.' });
    } finally {
      setLoading(false);
    }
  };

  const loadAppDetail = async (appId: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchBranchApplicationDetail(appId);
      setAppDetail(detail);
      setCorrectionForms({});
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to load application detail.' });
      setSelectedAppId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadApplications(1);
  }, [activeTab]);

  useEffect(() => {
    if (selectedAppId) {
      loadAppDetail(selectedAppId);
    } else {
      setAppDetail(null);
    }
  }, [selectedAppId]);

  // Handle Search Trigger
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadApplications(1);
  };

  // --------------------------------------------------------------------------
  // Document Review Actions
  // --------------------------------------------------------------------------
  const handleVerifyDoc = async (docId: string) => {
    if (!selectedAppId) return;
    setActionLoading(true);
    try {
      await verifyBranchDocument(selectedAppId, docId, 'verified');
      setNotificationMsg({ type: 'success', text: 'Document marked as Verified.' });
      await loadAppDetail(selectedAppId);
      await loadMetrics();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to verify document.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCorrectionForm = (docId: string) => {
    setCorrectionForms((prev) => ({
      ...prev,
      [docId]: { isOpen: true, reason: prev[docId]?.reason || '' },
    }));
  };

  const handleCloseCorrectionForm = (docId: string) => {
    setCorrectionForms((prev) => ({
      ...prev,
      [docId]: { isOpen: false, reason: '' },
    }));
  };

  const handleReasonChange = (docId: string, value: string) => {
    setCorrectionForms((prev) => ({
      ...prev,
      [docId]: { isOpen: true, reason: value },
    }));
  };

  const handleSubmitCorrection = async (docId: string) => {
    if (!selectedAppId) return;
    const form = correctionForms[docId];
    if (!form || !form.reason.trim()) {
      setNotificationMsg({
        type: 'error',
        text: 'Reason is strictly mandatory when marking a document for correction.',
      });
      return;
    }

    setActionLoading(true);
    try {
      await verifyBranchDocument(selectedAppId, docId, 'correction_required', form.reason.trim());
      setNotificationMsg({ type: 'success', text: 'Document flagged for correction with reason logged.' });
      handleCloseCorrectionForm(docId);
      await loadAppDetail(selectedAppId);
      await loadMetrics();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to flag document.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Digital Signature Action
  // --------------------------------------------------------------------------
  const handleApplySignature = async () => {
    if (!selectedAppId) return;
    if (!signerName.trim()) {
      setNotificationMsg({ type: 'error', text: 'Signer Name is required for digital signature.' });
      return;
    }

    setActionLoading(true);
    try {
      await signBranchApplication(selectedAppId, signerName.trim());
      setNotificationMsg({
        type: 'success',
        text: 'Digital signature applied successfully with cryptographic hash.',
      });
      await loadAppDetail(selectedAppId);
      await loadMetrics();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to apply signature.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Forward to Central HR Action
  // --------------------------------------------------------------------------
  const handleForwardToCentral = async () => {
    if (!selectedAppId) return;
    setActionLoading(true);
    try {
      const res = await forwardApplicationToCentralHr(selectedAppId);
      setNotificationMsg({
        type: 'success',
        text: res.message || 'Application successfully forwarded to Central HR!',
      });
      await loadAppDetail(selectedAppId);
      await loadMetrics();
      await loadApplications(currentPage);
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to forward application.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Return to Candidate Action
  // --------------------------------------------------------------------------
  const handleReturnToCandidate = async () => {
    if (!selectedAppId || !returnReason.trim()) {
      setNotificationMsg({ type: 'error', text: 'Please specify the correction reason.' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await returnApplicationToCandidate(selectedAppId, returnReason.trim());
      setNotificationMsg({ type: 'success', text: res.message });
      setShowReturnModal(false);
      setReturnReason('');
      await loadAppDetail(selectedAppId);
      await loadMetrics();
      await loadApplications(currentPage);
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to return application.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Quick Testing Helpers (Sample Generator & Resubmission Simulator)
  // --------------------------------------------------------------------------
  const handleSeedSample = async () => {
    setActionLoading(true);
    try {
      const res = await seedSampleBranchApplication();
      setNotificationMsg({
        type: 'success',
        text: res.message || 'Sample candidate application created for your branch!',
      });
      await loadMetrics();
      await loadApplications(1);
      if (res.application?.id) {
        setSelectedAppId(res.application.id);
      }
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to create sample candidate.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateResubmit = async (docId: string) => {
    if (!selectedAppId) return;
    setActionLoading(true);
    try {
      await simulateCandidateResubmission(selectedAppId, docId);
      setNotificationMsg({
        type: 'success',
        text: 'Simulated candidate resubmission: Document marked as pending re-verification.',
      });
      await loadAppDetail(selectedAppId);
      await loadMetrics();
    } catch (err: any) {
      setNotificationMsg({ type: 'error', text: err.message || 'Failed to simulate resubmission.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectTab = (
    tab: 'pending_queue' | 'corrections_queue' | 'forwarded_queue' | 'branch_overview' | 'headcount' | 'workflow_tracker'
  ) => {
    setActiveTab(tab);
    setSelectedAppId(null);
    setNavOpen(false);
  };

  return (
    <div className="flex flex-col sm:flex-row min-h-[calc(100vh-4rem)] bg-slate-100 overflow-x-hidden">
      {/* Mobile Slide-In Drawer Backdrop (<640px) */}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* DEDICATED SIDEBAR NAVIGATION */}
      {/* ---------------------------------------------------------------------- */}
      <aside
        className={`${
          isNavOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64 flex shadow-2xl'
            : 'hidden'
        } sm:static sm:z-auto sm:flex sm:w-16 lg:w-64 bg-slate-900 text-slate-200 flex-col border-r border-slate-800 shrink-0 transition-all duration-200`}
      >
        {/* Branch Context Header */}
        <div className="p-4 sm:p-3 lg:p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between sm:justify-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 sm:hidden lg:block">
                <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">Branch Portal</span>
                <h2 className="text-sm font-bold text-white leading-snug truncate max-w-[160px]">
                  {currentUser.branch_name || 'Assigned Branch'}
                </h2>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                  Zone: {currentUser.zone_name || 'Assigned Zone'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation drawer"
              className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2.5 sm:p-2 lg:p-3 space-y-1.5 overflow-y-auto">
          <button
            id="bm-nav-pending"
            title="Pending Verification"
            onClick={() => handleSelectTab('pending_queue')}
            className={`w-full flex items-center justify-between sm:justify-center lg:justify-between px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pending_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="sm:hidden lg:inline truncate">Pending Verification</span>
            </div>
            {metrics?.pendingVerification !== undefined && metrics.pendingVerification > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold sm:hidden lg:inline ${
                  activeTab === 'pending_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {metrics.pendingVerification}
              </span>
            )}
          </button>

          <button
            id="bm-nav-corrections"
            title="Corrections & Resubmissions"
            onClick={() => handleSelectTab('corrections_queue')}
            className={`w-full flex items-center justify-between sm:justify-center lg:justify-between px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'corrections_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span className="sm:hidden lg:inline truncate">Corrections &amp; Resubmissions</span>
            </div>
            {metrics?.needsCorrection !== undefined && metrics.needsCorrection > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold sm:hidden lg:inline ${
                  activeTab === 'corrections_queue' ? 'bg-slate-950 text-rose-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {metrics.needsCorrection}
              </span>
            )}
          </button>

          <button
            id="bm-nav-forwarded"
            title="Forwarded to Central HR"
            onClick={() => handleSelectTab('forwarded_queue')}
            className={`w-full flex items-center justify-between sm:justify-center lg:justify-between px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'forwarded_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Send className="w-4 h-4 shrink-0" />
              <span className="sm:hidden lg:inline truncate">Forwarded to Central HR</span>
            </div>
            {metrics?.forwardedToCentral !== undefined && metrics.forwardedToCentral > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold sm:hidden lg:inline ${
                  activeTab === 'forwarded_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {metrics.forwardedToCentral}
              </span>
            )}
          </button>

          <button
            id="bm-nav-overview"
            title="Branch Overview & Stats"
            onClick={() => handleSelectTab('branch_overview')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-2.5 px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'branch_overview'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Branch Overview &amp; Stats</span>
          </button>

          <button
            id="bm-nav-headcount"
            title="Headcount Management"
            onClick={() => handleSelectTab('headcount')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-2.5 px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'headcount'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Headcount Management</span>
          </button>

          <button
            id="bm-nav-workflow-tracker"
            title="Workflow Tracker"
            onClick={() => handleSelectTab('workflow_tracker')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-2.5 px-3.5 sm:px-0 lg:px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'workflow_tracker'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Workflow Tracker</span>
          </button>
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 sm:p-2 lg:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between sm:justify-center lg:justify-between">
          <div className="flex items-center gap-2.5 min-w-0 sm:hidden lg:flex">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'B'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser.name || 'Branch Manager'}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            id="bm-signout-btn"
            onClick={onSignOut}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------------------------- */}
      {/* MAIN CONTENT WORKSPACE */}
      {/* ---------------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Notification Toast */}
        {notificationMsg && (
          <div
            className={`m-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in duration-200 ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notificationMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notificationMsg.text}</span>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Role & Section Banner */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[11px] font-bold uppercase tracking-wider mb-1">
                Branch Manager Workstation &bull; {currentUser.branch_name || 'Assigned Branch'}
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {activeTab === 'pending_queue' && 'Branch Manager — Pending Verification Queue'}
                {activeTab === 'corrections_queue' && 'Branch Manager — Corrections & Resubmissions Queue'}
                {activeTab === 'forwarded_queue' && 'Branch Manager — Forwarded Applications'}
                {activeTab === 'branch_overview' && 'Branch Manager — Branch Overview & Operations'}
                {activeTab === 'headcount' && 'Branch Manager — Branch Headcount (Read-Only)'}
                {activeTab === 'workflow_tracker' && 'Branch Manager — Workflow Tracker'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === 'pending_queue' && 'Conduct in-person document verification, apply digital signature attestation, and forward to Central HR.'}
                {activeTab === 'corrections_queue' && 'Review corrected candidate documents returned by Central HR for re-verification.'}
                {activeTab === 'forwarded_queue' && 'Track applications verified by this branch currently awaiting final Central HR enrollment decision.'}
                {activeTab === 'branch_overview' && 'You can only view and manage records, document verifications, and headcount for your assigned branch.'}
                {activeTab === 'headcount' && 'Read-only view of approved designation headcount targets, active enrolled employees, and open vacancies for your branch.'}
                {activeTab === 'workflow_tracker' && 'Track onboarding tasks and employee clearance forms scoped to your assigned branch.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-xs hidden sm:inline-block">
                Logged in as: <strong className="text-slate-900">{currentUser.name}</strong>
              </span>
              <button
                onClick={() => {
                  loadMetrics();
                  if (selectedAppId) loadAppDetail(selectedAppId);
                  else loadApplications(currentPage);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500">Pending Verification</span>
              <p className="text-xl font-black text-amber-600 mt-1">{metrics?.pendingVerification ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500">Needs Correction</span>
              <p className="text-xl font-black text-rose-600 mt-1">{metrics?.needsCorrection ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500">Forwarded to Central HR</span>
              <p className="text-xl font-black text-indigo-600 mt-1">{metrics?.forwardedToCentral ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500">Enrolled / Approved</span>
              <p className="text-xl font-black text-emerald-600 mt-1">{metrics?.approved ?? 0}</p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: APPLICATION DETAIL & DOCUMENT REVIEW WORKSPACE */}
        {/* ------------------------------------------------------------------ */}
        {selectedAppId ? (
          <DocumentReviewWorkspaceView
            appDetail={appDetail}
            loading={detailLoading}
            actionLoading={actionLoading}
            currentUser={currentUser}
            onBack={() => setSelectedAppId(null)}
            correctionForms={correctionForms}
            onOpenCorrectionForm={handleOpenCorrectionForm}
            onCloseCorrectionForm={handleCloseCorrectionForm}
            onReasonChange={handleReasonChange}
            onSubmitCorrection={handleSubmitCorrection}
            onVerifyDoc={handleVerifyDoc}
            onSimulateResubmit={handleSimulateResubmit}
            onPreviewDoc={(doc) => setPreviewDoc(doc)}
            signerName={signerName}
            signatureConfirm={signatureConfirm}
            setSignatureConfirm={setSignatureConfirm}
            onApplySignature={handleApplySignature}
            onOpenReturnModal={() => setShowReturnModal(true)}
            onForwardToCentral={handleForwardToCentral}
          />
        ) : activeTab === 'branch_overview' ? (
          <BranchOverviewView
            currentUser={{
              branch_name: currentUser.branch_name || 'Assigned Branch',
              branch_id: currentUser.branch_id || 'N/A',
              zone_name: currentUser.zone_name || 'Assigned Zone',
              zone_id: currentUser.zone_id || 'N/A',
            }}
            onNavigateToHeadcount={() => {
              setActiveTab('headcount');
              setSelectedAppId(null);
            }}
          />
        ) : activeTab === 'headcount' ? (
          <div className="p-6">
            <HeadcountManagementView />
          </div>
        ) : activeTab === 'workflow_tracker' ? (
          <div className="p-4 sm:p-6">
            <WorkflowTrackerView
              role="branch_manager"
              branchName={currentUser.branch_name}
              zoneName={currentUser.zone_name}
            />
          </div>
        ) : (
          <ApplicationsQueueView
            applications={uniqueApplications}
            totalApps={totalApps}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => loadApplications(p)}
            onSelectApp={(id) => setSelectedAppId(id)}
            onSeedSample={handleSeedSample}
            actionLoading={actionLoading}
            activeTabTitle={
              activeTab === 'pending_queue'
                ? 'Branch Manager — Pending Verification Queue'
                : activeTab === 'corrections_queue'
                ? 'Branch Manager — Corrections & Resubmissions Queue'
                : 'Branch Manager — Forwarded Applications'
            }
          />
        )}

        {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
        <DocumentPreviewModal
          previewDoc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />

        {/* RETURN TO CANDIDATE MODAL */}
        <ReturnToCandidateModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          returnReason={returnReason}
          setReturnReason={setReturnReason}
          onConfirm={handleReturnToCandidate}
          actionLoading={actionLoading}
        />
      </main>
    </div>
  );
}
