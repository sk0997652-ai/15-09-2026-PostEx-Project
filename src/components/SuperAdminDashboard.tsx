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
import { Badge, Button, PageContainer, PortalSidebar, PortalSidebarItem } from './ui';
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
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50">
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
