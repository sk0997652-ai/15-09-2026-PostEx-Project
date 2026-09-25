import React, { useState, useRef } from 'react';
import {
  History,
  Archive,
  RefreshCw,
  CheckCircle2,
  Building,
  Mail,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Info,
  Type,
} from 'lucide-react';
import { OrgSettings, superAdminApi } from '../../lib/superAdminApi';
import { useBranding, DEFAULT_LOGIN_TAGLINE } from '../../lib/branding';
import { optimizeBackgroundImage, optimizeLogoImage } from '../../lib/imageOptimizer';
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
  const { reloadBranding, defaultLoginBg } = useBranding();
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [bgOptimizationNote, setBgOptimizationNote] = useState<string | null>(null);

  const [retentionResult, setRetentionResult] = useState<{
    success: boolean;
    countArchived: number;
    thresholdDays: number;
    cutoffDate: string;
    message: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const updated = await superAdminApi.updateSettings(settings);
      setSettings(updated);
      setNotification({ type: 'success', text: 'Organization identity, branding, and settings saved successfully.' });
      await reloadBranding();
      if (onSettingsSaved) onSettingsSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', text: msg });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploadingLogo(true);
    try {
      const optimized = await optimizeLogoImage(file);
      const res = await superAdminApi.uploadLogo(optimized.blob, file.name);
      setSettings({ ...settings, logoUrl: res.logoUrl });
      setNotification({ type: 'success', text: 'Company logo uploaded and updated successfully.' });
      await reloadBranding();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', text: `Logo upload failed: ${msg}` });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleResetLogo = () => {
    if (!settings) return;
    setSettings({ ...settings, logoUrl: null });
    setNotification({ type: 'success', text: 'Logo reset to system default brand mark.' });
  };

  const handleBgFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploadingBg(true);
    setBgOptimizationNote(null);
    try {
      const optimized = await optimizeBackgroundImage(file);
      const origKb = Math.round(optimized.originalSize / 1024);
      const optKb = Math.round(optimized.optimizedSize / 1024);
      const reduction = Math.round(((optimized.originalSize - optimized.optimizedSize) / optimized.originalSize) * 100);

      const res = await superAdminApi.uploadLoginBackground(optimized.blob, 'login_bg.jpg');
      setSettings({ ...settings, loginBgUrl: res.bgUrl });
      setBgOptimizationNote(
        `Optimized: ${origKb} KB → ${optKb} KB (${reduction}% smaller, ${optimized.width}×${optimized.height}) for crisp high-speed loading.`
      );
      setNotification({ type: 'success', text: 'Login page background uploaded and automatically optimized.' });
      await reloadBranding();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', text: `Background upload failed: ${msg}` });
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const handleResetBg = () => {
    if (!settings) return;
    setSettings({ ...settings, loginBgUrl: null });
    setBgOptimizationNote(null);
    setNotification({ type: 'success', text: 'Login background reset to neutral default workplace image.' });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', text: msg });
    } finally {
      setRetentionRunning(false);
    }
  };

  return (
    <div id="super-admin-settings-view" className="max-w-4xl space-y-6">
      <PageHeader
        title="Super Admin — Branding & Organization Settings"
        description="Configure corporate brand identity, login experience, tagline, and automated data retention policies."
        roleContext="System Preferences"
      />

      {settings && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Brand Identity & Login Styling Controls */}
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Company Identity &amp; Portal Branding</h3>
              </div>
              <Badge variant="indigo" size="sm">Super Admin Controlled</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. Company Name */}
              <div className="space-y-1">
                <Input
                  id="settings-company-name"
                  label="Company Name"
                  type="text"
                  required
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  leftIcon={<Building className="w-4 h-4 text-slate-400" />}
                  placeholder="e.g. PostEx Logistics"
                />
                <span className="text-[11px] text-slate-500 block">
                  Displayed across header navigation, login portals, and official PDF dossiers.
                </span>
              </div>

              {/* 2. Login Page Tagline / Welcome Text */}
              <div className="space-y-1">
                <Input
                  id="settings-login-tagline"
                  label="Login Page Tagline / Welcome Text"
                  type="text"
                  value={settings.loginTagline ?? DEFAULT_LOGIN_TAGLINE}
                  onChange={(e) => setSettings({ ...settings, loginTagline: e.target.value })}
                  leftIcon={<Type className="w-4 h-4 text-slate-400" />}
                  placeholder="e.g. Sign in to manage your team"
                />
                <span className="text-[11px] text-slate-500 block">
                  Shown beneath the main heading on both Candidate and Staff login pages.
                </span>
              </div>
            </div>

            {/* 3. Company Logo Upload & Preview */}
            <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Company Logo</span>
                    {settings.logoUrl ? (
                      <Badge variant="emerald" size="sm">Custom Upload</Badge>
                    ) : (
                      <Badge variant="slate" size="sm">Default System Logo</Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Accepts PNG, SVG, JPG, or WebP (max 2MB). Displayed in the header nav, both login pages, and PDF dossiers.
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFileSelect}
                  />
                  <Button
                    id="btn-upload-logo"
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    {uploadingLogo ? 'Optimizing...' : 'Upload Logo'}
                  </Button>
                  {settings.logoUrl && (
                    <Button
                      id="btn-reset-logo"
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleResetLogo}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Logo Preview Box */}
              <div className="flex items-center gap-4 pt-2">
                <div className="w-36 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-2 shadow-xs">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Company Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                      <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-600">
                        <Building className="w-3.5 h-3.5" />
                      </div>
                      <span>{settings.companyName || 'PostEx'}</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <span className="font-semibold text-slate-700 block">Preview in Portal Nav &amp; Login Cards</span>
                  <span>{settings.logoUrl ? 'Using custom uploaded logo file.' : 'Using default company brand mark.'}</span>
                </div>
              </div>
            </div>

            {/* 4. Login Page Background Image Upload & Preview */}
            <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">Login Page Background Image</span>
                    {settings.loginBgUrl ? (
                      <Badge variant="emerald" size="sm">Custom Background</Badge>
                    ) : (
                      <Badge variant="slate" size="sm">Default Background</Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Used as the full-bleed background for <strong>both Staff and Candidate login pages</strong>. Accepts JPG, PNG, WebP up to 5MB (resolutions up to 2560×1440).
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleBgFileSelect}
                  />
                  <Button
                    id="btn-upload-bg"
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={uploadingBg}
                    onClick={() => bgInputRef.current?.click()}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    {uploadingBg ? 'Optimizing...' : 'Upload Background'}
                  </Button>
                  {settings.loginBgUrl && (
                    <Button
                      id="btn-reset-bg"
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleResetBg}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Automatic Compression Notice */}
              <div className="flex items-start gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>High-Speed Auto-Optimization:</strong> Large uploads (up to 5MB) are automatically downscaled and compressed to high-performance responsive web resolution on upload so login pages load instantly on mobile, tablet, and desktop displays.
                </span>
              </div>

              {bgOptimizationNote && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{bgOptimizationNote}</span>
                </div>
              )}

              {/* Background Thumbnail Preview */}
              <div className="flex items-center gap-4 pt-1">
                <div className="w-48 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-xs relative bg-slate-900">
                  <img
                    src={settings.loginBgUrl || defaultLoginBg}
                    alt="Login Background Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 flex items-end p-2">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-slate-950/60 px-1.5 py-0.5 rounded">
                      {settings.loginBgUrl ? 'Active Custom' : 'Default Neutral'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700 block">Full-Bleed Glass Card Preview</span>
                  <span>Both Staff &amp; Candidate login cards sit centered on this background image with a soft translucent blur.</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Support Email & Data Retention Settings */}
          <Card className="p-6 space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Support &amp; Data Retention Policy</h3>
              <p className="text-xs text-slate-500">Corporate communication and privacy compliance retention thresholds.</p>
            </div>

            <Input
              id="settings-support-email"
              label="Support Email"
              type="email"
              required
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              placeholder="e.g. hr-support@postex.pk"
            />

            {/* Data Retention Policy Sub-panel */}
            <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <History className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Data Retention Policy</span>
                  <span className="text-[11px] text-slate-500 block leading-relaxed mt-0.5">
                    Specifies the number of days after an application is rejected before candidate dossier data is soft-archived in compliance with privacy regulations.
                  </span>
                </div>
              </div>

              <div className="w-48">
                <Input
                  id="settings-retention-days"
                  label="Days After Rejection Before Hiding"
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
                size="md"
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Saving Settings...' : 'Save Organization Settings'}
              </Button>
            </div>
          </Card>
        </form>
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
