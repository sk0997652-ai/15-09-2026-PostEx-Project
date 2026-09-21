import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Briefcase,
  KeyRound,
  ShieldCheck,
  Search,
  History,
  Settings,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  FileSpreadsheet,
  Sliders,
  Archive,
} from 'lucide-react';
import {
  superAdminApi,
  DashboardMetrics,
  OrgStructure,
  StaffUserItem,
  CandidateBrowserRecord,
  AuditLogItem,
  OrgSettings,
} from '../lib/superAdminApi';
import { FormBuilderModule } from './admin/FormBuilderModule';
import { useBranding } from '../lib/branding';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';

// Friendly human-readable labels for all 18 system permissions
const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  'applications.view': { label: 'View Candidates', description: 'View candidate applications in operational pipelines' },
  'applications.verify': { label: 'Review Applications', description: 'Review and verify candidate documents and credentials' },
  'applications.decide': { label: 'Approve Applications', description: 'Approve or reject candidate applications' },
  'candidates.view': { label: 'View Candidates', description: 'Inspect candidate profiles and basic registration details' },
  'candidates.create': { label: 'Create New Candidates', description: 'Create candidate invitations and initiate onboarding' },
  'candidates.edit': { label: 'Edit Candidate Details', description: 'Edit candidate profile and contact information' },
  'staff.manage': { label: 'Manage Users', description: 'Provision staff accounts and manage user statuses' },
  'audit.view': { label: 'View Audit Logs', description: 'Access immutable security audit logs and event history' },
  'applications.reassign': { label: 'Reassign Applications', description: 'Reassign applications between staff members' },
  'documents.view': { label: 'View Documents', description: 'View uploaded candidate identity and verification files' },
  'documents.download': { label: 'Download Documents', description: 'Download candidate dossiers and verification assets' },
  'employees.view': { label: 'View Enrolled Employees', description: 'View roster of enrolled employees and IDs' },
  'organization.manage': { label: 'Manage Organization Structure', description: 'Create and edit zones, branches, departments, and designations' },
  'form_builder.manage': { label: 'Edit Application Forms', description: 'Customize candidate wizard form fields and steps' },
  'settings.manage': { label: 'Manage System Settings', description: 'Configure organization settings and retention policy' },
  'permissions.manage': { label: 'Manage User Permissions', description: 'Manage permissions and role overrides for other users' },
  'reports.view': { label: 'View Reports', description: 'Access zone and branch operational analytics' },
  'reports.export': { label: 'Export Reports', description: 'Export operational data reports to CSV/Excel' },
};

interface SuperAdminDashboardProps {
  currentUser: { id: string; email: string; name?: string; role?: string };
  onSignOut: () => void;
}

type AdminTab =
  | 'overview'
  | 'org'
  | 'staff'
  | 'overrides'
  | 'records'
  | 'audit'
  | 'form_builder'
  | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUser,
  onSignOut,
}) => {
  const { reloadBranding } = useBranding();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [staff, setStaff] = useState<StaffUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // One-time password reveal modal state
  const [oneTimePasswordModal, setOneTimePasswordModal] = useState<{
    show: boolean;
    name: string;
    email: string;
    password: string;
  } | null>(null);

  // New staff user modal state
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    role_id: '',
    zone_id: '',
    branch_id: '',
  });

  // Edit staff modal state
  const [editingStaff, setEditingStaff] = useState<StaffUserItem | null>(null);

  // Staff search, filter, and pagination states
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');
  const [staffZoneFilter, setStaffZoneFilter] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const staffLimit = 10;

  // Deduplicate and filter staff records
  const uniqueStaff = useMemo(() => {
    const seen = new Set<string>();
    return staff.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return uniqueStaff.filter((u) => {
      const q = staffSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      const matchRole = !staffRoleFilter || u.roles?.name === staffRoleFilter;
      const matchStatus =
        !staffStatusFilter ||
        (staffStatusFilter === 'active' && u.is_active) ||
        (staffStatusFilter === 'deactivated' && !u.is_active);
      const matchZone = !staffZoneFilter || u.zone_id === staffZoneFilter;
      return matchSearch && matchRole && matchStatus && matchZone;
    });
  }, [uniqueStaff, staffSearch, staffRoleFilter, staffStatusFilter, staffZoneFilter]);

  const staffTotalPages = Math.max(1, Math.ceil(filteredStaff.length / staffLimit));
  const paginatedStaff = useMemo(() => {
    const start = (staffPage - 1) * staffLimit;
    return filteredStaff.slice(start, start + staffLimit);
  }, [filteredStaff, staffPage, staffLimit]);

  // Org CRUD states
  const [orgSubTab, setOrgSubTab] = useState<'zones' | 'branches' | 'departments' | 'designations'>('zones');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgModalMode, setOrgModalMode] = useState<'create' | 'edit'>('create');
  const [orgEditId, setOrgEditId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<any>({});

  // Unified Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    open: boolean;
    type: 'org' | 'override';
    targetId: string;
    targetName: string;
    subTab?: 'zones' | 'branches' | 'departments' | 'designations';
    isDeleting: boolean;
  }>({
    open: false,
    type: 'org',
    targetId: '',
    targetName: '',
    isDeleting: false,
  });

  // User Permissions states
  const [permissionStaffSearch, setPermissionStaffSearch] = useState('');
  const [selectedStaffForOverride, setSelectedStaffForOverride] = useState<StaffUserItem | null>(null);
  const [staffOverrides, setStaffOverrides] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [roleDefaultPermKeys, setRoleDefaultPermKeys] = useState<string[]>([]);
  const [userPermissionsChecklist, setUserPermissionsChecklist] = useState<Record<string, boolean>>({});
  const [permissionReason, setPermissionReason] = useState('');
  const [overrideForm, setOverrideForm] = useState({
    permission_id: '',
    granted: true,
    reason: '',
  });

  // Company-wide Record Browser state
  const [records, setRecords] = useState<CandidateBrowserRecord[]>([]);
  const [recordPagination, setRecordPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [recordSearch, setRecordSearch] = useState('');
  const [recordZoneFilter, setRecordZoneFilter] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState('');

  // Deduplicate records by candidate id
  const uniqueRecords = useMemo(() => {
    const seen = new Set<string>();
    return records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [records]);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Settings state
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionResult, setRetentionResult] = useState<{
    countArchived: number;
    thresholdDays: number;
    cutoffDate: string;
    message: string;
  } | null>(null);

  // Auto-clear notifications after 6s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Initial load
  useEffect(() => {
    loadOverviewData();
  }, []);

  // Tab-specific loads
  useEffect(() => {
    if (activeTab === 'overview') loadOverviewData();
    if (activeTab === 'org') loadOrgData();
    if (activeTab === 'staff') loadStaffData();
    if (activeTab === 'records') loadRecordsData(1, recordPagination.limit);
    if (activeTab === 'audit') loadAuditLogsData(1, auditPagination.limit);
    if (activeTab === 'settings') loadSettingsData();
  }, [activeTab]);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [m, o, s] = await Promise.all([
        superAdminApi.getMetrics(),
        superAdminApi.getOrgStructure(),
        superAdminApi.getStaff(),
      ]);
      setMetrics(m);
      setOrg(o);
      setStaff(s);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadOrgData = async () => {
    setLoading(true);
    try {
      const o = await superAdminApi.getOrgStructure();
      setOrg(o);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadStaffData = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        superAdminApi.getStaff(),
        superAdminApi.getOrgStructure(),
      ]);
      setStaff(s);
      setOrg(o);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadRecordsData = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getRecords({
        page,
        limit,
        search: recordSearch,
        zone_id: recordZoneFilter,
        status: recordStatusFilter,
      });
      setRecords(res.records);
      setRecordPagination(res.pagination);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogsData = async (page = 1, limit = 25) => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAuditLogs({
        page,
        limit,
        action: auditActionFilter,
      });
      setAuditLogs(res.logs);
      setAuditPagination(res.pagination);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const s = await superAdminApi.getSettings();
      setSettings(s);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Staff Handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.email || !newStaffForm.name || !newStaffForm.role_id) {
      setNotification({ type: 'error', text: 'Name, Email, and Role are mandatory.' });
      return;
    }
    setLoading(true);
    try {
      const res = await superAdminApi.createStaff({
        email: newStaffForm.email,
        name: newStaffForm.name,
        role_id: newStaffForm.role_id,
        zone_id: newStaffForm.zone_id || null,
        branch_id: newStaffForm.branch_id || null,
      });

      setShowCreateStaffModal(false);
      setNewStaffForm({ name: '', email: '', role_id: '', zone_id: '', branch_id: '' });
      await loadStaffData();

      // [HARD RULE]: Show one-time password reveal
      setOneTimePasswordModal({
        show: true,
        name: res.staff.name,
        email: res.staff.email,
        password: res.one_time_temporary_password,
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setLoading(true);
    try {
      await superAdminApi.updateStaff(editingStaff.id, {
        name: editingStaff.name,
        role_id: editingStaff.role_id,
        zone_id: editingStaff.zone_id,
        branch_id: editingStaff.branch_id,
      });
      setEditingStaff(null);
      setNotification({ type: 'success', text: `Staff profile for ${editingStaff.name} updated.` });
      await loadStaffData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaffStatus = async (item: StaffUserItem) => {
    setLoading(true);
    try {
      await superAdminApi.toggleStaffStatus(item.id, !item.is_active);
      setNotification({
        type: 'success',
        text: `Staff user ${item.name} has been ${!item.is_active ? 'activated' : 'deactivated'}.`,
      });
      await loadStaffData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRegeneratePassword = async (item: StaffUserItem) => {
    if (!confirm(`Are you sure you want to regenerate credentials for ${item.name}?`)) return;
    setLoading(true);
    try {
      const res = await superAdminApi.regenerateStaffPassword(item.id);
      setOneTimePasswordModal({
        show: true,
        name: item.name,
        email: item.email,
        password: res.temporary_password,
      });
      setNotification({ type: 'success', text: `New temporary password generated for ${item.name}.` });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Org CRUD Handlers
  const handleOpenOrgCreate = () => {
    setOrgModalMode('create');
    setOrgEditId(null);
    if (orgSubTab === 'zones') setOrgForm({ name: '' });
    if (orgSubTab === 'branches') setOrgForm({ name: '', zone_id: org?.zones[0]?.id || '', address: '' });
    if (orgSubTab === 'departments') setOrgForm({ name: '' });
    if (orgSubTab === 'designations') setOrgForm({ name: '', department_id: org?.departments[0]?.id || '' });
    setShowOrgModal(true);
  };

  const handleOpenOrgEdit = (item: any) => {
    setOrgModalMode('edit');
    setOrgEditId(item.id);
    setOrgForm({ ...item });
    setShowOrgModal(true);
  };

  const handleSaveOrgEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (orgModalMode === 'create') {
        await superAdminApi.createOrgEntity(orgSubTab, orgForm);
        setNotification({ type: 'success', text: `Created new ${orgSubTab.slice(0, -1)}.` });
      } else if (orgEditId) {
        await superAdminApi.updateOrgEntity(orgSubTab, orgEditId, orgForm);
        setNotification({ type: 'success', text: `Updated ${orgSubTab.slice(0, -1)}.` });
      }
      setShowOrgModal(false);
      await loadOrgData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrgEntity = (id: string, name: string) => {
    setDeleteModalState({
      open: true,
      type: 'org',
      targetId: id,
      targetName: name,
      subTab: orgSubTab,
      isDeleting: false,
    });
  };

  const handleConfirmDeleteOrgEntity = async (reason?: string) => {
    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));
    setLoading(true);
    try {
      await superAdminApi.deleteOrgEntity(deleteModalState.subTab || orgSubTab, deleteModalState.targetId, reason);
      setNotification({ type: 'success', text: `Deleted "${deleteModalState.targetName}".` });
      setDeleteModalState({ open: false, type: 'org', targetId: '', targetName: '', isDeleting: false });
      await loadOrgData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    } finally {
      setLoading(false);
    }
  };

  // User Permissions Handlers
  const handleSelectStaffForOverride = async (user: StaffUserItem) => {
    setSelectedStaffForOverride(user);
    setLoading(true);
    try {
      const res = await superAdminApi.getPermissionOverrides(user.id);
      setStaffOverrides(res.overrides);
      setAvailablePermissions(res.allPermissions);
      const defaultKeys = res.roleDefaultPermissionKeys || [];
      setRoleDefaultPermKeys(defaultKeys);

      // Map existing overrides: if override exists, override.granted determines state; else defaultKeys
      const overrideMap = new Map<string, boolean>();
      res.overrides.forEach((ov) => {
        if (ov.permissions?.key) {
          overrideMap.set(ov.permissions.key, ov.granted);
        }
      });

      const initialChecklist: Record<string, boolean> = {};
      res.allPermissions.forEach((p) => {
        if (overrideMap.has(p.key)) {
          initialChecklist[p.key] = overrideMap.get(p.key)!;
        } else {
          initialChecklist[p.key] = defaultKeys.includes(p.key);
        }
      });

      setUserPermissionsChecklist(initialChecklist);
      setPermissionReason('');
      setOverrideForm({
        permission_id: res.allPermissions[0]?.id || '',
        granted: true,
        reason: '',
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (key: string) => {
    setUserPermissionsChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForOverride) return;

    // [HARD RULE]: MANDATORY reason field validation
    if (!permissionReason.trim()) {
      setNotification({
        type: 'error',
        text: 'Reason for permission change is required. Please provide a valid justification before saving.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await superAdminApi.saveUserPermissions({
        staff_profile_id: selectedStaffForOverride.id,
        permissionsState: userPermissionsChecklist,
        reason: permissionReason.trim(),
      });

      setNotification({
        type: 'success',
        text: res.message || 'User permissions updated successfully and logged to audit trail.',
      });

      // Reload fresh overrides
      const fresh = await superAdminApi.getPermissionOverrides(selectedStaffForOverride.id);
      setStaffOverrides(fresh.overrides);
      setPermissionReason('');
      loadAuditLogsData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForOverride) return;

    // [HARD RULE]: MANDATORY reason field
    if (!overrideForm.reason.trim()) {
      setNotification({ type: 'error', text: 'MANDATORY: You must supply a justification/reason for this override.' });
      return;
    }

    setLoading(true);
    try {
      await superAdminApi.setPermissionOverride({
        staff_profile_id: selectedStaffForOverride.id,
        permission_id: overrideForm.permission_id,
        granted: overrideForm.granted,
        reason: overrideForm.reason.trim(),
      });
      setNotification({ type: 'success', text: 'Permission override saved and logged to audit trail.' });
      const res = await superAdminApi.getPermissionOverrides(selectedStaffForOverride.id);
      setStaffOverrides(res.overrides);
      setOverrideForm((prev) => ({ ...prev, reason: '' }));
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOverride = (overrideId: string) => {
    setDeleteModalState({
      open: true,
      type: 'override',
      targetId: overrideId,
      targetName: 'Custom Permission Override',
      isDeleting: false,
    });
  };

  const handleConfirmDeleteOverride = async () => {
    setDeleteModalState((prev) => ({ ...prev, isDeleting: true }));
    setLoading(true);
    try {
      await superAdminApi.deletePermissionOverride(deleteModalState.targetId);
      if (selectedStaffForOverride) {
        const res = await superAdminApi.getPermissionOverrides(selectedStaffForOverride.id);
        setStaffOverrides(res.overrides);
      }
      setNotification({ type: 'success', text: 'Override removed.' });
      setDeleteModalState({ open: false, type: 'override', targetId: '', targetName: '', isDeleting: false });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
      setDeleteModalState((prev) => ({ ...prev, isDeleting: false }));
    } finally {
      setLoading(false);
    }
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const updated = await superAdminApi.updateSettings(settings);
      setSettings(updated);
      await reloadBranding();
      setNotification({ type: 'success', text: 'Organization settings and retention policy updated.' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleRunRetentionCleanup = async () => {
    setRetentionRunning(true);
    try {
      const res = await superAdminApi.runDataRetentionCleanup();
      setRetentionResult({
        countArchived: res.countArchived,
        thresholdDays: res.thresholdDays,
        cutoffDate: res.cutoffDate,
        message: res.message,
      });
      setNotification({
        type: 'success',
        text: `Retention cleanup executed: ${res.countArchived} application(s) older than ${res.thresholdDays} days soft-archived.`,
      });
      loadRecordsData();
      loadAuditLogsData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err.message || 'Failed to run data retention cleanup',
      });
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-sm">
            SA
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Super Admin Portal</span>
            <span className="text-[10px] text-slate-400 block truncate">{currentUser.email}</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 text-xs">
          <button
            id="nav-btn-overview"
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Dashboard Overview</span>
          </button>

          <button
            id="nav-btn-org"
            onClick={() => setActiveTab('org')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'org' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Organization Structure</span>
          </button>

          <button
            id="nav-btn-staff"
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'staff' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff &amp; User Management</span>
          </button>

          <button
            id="nav-btn-overrides"
            onClick={() => setActiveTab('overrides')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'overrides' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>User Permissions</span>
          </button>

          <button
            id="nav-btn-records"
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'records' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Company Record Browser</span>
          </button>

          <button
            id="nav-btn-audit"
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail Logs</span>
          </button>

          <button
            id="nav-btn-form-builder"
            onClick={() => setActiveTab('form_builder')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'form_builder' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Form Builder</span>
          </button>

          <button
            id="nav-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Organization Settings</span>
          </button>
        </nav>

        {/* Sign Out Button */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Global Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-lg text-xs font-medium flex items-center gap-3 border ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        {/* Persistent Role & Section Banner */}
        <div className="mb-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-1">
              Super Admin Workstation
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'overview' && 'Super Admin — Executive HR Dashboard'}
              {activeTab === 'org' && 'Super Admin — Organization Structure'}
              {activeTab === 'staff' && 'Super Admin — Staff Account Management'}
              {activeTab === 'overrides' && 'Super Admin — User Permissions'}
              {activeTab === 'records' && 'Super Admin — Company Record Browser'}
              {activeTab === 'audit' && 'Super Admin — Audit Trail Logs'}
              {activeTab === 'settings' && 'Super Admin — Organization Settings'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'overview' && 'Live operational counts, headcounts, and organizational metrics from PostEx onboarding backend.'}
              {activeTab === 'org' && 'Manage and configure PostEx operating Zones, Branches, Departments, and Designations.'}
              {activeTab === 'staff' && 'Provision new staff accounts with auto-generated passwords, assign zones/branches, and manage status.'}
              {activeTab === 'overrides' && 'Manage granular system permissions for individual staff members with mandatory reason and audit logging.'}
              {activeTab === 'records' && 'Search and inspect candidates across all zones with pagination and masked CNIC privacy protection.'}
              {activeTab === 'audit' && 'Immutable audit trail of all security actions, credential regenerations, and organizational updates.'}
              {activeTab === 'settings' && 'Configure company-wide onboarding parameters, support contact, and data retention rules.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium shadow-2xs">
              Logged in as: <strong className="text-slate-900">{currentUser.name}</strong>
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Key Operational Metrics</h2>
              <button
                onClick={loadOverviewData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Counts</span>
              </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium block">Total Candidates</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {metrics?.totalCandidates ?? '...'}
                </span>
                <span className="text-[11px] text-emerald-600 mt-2 block font-medium">&bull; Company-wide registry</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium block">Pending Applications</span>
                <span className="text-2xl font-black text-amber-600 mt-1 block">
                  {metrics?.pendingApplications ?? '...'}
                </span>
                <span className="text-[11px] text-slate-400 mt-2 block font-medium">Awaiting verification or decision</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium block">Approved Applications</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">
                  {metrics?.approvedApplications ?? '...'}
                </span>
                <span className="text-[11px] text-slate-400 mt-2 block font-medium">Ready for employee dossiers</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium block">Total Employees</span>
                <span className="text-2xl font-black text-blue-600 mt-1 block">
                  {metrics?.totalEmployees ?? '...'}
                </span>
                <span className="text-[11px] text-slate-400 mt-2 block font-medium">Onboarded staff headcount</span>
              </div>
            </div>

            {/* Secondary stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">Active Staff Accounts</span>
                  <span className="text-lg font-bold text-slate-900 block mt-0.5">{metrics?.totalStaff ?? 0}</span>
                </div>
                <Users className="w-7 h-7 text-slate-400" />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">Geographic Zones</span>
                  <span className="text-lg font-bold text-slate-900 block mt-0.5">{metrics?.totalZones ?? 0}</span>
                </div>
                <MapPin className="w-7 h-7 text-slate-400" />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">Branch Hubs</span>
                  <span className="text-lg font-bold text-slate-900 block mt-0.5">{metrics?.totalBranches ?? 0}</span>
                </div>
                <Building2 className="w-7 h-7 text-slate-400" />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: ORGANIZATION STRUCTURE CRUD */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'org' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Entity Hierarchy Manager</h2>
                <p className="text-xs text-slate-500">Add, edit, or remove organizational units across the company.</p>
              </div>

              <button
                id="add-org-entity-btn"
                onClick={handleOpenOrgCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add {orgSubTab.slice(0, -1)}</span>
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
              {(['zones', 'branches', 'departments', 'designations'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOrgSubTab(tab)}
                  className={`pb-3 capitalize transition-colors cursor-pointer ${
                    orgSubTab === tab
                      ? 'text-indigo-700 border-b-2 border-indigo-600 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab} ({org ? (org as any)[tab]?.length : 0})
                </button>
              ))}
            </div>

            {/* Entity Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Name</th>
                    {orgSubTab === 'branches' && <th className="p-3 font-bold">Zone</th>}
                    {orgSubTab === 'branches' && <th className="p-3 font-bold">Address</th>}
                    {orgSubTab === 'designations' && <th className="p-3 font-bold">Department</th>}
                    <th className="p-3 font-bold">Created At</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {org && (org as any)[orgSubTab]?.length > 0 ? (
                    (org as any)[orgSubTab].map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-900">{item.name}</td>
                        {orgSubTab === 'branches' && (
                          <td className="p-3 text-slate-600">{item.zones?.name || item.zone_id}</td>
                        )}
                        {orgSubTab === 'branches' && (
                          <td className="p-3 text-slate-500">{item.address || '—'}</td>
                        )}
                        {orgSubTab === 'designations' && (
                          <td className="p-3 text-slate-600">{item.departments?.name || item.department_id}</td>
                        )}
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenOrgEdit(item)}
                              className="p-1 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrgEntity(item.id, item.name)}
                              className="p-1 rounded-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No {orgSubTab} configured yet. Click "Add {orgSubTab.slice(0, -1)}" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: USER & STAFF MANAGEMENT */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Staff User Directory</h2>
                <p className="text-xs text-slate-500">
                  Provision new staff accounts with auto-generated passwords, assign zones/branches, and manage status.
                </p>
              </div>

              <button
                id="create-staff-user-btn"
                onClick={() => setShowCreateStaffModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Staff User</span>
              </button>
            </div>

            {/* Staff Search & Filter Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[220px]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search staff by name or email..."
                    value={staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value);
                      setStaffPage(1);
                    }}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <select
                  value={staffRoleFilter}
                  onChange={(e) => {
                    setStaffRoleFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="zonal_hr_manager">Zonal HR Manager</option>
                  <option value="central_hr">Central HR</option>
                  <option value="branch_manager">Branch Manager</option>
                </select>
              </div>

              <div>
                <select
                  value={staffStatusFilter}
                  onChange={(e) => {
                    setStaffStatusFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="deactivated">Deactivated Only</option>
                </select>
              </div>

              <div>
                <select
                  value={staffZoneFilter}
                  onChange={(e) => {
                    setStaffZoneFilter(e.target.value);
                    setStaffPage(1);
                  }}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Zones</option>
                  {org?.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              {(staffSearch || staffRoleFilter || staffStatusFilter || staffZoneFilter) && (
                <button
                  onClick={() => {
                    setStaffSearch('');
                    setStaffRoleFilter('');
                    setStaffStatusFilter('');
                    setStaffZoneFilter('');
                    setStaffPage(1);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Staff List Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Staff Member</th>
                    <th className="p-3 font-bold">System Role</th>
                    <th className="p-3 font-bold">Zone / Branch Assignment</th>
                    <th className="p-3 font-bold">Account Status</th>
                    <th className="p-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStaff.length > 0 ? (
                    paginatedStaff.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{u.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold">
                            {u.roles?.name || 'staff'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          {u.zones?.name ? (
                            <div>
                              <span className="font-medium text-slate-800 block">{u.zones.name}</span>
                              {u.branches?.name && (
                                <span className="text-[11px] text-slate-400 block">&bull; {u.branches.name}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Company-wide (All Zones)</span>
                          )}
                        </td>
                        <td className="p-3">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Deactivated
                            </span>
                          )}
                          {u.must_change_password && (
                            <span className="block text-[10px] text-amber-600 font-medium mt-0.5">
                              Must Change Pwd
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleRegeneratePassword(u)}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Regenerate temporary password"
                            >
                              <RefreshCw className="w-3 h-3 inline mr-1" />
                              Regen Pwd
                            </button>
                            <button
                              onClick={() => setEditingStaff(u)}
                              className="p-1 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              title="Edit Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStaffStatus(u)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                u.is_active
                                  ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No staff members found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Staff Table Pagination Footer */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing {filteredStaff.length === 0 ? 0 : (staffPage - 1) * staffLimit + 1} to{' '}
                  {Math.min(staffPage * staffLimit, filteredStaff.length)} of {filteredStaff.length} staff members &bull; Page {staffPage} of {staffTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={staffPage <= 1}
                    onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={staffPage >= staffTotalPages}
                    onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: USER PERMISSIONS */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'overrides' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">User Permissions Management</h2>
              <p className="text-xs text-slate-500">
                View and configure granular system permissions for individual staff members. [HARD RULE: Mandatory Reason Logged to Audit Trail].
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Staff Member Search & Selection Column */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900">Find Staff Member</h3>
                  <span className="text-[11px] text-slate-400">
                    {
                      staff.filter(
                        (s) =>
                          !permissionStaffSearch ||
                          s.name.toLowerCase().includes(permissionStaffSearch.toLowerCase()) ||
                          s.email.toLowerCase().includes(permissionStaffSearch.toLowerCase())
                      ).length
                    }{' '}
                    found
                  </span>
                </div>

                {/* Search box: by name or email */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="staff-permission-search-input"
                    type="text"
                    placeholder="Search by staff name or email..."
                    value={permissionStaffSearch}
                    onChange={(e) => setPermissionStaffSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
                  {staff
                    .filter(
                      (s) =>
                        !permissionStaffSearch ||
                        s.name.toLowerCase().includes(permissionStaffSearch.toLowerCase()) ||
                        s.email.toLowerCase().includes(permissionStaffSearch.toLowerCase())
                    )
                    .map((s) => (
                      <button
                        key={s.id}
                        id={`staff-select-btn-${s.id}`}
                        onClick={() => handleSelectStaffForOverride(s)}
                        className={`w-full p-2.5 text-left rounded-lg transition-colors flex items-center justify-between cursor-pointer my-0.5 ${
                          selectedStaffForOverride?.id === s.id
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs block font-medium truncate">{s.name}</span>
                          <span className="text-[11px] text-slate-500 block truncate">{s.email}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                              {s.roles?.name || 'Staff'}
                            </span>
                            {s.is_active ? (
                              <span className="text-[10px] text-emerald-600 font-semibold">• Active</span>
                            ) : (
                              <span className="text-[10px] text-rose-600 font-semibold">• Suspended</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}

                  {staff.filter(
                    (s) =>
                      !permissionStaffSearch ||
                      s.name.toLowerCase().includes(permissionStaffSearch.toLowerCase()) ||
                      s.email.toLowerCase().includes(permissionStaffSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No staff members match "{permissionStaffSearch}".
                    </div>
                  )}
                </div>
              </div>

              {/* User Profile & Permissions Checklist Column */}
              <div className="lg:col-span-2 space-y-6">
                {selectedStaffForOverride ? (
                  <>
                    {/* Selected User Profile Card */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{selectedStaffForOverride.name}</h3>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                selectedStaffForOverride.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {selectedStaffForOverride.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{selectedStaffForOverride.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                            Role: {selectedStaffForOverride.roles?.name || 'Staff'}
                          </span>
                        </div>
                      </div>

                      {/* Profile Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                        <div>
                          <span className="text-slate-400 text-[11px] block">Role</span>
                          <span className="font-semibold text-slate-800">{selectedStaffForOverride.roles?.name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Zone</span>
                          <span className="font-semibold text-slate-800">{selectedStaffForOverride.zones?.name || 'All Zones (HQ)'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Branch</span>
                          <span className="font-semibold text-slate-800">{selectedStaffForOverride.branches?.name || 'All Branches'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Active Overrides</span>
                          <span className="font-semibold text-indigo-600">{staffOverrides.length} customized</span>
                        </div>
                      </div>
                    </div>

                    {/* Permissions Checklist Form */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">System Permissions Checklist</h3>
                          <p className="text-[11px] text-slate-500">
                            Check to grant, uncheck to revoke. Overrides from role default are flagged automatically.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="flex items-center gap-1 text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Granted
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span> Revoked
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handleSaveUserPermissions} className="space-y-5">
                        {/* 18 Permissions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                          {availablePermissions.map((perm) => {
                            const isChecked = Boolean(userPermissionsChecklist[perm.key]);
                            const isRoleDefault = roleDefaultPermKeys.includes(perm.key);
                            const isOverride = isChecked !== isRoleDefault;
                            const meta = PERMISSION_LABELS[perm.key] || {
                              label: perm.key,
                              description: perm.description || '',
                            };

                            return (
                              <label
                                key={perm.id}
                                htmlFor={`perm-checkbox-${perm.key}`}
                                className={`p-3 rounded-lg border text-xs flex items-start gap-3 cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-white border-indigo-200 shadow-2xs ring-1 ring-indigo-50'
                                    : 'bg-white/60 border-slate-200 opacity-85 hover:opacity-100'
                                }`}
                              >
                                <input
                                  id={`perm-checkbox-${perm.key}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.key)}
                                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-slate-900 block truncate">{meta.label}</span>
                                    {isOverride && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                                          isChecked
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {isChecked ? 'Override Grant' : 'Override Revoke'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                                    {meta.description}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                                    Key: {perm.key} {isRoleDefault ? '• (Role Default)' : ''}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Mandatory Reason Input */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <label className="text-xs font-bold text-slate-800 block mb-1">
                            Reason for permission change <span className="text-rose-600">* [MANDATORY]</span>
                          </label>
                          <p className="text-[11px] text-slate-500 mb-2">
                            Every permission update creates an immutable entry in the system audit trail. Please provide a clear operational justification.
                          </p>
                          <input
                            id="user-permission-reason-input"
                            type="text"
                            required
                            placeholder="e.g., Assigned special verification authority for Lahore South expansion"
                            value={permissionReason}
                            onChange={(e) => setPermissionReason(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Submit Action */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => handleSelectStaffForOverride(selectedStaffForOverride)}
                            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Reset to Current
                          </button>
                          <button
                            id="save-user-permissions-btn"
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Save Permissions &amp; Audit</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Active Individual Overrides List */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-900">
                          Specific Overrides for {selectedStaffForOverride.name} ({staffOverrides.length})
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          These explicit overrides deviate from role defaults
                        </span>
                      </div>

                      {staffOverrides.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                          {staffOverrides.map((ov) => (
                            <div key={ov.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900">{ov.permissions?.key}</span>
                                  {ov.granted ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Explicit Grant
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                      Explicit Revoke
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-600 text-[11px] mt-0.5">
                                  <span className="font-semibold text-slate-700">Reason:</span> {ov.reason}
                                </p>
                              </div>

                              <button
                                onClick={() => handleDeleteOverride(ov.id)}
                                className="p-1 rounded-sm text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Remove Override and Revert to Role Default"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No specific overrides applied. Standard role permissions govern this user.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    Select a staff member from the search list on the left to view their profile and manage their permissions.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 5: RECORD BROWSER */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Candidate Directory Browser</h2>
                <p className="text-xs text-slate-500">
                  Search and inspect candidates across all zones with pagination and masked CNIC privacy protection.
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by candidate name, joining ID, CNIC..."
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadRecordsData(1, recordPagination.limit)}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <select
                  value={recordZoneFilter}
                  onChange={(e) => {
                    setRecordZoneFilter(e.target.value);
                  }}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">All Zones</option>
                  {org?.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={recordPagination.limit}
                  onChange={(e) => {
                    const newLim = parseInt(e.target.value, 10);
                    setRecordPagination((p) => ({ ...p, limit: newLim }));
                    loadRecordsData(1, newLim);
                  }}
                  className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              <button
                onClick={() => loadRecordsData(1, recordPagination.limit)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>

            {/* Candidates Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Candidate</th>
                    <th className="p-3 font-bold">Joining ID</th>
                    <th className="p-3 font-bold">Masked CNIC</th>
                    <th className="p-3 font-bold">Zone / Branch</th>
                    <th className="p-3 font-bold">Application Status</th>
                    <th className="p-3 font-bold">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uniqueRecords.length > 0 ? (
                    uniqueRecords.map((r) => {
                      const app = r.applications?.[0];
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{r.full_name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{r.mobile}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">{r.joining_id}</td>
                          <td className="p-3 font-mono text-slate-700 bg-slate-50/50 px-2 py-1 rounded-sm">
                            {r.masked_cnic}
                          </td>
                          <td className="p-3 text-slate-600">
                            <span className="font-medium text-slate-800 block">{r.zones?.name || '—'}</span>
                            <span className="text-[11px] text-slate-400 block">{r.branches?.name || '—'}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                              {app?.status || 'no_application'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {new Date(r.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No candidates found matching the query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination controls */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing Page {recordPagination.page} of {Math.max(1, recordPagination.totalPages)} ({recordPagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={recordPagination.page <= 1}
                    onClick={() => loadRecordsData(recordPagination.page - 1, recordPagination.limit)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={recordPagination.page >= recordPagination.totalPages}
                    onClick={() => loadRecordsData(recordPagination.page + 1, recordPagination.limit)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 6: AUDIT TRAIL VIEWER */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">System Activity Audit Trail</h2>
                <p className="text-xs text-slate-500">
                  Immutable audit trail of all security actions, credential regenerations, and organizational updates.
                  [HARD RULE: Strictly restricted to Super Admin].
                </p>
              </div>
              <button
                onClick={() => loadAuditLogsData(1, auditPagination.limit)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Audit Logs</span>
              </button>
            </div>

            {/* Audit Filter */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex gap-4 items-center">
              <input
                type="text"
                placeholder="Filter by action name (e.g., regenerate, create, override)..."
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAuditLogsData(1, auditPagination.limit)}
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 bg-white"
              />
              <button
                onClick={() => loadAuditLogsData(1, auditPagination.limit)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Filter Logs
              </button>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Timestamp</th>
                    <th className="p-3 font-bold">Action</th>
                    <th className="p-3 font-bold">Actor Type</th>
                    <th className="p-3 font-bold">Entity</th>
                    <th className="p-3 font-bold">Metadata Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{log.actor_type}</td>
                        <td className="p-3 text-slate-700">{log.entity_type}</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">
                          {JSON.stringify(log.metadata)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No audit logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Audit Pagination */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {auditPagination.page} of {Math.max(1, auditPagination.totalPages)} ({auditPagination.total} total events)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={auditPagination.page <= 1}
                    onClick={() => loadAuditLogsData(auditPagination.page - 1, auditPagination.limit)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={auditPagination.page >= auditPagination.totalPages}
                    onClick={() => loadAuditLogsData(auditPagination.page + 1, auditPagination.limit)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB: DYNAMIC FORM BUILDER (DUAL-TRACK DOSSIER MANAGEMENT) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'form_builder' && (
          <div className="max-w-5xl">
            <FormBuilderModule />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 7: ORGANIZATION SETTINGS & DATA RETENTION */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">System Preferences &amp; Retention</h2>
              <p className="text-xs text-slate-500">
                Configure organizational parameters and data retention rules.
              </p>
            </div>

            {settings && (
              <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Company Name</label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Support Email</label>
                  <input
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                {/* Data Retention Policy */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Data Retention Policy</span>
                      <span className="text-[11px] text-slate-500 block">
                        Specifies the number of days after an application is rejected before candidate dossier data is archived in compliance with privacy retention regulations.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Days After Rejection Before Hiding
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={settings.dataRetentionDaysAfterRejection}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          dataRetentionDaysAfterRejection: parseInt(e.target.value, 10) || 30,
                        })
                      }
                      className="w-32 text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoArchive"
                    checked={settings.autoArchiveEnabled}
                    onChange={(e) => setSettings({ ...settings, autoArchiveEnabled: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <label htmlFor="autoArchive" className="text-xs text-slate-700 font-medium">
                    Enable automated archival notifications
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Last updated: {new Date(settings.lastUpdated).toLocaleDateString()}
                  </span>
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {settingsSaving ? 'Saving...' : 'Save Organization Settings'}
                  </button>
                </div>
              </form>
            )}

            {/* Data Retention Enforcement Job Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">Automated Data Retention Policy Enforcement</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Enforces data retention compliance by soft-hiding rejected candidate applications older than the configured policy threshold ({settings?.dataRetentionDaysAfterRejection || 120} days). Records remain fully intact in compliance audit logs.
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-run-retention-cleanup"
                  onClick={handleRunRetentionCleanup}
                  disabled={retentionRunning}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retentionRunning ? 'animate-spin' : ''}`} />
                  {retentionRunning ? 'Executing Cleanup...' : 'Run Retention Cleanup Now'}
                </button>
              </div>

              {retentionResult && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Execution Result:
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Cutoff: {new Date(retentionResult.cutoffDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {retentionResult.message}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 font-mono">
                    <span>Archived: <strong className="text-indigo-600">{retentionResult.countArchived}</strong></span>
                    <span>Policy Threshold: <strong className="text-slate-700">{retentionResult.thresholdDays} days</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ONE-TIME TEMPORARY PASSWORD REVEAL */}
      {/* -------------------------------------------------------------------- */}
      {oneTimePasswordModal?.show && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Credentials Generated</h3>
            </div>
            <p className="text-xs text-slate-600">
              Account provisioned for <strong className="text-slate-900">{oneTimePasswordModal.name}</strong> ({oneTimePasswordModal.email}).
            </p>

            <div className="my-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Temporary Password (One-Time Display)
                </span>
                <span className="text-[10px] font-mono text-amber-700 font-semibold">Min 10 Chars &bull; Must Change</span>
              </div>
              <div className="p-3 bg-white rounded-md border border-amber-300 font-mono text-base font-black text-slate-900 tracking-wider text-center select-all">
                {oneTimePasswordModal.password}
              </div>
              <p className="text-[11px] text-amber-700 mt-2">
                [HARD RULE]: This password is shown exactly once to the creator. The staff member will be forced to change it on their first login.
              </p>
            </div>

            <button
              onClick={() => setOneTimePasswordModal(null)}
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              I have noted this password
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: CREATE STAFF USER */}
      {/* -------------------------------------------------------------------- */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Provision New Staff User</h3>
              <button onClick={() => setShowCreateStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Tariq Mehmood"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g., tariq.mehmood@postex.pk"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">System Role</label>
                <select
                  required
                  value={newStaffForm.role_id}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Select a system role...</option>
                  {org?.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Zone</label>
                  <select
                    value={newStaffForm.zone_id}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, zone_id: e.target.value, branch_id: '' })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Company-wide (No Zone)</option>
                    {org?.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Branch</label>
                  <select
                    value={newStaffForm.branch_id}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, branch_id: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">No specific branch</option>
                    {org?.branches
                      .filter((b) => !newStaffForm.zone_id || b.zone_id === newStaffForm.zone_id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Generate Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: EDIT STAFF USER */}
      {/* -------------------------------------------------------------------- */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Edit Staff Member: {editingStaff.name}</h3>
              <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role</label>
                <select
                  value={editingStaff.role_id}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                >
                  {org?.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Zone</label>
                  <select
                    value={editingStaff.zone_id || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, zone_id: e.target.value || null, branch_id: null })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Company-wide (No Zone)</option>
                    {org?.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Assigned Branch</label>
                  <select
                    value={editingStaff.branch_id || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, branch_id: e.target.value || null })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">No specific branch</option>
                    {org?.branches
                      .filter((b) => !editingStaff.zone_id || b.zone_id === editingStaff.zone_id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ORG ENTITY CREATE / EDIT */}
      {/* -------------------------------------------------------------------- */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {orgModalMode === 'create' ? `Create ${orgSubTab.slice(0, -1)}` : `Edit ${orgSubTab.slice(0, -1)}`}
              </h3>
              <button onClick={() => setShowOrgModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveOrgEntity} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={orgForm.name || ''}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              {orgSubTab === 'branches' && (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Zone</label>
                    <select
                      required
                      value={orgForm.zone_id || ''}
                      onChange={(e) => setOrgForm({ ...orgForm, zone_id: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">Select Zone...</option>
                      {org?.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Physical Address</label>
                    <input
                      type="text"
                      value={orgForm.address || ''}
                      onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </>
              )}

              {orgSubTab === 'designations' && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <select
                    required
                    value={orgForm.department_id || ''}
                    onChange={(e) => setOrgForm({ ...orgForm, department_id: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Select Department...</option>
                    {org?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE DELETE CONFIRMATION MODAL FOR ORG ENTITIES & OVERRIDES */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.open}
        title={deleteModalState.type === 'org' ? `Delete ${deleteModalState.subTab?.slice(0, -1) || 'Item'}` : 'Remove Permission Override'}
        itemName={deleteModalState.targetName}
        itemType={deleteModalState.type === 'org' ? deleteModalState.subTab?.slice(0, -1) || 'Entity' : 'User Permission Override'}
        contextInfo={deleteModalState.type === 'org' ? `Organization Structure → ${deleteModalState.subTab}` : `Staff User: ${selectedStaffForOverride?.name || selectedStaffForOverride?.email}`}
        warningMessage={
          deleteModalState.type === 'org'
            ? `Deleting this ${deleteModalState.subTab?.slice(0, -1)} will permanently dissociate it from all assigned employees, branches, or onboarding forms.`
            : 'Removing this override will immediately revert this staff user to their baseline role-assigned permissions.'
        }
        requireReason={deleteModalState.type === 'org'}
        reasonPlaceholder="State the operational justification for deleting this organization record (mandatory for audit log)..."
        confirmButtonLabel={deleteModalState.type === 'org' ? 'Yes, Delete' : 'Yes, Remove Override'}
        isDeleting={deleteModalState.isDeleting}
        onConfirm={deleteModalState.type === 'org' ? handleConfirmDeleteOrgEntity : handleConfirmDeleteOverride}
        onCancel={() => setDeleteModalState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
