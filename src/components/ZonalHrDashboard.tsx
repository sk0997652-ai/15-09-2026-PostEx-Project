/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  MapPin,
  Users,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  KeyRound,
  UserPlus,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  Sparkles,
  BarChart3,
  Layers,
  Lock,
  Edit,
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
import { ZoneOverviewView } from './zonal/ZoneOverviewView';
import { ZoneStaffView } from './zonal/ZoneStaffView';
import { ApplicationsPipelineView } from './zonal/ApplicationsPipelineView';
import { ZoneAnalyticsView } from './zonal/ZoneAnalyticsView';
import { Modal, Button, Input, Select, Textarea } from './ui';

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
    roleName: 'central_hr' | 'branch_manager';
    branchId: string;
    submitting: boolean;
  }>({
    isOpen: false,
    staffId: '',
    name: '',
    email: '',
    roleName: 'central_hr',
    branchId: '',
    submitting: false,
  });

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

  // Dedicated Action Confirmation Modal State
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

  // Applications state
  const [applications, setApplications] = useState<ZonalApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appPage, setAppPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalCount, setAppTotalCount] = useState(0);

  // Unique IDs for accessibility
  const staffRoleSelectId = useId();
  const staffBranchSelectId = useId();
  const reassignSelectId = useId();
  const overrideSelectId = useId();

  // Load Dashboard Data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Zonal Metrics & Zone Scope
      const m = await getZonalMetrics();
      setMetrics(m.metrics);
      if (m.zone?.id) {
        setZoneInfo({ id: m.zone.id, name: m.zone.name });
      }

      // Fetch Zone-Scoped Staff & Branches
      const staffRes = await getZonalStaff();
      setStaffList(staffRes.staff || []);
      setZoneBranches(staffRes.branches || []);
      if (staffRes.branches?.length > 0) {
        setNewStaffBranchId(staffRes.branches[0].id);
      }
    } catch (err: unknown) {
      console.error('Error loading Zonal HR dashboard data:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Load Applications
  const loadApplications = async (page = 1) => {
    try {
      setLoadingApps(true);
      setError(null);
      const res = await getZonalApplications({
        page,
        limit: 10,
        search: appSearchQuery.trim() || undefined,
        status: appStatusFilter || undefined,
      });

      setApplications(res.applications || []);
      setAppPage(res.pagination?.page || 1);
      setAppTotalPages(res.pagination?.totalPages || 1);
      setAppTotalCount(res.pagination?.total || 0);
    } catch (err: unknown) {
      console.error('Error fetching zonal applications:', err);
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

  // Central HR reviewer list for reassignment target select
  const centralHrList: CentralHrStaffMember[] = useMemo(() => {
    return staffList
      .filter((s) => s.roles?.name === 'central_hr' && s.is_active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone || undefined,
      }));
  }, [staffList]);

  // Handle Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffName) {
      setError('Staff name and valid email are mandatory.');
      return;
    }

    if (newStaffRole === 'branch_manager' && !newStaffBranchId) {
      setError('Branch Managers must be assigned to a specific branch in this zone.');
      return;
    }

    try {
      setCreatingStaff(true);
      setError(null);

      const res = await createZonalStaff({
        email: newStaffEmail.trim().toLowerCase(),
        name: newStaffName.trim(),
        role_name: newStaffRole,
        phone: newStaffPhone.trim() || undefined,
        branch_id: newStaffRole === 'branch_manager' ? newStaffBranchId : undefined,
      });

      setSuccessMessage(`Staff member ${newStaffName} successfully provisioned.`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Open one-time password reveal modal
      setCreatedPasswordModal({
        isOpen: true,
        staffName: res.staff.name,
        email: res.staff.email,
        password: res.one_time_temporary_password,
      });

      // Reset form
      setNewStaffEmail('');
      setNewStaffName('');
      setNewStaffPhone('');
      setShowAddStaffModal(false);

      // Refresh list
      await loadDashboardData();
    } catch (err: unknown) {
      console.error('Failed to create staff:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingStaff(false);
    }
  };

  // Handle Edit Staff
  const handleOpenEditStaff = (staff: ZonalStaffProfile) => {
    setEditStaffModal({
      isOpen: true,
      staffId: staff.id,
      name: staff.name,
      email: staff.email,
      roleName: (staff.roles?.name as any) || 'central_hr',
      branchId: staff.branches?.id || '',
      submitting: false,
    });
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffModal.name.trim()) {
      setError('Staff name is required.');
      return;
    }

    try {
      setEditStaffModal((prev) => ({ ...prev, submitting: true }));
      setError(null);

      await updateZonalStaff(editStaffModal.staffId, {
        name: editStaffModal.name.trim(),
        role_name: editStaffModal.roleName,
        branch_id: editStaffModal.roleName === 'branch_manager' ? editStaffModal.branchId : null,
      });

      setSuccessMessage(`Staff member updated successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setEditStaffModal((prev) => ({ ...prev, isOpen: false }));
      await loadDashboardData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setEditStaffModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Status toggle handler
  const handleToggleStaffStatus = (staff: ZonalStaffProfile) => {
    setConfirmActionModal({
      isOpen: true,
      type: 'toggle_status',
      staff,
      isDeleting: false,
    });
  };

  // Password regen handler
  const handleRegeneratePassword = (staff: ZonalStaffProfile) => {
    setConfirmActionModal({
      isOpen: true,
      type: 'regenerate_password',
      staff,
      isDeleting: false,
    });
  };

  // Execute Confirmed Modal Action
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

  const zoneDisplayName = metrics?.zoneName || zoneInfo?.name || 'Assigned Zone';

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
              <div className="text-sm font-bold text-white truncate">{zoneDisplayName}</div>
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

        {/* TAB 1: ZONE OVERVIEW */}
        {activeTab === 'overview' && (
          <ZoneOverviewView
            metrics={metrics}
            zoneInfo={zoneInfo}
            zoneBranches={zoneBranches}
            staffList={staffList}
            loading={loading}
            onRefresh={loadDashboardData}
            onNavigateToStaff={() => setActiveTab('staff')}
            onOpenAddStaff={() => {
              setActiveTab('staff');
              setShowAddStaffModal(true);
            }}
          />
        )}

        {/* TAB 2: ZONE STAFF MANAGEMENT */}
        {activeTab === 'staff' && (
          <ZoneStaffView
            staffList={staffList}
            zoneBranches={zoneBranches}
            zoneName={zoneDisplayName}
            onOpenAddStaff={() => setShowAddStaffModal(true)}
            onOpenEditStaff={handleOpenEditStaff}
            onToggleStaffStatus={handleToggleStaffStatus}
            onRegeneratePassword={handleRegeneratePassword}
          />
        )}

        {/* TAB 3: APPLICATIONS PIPELINE & REASSIGNMENT */}
        {activeTab === 'applications' && (
          <ApplicationsPipelineView
            applications={applications}
            loadingApps={loadingApps}
            zoneName={zoneDisplayName}
            appSearchQuery={appSearchQuery}
            onSearchQueryChange={setAppSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            appStatusFilter={appStatusFilter}
            onStatusFilterChange={setAppStatusFilter}
            appPage={appPage}
            appTotalPages={appTotalPages}
            appTotalCount={appTotalCount}
            onPageChange={loadApplications}
            onRefresh={() => loadApplications(appPage)}
            onOpenReassign={(app) => {
              setReassignModal({
                isOpen: true,
                application: app,
                targetHrId: centralHrList[0]?.id || '',
                reason: '',
                submitting: false,
              });
            }}
            onOpenOverride={(app) => {
              setOverrideModal({
                isOpen: true,
                application: app,
                decision: 'approved',
                reason: '',
                submitting: false,
              });
            }}
          />
        )}

        {/* TAB 4: ZONE ANALYTICS & SLA REPORTS */}
        {activeTab === 'reports' && (
          <ZoneAnalyticsView
            metrics={metrics}
            zoneBranches={zoneBranches}
            staffList={staffList}
            zoneName={zoneDisplayName}
          />
        )}
      </main>

      {/* MODAL 1: ADD ZONE STAFF */}
      {showAddStaffModal && (
        <Modal
          isOpen={showAddStaffModal}
          onClose={() => setShowAddStaffModal(false)}
          title="Create Zone Staff Account"
          description={`Scoped to ${zoneDisplayName}`}
          size="md"
        >
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <Select
                id={staffRoleSelectId}
                label="Role in Zone *"
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as any)}
                options={[
                  { value: 'central_hr', label: 'Central HR (Review & Dossier Approval)' },
                  { value: 'branch_manager', label: 'Branch Manager (In-Person Verification)' },
                ]}
                helperText="* Zonal HR is authorized to provision Central HR and Branch Managers only."
              />
            </div>

            {newStaffRole === 'branch_manager' && (
              <div>
                <Select
                  id={staffBranchSelectId}
                  label={`Branch in ${zoneDisplayName} *`}
                  value={newStaffBranchId}
                  onChange={(e) => setNewStaffBranchId(e.target.value)}
                  required
                  options={zoneBranches.map((br) => ({ value: br.id, label: br.name }))}
                />
              </div>
            )}

            <div>
              <Input
                id="zonal-new-staff-name"
                label="Full Name *"
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="e.g. Usman Tariq"
              />
            </div>

            <div>
              <Input
                id="zonal-new-staff-email"
                label="Email Address *"
                type="email"
                required
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="e.g. usman.tariq@postex.pk"
              />
            </div>

            <div>
              <Input
                id="zonal-new-staff-phone"
                label="Phone Number (Optional)"
                type="text"
                value={newStaffPhone}
                onChange={(e) => setNewStaffPhone(e.target.value)}
                placeholder="e.g. 03001234567"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
              <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <span>
                A random 14-character password meeting company policy will be generated. The user will be required to change it on their first login.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddStaffModal(false)}
              >
                Cancel
              </Button>
              <Button
                id="zonal-submit-create-staff-btn"
                type="submit"
                variant="primary"
                disabled={creatingStaff}
                isLoading={creatingStaff}
              >
                Generate Credentials
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 1b: EDIT ZONE STAFF */}
      {editStaffModal.isOpen && (
        <Modal
          isOpen={editStaffModal.isOpen}
          onClose={() => setEditStaffModal((prev) => ({ ...prev, isOpen: false }))}
          title="Edit Zone Staff Member"
          description={editStaffModal.email}
          size="md"
        >
          <form onSubmit={handleSaveEditStaff} className="space-y-4">
            <div>
              <Input
                id="zonal-edit-staff-name"
                label="Full Name *"
                type="text"
                required
                value={editStaffModal.name}
                onChange={(e) => setEditStaffModal({ ...editStaffModal, name: e.target.value })}
              />
            </div>

            <div>
              <Select
                id="zonal-edit-staff-role"
                label="Role Track *"
                value={editStaffModal.roleName}
                onChange={(e) =>
                  setEditStaffModal({
                    ...editStaffModal,
                    roleName: e.target.value as 'central_hr' | 'branch_manager',
                  })
                }
                options={[
                  { value: 'central_hr', label: 'Central HR (Reviewer)' },
                  { value: 'branch_manager', label: 'Branch Manager (Verification)' },
                ]}
              />
            </div>

            <div>
              <Select
                id="zonal-edit-staff-branch"
                label={editStaffModal.roleName === 'branch_manager' ? 'Branch Hub Assignment *' : 'Branch Hub Assignment (Optional)'}
                value={editStaffModal.branchId}
                onChange={(e) => setEditStaffModal({ ...editStaffModal, branchId: e.target.value })}
                options={[
                  ...(editStaffModal.roleName === 'central_hr'
                    ? [{ value: '', label: 'Zone-Wide HQ (No specific branch)' }]
                    : []),
                  ...zoneBranches.map((br) => ({ value: br.id, label: br.name })),
                ]}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditStaffModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                id="zonal-save-edit-staff-btn"
                type="submit"
                variant="primary"
                disabled={editStaffModal.submitting}
                isLoading={editStaffModal.submitting}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: ONE-TIME PASSWORD REVEAL */}
      {createdPasswordModal?.isOpen && (
        <Modal
          isOpen={createdPasswordModal.isOpen}
          onClose={() => setCreatedPasswordModal(null)}
          title="One-Time Credentials Generated"
          size="md"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-600">
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

          <Button
            id="zonal-close-pwd-modal-btn"
            variant="primary"
            className="mt-5 w-full"
            onClick={() => setCreatedPasswordModal(null)}
          >
            Done &amp; Dismiss
          </Button>
        </Modal>
      )}

      {/* MODAL 3: REASSIGNMENT MODAL */}
      {reassignModal.isOpen && (
        <Modal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal((prev) => ({ ...prev, isOpen: false }))}
          title="Reassign Candidate Application"
          description={`Zone: ${zoneDisplayName}`}
          size="md"
        >
          <form onSubmit={handleExecuteReassignment} className="space-y-4">
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
              <Select
                id={reassignSelectId}
                label="Target Central HR Staff *"
                value={reassignModal.targetHrId}
                onChange={(e) => setReassignModal((prev) => ({ ...prev, targetHrId: e.target.value }))}
                required
                options={centralHrList.map((hr) => ({
                  value: hr.id,
                  label: `${hr.name} (${hr.email})`,
                }))}
              />
            </div>

            <div>
              <Textarea
                id="zonal-reassign-reason"
                label="Reassignment Reason / Note"
                rows={3}
                value={reassignModal.reason}
                onChange={(e) => setReassignModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Workload balancing across Central HR team..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReassignModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                id="zonal-submit-reassign-btn"
                type="submit"
                variant="primary"
                disabled={reassignModal.submitting}
                isLoading={reassignModal.submitting}
              >
                Confirm Reassignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: OVERRIDE DECISION HOOK */}
      {overrideModal.isOpen && (
        <Modal
          isOpen={overrideModal.isOpen}
          onClose={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
          title="Zonal HR Override Decision"
          description={`Candidate: ${overrideModal.application?.candidate?.full_name}`}
          size="md"
        >
          <form onSubmit={handleExecuteOverrideDecision} className="space-y-4">
            <div>
              <Select
                id={overrideSelectId}
                label="Override Decision *"
                value={overrideModal.decision}
                onChange={(e) => setOverrideModal((prev) => ({ ...prev, decision: e.target.value as any }))}
                options={[
                  { value: 'approved', label: 'Approve Application (Final Approval)' },
                  { value: 'correction_needed', label: 'Return for Candidate Correction' },
                  { value: 'rejected', label: 'Reject Application' },
                ]}
              />
            </div>

            <div>
              <Textarea
                id="zonal-override-reason"
                label="Mandatory Justification / Reason *"
                required
                rows={4}
                value={overrideModal.reason}
                onChange={(e) => setOverrideModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="State the justification for this Zonal HR override decision (logged into permanent audit trail)..."
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              This action is recorded in the permanent audit trail and overrides any pending reviewer stages.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                id="zonal-submit-override-btn"
                type="submit"
                variant="primary"
                disabled={overrideModal.submitting}
                isLoading={overrideModal.submitting}
              >
                Execute Override
              </Button>
            </div>
          </form>
        </Modal>
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
