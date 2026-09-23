import React, { useState } from 'react';
import { History, Archive, RefreshCw, CheckCircle2, Building, Mail } from 'lucide-react';
import { OrgSettings, superAdminApi } from '../../lib/superAdminApi';
import { useBranding } from '../../lib/branding';
import { Button, Card, PageHeader, Input, Badge } from '../ui';

export interface OrganizationSettingsViewProps {
  settings: OrgSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<OrgSettings | null>>;
  setNotification: (notif: { type: 'success' | 'error'; text: string } | null) => void;
  onSettingsSaved?: () => void;
}

export const OrganizationSettingsView: React.FC<OrganizationSettingsViewProps> = ({
  settings,
  setSettings,
  setNotification,
  onSettingsSaved,
}) => {
  const { reloadBranding } = useBranding();
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionResult, setRetentionResult] = useState<{
    success: boolean;
    countArchived: number;
    thresholdDays: number;
    cutoffDate: string;
    message: string;
  } | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    try {
      await superAdminApi.updateSettings(settings);
      setNotification({ type: 'success', text: 'Organization settings and retention policy updated.' });
      reloadBranding();
      if (onSettingsSaved) onSettingsSaved();
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
      setRetentionResult(res);
      setNotification({
        type: 'success',
        text: `Data retention job complete: ${res.countArchived} candidate applications archived.`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div id="super-admin-settings-view" className="max-w-3xl space-y-6">
      <PageHeader
        title="Super Admin — System Preferences & Retention"
        description="Configure organizational parameters, company identity, and data retention rules."
        roleContext="System Preferences"
      />

      {settings && (
        <Card className="p-6">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <Input
              id="settings-company-name"
              label="Company Name"
              type="text"
              required
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              leftIcon={<Building className="w-4 h-4 text-slate-400" />}
            />

            <Input
              id="settings-support-email"
              label="Support Email"
              type="email"
              required
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            />

            {/* Data Retention Policy Sub-panel */}
            <div className="p-4.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <History className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Data Retention Policy</span>
                  <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                    Specifies the number of days after an application is rejected before candidate dossier data is soft-archived in compliance with privacy regulations.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Days After Rejection Before Hiding
                </label>
                <input
                  id="settings-retention-days"
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
                  className="w-36 text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="autoArchive"
                checked={settings.autoArchiveEnabled}
                onChange={(e) => setSettings({ ...settings, autoArchiveEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="autoArchive" className="text-xs text-slate-700 font-medium cursor-pointer">
                Enable automated archival notifications
              </label>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                Last updated: {new Date(settings.lastUpdated).toLocaleDateString()}
              </span>
              <Button
                id="save-settings-btn"
                type="submit"
                variant="primary"
                size="sm"
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Saving Settings...' : 'Save Organization Settings'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Data Retention Enforcement Job Panel */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Automated Data Retention Policy Enforcement
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Enforces data retention compliance by soft-hiding rejected candidate applications older than the configured policy threshold ({settings?.dataRetentionDaysAfterRejection || 120} days). Records remain fully intact in compliance audit logs.
            </p>
          </div>
          <Button
            id="btn-run-retention-cleanup"
            type="button"
            variant="primary"
            size="sm"
            onClick={handleRunRetentionCleanup}
            disabled={retentionRunning}
            className="shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retentionRunning ? 'animate-spin' : ''}`} />
            <span>{retentionRunning ? 'Executing Cleanup...' : 'Run Retention Cleanup Now'}</span>
          </Button>
        </div>

        {retentionResult && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Execution Result:
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Cutoff: {new Date(retentionResult.cutoffDate).toLocaleDateString()}
              </span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              {retentionResult.message}
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 font-mono">
              <span>
                Archived: <strong className="text-indigo-600">{retentionResult.countArchived}</strong>
              </span>
              <span>
                Policy Threshold: <strong className="text-slate-700">{retentionResult.thresholdDays} days</strong>
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
