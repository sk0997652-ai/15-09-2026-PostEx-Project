/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  MapPin,
  Users,
  FileText,
  Clock,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  KeyRound,
  UserPlus,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  BarChart3,
  Layers,
  Send,
  Lock,
  Edit,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  getZonalMetrics,
  getZonalStaff,
  createZonalStaff,
  updateZonalStaff,
  toggleZonalStaffStatus,
  regenerateZonalStaffPassword,
  getZonalApplications,
  reassignZonalApplication,
  overrideZonalApplicationDecision,
  ZonalMetrics,
  ZonalStaffProfile,
  ZonalApplication,
  CentralHrStaffMember,
} from '../lib/zonalHrApi';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';

interface ZonalHrDashboardProps {
  currentUser: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    zone_id?: string;
  };
  onSignOut: () => void;
}

export function ZonalHrDashboard({ currentUser, onSignOut }: ZonalHrDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'applications' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<ZonalMetrics | null>(null);
  const [zoneInfo, setZoneInfo] = useState<{ id: string; name: string } | null>(null);

  // Staff state
  const [staffList, setStaffList] = useState<ZonalStaffProfile[]>([]);
  const [zoneBranches, setZoneBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffRole, setNewStaffRole] = useState<'central_hr' | 'branch_manager'>('central_hr');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffBranchId, setNewStaffBranchId] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Password reveal modal
  const [createdPasswordModal, setCreatedPasswordModal] = useState<{
    isOpen: boolean;
    staffName: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Edit Staff modal
  const [editStaffModal, setEditStaffModal] = useState<{
    isOpen: boolean;
    staffId: string;
    name: string;
    email: string;
    branchId: string;
    roleName: 'central_hr' | 'branch_manager';
    submitting: boolean;
  }>({
    isOpen: false,
    staffId: '',
    name: '',
    email: '',
    branchId: '',
    roleName: 'central_hr',
    submitting: false,
  });

  // Staff search, filter, and pagination
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');
  const [staffBranchFilter, setStaffBranchFilter] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const staffLimit = 10;

  // Deduplicate and filter staff
  const uniqueStaffList = useMemo(() => {
    const seen = new Set<string>();
    return staffList.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [staffList]);

  const filteredStaffList = useMemo(() => {
    return uniqueStaffList.filter((s) => {
      const q = staffSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));
      const matchRole = !staffRoleFilter || s.roles?.name === staffRoleFilter;
      const matchStatus =
        !staffStatusFilter ||
        (staffStatusFilter === 'active' && s.is_active) ||
        (staffStatusFilter === 'inactive' && !s.is_active);
      const matchBranch = !staffBranchFilter || s.branches?.id === staffBranchFilter;
      return matchSearch && matchRole && matchStatus && matchBranch;
    });
  }, [uniqueStaffList, staffSearch, staffRoleFilter, staffStatusFilter, staffBranchFilter]);

  const staffTotalPages = Math.max(1, Math.ceil(filteredStaffList.length / staffLimit));
  const paginatedStaffList = useMemo(() => {
    const start = (staffPage - 1) * staffLimit;
    return filteredStaffList.slice(start, start + staffLimit);
  }, [filteredStaffList, staffPage, staffLimit]);

  // Applications state
  const [applications, setApplications] = useState<ZonalApplication[]>([]);
  const [centralHrList, setCentralHrList] = useState<CentralHrStaffMember[]>([]);
  const [appPage, setAppPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalCount, setAppTotalCount] = useState(0);
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);

  // Deduplicate applications
  const uniqueApplications = useMemo(() => {
    const seen = new Set<string>();
    return applications.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [applications]);

  // Reassignment modal
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    application: ZonalApplication | null;
    targetHrId: string;
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    application: null,
    targetHrId: '',
    reason: '',
    submitting: false,
  });

  // Override decision modal
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    application: ZonalApplication | null;
    decision: 'approved' | 'correction_needed' | 'rejected';
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    application: null,
    decision: 'approved',
    reason: '',
    submitting: false,
  });

  // Dedicated confirmation modal state (replacing window.confirm)
  const [confirmActionModal, setConfirmActionModal] = useState<{
    isOpen: boolean;
    type: 'regenerate_password' | 'toggle_status';
    staff: ZonalStaffProfile | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    type: 'regenerate_password',
    staff: null,
    isDeleting: false,
  });

  const staffRoleSelectId = useId();
  const staffBranchSelectId = useId();
  const reassignSelectId = useId();
  const overrideSelectId = useId();

  // Load metrics & data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricRes, staffRes] = await Promise.all([
        getZonalMetrics(),
        getZonalStaff(),
      ]);

      setMetrics(metricRes.metrics);
      setZoneInfo(metricRes.zone);
      setStaffList(staffRes.staff);
      setZoneBranches(staffRes.branches);
      if (staffRes.branches.length > 0) {
        setNewStaffBranchId(staffRes.branches[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Load paginated applications
  const loadApplications = async (page = 1) => {
    try {
      setLoadingApps(true);
      const res = await getZonalApplications({
        page,
        limit: 10,
        status: appStatusFilter,
        search: appSearchQuery,
      });

      setApplications(res.applications);
      setCentralHrList(res.centralHrStaff);
      setAppPage(res.pagination.page);
      setAppTotalPages(res.pagination.totalPages || 1);
      setAppTotalCount(res.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'applications') {
      loadApplications(1);
    }
  }, [activeTab, appStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadApplications(1);
  };

  // Handle staff creation
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffName) {
      setError('Please provide email and full name.');
      return;
    }

    if (newStaffRole === 'branch_manager' && !newStaffBranchId) {
      setError('Branch selection is mandatory for Branch Manager.');
      return;
    }

    try {
      setCreatingStaff(true);
      setError(null);
      const res = await createZonalStaff({
        email: newStaffEmail.trim(),
        name: newStaffName.trim(),
        role_name: newStaffRole,
        branch_id: newStaffRole === 'branch_manager' ? newStaffBranchId : undefined,
        phone: newStaffPhone.trim() || undefined,
      });

      setShowAddStaffModal(false);
      setNewStaffEmail('');
      setNewStaffName('');
      setNewStaffPhone('');

      // Show temporary password modal
      setCreatedPasswordModal({
        isOpen: true,
        staffName: res.staff.name,
        email: res.staff.email,
        password: res.one_time_temporary_password,
      });

      // Refresh staff list
      const staffRes = await getZonalStaff();
      setStaffList(staffRes.staff);
      setSuccessMessage(`Account created for ${res.staff.name}. Temporary credentials generated.`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingStaff(false);
    }
  };

  // Handle password regeneration trigger
  const handleRegeneratePassword = (staff: ZonalStaffProfile) => {
    setConfirmActionModal({
      isOpen: true,
      type: 'regenerate_password',
      staff,
      isDeleting: false,
    });
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff: ZonalStaffProfile) => {
    setEditStaffModal({
      isOpen: true,
      staffId: staff.id,
      name: staff.name,
      email: staff.email,
      branchId: staff.branches?.id || '',
      roleName: (staff.roles?.name === 'branch_manager' ? 'branch_manager' : 'central_hr'),
      submitting: false,
    });
  };

  // Save Edit Staff
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffModal.name.trim()) {
      setError('Staff name cannot be empty.');
      return;
    }
    if (editStaffModal.roleName === 'branch_manager' && !editStaffModal.branchId) {
      setError('Branch Manager must be assigned to an operational branch.');
      return;
    }

    try {
      setEditStaffModal((prev) => ({ ...prev, submitting: true }));
      setError(null);
      await updateZonalStaff(editStaffModal.staffId, {
        name: editStaffModal.name.trim(),
        branch_id: editStaffModal.roleName === 'branch_manager' ? editStaffModal.branchId : (editStaffModal.branchId || null),
        role_name: editStaffModal.roleName,
      });
      setSuccessMessage('Staff profile updated successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
      setEditStaffModal((prev) => ({ ...prev, isOpen: false }));
      loadDashboardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setEditStaffModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Toggle Staff Active/Inactive status trigger
  const handleToggleStaffStatus = (staff: ZonalStaffProfile) => {
    setConfirmActionModal({
      isOpen: true,
      type: 'toggle_status',
      staff,
      isDeleting: false,
    });
  };

  // Execute confirmed action (regenerate password or toggle status)
  const handleExecuteConfirmedAction = async () => {
    const staff = confirmActionModal.staff;
    if (!staff) return;

    setConfirmActionModal((prev) => ({ ...prev, isDeleting: true }));
    setError(null);

    try {
      if (confirmActionModal.type === 'regenerate_password') {
        const res = await regenerateZonalStaffPassword(staff.id);
        setConfirmActionModal({ isOpen: false, type: 'regenerate_password', staff: null, isDeleting: false });
        setCreatedPasswordModal({
          isOpen: true,
          staffName: staff.name,
          email: staff.email,
          password: res.temporary_password,
        });
        setSuccessMessage(`New temporary password generated for ${staff.name}.`);
        setTimeout(() => setSuccessMessage(null), 6000);
      } else if (confirmActionModal.type === 'toggle_status') {
        const nextStatus = !staff.is_active;
        await toggleZonalStaffStatus(staff.id, nextStatus);
        setConfirmActionModal({ isOpen: false, type: 'toggle_status', staff: null, isDeleting: false });
        setSuccessMessage(`Staff member ${staff.name} is now ${nextStatus ? 'active' : 'inactive'}.`);
        setTimeout(() => setSuccessMessage(null), 5000);
        await loadDashboardData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmActionModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Handle Reassignment
  const handleExecuteReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal.application || !reassignModal.targetHrId) {
      setError('Please select a target Central HR staff member.');
      return;
    }

    try {
      setReassignModal((prev) => ({ ...prev, submitting: true }));
      setError(null);
      await reassignZonalApplication(
        reassignModal.application.id,
        reassignModal.targetHrId,
        reassignModal.reason.trim() || 'Zonal HR reassignment'
      );

      setSuccessMessage(`Application successfully reassigned.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setReassignModal({
        isOpen: false,
        application: null,
        targetHrId: '',
        reason: '',
        submitting: false,
      });
      loadApplications(appPage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setReassignModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle Override Decision
  const handleExecuteOverrideDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModal.application) return;

    if (!overrideModal.reason || !overrideModal.reason.trim()) {
      setError('Mandatory reason required for Zonal HR override decision.');
      return;
    }

    try {
      setOverrideModal((prev) => ({ ...prev, submitting: true }));
      setError(null);
      await overrideZonalApplicationDecision(
        overrideModal.application.id,
        overrideModal.decision,
        overrideModal.reason.trim()
      );

      setSuccessMessage(`Override decision (${overrideModal.decision}) recorded successfully.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setOverrideModal({
        isOpen: false,
        application: null,
        decision: 'approved',
        reason: '',
        submitting: false,
      });
      loadApplications(appPage);
      loadDashboardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setOverrideModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Dedicated Zonal HR Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col border-r border-slate-800">
        {/* Zonal Header / Scope Identity */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-teal-400">Zonal Operations</div>
              <div className="text-sm font-bold text-white truncate">{metrics?.zoneName || zoneInfo?.name || 'Assigned Zone'}</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>RLS Zone-Scoped Access</span>
          </div>
        </div>

        {/* Sidebar Menu Items */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            id="zonal-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Zone Overview</span>
          </button>

          <button
            id="zonal-tab-staff"
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="flex-1 text-left">Zone Staff Management</span>
            {staffList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-indigo-300 font-mono">
                {staffList.length}
              </span>
            )}
          </button>

          <button
            id="zonal-tab-applications"
            onClick={() => setActiveTab('applications')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'applications'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="flex-1 text-left">Applications Pipeline</span>
            {metrics?.pendingApplications !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                {metrics.pendingApplications}
              </span>
            )}
          </button>

          <button
            id="zonal-tab-reports"
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Zone Analytics &amp; SLA</span>
          </button>
        </nav>

        {/* User Badge & Sign Out */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-200 truncate">{currentUser.name || 'Zonal HR Manager'}</span>
              <span className="text-[10px] text-slate-400 truncate">{currentUser.email}</span>
            </div>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
              Zonal HR
            </span>
          </div>
          <button
            id="zonal-signout-btn"
            onClick={onSignOut}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Banner Alert for Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 font-bold ml-4 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-800 font-bold ml-4 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* Persistent Role & Section Banner */}
        <div className="mb-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-1">
              Zonal HR Workstation &bull; {metrics?.zoneName || zoneInfo?.name || 'Assigned Zone'}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'overview' && 'Zonal HR Manager — Operational Overview'}
              {activeTab === 'staff' && 'Zonal HR Manager — Zone Staff Management'}
              {activeTab === 'applications' && 'Zonal HR Manager — Applications Pipeline'}
              {activeTab === 'reports' && 'Zonal HR Manager — Zone Analytics & SLA'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'overview' && 'Operational dashboard, regional KPIs, and branch performance in this zone.'}
              {activeTab === 'staff' && 'Manage Central HR and Branch Manager staff accounts provisioned for this zone.'}
              {activeTab === 'applications' && 'Search candidates, inspect verification progress, reassign Central HR reviewers, or issue override decisions.'}
              {activeTab === 'reports' && 'Key performance metrics, turnaround benchmarks, and branch breakdown for this zone.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs">
              Logged in as: <strong className="text-slate-900">{currentUser.name}</strong>
            </span>
          </div>
        </div>

        {/* TAB 1: ZONE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Header / Zone Hero */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Geographic Region
                  </span>
                  <span className="text-xs text-slate-500 font-mono">ID: {metrics?.zoneId}</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                  {metrics?.zoneName || zoneInfo?.name || 'Zonal HR Command'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Managing onboarding pipelines, Central HR allocations, and Branch Manager operations in this zone.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="zonal-refresh-btn"
                  onClick={loadDashboardData}
                  disabled={loading}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Metrics</span>
                </button>
                <button
                  id="zonal-quick-add-staff-btn"
                  onClick={() => {
                    setActiveTab('staff');
                    setShowAddStaffModal(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Zone Staff</span>
                </button>
              </div>
            </div>

            {/* Metrics KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Total Candidates</span>
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{metrics?.totalCandidates ?? 0}</div>
                <div className="mt-1 text-[11px] text-slate-500">Registered in {metrics?.zoneName}</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Pending Review</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-3xl font-black text-amber-600">{metrics?.pendingApplications ?? 0}</div>
                <div className="mt-1 text-[11px] text-slate-500">Awaiting branch/HR decision</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Approved Onboarded</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-emerald-600">{metrics?.approvedApplications ?? 0}</div>
                <div className="mt-1 text-[11px] text-slate-500">Completed &amp; dossiers locked</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Avg Turnaround Time</span>
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-indigo-700">{metrics?.avgTurnaroundHours ?? 'N/A'}</div>
                <div className="mt-1 text-[11px] text-slate-500">Submission to final decision</div>
              </div>
            </div>

            {/* Zone Branches & Operational Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Branches in Zone */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Operational Branches in Zone</h3>
                    <p className="text-xs text-slate-500">Branches authorized for local candidate document verification.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                    {zoneBranches.length} Branches
                  </span>
                </div>

                {zoneBranches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No branches currently configured for this zone.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {zoneBranches.map((branch) => {
                      const branchStaff = staffList.filter((s) => s.branches?.id === branch.id);
                      return (
                        <div
                          key={branch.id}
                          className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                              <Building2 className="w-4 h-4 text-indigo-600" />
                              <span>{branch.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {branchStaff.length} Staff
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>
                              BM:{' '}
                              {branchStaff.length > 0
                                ? branchStaff.map((s) => s.name).join(', ')
                                : 'No BM assigned'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Zonal Staff Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Zone HR Staff</h3>
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        CH
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-900">Central HR Reviewers</div>
                        <div className="text-[11px] text-indigo-700">Audit &amp; approve dossiers</div>
                      </div>
                    </div>
                    <span className="text-sm font-black text-indigo-900 font-mono">
                      {staffList.filter((s) => s.roles?.name === 'central_hr').length}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                        BM
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Branch Managers</div>
                        <div className="text-[11px] text-slate-500">In-person physical checks</div>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-800 font-mono">
                      {staffList.filter((s) => s.roles?.name === 'branch_manager').length}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Zonal HR has authorization to create &amp; manage Central HR and Branch Managers in this zone.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ZONE STAFF MANAGEMENT */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Zone-Scoped Staff
                  </span>
                  <span className="text-xs text-slate-500">Region: {metrics?.zoneName}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                  Central HR &amp; Branch Manager Accounts
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Create accounts strictly within your assigned zone with automated temporary credential generation.
                </p>
              </div>

              <button
                id="zonal-add-staff-btn"
                onClick={() => setShowAddStaffModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Staff Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={staffSearch}
                  onChange={(e) => {
                    setStaffSearch(e.target.value);
                    setStaffPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={staffRoleFilter}
                  onChange={(e) => {
                    setStaffRoleFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="central_hr">Central HR</option>
                  <option value="branch_manager">Branch Manager</option>
                </select>

                <select
                  value={staffStatusFilter}
                  onChange={(e) => {
                    setStaffStatusFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  value={staffBranchFilter}
                  onChange={(e) => {
                    setStaffBranchFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {zoneBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                {(staffSearch || staffRoleFilter || staffStatusFilter || staffBranchFilter) && (
                  <button
                    onClick={() => {
                      setStaffSearch('');
                      setStaffRoleFilter('');
                      setStaffStatusFilter('');
                      setStaffBranchFilter('');
                      setStaffPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Staff Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Staff Directory ({filteredStaffList.length} of {uniqueStaffList.length})
                </span>
                <span className="text-[11px] text-slate-500">Policy: Min 10 chars, forced password change on first login</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Staff Member</th>
                      <th className="py-3 px-4 font-semibold">Assigned Role</th>
                      <th className="py-3 px-4 font-semibold">Branch Assignment</th>
                      <th className="py-3 px-4 font-semibold">Password Status</th>
                      <th className="py-3 px-4 font-semibold">Account Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedStaffList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No staff accounts matching your search or filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedStaffList.map((staff) => (
                        <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{staff.name}</div>
                            <div className="text-[11px] text-slate-500">{staff.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                staff.roles?.name === 'central_hr'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : staff.roles?.name === 'branch_manager'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {staff.roles?.name?.replace(/_/g, ' ') || 'Staff'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {staff.branches?.name || <span className="text-slate-400 italic">Zone-Wide (Central)</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            {staff.must_change_password ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Change Pending</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Active &amp; Set</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                staff.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${staff.is_active ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                              <span>{staff.is_active ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                id={`zonal-edit-staff-${staff.id}`}
                                onClick={() => handleOpenEditStaff(staff)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                                title="Edit staff details and role track"
                              >
                                <Edit className="w-3 h-3 text-indigo-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                id={`zonal-toggle-status-${staff.id}`}
                                onClick={() => handleToggleStaffStatus(staff)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                                  staff.is_active
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                                title={staff.is_active ? 'Deactivate staff account' : 'Reactivate staff account'}
                              >
                                {staff.is_active ? (
                                  <>
                                    <UserX className="w-3 h-3 text-rose-600" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                              <button
                                id={`zonal-regen-pwd-${staff.id}`}
                                onClick={() => handleRegeneratePassword(staff)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                                title="Generate new temporary password"
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Reset Password</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Staff Table Pagination Controls */}
              {filteredStaffList.length > 0 && (
                <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Showing {(staffPage - 1) * staffLimit + 1} to{' '}
                    {Math.min(staffPage * staffLimit, filteredStaffList.length)} of {filteredStaffList.length} staff members (Page {staffPage} of {staffTotalPages})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                      disabled={staffPage <= 1}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                      disabled={staffPage >= staffTotalPages}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: APPLICATIONS PIPELINE & REASSIGNMENT */}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Zone Applications Pipeline</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Search candidates, inspect verification progress, reassign Central HR reviewers, or issue override decisions.
                  </p>
                </div>
                <button
                  id="zonal-refresh-apps-btn"
                  onClick={() => loadApplications(appPage)}
                  disabled={loadingApps}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="zonal-app-search-input"
                    type="text"
                    value={appSearchQuery}
                    onChange={(e) => setAppSearchQuery(e.target.value)}
                    placeholder="Search candidate name, Joining ID, or CNIC..."
                    className="w-full pl-9 pr-20 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    Search
                  </button>
                </form>

                {/* Status Filter Dropdown */}
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status:</span>
                  <select
                    id="zonal-app-status-filter"
                    value={appStatusFilter}
                    onChange={(e) => {
                      setAppStatusFilter(e.target.value);
                      setAppPage(1);
                    }}
                    className="w-full sm:w-44 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="bm_verification">BM Verification</option>
                    <option value="hr_review">HR Review</option>
                    <option value="needs_correction">Needs Correction</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Applications Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Candidate</th>
                      <th className="py-3 px-4 font-semibold">Masked CNIC</th>
                      <th className="py-3 px-4 font-semibold">Branch</th>
                      <th className="py-3 px-4 font-semibold">Assigned Central HR</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Stage</th>
                      <th className="py-3 px-4 font-semibold text-right">Zonal Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingApps ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                          <span>Loading applications in {metrics?.zoneName}...</span>
                        </td>
                      </tr>
                    ) : uniqueApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No applications matching your filters in this zone.
                        </td>
                      </tr>
                    ) : (
                      uniqueApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{app.candidate?.full_name || 'Candidate'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{app.candidate?.joining_id}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {app.candidate?.masked_cnic || '*****'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {app.candidate?.branches?.name || 'Assigned Branch'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              <span>{app.assigned_central_hr_name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                app.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : app.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : app.status === 'needs_correction'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {app.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono">
                            Step {app.current_step}/4
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Reassign Button */}
                              <button
                                id={`zonal-reassign-btn-${app.id}`}
                                onClick={() => {
                                  setReassignModal({
                                    isOpen: true,
                                    application: app,
                                    targetHrId: centralHrList[0]?.id || '',
                                    reason: '',
                                    submitting: false,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                                title="Reassign application to another Central HR staff member in zone"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Reassign</span>
                              </button>

                              {/* Override Decision Hook Button */}
                              <button
                                id={`zonal-override-btn-${app.id}`}
                                onClick={() => {
                                  setOverrideModal({
                                    isOpen: true,
                                    application: app,
                                    decision: 'approved',
                                    reason: '',
                                    submitting: false,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                                title="Issue Zonal HR override decision"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>Override</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing Page {appPage} of {appTotalPages} ({appTotalCount} total applications)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadApplications(appPage - 1)}
                    disabled={appPage <= 1 || loadingApps}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    onClick={() => loadApplications(appPage + 1)}
                    disabled={appPage >= appTotalPages || loadingApps}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ZONE ANALYTICS & SLA REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Zone Operational SLA &amp; Analytics</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Key performance metrics, turnaround benchmarks, and branch breakdown for {metrics?.zoneName}.
              </p>
            </div>

            {/* Turnaround & SLA Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold">Average Turnaround</span>
                  <Clock className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-indigo-900">{metrics?.avgTurnaroundHours ?? 'N/A'}</div>
                <p className="text-xs text-slate-600 mt-2">
                  Calculated from submission timestamp to final HR decision timestamp across all candidates in this zone.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold">Approval Rate</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-emerald-600">
                  {metrics?.totalApplications && metrics.totalApplications > 0
                    ? `${Math.round((metrics.approvedApplications / metrics.totalApplications) * 100)}%`
                    : '100%'}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {metrics?.approvedApplications ?? 0} approved applications out of {metrics?.totalApplications ?? 0} total applications.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold">Rejection Rate</span>
                  <XCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-3xl font-black text-rose-600">
                  {metrics?.totalApplications && metrics.totalApplications > 0
                    ? `${Math.round((metrics.rejectedApplications / metrics.totalApplications) * 100)}%`
                    : '0%'}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {metrics?.rejectedApplications ?? 0} rejected applications out of {metrics?.totalApplications ?? 0} total applications.
                </p>
              </div>
            </div>

            {/* Branch Summary Breakdown */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Branch Distribution in {metrics?.zoneName}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Branch Name</th>
                      <th className="py-2.5 px-4 font-semibold">Assigned Branch Managers</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {zoneBranches.map((br) => {
                      const managers = staffList.filter((s) => s.branches?.id === br.id);
                      return (
                        <tr key={br.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">{br.name}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {managers.length > 0 ? (
                              managers.map((m) => m.name).join(', ')
                            ) : (
                              <span className="text-amber-600 italic">No Manager Assigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD ZONE STAFF */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Zone Staff Account</h3>
                  <p className="text-[11px] text-slate-500">Scoped to {metrics?.zoneName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role in Zone *</label>
                <select
                  id={staffRoleSelectId}
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="central_hr">Central HR (Review &amp; Dossier Approval)</option>
                  <option value="branch_manager">Branch Manager (In-Person Verification)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  * Zonal HR is authorized to provision Central HR and Branch Managers only.
                </p>
              </div>

              {newStaffRole === 'branch_manager' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch in {metrics?.zoneName} *</label>
                  <select
                    id={staffBranchSelectId}
                    value={newStaffBranchId}
                    onChange={(e) => setNewStaffBranchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {zoneBranches.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  id="zonal-new-staff-name"
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Usman Tariq"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  id="zonal-new-staff-email"
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g. usman.tariq@postex.pk"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  id="zonal-new-staff-phone"
                  type="text"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="e.g. 03001234567"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>
                  A random 14-character password meeting company policy will be generated. The user will be required to change it on their first login.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="zonal-submit-create-staff-btn"
                  type="submit"
                  disabled={creatingStaff}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {creatingStaff && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Credentials</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1b: EDIT ZONE STAFF */}
      {editStaffModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Zone Staff Member</h3>
                  <p className="text-[11px] text-slate-500">{editStaffModal.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditStaffModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  id="zonal-edit-staff-name"
                  type="text"
                  required
                  value={editStaffModal.name}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Track *</label>
                <select
                  id="zonal-edit-staff-role"
                  value={editStaffModal.roleName}
                  onChange={(e) =>
                    setEditStaffModal({
                      ...editStaffModal,
                      roleName: e.target.value as 'central_hr' | 'branch_manager',
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="central_hr">Central HR (Reviewer)</option>
                  <option value="branch_manager">Branch Manager (Verification)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editStaffModal.roleName === 'branch_manager' ? 'Branch Hub Assignment *' : 'Branch Hub Assignment (Optional)'}
                </label>
                <select
                  id="zonal-edit-staff-branch"
                  value={editStaffModal.branchId}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, branchId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {editStaffModal.roleName === 'central_hr' && (
                    <option value="">Zone-Wide HQ (No specific branch)</option>
                  )}
                  {zoneBranches.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name} ({br.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditStaffModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="zonal-save-edit-staff-btn"
                  type="submit"
                  disabled={editStaffModal.submitting}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {editStaffModal.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ONE-TIME PASSWORD REVEAL */}
      {createdPasswordModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">One-Time Credentials Generated</h3>
              <p className="text-xs text-slate-600 mt-1">
                Provide these temporary credentials to <strong>{createdPasswordModal.staffName}</strong>.
              </p>
            </div>

            <div className="mt-5 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Email Address</span>
                <div className="text-xs font-mono font-bold text-slate-800">{createdPasswordModal.email}</div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Temporary Password</span>
                <div className="flex items-center justify-between mt-1 p-2.5 rounded-lg bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900">
                  <span className="select-all tracking-wider">{createdPasswordModal.password}</span>
                  <button
                    id="zonal-copy-pwd-btn"
                    onClick={() => copyToClipboard(createdPasswordModal.password)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Mandatory Password Change:</strong> This password is valid only for the initial sign-in. The user will be prompted to choose a new password immediately upon login.
              </span>
            </div>

            <button
              id="zonal-close-pwd-modal-btn"
              onClick={() => setCreatedPasswordModal(null)}
              className="mt-5 w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Done &amp; Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: REASSIGNMENT MODAL */}
      {reassignModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reassign Candidate Application</h3>
                  <p className="text-[11px] text-slate-500">Zone: {metrics?.zoneName}</p>
                </div>
              </div>
              <button
                onClick={() => setReassignModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteReassignment} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-bold text-slate-900">
                  {reassignModal.application?.candidate?.full_name}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  ID: {reassignModal.application?.candidate?.joining_id} &bull; Current:{' '}
                  {reassignModal.application?.assigned_central_hr_name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Central HR Staff *</label>
                <select
                  id={reassignSelectId}
                  value={reassignModal.targetHrId}
                  onChange={(e) => setReassignModal((prev) => ({ ...prev, targetHrId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {centralHrList.map((hr) => (
                    <option key={hr.id} value={hr.id}>
                      {hr.name} ({hr.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reassignment Reason / Note</label>
                <textarea
                  id="zonal-reassign-reason"
                  rows={3}
                  value={reassignModal.reason}
                  onChange={(e) => setReassignModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Workload balancing across Central HR team..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReassignModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="zonal-submit-reassign-btn"
                  type="submit"
                  disabled={reassignModal.submitting}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {reassignModal.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Reassignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: OVERRIDE DECISION HOOK */}
      {overrideModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Zonal HR Override Decision</h3>
                  <p className="text-[11px] text-slate-500">Candidate: {overrideModal.application?.candidate?.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteOverrideDecision} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Override Decision *</label>
                <select
                  id={overrideSelectId}
                  value={overrideModal.decision}
                  onChange={(e) => setOverrideModal((prev) => ({ ...prev, decision: e.target.value as any }))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="approved">Approve Application (Final Approval)</option>
                  <option value="correction_needed">Return for Candidate Correction</option>
                  <option value="rejected">Reject Application</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandatory Justification / Reason *</label>
                <textarea
                  id="zonal-override-reason"
                  required
                  rows={4}
                  value={overrideModal.reason}
                  onChange={(e) => setOverrideModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="State the justification for this Zonal HR override decision (logged into permanent audit trail)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                This action is recorded in the permanent audit trail and overrides any pending reviewer stages.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="zonal-submit-override-btn"
                  type="submit"
                  disabled={overrideModal.submitting}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {overrideModal.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dedicated Confirmation Modal for Password Regeneration & Staff Status Toggle */}
      {confirmActionModal.staff && (
        <DeleteConfirmationModal
          isOpen={confirmActionModal.isOpen}
          title={
            confirmActionModal.type === 'regenerate_password'
              ? 'Regenerate Staff Temporary Password'
              : !confirmActionModal.staff.is_active
              ? 'Activate Staff Member'
              : 'Deactivate Staff Member'
          }
          itemName={`${confirmActionModal.staff.name} (${confirmActionModal.staff.email})`}
          itemType={confirmActionModal.type === 'regenerate_password' ? 'Staff Credentials' : 'Staff Profile'}
          contextInfo={`Branch: ${confirmActionModal.staff.branches?.name || 'Zonal Staff'} | Role: ${
            confirmActionModal.staff.roles?.name === 'branch_manager' ? 'Branch Manager' : 'Central HR'
          }`}
          warningMessage={
            confirmActionModal.type === 'regenerate_password'
              ? 'Generating a new temporary password will immediately invalidate current credentials for this staff member.'
              : !confirmActionModal.staff.is_active
              ? 'Activating this staff member will restore their operational portal access immediately.'
              : 'Deactivating this staff member will immediately revoke active access to the portal.'
          }
          confirmButtonLabel={
            confirmActionModal.type === 'regenerate_password'
              ? 'Yes, Regenerate Password'
              : !confirmActionModal.staff.is_active
              ? 'Yes, Activate Staff'
              : 'Yes, Deactivate Staff'
          }
          isDeleting={confirmActionModal.isDeleting}
          onConfirm={handleExecuteConfirmedAction}
          onCancel={() =>
            setConfirmActionModal((prev) => ({
              ...prev,
              isOpen: false,
              staff: null,
              isDeleting: false,
            }))
          }
        />
      )}
    </div>
  );
}
