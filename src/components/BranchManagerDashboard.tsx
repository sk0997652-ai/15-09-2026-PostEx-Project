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
import { toTitleCase } from '../lib/formatText';
import { PageContainer, PortalSidebar, PortalSidebarItem, KpiGrid, KpiCard } from './ui';

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

  const sidebarItems: PortalSidebarItem[] = [
    {
      id: 'bm-nav-pending',
      label: 'Pending Verification',
      title: 'Pending Verification',
      icon: <Clock className="w-3.5 h-3.5" />,
      active: activeTab === 'pending_queue',
      onSelect: () => handleSelectTab('pending_queue'),
      badge:
        metrics?.pendingVerification !== undefined && metrics.pendingVerification > 0 ? (
          <span
            className={`px-1.5 py-0.5 rounded-full text-tag ${
              activeTab === 'pending_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
            }`}
          >
            {metrics.pendingVerification}
          </span>
        ) : undefined,
    },
    {
      id: 'bm-nav-corrections',
      label: 'Corrections & Resubmissions',
      title: 'Corrections & Resubmissions',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      active: activeTab === 'corrections_queue',
      onSelect: () => handleSelectTab('corrections_queue'),
      badge:
        metrics?.needsCorrection !== undefined && metrics.needsCorrection > 0 ? (
          <span
            className={`px-1.5 py-0.5 rounded-full text-tag ${
              activeTab === 'corrections_queue' ? 'bg-slate-950 text-rose-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {metrics.needsCorrection}
          </span>
        ) : undefined,
    },
    {
      id: 'bm-nav-forwarded',
      label: 'Forwarded to Central HR',
      title: 'Forwarded to Central HR',
      icon: <Send className="w-3.5 h-3.5" />,
      active: activeTab === 'forwarded_queue',
      onSelect: () => handleSelectTab('forwarded_queue'),
      badge:
        metrics?.forwardedToCentral !== undefined && metrics.forwardedToCentral > 0 ? (
          <span
            className={`px-1.5 py-0.5 rounded-full text-tag ${
              activeTab === 'forwarded_queue' ? 'bg-slate-950 text-indigo-200' : 'bg-indigo-500/20 text-indigo-300'
            }`}
          >
            {metrics.forwardedToCentral}
          </span>
        ) : undefined,
    },
    {
      id: 'bm-nav-overview',
      label: 'Branch Overview & Stats',
      title: 'Branch Overview & Stats',
      icon: <Shield className="w-3.5 h-3.5" />,
      active: activeTab === 'branch_overview',
      onSelect: () => handleSelectTab('branch_overview'),
    },
    {
      id: 'bm-nav-headcount',
      label: 'Headcount Management',
      title: 'Headcount Management',
      icon: <Users className="w-3.5 h-3.5" />,
      active: activeTab === 'headcount',
      onSelect: () => handleSelectTab('headcount'),
    },
    {
      id: 'bm-nav-workflow-tracker',
      label: 'Workflow Tracker',
      title: 'Workflow Tracker',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      active: activeTab === 'workflow_tracker',
      onSelect: () => handleSelectTab('workflow_tracker'),
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row min-h-[calc(100vh-4rem)] bg-slate-100 overflow-x-hidden">
      {/* Shared Portal Sidebar */}
      <PortalSidebar
        brand={{
          icon: <Building2 className="w-3.5 h-3.5" />,
          title: currentUser.branch_name || 'Assigned Branch',
          subtitle: `Zone: ${currentUser.zone_name || 'Assigned Zone'}`,
        }}
        headerExtra={
          <div className="text-tag uppercase tracking-wider text-indigo-400 font-semibold mt-0.5">
            Branch Portal
          </div>
        }
        items={sidebarItems}
        isOpen={isNavOpen}
        onClose={() => setNavOpen(false)}
        onSignOut={onSignOut}
        signOutBtnId="bm-signout-btn"
        signOutLabel="Sign Out"
        userContext={{
          name: toTitleCase(currentUser.name || 'Branch Manager'),
          email: currentUser.email,
        }}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MAIN CONTENT WORKSPACE */}
      {/* ---------------------------------------------------------------------- */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
        {/* Notification Toast */}
        {notificationMsg && (
          <div
            className={`m-4 p-3.5 rounded-xl border flex items-center justify-between text-caption font-semibold shadow-xs animate-in fade-in duration-200 ${
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
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-tag uppercase tracking-wider mb-1">
                Branch Manager Workstation &bull; {currentUser.branch_name || 'Assigned Branch'}
              </div>
              <h1 className="text-page-title text-slate-900 flex items-center gap-2">
                {activeTab === 'pending_queue' && 'Branch Manager — Pending Verification Queue'}
                {activeTab === 'corrections_queue' && 'Branch Manager — Corrections & Resubmissions Queue'}
                {activeTab === 'forwarded_queue' && 'Branch Manager — Forwarded Applications'}
                {activeTab === 'branch_overview' && 'Branch Manager — Branch Overview & Operations'}
                {activeTab === 'headcount' && 'Branch Manager — Branch Headcount (Read-Only)'}
                {activeTab === 'workflow_tracker' && 'Branch Manager — Workflow Tracker'}
              </h1>
              <p className="text-caption text-slate-500 mt-0.5">
                {activeTab === 'pending_queue' && 'Conduct in-person document verification, apply digital signature attestation, and forward to Central HR.'}
                {activeTab === 'corrections_queue' && 'Review corrected candidate documents returned by Central HR for re-verification.'}
                {activeTab === 'forwarded_queue' && 'Track applications verified by this branch currently awaiting final Central HR enrollment decision.'}
                {activeTab === 'branch_overview' && 'You can only view and manage records, document verifications, and headcount for your assigned branch.'}
                {activeTab === 'headcount' && 'Read-only view of approved designation headcount targets, active enrolled employees, and open vacancies for your branch.'}
                {activeTab === 'workflow_tracker' && 'Track onboarding tasks and employee clearance forms scoped to your assigned branch.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-caption font-medium shadow-xs hidden sm:inline-block">
                Logged in as: <strong className="text-slate-900">{toTitleCase(currentUser.name)}</strong>
              </span>
              <button
                onClick={() => {
                  loadMetrics();
                  if (selectedAppId) loadAppDetail(selectedAppId);
                  else loadApplications(currentPage);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <KpiGrid columns={4} className="mt-4">
            <KpiCard
              label="Pending Verification"
              value={metrics?.pendingVerification ?? 0}
              tone="warning"
            />
            <KpiCard
              label="Needs Correction"
              value={metrics?.needsCorrection ?? 0}
              tone="danger"
            />
            <KpiCard
              label="Forwarded to Central HR"
              value={metrics?.forwardedToCentral ?? 0}
              tone="info"
            />
            <KpiCard
              label="Enrolled / Approved"
              value={metrics?.approved ?? 0}
              tone="success"
            />
          </KpiGrid>
        </div>

        <PageContainer width="full">
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
            <HeadcountManagementView />
          ) : activeTab === 'workflow_tracker' ? (
            <WorkflowTrackerView
              role="branch_manager"
              branchName={currentUser.branch_name}
              zoneName={currentUser.zone_name}
            />
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
        </PageContainer>

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
