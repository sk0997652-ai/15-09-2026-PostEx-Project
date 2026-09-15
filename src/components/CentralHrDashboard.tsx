// ==============================================================================
// PostEx HR Onboarding Portal — Central HR Dashboard Component (Step 7)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  UserPlus,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  FileText,
  UserCheck,
  Building2,
  Phone,
  Mail,
  Shield,
  Clock,
  Eye,
  Check,
  ChevronRight,
  AlertTriangle,
  Send,
  Download,
  Printer,
  ChevronLeft,
  X,
  Lock,
  Unlock,
  KeyRound,
  FileCheck,
  LogOut,
  RefreshCw,
  BadgeAlert,
  IdCard,
} from 'lucide-react';

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

export function CentralHrDashboard({ currentUser, onSignOut }: CentralHrDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'create_joiner' | 'review_queue' | 'enrolled_roster'>('overview');
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
  const [joinerForm, setJoinerForm] = useState({
    full_name: '',
    cnic: '',
    mobile: '',
    email: '',
    designation_id: '',
    branch_id: '',
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
  } | null>(null);

  // Review Queue State
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [queuePagination, setQueuePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [queueBranchFilter, setQueueBranchFilter] = useState('');
  const [queueSearch, setQueueSearch] = useState('');

  // Enrolled Employees State
  const [enrolledEmployees, setEnrolledEmployees] = useState<EnrolledEmployee[]>([]);

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
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
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

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ------------------------------------------------------------- */}
      {/* 1. Dedicated Central HR Sidebar Navigation */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-full lg:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between border-r border-slate-800">
        <div className="p-4 space-y-6">
          {/* User Badge / Role Context */}
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-bold">
                <IdCard className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-sm font-bold text-slate-100 truncate">{currentUser.name || currentUser.email}</h3>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  <span>Central HR</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
              <span className="text-slate-400">Assigned Zone:</span>
              <span className="font-semibold text-white bg-slate-700/60 px-2 py-0.5 rounded text-[11px]">
                {currentUser.zone_name || metrics?.zoneName || 'Assigned Zone'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              id="central-nav-overview"
              onClick={() => {
                setActiveTab('overview');
                setSelectedApplicationId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-indigo-300" />
                <span>Zone Overview</span>
              </div>
            </button>

            <button
              id="central-nav-create-joiner"
              onClick={() => {
                setActiveTab('create_joiner');
                setSelectedApplicationId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'create_joiner'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Create New Joiner</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
                PX-ID
              </span>
            </button>

            <button
              id="central-nav-review-queue"
              onClick={() => {
                setActiveTab('review_queue');
                setSelectedApplicationId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'review_queue'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <span>Review Queue</span>
              </div>
              {metrics && metrics.pendingReviewCount > 0 && (
                <span className="bg-amber-500 text-slate-900 font-bold text-[10px] px-2 py-0.5 rounded-full">
                  {metrics.pendingReviewCount}
                </span>
              )}
            </button>

            <button
              id="central-nav-enrolled-roster"
              onClick={() => {
                setActiveTab('enrolled_roster');
                setSelectedApplicationId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'enrolled_roster'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-teal-400" />
                <span>Enrolled Employees</span>
              </div>
              {metrics && metrics.enrolledCount > 0 && (
                <span className="bg-slate-800 text-teal-300 text-[10px] px-2 py-0.5 rounded-full border border-teal-500/30">
                  {metrics.enrolledCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Action */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="text-[11px] text-slate-400 px-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Zone RLS Enforced</span>
            </span>
          </div>
          <button
            id="central-hr-signout-btn"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. Main Workspace Content Area */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start justify-between shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Error:</span> {errorMessage}
              </div>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start justify-between shadow-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Success:</span> {successMessage}
              </div>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* VIEW 1: OVERVIEW & PIPELINE METRICS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold mb-2">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Central HR Workstation</span> &bull; <span>{currentUser.zone_name || metrics?.zoneName}</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Onboarding Operations Desk</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage joiner registrations, review branch-verified application dossiers, and enrol corporate employees.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveTab('create_joiner');
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Joiner</span>
                </button>
                <button
                  onClick={fetchMetrics}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                  title="Refresh Metrics"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Awaiting HR Review</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    {metrics?.pendingReviewCount ?? 0}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1 font-medium">Needs Central HR Decision</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Returned for Correction</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    {metrics?.needsCorrectionCount ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">Candidate Fixing Sections</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Enrolled Employees</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    {metrics?.enrolledCount ?? 0}
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium">Assigned EMP-ID &amp; Dossier</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Zone Branches</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    {metrics?.branchesCount ?? 0}
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-1 font-medium">Operational Hubs in Zone</p>
                </div>
              </div>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                    <UserPlus className="w-4 h-4" />
                    <span>Candidate Intake</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Issue Joining ID &amp; Trigger Onboarding</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Create new joiner profile with mandatory Pakistani CNIC (13 digits), mobile, email, and designation. Automated system assigns unique <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">PX-YYYY-XXXXXX</code> Joining ID and sends instant SMS/email notifications.
                  </p>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => setActiveTab('create_joiner')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Open Registration Form</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
                    <ClipboardList className="w-4 h-4" />
                    <span>Dossier Decision Desk</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Review BM-Verified Candidates</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Inspect physical verification marks from Branch Managers, uploaded documents, career &amp; education histories, and issue formal decision: <strong>Approve &amp; Enrol</strong> (generates Employee ID and compiled PDF Dossier), <strong>Return for Correction</strong> (select unlock sections), or <strong>Reject</strong>.
                  </p>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => setActiveTab('review_queue')}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Open Review Queue ({metrics?.pendingReviewCount ?? 0} Pending)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: CREATE NEW JOINER FORM */}
        {activeTab === 'create_joiner' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
              <div className="border-b border-slate-100 pb-5 mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Step 1: Joiner Intake</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">Register New Candidate Joiner</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enforce strict CNIC, mobile, and duplicate checking. On creation, a unique Joining ID (<code className="font-mono text-indigo-600">PX-YYYY-XXXXXX</code>) is auto-generated and dispatched via SMS/email.
                </p>
              </div>

              {/* Created Joiner Success Banner */}
              {createdJoinerResult && (
                <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Joiner Registered Successfully</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900 font-mono text-xs font-bold">
                      {createdJoinerResult.joining_id}
                    </span>
                  </div>
                  <div className="text-xs text-emerald-900 space-y-1 bg-white/70 p-3 rounded-xl border border-emerald-100 font-mono">
                    <p><strong>Candidate:</strong> {createdJoinerResult.candidate_name}</p>
                    <p><strong>Assigned Joining ID:</strong> {createdJoinerResult.joining_id}</p>
                    <p><strong>SMS Notification:</strong> Dispatched to {createdJoinerResult.mobile}</p>
                    {createdJoinerResult.email && <p><strong>Email Notification:</strong> Dispatched to {createdJoinerResult.email}</p>}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setActiveTab('review_queue');
                        setCreatedJoinerResult(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      View in Review Queue
                    </button>
                    <button
                      onClick={() => setCreatedJoinerResult(null)}
                      className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Register Another Joiner
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateJoiner} className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Candidate Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="joiner-name-input"
                    type="text"
                    required
                    placeholder="e.g. Muhammad Usman Ali"
                    value={joinerForm.full_name}
                    onChange={(e) => setJoinerForm({ ...joinerForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>

                {/* CNIC with Pakistani Format Validation */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Pakistani CNIC (13 Digits) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Format: 35202-1234567-1
                    </span>
                  </div>
                  <input
                    id="joiner-cnic-input"
                    type="text"
                    required
                    placeholder="35202-1234567-1 or 3520212345671"
                    value={joinerForm.cnic}
                    onChange={(e) => setJoinerForm({ ...joinerForm, cnic: e.target.value })}
                    onBlur={handleCnicBlur}
                    maxLength={15}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Must contain exactly 13 numeric digits. Hyphens are formatted automatically.
                  </p>
                </div>

                {/* Duplicate CNIC Warning & Override Box */}
                {duplicateWarning?.exists && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">Duplicate CNIC Detected in System</h4>
                        <p className="text-xs text-amber-800 mt-1">
                          A candidate record with this CNIC already exists:
                        </p>
                        <div className="mt-2 text-[11px] bg-white/80 p-2.5 rounded-lg border border-amber-200 text-amber-900 font-mono space-y-0.5">
                          <p><strong>Name:</strong> {duplicateWarning.candidate?.full_name}</p>
                          <p><strong>Joining ID:</strong> {duplicateWarning.candidate?.joining_id}</p>
                          <p><strong>Zone/Branch:</strong> {duplicateWarning.candidate?.zone_name} / {duplicateWarning.candidate?.branch_name}</p>
                          <p><strong>Registered:</strong> {duplicateWarning.candidate?.created_at ? new Date(duplicateWarning.candidate.created_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200">
                      <label className="flex items-start gap-2 text-xs font-semibold text-amber-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={joinerForm.allow_duplicate_override}
                          onChange={(e) => setJoinerForm({ ...joinerForm, allow_duplicate_override: e.target.checked })}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Override Duplicate Warning (Requires Mandatory Justification Reason)</span>
                      </label>

                      {joinerForm.allow_duplicate_override && (
                        <div className="mt-3">
                          <label className="block text-[11px] font-bold text-amber-900 mb-1">
                            Override Justification Reason <span className="text-rose-600">*</span>
                          </label>
                          <textarea
                            rows={2}
                            required
                            placeholder="e.g. Re-joining candidate after seasonal contract expiration; approved by Zonal Head."
                            value={joinerForm.override_reason}
                            onChange={(e) => setJoinerForm({ ...joinerForm, override_reason: e.target.value })}
                            className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Mobile Number (Pakistani) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="joiner-mobile-input"
                        type="tel"
                        required
                        placeholder="03001234567"
                        value={joinerForm.mobile}
                        onChange={(e) => setJoinerForm({ ...joinerForm, mobile: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">e.g. 03XXXXXXXXX or +923XXXXXXXXX</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Email Address (Optional)
                    </label>
                    <div className="relative">
                      <input
                        id="joiner-email-input"
                        type="email"
                        placeholder="candidate@example.com"
                        value={joinerForm.email}
                        onChange={(e) => setJoinerForm({ ...joinerForm, email: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>
                </div>

                {/* Designation & Branch Assignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Designation / Role Track
                    </label>
                    <select
                      id="joiner-designation-select"
                      value={joinerForm.designation_id}
                      onChange={(e) => setJoinerForm({ ...joinerForm, designation_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    >
                      <option value="">Select Designation...</option>
                      {formOptions.designations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.departments ? `(${d.departments.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Branch / Hub (Scoped to {currentUser.zone_name || metrics?.zoneName}) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="joiner-branch-select"
                      required
                      value={joinerForm.branch_id}
                      onChange={(e) => setJoinerForm({ ...joinerForm, branch_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    >
                      {formOptions.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    id="submit-create-joiner-btn"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating Joining ID &amp; Registering...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Register Joiner &amp; Issue Joining ID</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 3: REVIEW QUEUE (Zone Scoped) */}
        {activeTab === 'review_queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Onboarding Review Queue</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Applications from candidates in <strong>{currentUser.zone_name || metrics?.zoneName}</strong>. Inspect branch verifications and issue enrollment decisions.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search candidate, CNIC, PX-ID..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchApplications(1)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="hr_review">Awaiting HR Review</option>
                  <option value="needs_correction">Returned for Correction</option>
                  <option value="approved">Approved &amp; Enrolled</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={queueBranchFilter}
                  onChange={(e) => setQueueBranchFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {formOptions.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => fetchApplications(1)}
                  className="p-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                  title="Search &amp; Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Applications Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Joining ID</th>
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Masked CNIC</th>
                      <th className="py-3 px-4">Branch Hub</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span>Loading applications in your assigned zone...</span>
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <ClipboardList className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-700">No applications found</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Try adjusting your search query or status filter.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                            {app.candidate?.joining_id || 'N/A'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{app.candidate?.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{app.candidate?.mobile}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {app.candidate?.masked_cnic || app.candidate?.cnic}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {app.candidate?.branch_name || 'Assigned Branch'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                app.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : app.status === 'needs_correction'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}
                            >
                              {app.status.replace(/_/g, ' ')}
                            </span>
                            {app.employee_id && (
                              <div className="text-[10px] font-mono text-emerald-700 font-bold mt-0.5">
                                {app.employee_id}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              id={`view-dossier-btn-${app.id}`}
                              onClick={() => handleOpenDossier(app.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-200 text-xs font-bold transition-all cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Dossier &amp; Decision</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {queuePagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing page {queuePagination.page} of {queuePagination.totalPages} ({queuePagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={queuePagination.page <= 1}
                      onClick={() => fetchApplications(queuePagination.page - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={queuePagination.page >= queuePagination.totalPages}
                      onClick={() => fetchApplications(queuePagination.page + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: ENROLLED EMPLOYEES ROSTER */}
        {activeTab === 'enrolled_roster' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Enrolled Corporate Employees</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Approved candidates in <strong>{currentUser.zone_name || metrics?.zoneName}</strong> with formal Employee IDs and generated PDF Dossiers.
                </p>
              </div>
              <button
                onClick={fetchEnrolledEmployees}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Joining ID</th>
                      <th className="py-3 px-4">Candidate Name</th>
                      <th className="py-3 px-4">Masked CNIC</th>
                      <th className="py-3 px-4">Branch Hub</th>
                      <th className="py-3 px-4">Enrolled Date</th>
                      <th className="py-3 px-4 text-right">PDF Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span>Loading enrolled employees...</span>
                        </td>
                      </tr>
                    ) : enrolledEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-700">No enrolled employees yet</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Approve applications in the review queue to enrol employees.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      enrolledEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                            {emp.employee_id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {emp.candidate?.joining_id}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {emp.candidate?.full_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {emp.candidate?.masked_cnic}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {emp.candidate?.branch_name}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {new Date(emp.enrolled_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenPdfDossier(emp)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>View Dossier Certificate</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Full Dossier View Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedApplicationId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Candidate Onboarding Dossier</span>
                    {dossierData?.candidate?.joining_id && (
                      <span className="font-mono text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded border border-slate-700">
                        {dossierData.candidate.joining_id}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dossierData?.candidate?.full_name} &bull; {dossierData?.candidate?.zone_name} &bull; {dossierData?.candidate?.branch_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dossierData?.application?.status === 'approved' && (
                  <button
                    onClick={() => handleOpenPdfDossier(dossierData)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print PDF Dossier</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedApplicationId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {dossierLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
                  <p className="font-bold text-slate-700">Compiling candidate dossier...</p>
                </div>
              ) : !dossierData ? (
                <div className="py-12 text-center text-slate-500">Dossier not found.</div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      dossierData.application.status === 'approved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : dossierData.application.status === 'rejected'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : dossierData.application.status === 'needs_correction'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <span className="font-bold uppercase tracking-wider text-[11px]">
                          Application Status: {dossierData.application.status.replace(/_/g, ' ')}
                        </span>
                        {dossierData.application.decision_reason && (
                          <p className="text-xs mt-0.5">{dossierData.application.decision_reason}</p>
                        )}
                      </div>
                    </div>
                    {dossierData.application.employee?.employee_id && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-emerald-700">Employee ID</span>
                        <div className="text-sm font-mono font-bold text-emerald-900">
                          {dossierData.application.employee.employee_id}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1. Candidate Personal & Organizational Summary */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 mb-3">
                      1. Candidate Profile &amp; Contact Info
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Full Name</span>
                        <p className="font-bold text-slate-900">{dossierData.candidate.full_name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">CNIC</span>
                        <p className="font-mono font-bold text-slate-900">{dossierData.candidate.masked_cnic}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Mobile</span>
                        <p className="font-mono text-slate-800">{dossierData.candidate.mobile}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Email</span>
                        <p className="text-slate-800 truncate">{dossierData.candidate.email || 'None'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Joining ID</span>
                        <p className="font-mono font-bold text-indigo-700">{dossierData.candidate.joining_id}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Zone</span>
                        <p className="font-medium text-slate-800">{dossierData.candidate.zone_name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Branch</span>
                        <p className="font-medium text-slate-800">{dossierData.candidate.branch_name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold">Registered At</span>
                        <p className="text-slate-600">{new Date(dossierData.candidate.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Uploaded Documents & Branch Manager Verification Remarks */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700">
                        2. Uploaded Documents &amp; Verification Checks
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {dossierData.documents?.length || 0} Documents Uploaded
                      </span>
                    </div>

                    {dossierData.documents && dossierData.documents.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dossierData.documents.map((doc: any) => (
                          <div key={doc.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start justify-between">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-800 text-[11px]">
                                {doc.type.replace(/_/g, ' ')}
                              </span>
                              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                {doc.storage_path}
                              </p>
                              {doc.remark && (
                                <p className="text-[11px] text-slate-600 bg-slate-50 p-1 rounded mt-1 italic">
                                  "{doc.remark}"
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                doc.verification_status === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.verification_status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {doc.verification_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                        No digital documents uploaded yet.
                      </div>
                    )}
                  </div>

                  {/* 3. Branch Manager Remarks */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">
                      3. Branch Verification History
                    </h4>
                    {dossierData.verification_remarks && dossierData.verification_remarks.length > 0 ? (
                      <div className="space-y-2">
                        {dossierData.verification_remarks.map((r: any) => (
                          <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span className="font-semibold text-slate-800">
                                {r.staff_profiles?.name || 'Reviewer'} ({r.staff_profiles?.roles?.name || 'Staff'})
                              </span>
                              <span>{new Date(r.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700 font-medium">{r.remark}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No in-person verification remarks recorded.</p>
                    )}
                  </div>

                  {/* 4. HR Decision History */}
                  {dossierData.decisions && dossierData.decisions.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-700">
                        4. Central HR Historical Decisions
                      </h4>
                      <div className="space-y-2">
                        {dossierData.decisions.map((dec: any) => (
                          <div key={dec.id} className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span
                                className={`font-bold uppercase ${
                                  dec.decision === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {dec.decision}
                              </span>
                              <span className="text-slate-400">{new Date(dec.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700">{dec.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer / Decision Action Bar (Only if not decided yet or needs_correction) */}
            {dossierData && (
              <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-slate-500 text-xs">
                  <span>Take formal action for </span>
                  <strong className="text-slate-900">{dossierData.candidate.full_name}</strong>:
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="decision-return-correction-btn"
                    onClick={() => openDecisionDialog('return_correction')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return for Correction</span>
                  </button>

                  <button
                    id="decision-reject-btn"
                    onClick={() => openDecisionDialog('reject')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    id="decision-approve-enrol-btn"
                    onClick={() => openDecisionDialog('approve_enrol')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Enrol Employee</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. Action Confirmation Modal */}
      {/* ------------------------------------------------------------- */}
      {decisionModal.open && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                {decisionModal.action === 'approve_enrol' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Approve &amp; Formally Enrol Candidate</span>
                  </>
                )}
                {decisionModal.action === 'return_correction' && (
                  <>
                    <RotateCcw className="w-5 h-5 text-amber-600" />
                    <span>Return Application for Correction</span>
                  </>
                )}
                {decisionModal.action === 'reject' && (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Reject Candidate Application</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Candidate: <strong className="text-slate-900">{decisionModal.candidateName}</strong> (Joining ID:{' '}
                <span className="font-mono text-indigo-600">{decisionModal.joiningId}</span>)
              </p>

              {decisionModal.action === 'approve_enrol' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                  <p className="font-bold">On Confirmation:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>Auto-generates Employee ID: <code className="font-mono">EMP-[BRANCH]-XXXXX</code></li>
                    <li>Generates official PDF dossier record in storage</li>
                    <li>Locks application against edits</li>
                    <li>Dispatches enrollment SMS to candidate</li>
                  </ul>
                </div>
              )}

              {decisionModal.action === 'return_correction' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-900 font-bold mb-1.5">
                      Select Section(s) to Unlock for Candidate: <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        { id: 'documents', label: 'Uploaded Documents' },
                        { id: 'personal_info', label: 'Personal Information' },
                        { id: 'education', label: 'Education History' },
                        { id: 'employment', label: 'Employment History' },
                        { id: 'emergency_contacts', label: 'Emergency Contacts' },
                      ].map((sec) => (
                        <label
                          key={sec.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                            decisionModal.unlockedSections.includes(sec.id)
                              ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={decisionModal.unlockedSections.includes(sec.id)}
                            onChange={() => toggleSection(sec.id)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{sec.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-900 font-bold mb-1">
                      Correction Reason &amp; Instructions: <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Please re-upload clearer photograph of original CNIC Back side."
                      value={decisionModal.reason}
                      onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {decisionModal.action === 'reject' && (
                <div>
                  <label className="block text-slate-900 font-bold mb-1">
                    Rejection Justification: <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Failed background verification check / unverified educational credentials."
                    value={decisionModal.reason}
                    onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This candidate application will be locked and archived under the corporate Data Retention Policy.
                  </p>
                </div>
              )}

              {decisionModal.action === 'approve_enrol' && (
                <div>
                  <label className="block text-slate-900 font-bold mb-1">Approval Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. All documents verified in order. Enrolling for Hub operations."
                    value={decisionModal.reason}
                    onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-decision-submit-btn"
                disabled={decisionSubmitting}
                onClick={handleSubmitDecision}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                  decisionModal.action === 'approve_enrol'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionModal.action === 'return_correction'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {decisionSubmitting ? 'Recording Decision...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Printable / Certificate PDF Dossier Modal */}
      {/* ------------------------------------------------------------- */}
      {pdfModalOpen && pdfDossierData && (
        <div className="fixed inset-0 z-70 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 text-slate-900 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                  PX
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">PostEx Logistics (Pvt) Ltd.</h2>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Official Employee Onboarding Dossier Certificate
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/central/dossiers/${pdfDossierData.employee_id || pdfDossierData.application?.employee?.employee_id || 'EMP-01'}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                  download
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .PDF File</span>
                </a>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print View</span>
                </button>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Certificate Body */}
            <div className="p-6 bg-slate-50/70 rounded-xl border border-slate-200 space-y-5 text-xs">
              <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400">Assigned Corporate ID</span>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    {pdfDossierData.employee_id || pdfDossierData.application?.employee?.employee_id || 'EMP-ENROLLED'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400">Joining Reference</span>
                  <div className="text-sm font-bold font-mono text-indigo-700">
                    {pdfDossierData.candidate?.joining_id || pdfDossierData.candidate?.joining_id}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Employee Full Name</span>
                  <p className="text-sm font-bold text-slate-900">{pdfDossierData.candidate?.full_name}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Pakistani CNIC</span>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {pdfDossierData.candidate?.masked_cnic || pdfDossierData.candidate?.cnic}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Assigned Branch / Hub</span>
                  <p className="font-semibold text-slate-800">{pdfDossierData.candidate?.branch_name || 'Zone Hub'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Verification Status</span>
                  <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified &amp; Approved</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Dossier Generation Timestamp: {new Date().toLocaleString()}</span>
                <span>Authorized Signatory: Central HR Department</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
