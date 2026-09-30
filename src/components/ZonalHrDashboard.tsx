/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Users,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Sparkles,
  BarChart3,
  Layers,
  X,
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
  ZonalDepartmentOption,
  ZonalDesignationOption,
  ZonalApplication,
  CentralHrStaffMember,
} from '../lib/zonalHrApi';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import { HeadcountManagementView } from './common/HeadcountManagementView';
import { WorkflowTrackerView } from './common/WorkflowTrackerView';
import { DataImportView } from './common/DataImportView';
import { EnrolledRosterView } from './central/EnrolledRosterView';
import { Upload, UserCheck } from 'lucide-react';
import {
  ZoneOverviewView,
  ZoneStaffView,
  ApplicationsPipelineView,
  ZoneAnalyticsView,
  AddStaffModal,
  EditStaffModal,
  PasswordRevealModal,
  ReassignModal,
  OverrideDecisionModal,
} from './zonal';
import { Button } from './ui';

interface ZonalHrDashboardProps {
  currentUser: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    zone_id?: string;
  };
  onSignOut: () => void;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

export function ZonalHrDashboard({
  currentUser,
  onSignOut,
  mobileNavOpen,
  setMobileNavOpen,
}: ZonalHrDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'headcount' | 'workflow_tracker' | 'data_import' | 'enrolled_roster' | 'staff' | 'applications' | 'reports'>('overview');
  const [internalNavOpen, setInternalNavOpen] = useState(false);
  const isNavOpen = mobileNavOpen !== undefined ? mobileNavOpen : internalNavOpen;
  const setNavOpen = setMobileNavOpen || setInternalNavOpen;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<ZonalMetrics | null>(null);
  const [zoneInfo, setZoneInfo] = useState<{ id: string; name: string } | null>(null);

  // Staff state
  const [staffList, setStaffList] = useState<ZonalStaffProfile[]>([]);
  const [zoneBranches, setZoneBranches] = useState<Array<{ id: string; name: string; branch_code?: string; branch_type?: string }>>([]);
  const [zonalDepartments, setZonalDepartments] = useState<ZonalDepartmentOption[]>([]);
  const [zonalDesignations, setZonalDesignations] = useState<ZonalDesignationOption[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffRole, setNewStaffRole] = useState<'central_hr' | 'branch_manager'>('central_hr');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPersonalEmail, setNewStaffPersonalEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('PX-STAFF-1001');
  const [newStaffDepartmentId, setNewStaffDepartmentId] = useState('');
  const [newStaffDesignationId, setNewStaffDesignationId] = useState('');
  const [newStaffBranchId, setNewStaffBranchId] = useState('');
  const [newStaffBranchIds, setNewStaffBranchIds] = useState<string[]>([]);
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Password reveal modal
  const [createdPasswordModal, setCreatedPasswordModal] = useState<{
    isOpen: boolean;
    staffName: string;
    email: string;
    password: string;
  } | null>(null);

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

      // Fetch Zone-Scoped Staff, Branches, Departments, Designations & nextStaffEmployeeId
      const staffRes = await getZonalStaff();
      setStaffList(staffRes.staff || []);
      setZoneBranches(staffRes.branches || []);
      setZonalDepartments(staffRes.departments || []);
      setZonalDesignations(staffRes.designations || []);
      if (staffRes.nextStaffEmployeeId) {
        setNewStaffEmployeeId(staffRes.nextStaffEmployeeId);
      }
      if (staffRes.branches?.length > 0 && !newStaffBranchId) {
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
      setError('Staff full name and official work email are mandatory.');
      return;
    }

    if (!newStaffDepartmentId || !newStaffDesignationId) {
      setError('Department and Designation are required in Section B.');
      return;
    }

    const effectiveBranches =
      newStaffBranchIds.length > 0
        ? newStaffBranchIds
        : newStaffBranchId
        ? [newStaffBranchId]
        : [];

    if (newStaffRole === 'branch_manager' && effectiveBranches.length === 0) {
      setError('Branch Managers must be assigned to at least one branch in this zone.');
      return;
    }

    try {
      setCreatingStaff(true);
      setError(null);

      const res = await createZonalStaff({
        email: newStaffEmail.trim().toLowerCase(),
        name: newStaffName.trim(),
        personal_email: newStaffPersonalEmail.trim() || null,
        phone_number: newStaffPhone.trim() || null,
        phone: newStaffPhone.trim() || undefined,
        staff_employee_id: newStaffEmployeeId.trim() || null,
        department_id: newStaffDepartmentId,
        designation_id: newStaffDesignationId,
        role_name: newStaffRole,
        branch_id: effectiveBranches[0] || undefined,
        branch_ids: effectiveBranches,
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
      setNewStaffPersonalEmail('');
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffDepartmentId('');
      setNewStaffDesignationId('');
      setNewStaffBranchIds([]);
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

  const zoneDisplayName = metrics?.zoneName || zoneInfo?.name || 'Assigned Zone';

  const handleSelectTab = (tab: 'overview' | 'headcount' | 'workflow_tracker' | 'data_import' | 'enrolled_roster' | 'staff' | 'applications' | 'reports') => {
    setActiveTab(tab);
    setNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row overflow-x-hidden">
      {/* Mobile Slide-In Drawer Backdrop (<640px) */}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dedicated Zonal HR Sidebar Navigation */}
      <aside
        className={`${
          isNavOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64 flex shadow-2xl'
            : 'hidden'
        } sm:static sm:z-auto sm:flex sm:w-16 lg:w-60 bg-slate-900 text-white flex-shrink-0 flex-col border-r border-slate-800 transition-all duration-200`}
      >
        {/* Zonal Header / Scope Identity */}
        <div className="p-4 sm:p-3 lg:p-5 border-b border-slate-800">
          <div className="flex items-center justify-between sm:justify-center lg:justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 sm:hidden lg:block">
                <div className="text-xs font-semibold text-indigo-400">Zonal Operations</div>
                <div className="text-sm font-bold text-white truncate">{zoneDisplayName}</div>
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
          <div className="mt-3 text-[11px] text-slate-400 sm:hidden lg:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 flex">
            <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Zone-Scoped Access</span>
          </div>
        </div>

        {/* Sidebar Menu Items */}
        <nav className="flex-1 p-2.5 sm:p-2 lg:p-3 space-y-1 overflow-y-auto">
          <button
            id="zonal-tab-overview"
            title="Zone Overview"
            onClick={() => handleSelectTab('overview')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Zone Overview</span>
          </button>

          <button
            id="zonal-tab-headcount"
            title="Headcount Management"
            onClick={() => handleSelectTab('headcount')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'headcount'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Headcount Management</span>
          </button>

          <button
            id="zonal-tab-workflow-tracker"
            title="Workflow Tracker"
            onClick={() => handleSelectTab('workflow_tracker')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'workflow_tracker'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Workflow Tracker</span>
          </button>

          <button
            id="zonal-tab-data-import"
            title="Data Import"
            onClick={() => handleSelectTab('data_import')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'data_import'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Data Import</span>
          </button>

          <button
            id="zonal-tab-enrolled-roster"
            title="Enrolled Employees"
            onClick={() => handleSelectTab('enrolled_roster')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'enrolled_roster'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Enrolled Employees</span>
          </button>

          <button
            id="zonal-tab-staff"
            title="Zone Staff Management"
            onClick={() => handleSelectTab('staff')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left sm:hidden lg:inline truncate">Zone Staff Management</span>
            {staffList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-indigo-300 font-mono sm:hidden lg:inline">
                {staffList.length}
              </span>
            )}
          </button>

          <button
            id="zonal-tab-applications"
            title="Applications Pipeline"
            onClick={() => handleSelectTab('applications')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'applications'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left sm:hidden lg:inline truncate">Applications Pipeline</span>
            {metrics?.pendingApplications !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono sm:hidden lg:inline">
                {metrics.pendingApplications}
              </span>
            )}
          </button>

          <button
            id="zonal-tab-reports"
            title="Zone Analytics & SLA"
            onClick={() => handleSelectTab('reports')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Zone Analytics &amp; SLA</span>
          </button>
        </nav>

        {/* User Badge & Sign Out */}
        <div className="p-2.5 sm:p-2 lg:p-3 border-t border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between mb-2 sm:hidden lg:flex">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-200 truncate">{currentUser.name || 'Zonal HR Manager'}</span>
              <span className="text-[10px] text-slate-400 truncate">{currentUser.email}</span>
            </div>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 shrink-0">
              Zonal HR
            </span>
          </div>
          <button
            id="zonal-signout-btn"
            title="Sign Out"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 sm:px-0 lg:px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
            onNavigateToHeadcount={() => setActiveTab('headcount')}
            onOpenAddStaff={() => {
              setActiveTab('staff');
              setShowAddStaffModal(true);
            }}
          />
        )}

        {/* TAB 1B: HEADCOUNT MANAGEMENT */}
        {activeTab === 'headcount' && <HeadcountManagementView />}

        {/* TAB 1C: WORKFLOW TRACKER */}
        {activeTab === 'workflow_tracker' && (
          <WorkflowTrackerView role="zonal_hr" zoneName={zoneDisplayName} />
        )}

        {/* TAB 1D: DATA IMPORT */}
        {activeTab === 'data_import' && <DataImportView />}

        {/* TAB 1E: ENROLLED EMPLOYEES & EXIT LIFECYCLE */}
        {activeTab === 'enrolled_roster' && (
          <EnrolledRosterView
            enrolledEmployees={[]}
            loading={loading}
            zoneName={zoneDisplayName}
            onRefresh={loadDashboardData}
            onOpenPdfDossier={() => {}}
            role="zonal_hr"
            actorName={currentUser.name || 'Zonal HR'}
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
      <AddStaffModal
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        zoneDisplayName={zoneDisplayName}
        zoneBranches={zoneBranches}
        departments={zonalDepartments}
        designations={zonalDesignations}
        newStaffRole={newStaffRole}
        setNewStaffRole={setNewStaffRole}
        newStaffBranchId={newStaffBranchId}
        setNewStaffBranchId={setNewStaffBranchId}
        newStaffBranchIds={newStaffBranchIds}
        setNewStaffBranchIds={setNewStaffBranchIds}
        newStaffName={newStaffName}
        setNewStaffName={setNewStaffName}
        newStaffPersonalEmail={newStaffPersonalEmail}
        setNewStaffPersonalEmail={setNewStaffPersonalEmail}
        newStaffEmail={newStaffEmail}
        setNewStaffEmail={setNewStaffEmail}
        newStaffPhone={newStaffPhone}
        setNewStaffPhone={setNewStaffPhone}
        newStaffEmployeeId={newStaffEmployeeId}
        setNewStaffEmployeeId={setNewStaffEmployeeId}
        newStaffDepartmentId={newStaffDepartmentId}
        setNewStaffDepartmentId={setNewStaffDepartmentId}
        newStaffDesignationId={newStaffDesignationId}
        setNewStaffDesignationId={setNewStaffDesignationId}
        creatingStaff={creatingStaff}
        onSubmit={handleCreateStaff}
      />

      {/* MODAL 1b: EDIT ZONE STAFF */}
      <EditStaffModal
        isOpen={editStaffModal.isOpen}
        onClose={() => setEditStaffModal((prev) => ({ ...prev, isOpen: false }))}
        staffData={editStaffModal}
        setStaffData={setEditStaffModal}
        zoneBranches={zoneBranches}
        onSubmit={handleSaveEditStaff}
      />

      {/* MODAL 2: ONE-TIME PASSWORD REVEAL */}
      {createdPasswordModal && (
        <PasswordRevealModal
          isOpen={createdPasswordModal.isOpen}
          onClose={() => setCreatedPasswordModal(null)}
          staffName={createdPasswordModal.staffName}
          email={createdPasswordModal.email}
          password={createdPasswordModal.password}
        />
      )}

      {/* MODAL 3: REASSIGNMENT MODAL */}
      <ReassignModal
        isOpen={reassignModal.isOpen}
        onClose={() => setReassignModal((prev) => ({ ...prev, isOpen: false }))}
        zoneDisplayName={zoneDisplayName}
        application={reassignModal.application}
        targetHrId={reassignModal.targetHrId}
        setTargetHrId={(targetHrId) => setReassignModal((prev) => ({ ...prev, targetHrId }))}
        reason={reassignModal.reason}
        setReason={(reason) => setReassignModal((prev) => ({ ...prev, reason }))}
        centralHrList={centralHrList}
        submitting={reassignModal.submitting}
        onSubmit={handleExecuteReassignment}
      />

      {/* MODAL 4: OVERRIDE DECISION HOOK */}
      <OverrideDecisionModal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal((prev) => ({ ...prev, isOpen: false }))}
        application={overrideModal.application}
        decision={overrideModal.decision}
        setDecision={(decision) => setOverrideModal((prev) => ({ ...prev, decision }))}
        reason={overrideModal.reason}
        setReason={(reason) => setOverrideModal((prev) => ({ ...prev, reason }))}
        submitting={overrideModal.submitting}
        onSubmit={handleExecuteOverrideDecision}
      />

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
