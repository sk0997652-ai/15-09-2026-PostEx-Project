import React, { useState, useEffect } from 'react';
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
  | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUser,
  onSignOut,
}) => {
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

  // Org CRUD states
  const [orgSubTab, setOrgSubTab] = useState<'zones' | 'branches' | 'departments' | 'designations'>('zones');
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgModalMode, setOrgModalMode] = useState<'create' | 'edit'>('create');
  const [orgEditId, setOrgEditId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<any>({});

  // Permission Override states
  const [selectedStaffForOverride, setSelectedStaffForOverride] = useState<StaffUserItem | null>(null);
  const [staffOverrides, setStaffOverrides] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
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

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Settings state
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

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

  const handleDeleteOrgEntity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await superAdminApi.deleteOrgEntity(orgSubTab, id);
      setNotification({ type: 'success', text: `Deleted "${name}".` });
      await loadOrgData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Overrides Handlers
  const handleSelectStaffForOverride = async (user: StaffUserItem) => {
    setSelectedStaffForOverride(user);
    setLoading(true);
    try {
      const res = await superAdminApi.getPermissionOverrides(user.id);
      setStaffOverrides(res.overrides);
      setAvailablePermissions(res.allPermissions);
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

  const handleDeleteOverride = async (overrideId: string) => {
    if (!confirm('Remove this override? The user will revert to default role permissions.')) return;
    setLoading(true);
    try {
      await superAdminApi.deletePermissionOverride(overrideId);
      if (selectedStaffForOverride) {
        const res = await superAdminApi.getPermissionOverrides(selectedStaffForOverride.id);
        setStaffOverrides(res.overrides);
      }
      setNotification({ type: 'success', text: 'Override removed.' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
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
      setNotification({ type: 'success', text: 'Organization settings and retention policy updated.' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-sm">
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
              activeTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Dashboard Overview</span>
          </button>

          <button
            id="nav-btn-org"
            onClick={() => setActiveTab('org')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'org' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Organization Structure</span>
          </button>

          <button
            id="nav-btn-staff"
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'staff' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff &amp; User Management</span>
          </button>

          <button
            id="nav-btn-overrides"
            onClick={() => setActiveTab('overrides')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'overrides' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Permission Overrides</span>
          </button>

          <button
            id="nav-btn-records"
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'records' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Company Record Browser</span>
          </button>

          <button
            id="nav-btn-audit"
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail Logs</span>
          </button>

          <button
            id="nav-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
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

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive HR Dashboard</h1>
                <p className="text-xs text-slate-500">Live operational counts from PostEx onboarding backend.</p>
              </div>
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
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Organization Hierarchy</h1>
                <p className="text-xs text-slate-500">Manage PostEx operating Zones, Branches, Departments, and Designations.</p>
              </div>

              <button
                id="add-org-entity-btn"
                onClick={handleOpenOrgCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
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
                      ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
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
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff &amp; User Accounts</h1>
                <p className="text-xs text-slate-500">
                  Provision new staff accounts with auto-generated passwords, assign zones/branches, and manage status.
                </p>
              </div>

              <button
                id="create-staff-user-btn"
                onClick={() => setShowCreateStaffModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Staff User</span>
              </button>
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
                  {staff.map((u) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: PERMISSION OVERRIDES */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'overrides' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Staff Permission Overrides</h1>
              <p className="text-xs text-slate-500">
                Grant or revoke granular system permissions for individual staff members. [HARD RULE: Mandatory Reason Logged to Audit Trail].
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User Selection Column */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 mb-3">Select Staff Member</h3>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {staff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStaffForOverride(s)}
                      className={`w-full p-2.5 text-left rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        selectedStaffForOverride?.id === s.id
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs block">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.roles?.name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Overrides Management Column */}
              <div className="lg:col-span-2 space-y-6">
                {selectedStaffForOverride ? (
                  <>
                    {/* Grant / Revoke Form */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                      <h3 className="text-xs font-bold text-slate-900 mb-1">
                        Apply Override for: {selectedStaffForOverride.name}
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">
                        Overrides take highest precedence over the default role permission matrix.
                      </p>

                      <form onSubmit={handleSaveOverride} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Permission Key</label>
                            <select
                              value={overrideForm.permission_id}
                              onChange={(e) => setOverrideForm({ ...overrideForm, permission_id: e.target.value })}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            >
                              {availablePermissions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.key} {p.description ? `(${p.description})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Action Override</label>
                            <select
                              value={overrideForm.granted ? 'true' : 'false'}
                              onChange={(e) => setOverrideForm({ ...overrideForm, granted: e.target.value === 'true' })}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            >
                              <option value="true">Grant (Explicit Allow)</option>
                              <option value="false">Revoke (Explicit Deny)</option>
                            </select>
                          </div>
                        </div>

                        {/* Mandatory Reason */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Justification / Reason <span className="text-rose-600 font-bold">* [MANDATORY]</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g., Temporary cover for Central HR manager during annual leave"
                            value={overrideForm.reason}
                            onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          Save Override &amp; Record Audit Log
                        </button>
                      </form>
                    </div>

                    {/* Active Overrides for this User */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                      <h3 className="text-xs font-bold text-slate-900 mb-3">
                        Active Overrides ({staffOverrides.length})
                      </h3>
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
                                title="Remove Override"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No overrides applied. Standard role permissions govern this user.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    Select a staff member from the left to view and configure permission overrides.
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
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Company-Wide Record Browser</h1>
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
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
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
                  {records.length > 0 ? (
                    records.map((r) => {
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
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Security &amp; Audit Logs</h1>
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
        {/* TAB 7: ORGANIZATION SETTINGS & DATA RETENTION */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Organization Settings</h1>
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
                        Specifies the number of days after an application is rejected before candidate dossier data is hidden and archived (actual purge job scheduled in Step 10).
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
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {settingsSaving ? 'Saving...' : 'Save Organization Settings'}
                  </button>
                </div>
              </form>
            )}
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
