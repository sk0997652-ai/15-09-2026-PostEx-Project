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
  Search,
  Filter,
  FileText,
  Shield,
  Send,
  Eye,
  Check,
  X,
  RotateCcw,
  LogOut,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  ChevronRight,
  UserCheck,
  BadgeAlert,
  Sparkles,
  Lock,
  Stamp,
  ExternalLink,
  ChevronLeft,
  Info,
} from 'lucide-react';
import { VerificationStampSeal } from './common/VerificationStampSeal';

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
}

export function BranchManagerDashboard({ currentUser, onSignOut }: BranchManagerDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'pending_queue' | 'corrections_queue' | 'forwarded_queue' | 'branch_overview'>('pending_queue');

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

  // Format doc title
  const formatDocType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ---------------------------------------------------------------------- */}
      {/* DEDICATED SIDEBAR NAVIGATION */}
      {/* ---------------------------------------------------------------------- */}
      <aside className="w-full lg:w-72 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 shrink-0">
        {/* Branch Context Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">Branch Portal</span>
              <h2 className="text-sm font-bold text-white leading-snug truncate max-w-[180px]">
                {currentUser.branch_name || 'Assigned Branch'}
              </h2>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                Zone: {currentUser.zone_name || 'Assigned Zone'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <button
            id="bm-nav-pending"
            onClick={() => {
              setActiveTab('pending_queue');
              setSelectedAppId(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pending_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
              <span>Pending Verification</span>
            </div>
            {metrics?.pendingVerification !== undefined && metrics.pendingVerification > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'pending_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {metrics.pendingVerification}
              </span>
            )}
          </button>

          <button
            id="bm-nav-corrections"
            onClick={() => {
              setActiveTab('corrections_queue');
              setSelectedAppId(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'corrections_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4" />
              <span>Corrections &amp; Resubmissions</span>
            </div>
            {metrics?.needsCorrection !== undefined && metrics.needsCorrection > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'corrections_queue' ? 'bg-slate-950 text-rose-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {metrics.needsCorrection}
              </span>
            )}
          </button>

          <button
            id="bm-nav-forwarded"
            onClick={() => {
              setActiveTab('forwarded_queue');
              setSelectedAppId(null);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'forwarded_queue'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4" />
              <span>Forwarded to Central HR</span>
            </div>
            {metrics?.forwardedToCentral !== undefined && metrics.forwardedToCentral > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'forwarded_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {metrics.forwardedToCentral}
              </span>
            )}
          </button>

          <button
            id="bm-nav-overview"
            onClick={() => {
              setActiveTab('branch_overview');
              setSelectedAppId(null);
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'branch_overview'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Branch Overview &amp; Stats</span>
          </button>
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
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
            className={`m-4 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in duration-200 ${
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
              className="p-1 hover:bg-black/5 rounded-md cursor-pointer"
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
                {activeTab === 'branch_overview' && 'Branch Manager — Branch Performance & Telemetry'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === 'pending_queue' && 'Conduct in-person document verification, apply digital signature attestation, and forward to Central HR.'}
                {activeTab === 'corrections_queue' && 'Review corrected candidate documents returned by Central HR for re-verification.'}
                {activeTab === 'forwarded_queue' && 'Track applications verified by this branch currently awaiting final Central HR enrollment decision.'}
                {activeTab === 'branch_overview' && 'Branch operational throughput, document verification metrics, and Postgres RLS telemetry.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs hidden sm:inline-block">
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
          <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
            {/* Back button */}
            <button
              onClick={() => setSelectedAppId(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Applications Queue</span>
            </button>

            {detailLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-600 font-medium">Loading candidate dossier and documents...</p>
              </div>
            ) : appDetail ? (
              <div className="space-y-6">
                {/* Candidate Summary Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {appDetail.candidate?.joining_id || 'PX-JOINING-ID'}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            appDetail.status === 'bm_verification'
                              ? 'bg-amber-100 text-amber-800'
                              : appDetail.status === 'needs_correction'
                              ? 'bg-rose-100 text-rose-800'
                              : appDetail.status === 'hr_review'
                              ? 'bg-indigo-100 text-indigo-800'
                              : appDetail.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {appDetail.status.replace(/_/g, ' ')}
                        </span>
                        {appDetail.is_resubmitted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" />
                            Resubmitted Section
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-1.5">{appDetail.candidate?.full_name}</h2>
                      <p className="text-xs text-slate-500">
                        CNIC: <span className="font-mono font-medium text-slate-700">{appDetail.candidate?.masked_cnic}</span> &bull; Mobile:{' '}
                        <span className="font-mono font-medium text-slate-700">{appDetail.candidate?.mobile}</span>
                      </p>
                    </div>

                    {/* Verification Progress Meter */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 min-w-[220px]">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-600">Verification Progress</span>
                        <span className="text-indigo-600 font-bold">
                          {appDetail.verifiedDocs + appDetail.correctionDocs} / {appDetail.totalDocs}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 transition-all duration-300 rounded-full"
                          style={{
                            width: `${
                              appDetail.totalDocs > 0
                                ? Math.round(((appDetail.verifiedDocs + appDetail.correctionDocs) / appDetail.totalDocs) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {appDetail.allReviewed
                          ? 'All documents marked. Ready for digital signature.'
                          : 'Review and mark each document below.'}
                      </p>
                    </div>
                  </div>

                  {/* Resubmission Alert if previous corrections existed */}
                  {appDetail.decision_reason && (
                    <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Previous Remarks / Correction Feedback:</span>
                        <p className="mt-0.5 text-slate-700">{appDetail.decision_reason}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------------ */}
                {/* 2. DOCUMENT REVIEW LIST (Mark Verified / Needs Correction) */}
                {/* ------------------------------------------------------------------ */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-amber-600" />
                        Uploaded Credentials &amp; Verification Documents
                      </h3>
                      <p className="text-xs text-slate-500">
                        Physically and digitally cross-reference each document against original certificates.
                      </p>
                    </div>
                  </div>

                  {appDetail.documents.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 font-semibold">No uploaded documents found for this candidate yet.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Documents will appear once candidate finishes Step 9 upload journey.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appDetail.documents.map((doc) => {
                        const form = correctionForms[doc.id];
                        const isVerified = doc.verification_status === 'verified';
                        const isCorrection = doc.verification_status === 'correction_required';

                        return (
                          <div
                            key={doc.id}
                            className={`bg-white rounded-xl border transition-all p-5 shadow-2xs flex flex-col justify-between ${
                              isVerified
                                ? 'border-emerald-200 bg-emerald-50/10'
                                : isCorrection
                                ? 'border-rose-200 bg-rose-50/10'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  {formatDocType(doc.type)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isVerified
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isCorrection
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {isVerified ? 'Verified' : isCorrection ? 'Needs Correction' : 'Pending Review'}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 font-mono break-all">{doc.storage_path}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()} at{' '}
                                {new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>

                              {/* Prior Remark Display */}
                              {doc.remark && (
                                <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                                  <span className="font-bold">Correction Flag: </span>
                                  {doc.remark}
                                </div>
                              )}

                              {/* Preview trigger */}
                              <div className="mt-3">
                                <button
                                  onClick={() => setPreviewDoc(doc)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Preview Document</span>
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              {form?.isOpen ? (
                                <div className="space-y-2">
                                  <label className="block text-[11px] font-bold text-slate-700">
                                    Reason for Correction <span className="text-rose-600">* (Mandatory)</span>
                                  </label>
                                  <textarea
                                    value={form.reason}
                                    onChange={(e) => handleReasonChange(doc.id, e.target.value)}
                                    placeholder="Explain why this document is rejected/requires re-upload (e.g. Blurry scan, CNIC expired, name mismatch)..."
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    rows={2}
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCloseCorrectionForm(doc.id)}
                                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitCorrection(doc.id)}
                                      disabled={actionLoading || !form.reason.trim()}
                                      className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Confirm Flag
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleVerifyDoc(doc.id)}
                                      disabled={actionLoading || isVerified}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        isVerified
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{isVerified ? 'Verified' : 'Mark Verified'}</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenCorrectionForm(doc.id)}
                                      disabled={actionLoading}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        isCorrection
                                          ? 'bg-rose-600 text-white shadow-2xs'
                                          : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300'
                                      }`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>{isCorrection ? 'Flagged' : 'Needs Correction'}</span>
                                    </button>
                                  </div>

                                  {/* Test simulator button for resubmission */}
                                  {isCorrection && (
                                    <button
                                      onClick={() => handleSimulateResubmit(doc.id)}
                                      title="Simulate candidate re-uploading this section"
                                      className="text-[10px] text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                    >
                                      Simulate Resubmit
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------------ */}
                {/* 3. DIGITAL SIGNATURE PANEL (Active when documents reviewed) */}
                {/* ------------------------------------------------------------------ */}
                <div
                  className={`bg-white rounded-2xl border p-6 shadow-xs transition-all ${
                    appDetail.digitalSignature
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : appDetail.allReviewed
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          appDetail.digitalSignature
                            ? 'bg-emerald-500 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        <Stamp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          Branch Manager Digital Signature
                          {appDetail.digitalSignature && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Officially Signed
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Cryptographic attestation certifying that all presented credentials have been inspected and verified at{' '}
                          <span className="font-semibold text-slate-800">{currentUser.branch_name}</span>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {appDetail.digitalSignature ? (
                    <div className="mt-4 p-5 bg-white rounded-2xl border border-emerald-200 shadow-xs flex flex-col md:flex-row items-center md:items-start gap-5">
                      <div className="shrink-0">
                        <VerificationStampSeal
                          stage="branch_signature"
                          signerName={appDetail.digitalSignature.signerName}
                          timestamp={appDetail.digitalSignature.signedAt}
                          code={appDetail.digitalSignature.signatureHash}
                          size="md"
                          showDetails={false}
                        />
                      </div>
                      <div className="space-y-2 flex-1 w-full text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-100">
                          <div>
                            <span className="font-semibold text-slate-500">Certifying Official: </span>
                            <span className="font-bold text-slate-900">{appDetail.digitalSignature.signerName}</span>
                            <span className="text-slate-500"> (Branch Manager)</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Signed At: </span>
                            <span className="font-mono text-slate-800">
                              {new Date(appDetail.digitalSignature.signedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block">SHA-256 Signature Certificate Hash:</span>
                          <code className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg block mt-1 break-all border border-emerald-200">
                            {appDetail.digitalSignature.signatureHash}
                          </code>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Credentials attested and cryptographic seal bound for Central HR formal review.</span>
                        </div>
                      </div>
                    </div>
                  ) : appDetail.allReviewed ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="bm-sign-attest"
                          checked={signatureConfirm}
                          onChange={(e) => setSignatureConfirm(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="bm-sign-attest" className="text-xs text-slate-700 leading-snug cursor-pointer">
                          I, <span className="font-bold text-slate-900">{signerName}</span>, hereby certify under corporate policy that all {appDetail.totalDocs} required documents have been reviewed for candidate{' '}
                          <span className="font-bold text-slate-900">{appDetail.candidate?.full_name}</span>.
                        </label>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={handleApplySignature}
                          disabled={actionLoading || !signatureConfirm}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Stamp className="w-4 h-4" />
                          <span>Apply Digital Signature</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">Action Required: </span>
                      Please mark all {appDetail.totalDocs} documents as Verified or Needs Correction above to enable the digital signature step.
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------------ */}
                {/* 4. ACTIONS BAR: FORWARD TO CENTRAL HR OR RETURN TO CANDIDATE */}
                {/* ------------------------------------------------------------------ */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-900">Application Dispatch</span>
                    <p className="text-[11px] text-slate-500">
                      {appDetail.digitalSignature
                        ? 'Digital signature applied. Ready to advance to Central HR review.'
                        : 'Complete digital signature above to forward to Central HR.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Return to Candidate Button */}
                    <button
                      onClick={() => setShowReturnModal(true)}
                      disabled={actionLoading || appDetail.status === 'approved'}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Return to Candidate</span>
                    </button>

                    {/* Forward to Central HR */}
                    <button
                      id="bm-forward-to-central-btn"
                      onClick={handleForwardToCentral}
                      disabled={actionLoading || !appDetail.digitalSignature || appDetail.status === 'hr_review' || appDetail.status === 'approved'}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {appDetail.status === 'hr_review'
                          ? 'Already Forwarded to Central HR'
                          : 'Forward to Central HR'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : activeTab === 'branch_overview' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW 2: BRANCH OVERVIEW & METRICS */
          /* ------------------------------------------------------------------ */
          <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Branch Identity &amp; Database Scoping</h2>
              <p className="text-xs text-slate-500 mb-4">
                Postgres RLS actively confines all read and write queries to this designated physical branch.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">Branch Name &amp; ID</span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{currentUser.branch_name}</p>
                  <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">{currentUser.branch_id}</code>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">Zone Name &amp; ID</span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{currentUser.zone_name}</p>
                  <code className="text-[10px] text-slate-500 font-mono mt-0.5 block">{currentUser.zone_id}</code>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Verification Protocol Checklist</h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>CNIC Front &amp; Back: Inspect 13-digit Nadra number, expiry date, and official holographic seal.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Education &amp; Experience: Cross-check institution stamp and graduation certificate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Driving License &amp; Utility Bill: Ensure address matches candidate's permanent or current domicile.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Digital Signature Hash: Cryptographic integrity seal applied to ensure anti-tamper compliance before Central HR review.</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* VIEW 3: APPLICATIONS QUEUE (Paginated Table & Search) */
          /* ------------------------------------------------------------------ */
          <div className="p-6 space-y-4 max-w-6xl mx-auto w-full">
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, masked CNIC, or joining ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Search
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      loadApplications(1);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800">{uniqueApplications.length}</span> of {totalApps} applications
                </span>
              </div>
            </div>

            {/* Applications Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-600 font-medium">Querying branch applications via Postgres RLS...</p>
                </div>
              ) : uniqueApplications.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No applications in this queue</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    There are currently no candidates awaiting action in this branch queue. Click below to generate a test candidate.
                  </p>
                  <button
                    onClick={handleSeedSample}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Test Candidate Application</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-5 py-3">Candidate</th>
                        <th className="px-5 py-3">Joining ID</th>
                        <th className="px-5 py-3">Masked CNIC</th>
                        <th className="px-5 py-3">Documents</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {uniqueApplications.map((app) => {
                        const cand = app.candidate;
                        const isPending = app.status === 'bm_verification';
                        const isCorrection = app.status === 'needs_correction';

                        return (
                          <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-slate-900 block">{cand?.full_name || 'Unnamed'}</span>
                              <span className="text-[11px] text-slate-500 font-mono">{cand?.mobile || 'No mobile'}</span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-800 font-semibold">
                              {cand?.joining_id || 'PX-PENDING'}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-600">
                              {cand?.masked_cnic || 'N/A'}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                {app.documents_verified} / {app.documents_total} Verified
                              </span>
                              {app.documents_correction_required > 0 && (
                                <span className="block text-[10px] text-rose-600 font-semibold">
                                  {app.documents_correction_required} flagged
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  app.status === 'bm_verification'
                                    ? 'bg-amber-100 text-amber-800'
                                    : app.status === 'needs_correction'
                                    ? 'bg-rose-100 text-rose-800'
                                    : app.status === 'hr_review'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : app.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {app.status === 'bm_verification' && <Clock className="w-3 h-3" />}
                                {app.status === 'needs_correction' && <RotateCcw className="w-3 h-3" />}
                                {app.status === 'hr_review' && <Send className="w-3 h-3" />}
                                {app.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                                {app.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => setSelectedAppId(app.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer ${
                                  isPending
                                    ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                                    : 'text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                                }`}
                              >
                                <span>{isPending ? 'Review & Verify' : 'View Details'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <button
                    onClick={() => loadApplications(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500">
                    Page <span className="font-bold text-slate-800">{currentPage}</span> of {totalPages}
                  </span>
                  <button
                    onClick={() => loadApplications(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
        {/* ------------------------------------------------------------------ */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{formatDocType(previewDoc.type)}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">{previewDoc.storage_path}</p>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mock Document Render */}
              <div className="p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[260px]">
                <div className="w-full max-w-xs bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center space-y-3">
                  <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">{formatDocType(previewDoc.type)}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Physical Credential Attestation</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500 font-mono break-all">
                    Storage: {previewDoc.storage_path}
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      Encrypted Cloud Storage Artifact
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* RETURN TO CANDIDATE MODAL */}
        {/* ------------------------------------------------------------------ */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Return Application to Candidate</h4>
                  <p className="text-xs text-slate-500">Unlocks candidate portal to allow re-upload of flagged credentials.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Correction Instructions <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Clearly explain which document(s) need correction and how the candidate should fix them..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturnToCandidate}
                  disabled={actionLoading || !returnReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Confirm &amp; Return
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
