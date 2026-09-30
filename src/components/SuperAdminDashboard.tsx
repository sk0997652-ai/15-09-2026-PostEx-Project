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
  X,
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
import { HeadcountManagementView } from './common/HeadcountManagementView';
import { WorkflowTrackerView } from './common/WorkflowTrackerView';
import { DataImportView } from './common/DataImportView';
import { Badge, Button } from './ui';
import { Upload } from 'lucide-react';
import { toTitleCase } from '../lib/formatText';

export interface SuperAdminDashboardProps {
  currentUser: { id: string; email: string; name?: string; role?: string };
  onSignOut: () => void;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

export type AdminTab =
  | 'overview'
  | 'org'
  | 'headcount'
  | 'workflow_tracker'
  | 'data_import'
  | 'staff'
  | 'overrides'
  | 'records'
  | 'audit'
  | 'form_builder'
  | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUser,
  onSignOut,
  mobileNavOpen,
  setMobileNavOpen,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [internalNavOpen, setInternalNavOpen] = useState(false);
  const isNavOpen = mobileNavOpen !== undefined ? mobileNavOpen : internalNavOpen;
  const setNavOpen = setMobileNavOpen || setInternalNavOpen;
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

  // Tab-specific loads (also runs on initial mount for 'overview')
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

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setNavOpen(false);
  };

  return (
    <div id="super-admin-dashboard-container" className="min-h-screen bg-slate-50 flex flex-col sm:flex-row font-sans antialiased text-slate-800 overflow-x-hidden">
      {/* Mobile Slide-In Drawer Backdrop (<640px) */}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation: Mobile Slide-In Drawer (<640px) | Tablet Icon Rail (640-1024px) | Desktop Full Sidebar (1024px+) */}
      <aside
        className={`${
          isNavOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64 flex shadow-2xl'
            : 'hidden'
        } sm:static sm:z-auto sm:flex sm:w-16 lg:w-60 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 transition-all duration-200`}
      >
        <div className="p-4 sm:p-3 lg:p-5 border-b border-slate-800 flex items-center justify-between sm:justify-center lg:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-tag shadow-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 sm:hidden lg:block">
              <span className="text-card-heading text-white block truncate">Super Admin Portal</span>
              <span className="text-caption text-slate-400 font-medium block truncate">
                {currentUser.name ? toTitleCase(currentUser.name) : currentUser.email}
              </span>
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

        {/* Navigation Tabs */}
        <nav className="p-2.5 sm:p-2 lg:p-3 space-y-1 text-caption flex-1 overflow-y-auto">
          <button
            id="nav-btn-overview"
            title="Overview"
            onClick={() => handleSelectTab('overview')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Overview</span>
          </button>

          <button
            id="nav-btn-org"
            title="Organization Structure"
            onClick={() => handleSelectTab('org')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'org'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Organization Structure</span>
          </button>

          <button
            id="nav-btn-headcount"
            title="Headcount Management"
            onClick={() => handleSelectTab('headcount')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'headcount'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Headcount Management</span>
          </button>

          <button
            id="nav-btn-workflow-tracker"
            title="Workflow Tracker"
            onClick={() => handleSelectTab('workflow_tracker')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'workflow_tracker'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Workflow Tracker</span>
          </button>

          <button
            id="nav-btn-data-import"
            title="Data Import"
            onClick={() => handleSelectTab('data_import')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'data_import'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Data Import</span>
          </button>

          <button
            id="nav-btn-staff"
            title="Staff & User Management"
            onClick={() => handleSelectTab('staff')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Staff &amp; User Management</span>
          </button>

          <button
            id="nav-btn-overrides"
            title="User Permissions"
            onClick={() => handleSelectTab('overrides')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'overrides'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">User Permissions</span>
          </button>

          <button
            id="nav-btn-records"
            title="Company Record Browser"
            onClick={() => handleSelectTab('records')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'records'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Company Record Browser</span>
          </button>

          <button
            id="nav-btn-audit"
            title="Audit Trail Logs"
            onClick={() => handleSelectTab('audit')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Audit Trail Logs</span>
          </button>

          <button
            id="nav-btn-form-builder"
            title="Form Builder"
            onClick={() => handleSelectTab('form_builder')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'form_builder'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Form Builder</span>
          </button>

          <button
            id="nav-btn-settings"
            title="Organization Settings"
            onClick={() => handleSelectTab('settings')}
            className={`w-full flex items-center sm:justify-center lg:justify-start gap-3 px-3 sm:px-0 lg:px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="sm:hidden lg:inline truncate">Organization Settings</span>
          </button>
        </nav>

        {/* User Session & Sign Out */}
        <div className="p-2.5 sm:p-2 lg:p-3 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1 text-caption sm:hidden lg:block">
            <span className="text-caption text-slate-400 block">Logged in as</span>
            <span className="font-semibold text-white truncate block">{currentUser.name ? toTitleCase(currentUser.name) : currentUser.email}</span>
          </div>
          <button
            id="super-admin-signout-btn"
            title="Sign Out"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 sm:px-0 lg:px-3 py-2 rounded-xl text-caption font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {/* Global Notification */}
        {notification && (
          <div
            id="super-admin-notification-banner"
            className={`mb-6 p-4 rounded-xl text-caption font-medium flex items-center gap-3 border ${
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
            onNavigateToHeadcount={() => setActiveTab('headcount')}
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

        {/* Tab 2b: Headcount Management */}
        {activeTab === 'headcount' && <HeadcountManagementView />}

        {/* Tab 2c: Workflow Tracker */}
        {activeTab === 'workflow_tracker' && <WorkflowTrackerView role="super_admin" />}

        {/* Tab 2d: Data Import */}
        {activeTab === 'data_import' && <DataImportView onDataImported={loadOrgData} />}

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
