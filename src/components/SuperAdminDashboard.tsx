import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Search,
  History,
  Sliders,
  Settings,
  ShieldCheck,
  TrendingUp,
  LogOut,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  DashboardMetrics,
  OrgStructure,
  StaffUserItem,
  OrgSettings,
  superAdminApi,
} from '../lib/superAdminApi';
import { FormBuilderModule } from './admin/FormBuilderModule';
import { OverviewMetricsView } from './admin/OverviewMetricsView';
import { OrganizationStructureView } from './admin/OrganizationStructureView';
import { StaffManagementView } from './admin/StaffManagementView';
import { UserPermissionsView } from './admin/UserPermissionsView';
import { RecordBrowserView } from './admin/RecordBrowserView';
import { AuditLogView } from './admin/AuditLogView';
import { OrganizationSettingsView } from './admin/OrganizationSettingsView';
import { Badge, Button } from './ui';

export interface SuperAdminDashboardProps {
  currentUser: { id: string; email: string; name?: string; role?: string };
  onSignOut: () => void;
}

export type AdminTab =
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
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [staff, setStaff] = useState<StaffUserItem[]>([]);
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    if (activeTab === 'overrides') loadStaffData();
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

  return (
    <div id="super-admin-dashboard-container" className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans antialiased text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
              P
            </div>
            <div>
              <span className="font-bold text-white tracking-tight block text-sm">PostEx HR</span>
              <span className="text-[10px] text-slate-400 font-medium block">Super Admin Portal</span>
            </div>
          </div>
          <Badge variant="primary" size="sm">
            v2.4
          </Badge>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-3 space-y-1 text-xs flex-1">
          <button
            id="nav-btn-overview"
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            id="nav-btn-org"
            onClick={() => setActiveTab('org')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'org'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Organization Structure</span>
          </button>

          <button
            id="nav-btn-staff"
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff &amp; User Management</span>
          </button>

          <button
            id="nav-btn-overrides"
            onClick={() => setActiveTab('overrides')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'overrides'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>User Permissions</span>
          </button>

          <button
            id="nav-btn-records"
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'records'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Company Record Browser</span>
          </button>

          <button
            id="nav-btn-audit"
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail Logs</span>
          </button>

          <button
            id="nav-btn-form-builder"
            onClick={() => setActiveTab('form_builder')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'form_builder'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Form Builder</span>
          </button>

          <button
            id="nav-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Organization Settings</span>
          </button>
        </nav>

        {/* User Session & Sign Out */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1 text-xs">
            <span className="text-[11px] text-slate-400 block">Logged in as</span>
            <span className="font-semibold text-white truncate block">{currentUser.name || currentUser.email}</span>
          </div>
          <button
            id="super-admin-signout-btn"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* Global Notification */}
        {notification && (
          <div
            id="super-admin-notification-banner"
            className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center gap-3 border ${
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

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <OverviewMetricsView
            metrics={metrics}
            loading={loading}
            onRefresh={loadOverviewData}
          />
        )}

        {/* Tab 2: Organization Structure */}
        {activeTab === 'org' && (
          <OrganizationStructureView
            org={org}
            loading={loading}
            onRefresh={loadOrgData}
            setNotification={setNotification}
          />
        )}

        {/* Tab 3: Staff Management */}
        {activeTab === 'staff' && (
          <StaffManagementView
            staff={staff}
            org={org}
            loading={loading}
            onReloadStaff={loadStaffData}
            setNotification={setNotification}
          />
        )}

        {/* Tab 4: User Permissions */}
        {activeTab === 'overrides' && (
          <UserPermissionsView
            staff={staff}
            loading={loading}
            setNotification={setNotification}
          />
        )}

        {/* Tab 5: Record Browser */}
        {activeTab === 'records' && (
          <RecordBrowserView
            org={org}
            setNotification={setNotification}
          />
        )}

        {/* Tab 6: Audit Log */}
        {activeTab === 'audit' && (
          <AuditLogView setNotification={setNotification} />
        )}

        {/* Tab 7: Dynamic Form Builder */}
        {activeTab === 'form_builder' && (
          <div className="max-w-5xl">
            <FormBuilderModule />
          </div>
        )}

        {/* Tab 8: Organization Settings & Retention */}
        {activeTab === 'settings' && (
          <OrganizationSettingsView
            settings={settings}
            setSettings={setSettings}
            setNotification={setNotification}
            onSettingsSaved={loadSettingsData}
          />
        )}
      </main>
    </div>
  );
};
