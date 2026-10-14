import React, { useState, useEffect, useRef } from 'react';
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
  Bell,
  HelpCircle,
  Upload,
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
import { EmployeeListView } from './admin/EmployeeListView';
import { OrganizationStructureView } from './admin/OrganizationStructureView';
import { StaffManagementView } from './admin/StaffManagementView';
import { UserPermissionsView } from './admin/UserPermissionsView';
import { RecordBrowserView } from './admin/RecordBrowserView';
import { AuditLogView } from './admin/AuditLogView';
import { OrganizationSettingsView } from './admin/OrganizationSettingsView';
import { HeadcountManagementView } from './common/HeadcountManagementView';
import { WorkflowTrackerView } from './common/WorkflowTrackerView';
import { DataImportView } from './common/DataImportView';
import { Badge, Button, PageContainer, PortalSidebar, PortalSidebarItem } from './ui';
import { toTitleCase } from '../lib/formatText';

export interface SuperAdminDashboardProps {
  currentUser: { id: string; email: string; name?: string; role?: string };
  onSignOut: () => void;
  mobileNavOpen?: boolean;
  setMobileNavOpen?: (open: boolean) => void;
}

export type AdminTab =
  | 'overview'
  | 'employees'
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
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [workflowInitialView, setWorkflowInitialView] = useState<'j' | 'e' | 's' | 't'>('j');
  const [topBarSearch, setTopBarSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTopBarSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topBarSearch.trim()) {
      setEmployeeSearchQuery(topBarSearch.trim());
      setActiveTab('employees');
    }
  };

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

  const sidebarItems: PortalSidebarItem[] = [
    {
      id: 'nav-btn-overview',
      label: 'Overview',
      title: 'Overview',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      active: activeTab === 'overview',
      onSelect: () => handleSelectTab('overview'),
    },
    {
      id: 'nav-btn-employees',
      label: 'Employee List',
      title: 'Employee List',
      icon: <Users className="w-3.5 h-3.5" />,
      active: activeTab === 'employees',
      onSelect: () => handleSelectTab('employees'),
    },
    {
      id: 'nav-btn-org',
      label: 'Organization Structure',
      title: 'Organization Structure',
      icon: <Building2 className="w-3.5 h-3.5" />,
      active: activeTab === 'org',
      onSelect: () => handleSelectTab('org'),
    },
    {
      id: 'nav-btn-headcount',
      label: 'Headcount Management',
      title: 'Headcount Management',
      icon: <Users className="w-3.5 h-3.5" />,
      active: activeTab === 'headcount',
      onSelect: () => handleSelectTab('headcount'),
    },
    {
      id: 'nav-btn-workflow-tracker',
      label: 'Workflow Tracker',
      title: 'Workflow Tracker',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      active: activeTab === 'workflow_tracker',
      onSelect: () => handleSelectTab('workflow_tracker'),
    },
    {
      id: 'nav-btn-data-import',
      label: 'Data Import',
      title: 'Data Import',
      icon: <Upload className="w-3.5 h-3.5" />,
      active: activeTab === 'data_import',
      onSelect: () => handleSelectTab('data_import'),
    },
    {
      id: 'nav-btn-staff',
      label: 'Staff & User Management',
      title: 'Staff & User Management',
      icon: <Users className="w-3.5 h-3.5" />,
      active: activeTab === 'staff',
      onSelect: () => handleSelectTab('staff'),
    },
    {
      id: 'nav-btn-overrides',
      label: 'User Permissions',
      title: 'User Permissions',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      active: activeTab === 'overrides',
      onSelect: () => handleSelectTab('overrides'),
    },
    {
      id: 'nav-btn-records',
      label: 'Company Record Browser',
      title: 'Company Record Browser',
      icon: <Search className="w-3.5 h-3.5" />,
      active: activeTab === 'records',
      onSelect: () => handleSelectTab('records'),
    },
    {
      id: 'nav-btn-audit',
      label: 'Audit Trail Logs',
      title: 'Audit Trail Logs',
      icon: <History className="w-3.5 h-3.5" />,
      active: activeTab === 'audit',
      onSelect: () => handleSelectTab('audit'),
    },
    {
      id: 'nav-btn-form-builder',
      label: 'Form Builder',
      title: 'Form Builder',
      icon: <Sliders className="w-3.5 h-3.5" />,
      active: activeTab === 'form_builder',
      onSelect: () => handleSelectTab('form_builder'),
    },
    {
      id: 'nav-btn-settings',
      label: 'Organization Settings',
      title: 'Organization Settings',
      icon: <Settings className="w-3.5 h-3.5" />,
      active: activeTab === 'settings',
      onSelect: () => handleSelectTab('settings'),
    },
  ];

  return (
    <div id="super-admin-dashboard-container" className="min-h-screen bg-slate-50 flex flex-col sm:flex-row antialiased text-slate-800 overflow-x-hidden">
      {/* Shared Portal Sidebar */}
      <PortalSidebar
        brand={{
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          title: 'Super Admin Portal',
          subtitle: currentUser.name ? toTitleCase(currentUser.name) : currentUser.email,
        }}
        items={sidebarItems}
        isOpen={isNavOpen}
        onClose={() => setNavOpen(false)}
        onSignOut={onSignOut}
        signOutBtnId="super-admin-signout-btn"
        signOutLabel="Sign Out"
        userContext={{
          name: currentUser.name ? toTitleCase(currentUser.name) : currentUser.email,
        }}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50 flex flex-col">
        {/* Top Bar for Super Admin Portal */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
          {/* Top Search Input (Ctrl+K shortcut) */}
          <form onSubmit={handleTopBarSearchSubmit} className="flex-1 max-w-md relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search portal, name, CNIC... (Ctrl+K)"
                value={topBarSearch}
                onChange={(e) => setTopBarSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-14 text-caption rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800"
              />
              <kbd className="absolute right-2 px-1.5 py-0.5 text-tag font-semibold text-slate-400 bg-slate-200/80 rounded border border-slate-300 pointer-events-none">
                ⌘K
              </kbd>
            </div>
          </form>

          {/* Right Header Icons: Bell, Help, Sign Out */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Notifications"
              onClick={() => setNotification({ type: 'success', text: 'No new notifications.' })}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Help & Support"
              onClick={() =>
                setNotification({
                  type: 'success',
                  text: 'PostEx Super Admin Support: support@postex.pk | +92 42 111-767-839',
                })
              }
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Sign Out"
              onClick={() => {
                setNotification({ type: 'success', text: 'Signing out...' });
                setTimeout(() => onSignOut(), 400);
              }}
              className="px-2.5 py-1 text-caption font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <PageContainer width={activeTab === 'settings' || activeTab === 'form_builder' ? 'form' : 'full'}>
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

          {/* Tab 1b: Employee List (100% exact copy of employee-list-reference.html) */}
          {activeTab === 'employees' && (
            <EmployeeListView
              initialSearch={employeeSearchQuery}
              currentUser={currentUser}
              onOpenExitTracker={() => {
                setWorkflowInitialView('e');
                setActiveTab('workflow_tracker');
              }}
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
          {activeTab === 'workflow_tracker' && (
            <WorkflowTrackerView
              role="super_admin"
              initialView={workflowInitialView}
              currentUser={currentUser}
            />
          )}

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
            <FormBuilderModule />
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
        </PageContainer>
      </main>
    </div>
  );
};
