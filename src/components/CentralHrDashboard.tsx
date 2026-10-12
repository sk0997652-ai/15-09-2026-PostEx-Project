// ==============================================================================
// PostEx HR Onboarding Portal — Central HR Dashboard Component (Step 7)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getStaffAccessToken } from '../lib/staffAuth';
import {
  UserPlus,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Building2,
  Shield,
  LogOut,
  IdCard,
  Users,
  Upload,
  X,
} from 'lucide-react';
import { HeadcountManagementView } from './common/HeadcountManagementView';
import { WorkflowTrackerView } from './common/WorkflowTrackerView';
import { DataImportView } from './common/DataImportView';
import { PageContainer, PortalSidebar, PortalSidebarItem } from './ui';
import {
  CentralOverviewView,
  CreateJoinerView,
  ReviewQueueView,
  EnrolledRosterView,
  DossierModal,
  DecisionActionModal,
  PdfDossierModal,
} from './central';
import { toTitleCase } from '../lib/formatText';

interface CentralHrDashboardProps {
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

interface ApplicationItem {
  id: string;
  candidate_id: string;
  status: string;
  current_step: number;
  locked: boolean;
  submitted_at: string;
  decided_at?: string;
  decision_reason?: string;
  created_at: string;
  employee_id?: string;
  pdf_dossier_storage_path?: string;
  candidate: {
    id: string;
    full_name: string;
    cnic: string;
    masked_cnic: string;
    mobile: string;
    email?: string;
    joining_id: string;
    zone_name?: string;
    branch_name?: string;
    created_at: string;
  } | null;
}

interface EnrolledEmployee {
  id: string;
  employee_id: string;
  pdf_dossier_storage_path?: string;
  enrolled_at: string;
  application_id: string;
  candidate: {
    id: string;
    full_name: string;
    masked_cnic: string;
    joining_id: string;
    mobile: string;
    email?: string;
    branch_name: string;
  } | null;
}

export function CentralHrDashboard({
  currentUser,
  onSignOut,
  mobileNavOpen,
  setMobileNavOpen,
}: CentralHrDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'headcount' | 'workflow_tracker' | 'data_import' | 'create_joiner' | 'review_queue' | 'enrolled_roster'>('overview');
  const [internalNavOpen, setInternalNavOpen] = useState(false);
  const isNavOpen = mobileNavOpen !== undefined ? mobileNavOpen : internalNavOpen;
  const setNavOpen = setMobileNavOpen || setInternalNavOpen;
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<{
    zoneId?: string;
    zoneName: string;
    totalCandidates: number;
    totalApplications: number;
    pendingReviewCount: number;
    needsCorrectionCount: number;
    approvedCount: number;
    rejectedCount: number;
    enrolledCount: number;
    branchesCount: number;
    branches: Array<{ id: string; name: string }>;
  } | null>(null);

  // Form references
  const [formOptions, setFormOptions] = useState<{
    designations: Array<{ id: string; name: string; departments?: { name: string } }>;
    branches: Array<{ id: string; name: string; address?: string }>;
  }>({ designations: [], branches: [] });

  // "Create New Joiner" State
  const [joinerForm, setJoinerForm] = useState<{
    full_name: string;
    cnic: string;
    mobile: string;
    email: string;
    designation_id: string;
    branch_id: string;
    track: 'executive' | 'non_executive';
    allow_duplicate_override: boolean;
    override_reason: string;
  }>({
    full_name: '',
    cnic: '',
    mobile: '',
    email: '',
    designation_id: '',
    branch_id: '',
    track: 'executive',
    allow_duplicate_override: false,
    override_reason: '',
  });
  const [duplicateWarning, setDuplicateWarning] = useState<{
    exists: boolean;
    candidate?: {
      id: string;
      full_name: string;
      masked_cnic: string;
      joining_id: string;
      created_at: string;
      zone_name?: string;
      branch_name?: string;
    };
  } | null>(null);
  const [createdJoinerResult, setCreatedJoinerResult] = useState<{
    joining_id: string;
    candidate_name: string;
    mobile: string;
    email?: string;
    track: string;
  } | null>(null);

  // Review Queue State
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [queuePagination, setQueuePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [queueBranchFilter, setQueueBranchFilter] = useState('');
  const [queueSearch, setQueueSearch] = useState('');

  // Memoized unique applications to prevent duplicate row rendering
  const uniqueApplications = React.useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((app) => {
      if (!app?.id || seen.has(app.id)) return false;
      seen.add(app.id);
      return true;
    });
  }, [applications]);

  // Enrolled Employees State
  const [enrolledEmployees, setEnrolledEmployees] = useState<EnrolledEmployee[]>([]);

  // Memoized unique enrolled employees
  const uniqueEnrolledEmployees = React.useMemo(() => {
    const seen = new Set<string>();
    return enrolledEmployees.filter((emp) => {
      if (!emp?.id || seen.has(emp.id)) return false;
      seen.add(emp.id);
      return true;
    });
  }, [enrolledEmployees]);

  // Dossier Modal State
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState<any | null>(null);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    action: 'approve_enrol' | 'return_correction' | 'reject' | null;
    applicationId: string | null;
    candidateName: string;
    joiningId: string;
    reason: string;
    unlockedSections: string[];
  }>({
    open: false,
    action: null,
    applicationId: null,
    candidateName: '',
    joiningId: '',
    reason: '',
    unlockedSections: [],
  });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  // Printable PDF Dossier Modal
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfDossierData, setPdfDossierData] = useState<any | null>(null);

  // Helper: Get Auth Token
  const getAuthToken = async (): Promise<string | null> => {
    return getStaffAccessToken();
  };

  // Fetch Dashboard Metrics
  const fetchMetrics = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/central/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load Central HR metrics:', err);
    }
  };

  // Fetch Form Options
  const fetchFormOptions = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/central/form-options', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFormOptions({
          designations: data.designations || [],
          branches: data.branches || [],
        });
        if (data.branches && data.branches.length > 0 && !joinerForm.branch_id) {
          setJoinerForm((prev) => ({ ...prev, branch_id: data.branches[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load form options:', err);
    }
  };

  // Fetch Review Queue Applications
  const fetchApplications = async (page = 1) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        status: queueStatusFilter,
      });
      if (queueBranchFilter) params.append('branch_id', queueBranchFilter);
      if (queueSearch) params.append('search', queueSearch);

      const res = await fetch(`/api/central/applications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications || []);
        setQueuePagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages,
        });
      }
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Enrolled Employees
  const fetchEnrolledEmployees = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch('/api/central/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEnrolledEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to load enrolled employees:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchMetrics();
    fetchFormOptions();
  }, []);

  useEffect(() => {
    if (activeTab === 'review_queue') {
      fetchApplications(1);
    } else if (activeTab === 'enrolled_roster') {
      fetchEnrolledEmployees();
    } else if (activeTab === 'overview') {
      fetchMetrics();
    }
  }, [activeTab, queueStatusFilter, queueBranchFilter]);

  // Handle Live Duplicate CNIC Check
  const handleCnicBlur = async () => {
    const raw = joinerForm.cnic.replace(/\D/g, '');
    if (raw.length === 13) {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch('/api/central/check-duplicate-cnic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cnic: joinerForm.cnic }),
        });
        const data = await res.json();
        if (data.success && data.exists) {
          setDuplicateWarning({
            exists: true,
            candidate: data.candidate,
          });
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.warn('Duplicate check check failed:', err);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  // Handle Create Joiner Submission
  const handleCreateJoiner = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client validation [HARD RULES]
    const cnicDigits = joinerForm.cnic.replace(/\D/g, '');
    if (cnicDigits.length !== 13) {
      setErrorMessage('CNIC must contain exactly 13 digits (Pakistani format, e.g. 35202-1234567-1).');
      return;
    }

    const mobileDigits = joinerForm.mobile.replace(/\D/g, '');
    if (!mobileDigits.startsWith('03') && !mobileDigits.startsWith('923') && !mobileDigits.startsWith('3')) {
      setErrorMessage('Mobile number must be a valid Pakistani mobile number starting with 03 (e.g. 03001234567).');
      return;
    }

    if (duplicateWarning?.exists && !joinerForm.allow_duplicate_override) {
      setErrorMessage('Duplicate CNIC detected. You must check "Override Duplicate Warning" and provide a reason to proceed.');
      return;
    }

    if (joinerForm.allow_duplicate_override && (!joinerForm.override_reason || joinerForm.override_reason.trim().length < 5)) {
      setErrorMessage('Please provide a mandatory justification reason (min 5 characters) for duplicate CNIC override.');
      return;
    }

    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication session expired.');

      const res = await fetch('/api/central/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(joinerForm),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.is_duplicate) {
          setDuplicateWarning({
            exists: true,
            candidate: data.existing_candidate,
          });
        }
        throw new Error(data.error || 'Failed to create joiner record.');
      }

      setCreatedJoinerResult({
        joining_id: data.joining_id,
        candidate_name: joinerForm.full_name,
        mobile: joinerForm.mobile,
        email: joinerForm.email,
        track: joinerForm.track,
      });
      setSuccessMessage(`Candidate successfully created! Assigned Joining ID: ${data.joining_id}`);

      // Reset form
      setJoinerForm({
        full_name: '',
        cnic: '',
        mobile: '',
        email: '',
        designation_id: '',
        branch_id: formOptions.branches[0]?.id || '',
        track: 'executive',
        allow_duplicate_override: false,
        override_reason: '',
      });
      setDuplicateWarning(null);
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Open Dossier View
  const handleOpenDossier = async (appId: string) => {
    setSelectedApplicationId(appId);
    setDossierLoading(true);
    setDossierData(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`/api/central/applications/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDossierData(data);
      } else {
        alert(data.error || 'Could not load dossier.');
        setSelectedApplicationId(null);
      }
    } catch (err) {
      console.error('Error fetching dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  // Trigger Decision Action Modal
  const openDecisionDialog = (action: 'approve_enrol' | 'return_correction' | 'reject') => {
    if (!dossierData) return;
    setDecisionModal({
      open: true,
      action,
      applicationId: dossierData.application.id,
      candidateName: dossierData.candidate.full_name,
      joiningId: dossierData.candidate.joining_id,
      reason: '',
      unlockedSections: action === 'return_correction' ? ['documents'] : [],
    });
  };

  // Submit Decision Action
  const handleSubmitDecision = async () => {
    if (!decisionModal.action || !decisionModal.applicationId) return;

    if (decisionModal.action === 'return_correction') {
      if (!decisionModal.reason.trim() || decisionModal.reason.trim().length < 5) {
        alert('Please provide a specific correction reason for the candidate (minimum 5 characters).');
        return;
      }
      if (decisionModal.unlockedSections.length === 0) {
        alert('Please select at least one section that requires correction.');
        return;
      }
    }

    if (decisionModal.action === 'reject') {
      if (!decisionModal.reason.trim() || decisionModal.reason.trim().length < 5) {
        alert('A detailed rejection reason is mandatory.');
        return;
      }
    }

    try {
      setDecisionSubmitting(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Session expired.');

      const res = await fetch(`/api/central/applications/${decisionModal.applicationId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: decisionModal.action,
          reason: decisionModal.reason,
          unlocked_sections: decisionModal.unlockedSections,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Decision submission failed.');
      }

      alert(data.message || 'Decision successfully recorded!');
      setDecisionModal({
        open: false,
        action: null,
        applicationId: null,
        candidateName: '',
        joiningId: '',
        reason: '',
        unlockedSections: [],
      });

      // Refresh current dossier & queue
      handleOpenDossier(decisionModal.applicationId);
      fetchApplications(queuePagination.page);
      fetchMetrics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error: ${msg}`);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  // Section toggle for return for correction
  const toggleSection = (sec: string) => {
    setDecisionModal((prev) => {
      const exists = prev.unlockedSections.includes(sec);
      return {
        ...prev,
        unlockedSections: exists
          ? prev.unlockedSections.filter((s) => s !== sec)
          : [...prev.unlockedSections, sec],
      };
    });
  };

  // Open PDF Dossier Preview
  const handleOpenPdfDossier = (data: any) => {
    setPdfDossierData(data);
    setPdfModalOpen(true);
  };

  const handleOpenDecisionDialog = (action: 'approve_enrol' | 'return_correction' | 'reject') => {
    if (!dossierData) return;
    setDecisionModal({
      open: true,
      action,
      applicationId: dossierData.application.id,
      candidateName: dossierData.candidate?.full_name || '',
      joiningId: dossierData.candidate?.joining_id || '',
      reason: '',
      unlockedSections: action === 'return_correction' ? ['documents'] : [],
    });
  };

  const handleSelectTab = (
    tab: 'overview' | 'headcount' | 'workflow_tracker' | 'data_import' | 'create_joiner' | 'review_queue' | 'enrolled_roster'
  ) => {
    setActiveTab(tab);
    setSelectedApplicationId(null);
    setNavOpen(false);
  };

  const sidebarItems: PortalSidebarItem[] = [
    {
      id: 'central-nav-overview',
      label: 'Zone Overview',
      title: 'Zone Overview',
      icon: <Building2 className="w-3.5 h-3.5" />,
      active: activeTab === 'overview',
      onSelect: () => handleSelectTab('overview'),
    },
    {
      id: 'central-nav-headcount',
      label: 'Headcount Management',
      title: 'Headcount Management',
      icon: <Users className="w-3.5 h-3.5" />,
      active: activeTab === 'headcount',
      onSelect: () => handleSelectTab('headcount'),
    },
    {
      id: 'central-nav-workflow-tracker',
      label: 'Workflow Tracker',
      title: 'Workflow Tracker',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      active: activeTab === 'workflow_tracker',
      onSelect: () => handleSelectTab('workflow_tracker'),
    },
    {
      id: 'central-nav-data-import',
      label: 'Data Import',
      title: 'Data Import',
      icon: <Upload className="w-3.5 h-3.5" />,
      active: activeTab === 'data_import',
      onSelect: () => handleSelectTab('data_import'),
    },
    {
      id: 'central-nav-create-joiner',
      label: 'Create New Joiner',
      title: 'Create New Joiner',
      icon: <UserPlus className="w-3.5 h-3.5" />,
      active: activeTab === 'create_joiner',
      onSelect: () => handleSelectTab('create_joiner'),
      badge: (
        <span className="text-tag bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
          PX-ID
        </span>
      ),
    },
    {
      id: 'central-nav-review-queue',
      label: 'Review Queue',
      title: 'Review Queue',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      active: activeTab === 'review_queue',
      onSelect: () => handleSelectTab('review_queue'),
      badge:
        metrics && metrics.pendingReviewCount > 0 ? (
          <span className="bg-amber-500 text-slate-900 text-tag px-2 py-0.5 rounded-full font-bold">
            {metrics.pendingReviewCount}
          </span>
        ) : undefined,
    },
    {
      id: 'central-nav-enrolled-roster',
      label: 'Enrolled Employees',
      title: 'Enrolled Employees',
      icon: <UserCheck className="w-3.5 h-3.5" />,
      active: activeTab === 'enrolled_roster',
      onSelect: () => handleSelectTab('enrolled_roster'),
      badge:
        metrics && metrics.enrolledCount > 0 ? (
          <span className="bg-slate-800 text-emerald-300 text-tag px-2 py-0.5 rounded-full border border-emerald-500/30">
            {metrics.enrolledCount}
          </span>
        ) : undefined,
    },
  ];

  const zoneTitle = currentUser.zone_name || metrics?.zoneName || 'Assigned Zone';

  return (
    <div className="flex flex-col sm:flex-row min-h-[calc(100vh-4rem)] bg-slate-100 overflow-x-hidden">
      {/* Shared Portal Sidebar */}
      <PortalSidebar
        brand={{
          icon: <IdCard className="w-3.5 h-3.5" />,
          title: 'Central HR',
          subtitle: zoneTitle,
        }}
        headerExtra={
          <div className="text-caption text-slate-400 flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 mt-1">
            <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-tag">Zone-Scoped Access</span>
          </div>
        }
        items={sidebarItems}
        isOpen={isNavOpen}
        onClose={() => setNavOpen(false)}
        onSignOut={onSignOut}
        signOutBtnId="central-hr-signout-btn"
        signOutLabel="Sign Out"
        userContext={{
          name: currentUser.name ? toTitleCase(currentUser.name) : currentUser.email,
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* 2. Main Workspace Content Area */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
        <PageContainer width={activeTab === 'create_joiner' ? 'form' : 'full'}>
          {/* Global Notifications */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-caption font-medium flex items-start justify-between shadow-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Error:</span> {errorMessage}
                </div>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-caption font-medium flex items-start justify-between shadow-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Success:</span> {successMessage}
                </div>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* VIEW 1: OVERVIEW & PIPELINE METRICS */}
          {activeTab === 'overview' && (
            <CentralOverviewView
              metrics={metrics}
              zoneName={currentUser.zone_name || metrics?.zoneName || 'Assigned Zone'}
              onNavigateToCreateJoiner={() => setActiveTab('create_joiner')}
              onNavigateToReviewQueue={() => setActiveTab('review_queue')}
              onNavigateToHeadcount={() => setActiveTab('headcount')}
              onRefresh={fetchMetrics}
            />
          )}

          {/* VIEW 1B: HEADCOUNT MANAGEMENT */}
          {activeTab === 'headcount' && <HeadcountManagementView />}

          {/* VIEW 1C: WORKFLOW TRACKER */}
          {activeTab === 'workflow_tracker' && (
            <WorkflowTrackerView
              role="central_hr"
              zoneName={currentUser.zone_name || metrics?.zoneName}
              assignedBranches={
                metrics?.branches?.map((b) => b.name) ||
                formOptions.branches.map((b) => b.name)
              }
            />
          )}

          {/* VIEW 1D: DATA IMPORT */}
          {activeTab === 'data_import' && <DataImportView onDataImported={fetchFormOptions} />}

          {/* VIEW 2: CREATE NEW JOINER FORM */}
          {activeTab === 'create_joiner' && (
            <CreateJoinerView
              joinerForm={joinerForm}
              setJoinerForm={setJoinerForm}
              handleCreateJoiner={handleCreateJoiner}
              handleCnicBlur={handleCnicBlur}
              duplicateWarning={duplicateWarning}
              createdJoinerResult={createdJoinerResult}
              setCreatedJoinerResult={setCreatedJoinerResult}
              formOptions={formOptions}
              loading={loading}
              zoneName={currentUser.zone_name || metrics?.zoneName || 'Assigned Zone'}
              onNavigateToReviewQueue={() => setActiveTab('review_queue')}
            />
          )}

          {/* VIEW 3: REVIEW QUEUE (Zone Scoped) */}
          {activeTab === 'review_queue' && (
            <ReviewQueueView
              applications={applications}
              loading={loading}
              queueSearch={queueSearch}
              setQueueSearch={setQueueSearch}
              queueStatusFilter={queueStatusFilter}
              setQueueStatusFilter={setQueueStatusFilter}
              queueBranchFilter={queueBranchFilter}
              setQueueBranchFilter={setQueueBranchFilter}
              queuePagination={queuePagination}
              fetchApplications={fetchApplications}
              formOptions={formOptions}
              zoneName={currentUser.zone_name || metrics?.zoneName || 'Assigned Zone'}
              onOpenDossier={handleOpenDossier}
            />
          )}

          {/* VIEW 4: ENROLLED EMPLOYEES ROSTER */}
          {activeTab === 'enrolled_roster' && (
            <EnrolledRosterView
              enrolledEmployees={enrolledEmployees}
              loading={loading}
              zoneName={currentUser.zone_name || metrics?.zoneName || 'Assigned Zone'}
              onRefresh={fetchEnrolledEmployees}
              onOpenPdfDossier={handleOpenPdfDossier}
              role="central_hr"
              actorName={currentUser.name || currentUser.email || 'Central HR'}
            />
          )}
        </PageContainer>
      </main>

      {/* 3. Full Dossier View Modal */}
      <DossierModal
        isOpen={Boolean(selectedApplicationId)}
        onClose={() => setSelectedApplicationId(null)}
        dossierLoading={dossierLoading}
        dossierData={dossierData}
        currentUserName={currentUser.name || currentUser.email || 'Central HR'}
        onOpenDecisionDialog={handleOpenDecisionDialog}
        onOpenPdfDossier={handleOpenPdfDossier}
      />

      {/* 4. Action Confirmation Modal */}
      <DecisionActionModal
        isOpen={decisionModal.open}
        onClose={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
        decisionModal={decisionModal}
        setDecisionModal={setDecisionModal}
        toggleSection={toggleSection}
        onSubmit={handleSubmitDecision}
        submitting={decisionSubmitting}
      />

      {/* 5. Printable / Certificate PDF Dossier Modal */}
      <PdfDossierModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfDossierData={pdfDossierData}
      />
    </div>
  );
}
