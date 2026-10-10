import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  User,
  Building,
} from 'lucide-react';
import {
  employeesApi,
  JoinerTrackerItem,
  JoinerItemStates,
} from '../../lib/employeesApi';
import { supabase } from '../../lib/supabase';
import { toTitleCase } from '../../lib/formatText';
import { Badge, Button, Card, Modal, Input } from '../ui';

export type WorkflowTrackerRole = 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';

export interface JoinerTrackerSubViewProps {
  role: WorkflowTrackerRole;
  zoneName?: string;
  branchName?: string;
  assignedBranches?: string[];
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

// Display configuration for the 6 onboarding asset checklist items
const ASSET_ITEMS_CONFIG: Array<{
  key: keyof JoinerItemStates;
  header: string;
  positive: string;
  negative: string;
}> = [
  { key: 'code', header: 'Employee Code', positive: 'Opened', negative: 'Not opened' },
  { key: 'machine', header: 'Machine', positive: 'Enrolled', negative: 'Not enrolled' },
  { key: 'login', header: 'Login Credentials', positive: 'Provided', negative: 'Not provided' },
  { key: 'sim', header: 'SIM', positive: 'Provided', negative: 'Not provided' },
  { key: 'idcard', header: 'ID Card', positive: 'Issued', negative: 'Not issued' },
  { key: 'docs_to_ho', header: 'Documents to HO', positive: 'Sent', negative: 'Not sent' },
];

export const JoinerTrackerSubView: React.FC<JoinerTrackerSubViewProps> = ({
  role,
  zoneName,
  branchName,
}) => {
  const [joiners, setJoiners] = useState<JoinerTrackerItem[]>([]);
  const [counts, setCounts] = useState({
    joiners_tracked: 0,
    assets_pending: 0,
    emails_unsent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [branchFilter, setBranchFilter] = useState('');
  const [hrFilter, setHrFilter] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Available branches list from database
  const [availableBranches, setAvailableBranches] = useState<Array<{ id: string; name: string }>>([]);

  // Saving states & errors per row
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Email modal state
  const [selectedEmployeeForEmail, setSelectedEmployeeForEmail] = useState<JoinerTrackerItem | null>(null);
  const [modalEmail, setModalEmail] = useState('');
  const [modalEmailTouched, setModalEmailTouched] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [bannerNotification, setBannerNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Roles permitted to edit asset checklist items and send emails
  const canEdit = role === 'super_admin' || role === 'zonal_hr' || role === 'central_hr';

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailValid = EMAIL_REGEX.test(modalEmail.trim());

  const handleOpenEmailModal = (emp: JoinerTrackerItem) => {
    if (!canEdit) return;
    setSelectedEmployeeForEmail(emp);
    setModalEmail(emp.personal_email || '');
    setModalEmailTouched(false);
    setModalError(null);
  };

  const handleSendEmailSubmit = async () => {
    if (!selectedEmployeeForEmail || !isEmailValid || isSendingEmail) return;

    setIsSendingEmail(true);
    setModalError(null);

    try {
      const res = await employeesApi.sendEmployeeAssetsEmail(selectedEmployeeForEmail.id, {
        recipient_email: modalEmail.trim(),
      });

      if (res.simulated) {
        // Warning: unconfigured provider / simulated mode
        setSelectedEmployeeForEmail(null);
        setBannerNotification({
          type: 'warning',
          message: 'Email provider is not configured, nothing was delivered',
        });
        return;
      }

      if (res.success) {
        // Update row to "Sent"
        const empId = selectedEmployeeForEmail.id;
        const nowIso = new Date().toISOString();
        setJoiners((prev) =>
          prev.map((item) =>
            item.id === empId
              ? {
                  ...item,
                  email_status: 'sent',
                  last_sent_at: nowIso,
                  personal_email: modalEmail.trim() || item.personal_email,
                }
              : item
          )
        );

        // Update counts
        setCounts((prev) => ({
          ...prev,
          emails_unsent:
            selectedEmployeeForEmail.email_status === 'unsent'
              ? Math.max(0, prev.emails_unsent - 1)
              : prev.emails_unsent,
        }));

        setSelectedEmployeeForEmail(null);
        setBannerNotification({
          type: 'success',
          message: `Onboarding assets notification email dispatched successfully to ${modalEmail.trim()}.`,
        });
      } else {
        throw new Error(res.error || res.message || 'Failed to dispatch email.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModalError(msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Load available branches for filter dropdown
  useEffect(() => {
    async function loadBranches() {
      try {
        const { data } = await supabase
          .from('branches')
          .select('id, name')
          .order('name');
        if (data && data.length > 0) {
          setAvailableBranches(data);
        }
      } catch (err) {
        console.warn('Failed to load branches for filter:', err);
      }
    }
    loadBranches();
  }, []);

  // Fetch joiner tracker data from GET /api/employees/joiner-tracker
  const fetchJoinerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeesApi.getJoinerTracker({
        branch_id: branchFilter || undefined,
        hr: hrFilter || undefined,
        only_pending: onlyPending ? true : undefined,
        search: debouncedSearch || undefined,
      });

      if (res.success) {
        setJoiners(res.joiners || []);
        if (res.counts) {
          setCounts(res.counts);
        }
      } else {
        throw new Error(res.error || 'Failed to load joiner tracker records.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, hrFilter, onlyPending, debouncedSearch]);

  useEffect(() => {
    fetchJoinerData();
  }, [fetchJoinerData]);

  // Unique HR officer names extracted from loaded joiners for HR filter dropdown
  const uniqueHrOfficers = useMemo(() => {
    const set = new Set<string>();
    joiners.forEach((j) => {
      if (j.hr_officer_name) {
        set.add(j.hr_officer_name);
      }
    });
    return Array.from(set).sort();
  }, [joiners]);

  // Handle asset checklist item modification with optimistic update and rollback
  const handleAssetChange = async (
    empId: string,
    itemKey: keyof JoinerItemStates,
    newVal: 'provided' | 'not_provided'
  ) => {
    if (!canEdit || savingRows.has(empId)) return;

    const targetJoiner = joiners.find((j) => j.id === empId);
    if (!targetJoiner) return;

    const oldVal = targetJoiner.item_states[itemKey];
    if (oldVal === newVal) return;

    // 1. Lock row and clear existing row error
    setSavingRows((prev) => new Set(prev).add(empId));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });

    // 2. Optimistic update
    const updatedStates: JoinerItemStates = {
      ...targetJoiner.item_states,
      [itemKey]: newVal,
    };
    const newProgress = ASSET_ITEMS_CONFIG.filter((cfg) => updatedStates[cfg.key] === 'provided').length;

    setJoiners((prev) =>
      prev.map((j) =>
        j.id === empId
          ? {
              ...j,
              item_states: updatedStates,
              items: updatedStates,
              progress_count: newProgress,
              // Changing any item invalidates previous email snapshot -> unsent
              email_status: 'unsent',
            }
          : j
      )
    );

    // Optimistically adjust KPI counts
    setCounts((prev) => {
      const oldProgress = targetJoiner.progress_count;
      let pendingDiff = 0;
      if (oldProgress < 6 && newProgress === 6) pendingDiff = -1;
      if (oldProgress === 6 && newProgress < 6) pendingDiff = 1;

      let unsentDiff = 0;
      if (targetJoiner.email_status === 'sent') unsentDiff = 1;

      return {
        ...prev,
        assets_pending: Math.max(0, prev.assets_pending + pendingDiff),
        emails_unsent: prev.emails_unsent + unsentDiff,
      };
    });

    // 3. Dispatch to API
    try {
      await employeesApi.updateEmployeeAssetStatus(empId, { [itemKey]: newVal });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Rollback to previous state
      setJoiners((prev) =>
        prev.map((j) =>
          j.id === empId
            ? {
                ...j,
                item_states: {
                  ...j.item_states,
                  [itemKey]: oldVal,
                },
                items: {
                  ...j.items,
                  [itemKey]: oldVal,
                },
                progress_count: targetJoiner.progress_count,
                email_status: targetJoiner.email_status,
              }
            : j
        )
      );
      setRowErrors((prev) => ({
        ...prev,
        [empId]: `Failed to save: ${msg}`,
      }));
      // Resync counts from server
      fetchJoinerData();
    } finally {
      setSavingRows((prev) => {
        const next = new Set(prev);
        next.delete(empId);
        return next;
      });
    }
  };

  const hasActiveFilters = Boolean(branchFilter || hrFilter || onlyPending || searchInput);

  const handleResetFilters = () => {
    setBranchFilter('');
    setHrFilter('');
    setOnlyPending(false);
    setSearchInput('');
  };

  return (
    <div className="space-y-6" id="joiner-tracker-view">
      {/* 1. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 border-slate-200">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Joiners Tracked
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums mt-1.5" id="kpi-joiners-tracked">
            {counts.joiners_tracked}
          </div>
          <div className="text-caption text-slate-500 mt-1">active joiners across scope</div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Assets Pending
          </div>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums mt-1.5 ${
              counts.assets_pending > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
            id="kpi-assets-pending"
          >
            {counts.assets_pending}
          </div>
          <div className="text-caption text-slate-500 mt-1">joiners with &lt; 6 items provided</div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200">
          <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
            Emails Not Sent
          </div>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums mt-1.5 ${
              counts.emails_unsent > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
            id="kpi-emails-unsent"
          >
            {counts.emails_unsent}
          </div>
          <div className="text-caption text-slate-500 mt-1">awaiting dispatch or updated</div>
        </Card>
      </div>

      {/* 2. Toolbar & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="joiner-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search joiner name, code, designation, email..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Filters controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch Filter */}
            <div className="min-w-[160px]">
              <select
                id="joiner-branch-filter"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">All Branches</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* HR Officer Filter */}
            <div className="min-w-[150px]">
              <select
                id="joiner-hr-filter"
                value={hrFilter}
                onChange={(e) => setHrFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="">All HR Officers</option>
                {uniqueHrOfficers.map((hr) => (
                  <option key={hr} value={hr}>
                    {toTitleCase(hr)}
                  </option>
                ))}
              </select>
            </div>

            {/* Only Pending Toggle */}
            <label
              htmlFor="joiner-only-pending-toggle"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer select-none transition-colors"
            >
              <input
                id="joiner-only-pending-toggle"
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <span>Only Pending (&lt; 6)</span>
            </label>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                id="joiner-reset-filters-btn"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Banner Notification (Success / Warning) */}
      {bannerNotification && (
        <div
          id="joiner-banner-notification"
          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 animate-in fade-in duration-150 ${
            bannerNotification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : bannerNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerNotification.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : bannerNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{bannerNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotification(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-sm font-medium">Loading Joiner Tracker...</span>
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center bg-rose-50/50">
            <AlertTriangle className="w-8 h-8 text-rose-600" />
            <div className="text-sm font-semibold text-rose-800">{error}</div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchJoinerData}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Retry
            </Button>
          </div>
        ) : joiners.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">No active joiners</div>
            <div className="text-caption text-slate-400 mt-1">
              {hasActiveFilters
                ? 'No employees match the applied filters.'
                : 'There are no active employee records currently being tracked.'}
            </div>
            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetFilters}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm border-collapse" id="joiner-tracker-table">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Branch / HR Officer</th>
                  {ASSET_ITEMS_CONFIG.map((cfg) => (
                    <th key={cfg.key} className="py-3 px-3 text-center whitespace-nowrap">
                      {cfg.header}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center whitespace-nowrap">Progress</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {joiners.map((emp) => {
                  const isSaving = savingRows.has(emp.id);
                  const rowError = rowErrors[emp.id];
                  const branchDisplayName = emp.branch?.name || emp.branch_name || 'HQ / Field';
                  const hrDisplayName = emp.hr_officer_name ? toTitleCase(emp.hr_officer_name) : 'Unassigned';

                  return (
                    <tr
                      key={emp.id}
                      id={`joiner-row-${emp.id}`}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSaving ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {/* Column 1: Employee */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">{toTitleCase(emp.full_name)}</div>
                        <div className="text-caption text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                          <span>{emp.employee_code}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-sans text-slate-500">{emp.designation}</span>
                        </div>
                        {emp.personal_email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">
                            {emp.personal_email}
                          </div>
                        )}
                        {/* Saving indicator */}
                        {isSaving && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium mt-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </div>
                        )}
                        {/* Error message */}
                        {rowError && (
                          <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{rowError}</span>
                          </div>
                        )}
                      </td>

                      {/* Column 2: Branch / HR Officer */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{branchDisplayName}</span>
                        </div>
                        <div className="text-caption text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{hrDisplayName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                          Joined: {emp.joining_date}
                        </div>
                      </td>

                      {/* Columns 3 - 8: 6 Item Dropdowns */}
                      {ASSET_ITEMS_CONFIG.map((cfg) => {
                        const currentVal = emp.item_states[cfg.key] || 'not_provided';
                        const isProvided = currentVal === 'provided';
                        const disabled = !canEdit || isSaving;

                        return (
                          <td key={cfg.key} className="py-3.5 px-2 align-middle text-center">
                            <select
                              id={`select-${cfg.key}-${emp.id}`}
                              aria-label={`${cfg.header} status for ${emp.full_name}`}
                              value={currentVal}
                              disabled={disabled}
                              onChange={(e) =>
                                handleAssetChange(
                                  emp.id,
                                  cfg.key,
                                  e.target.value as 'provided' | 'not_provided'
                                )
                              }
                              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all text-center select-none ${
                                isProvided
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500'
                                  : 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                              } ${
                                disabled ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:shadow-xs'
                              }`}
                            >
                              <option value="provided">{cfg.positive}</option>
                              <option value="not_provided">{cfg.negative}</option>
                            </select>
                          </td>
                        );
                      })}

                      {/* Column 9: Progress */}
                      <td className="py-3.5 px-3 align-middle text-center">
                        <Badge
                          variant={
                            emp.progress_count === 6
                              ? 'success'
                              : emp.progress_count > 0
                              ? 'warning'
                              : 'neutral'
                          }
                          className="font-mono text-xs px-2.5 py-1"
                        >
                          {emp.progress_count}/6
                        </Badge>
                      </td>

                      {/* Column 10: Email Status & Action */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {emp.email_status === 'sent' ? (
                            <span
                              title={
                                emp.last_sent_at
                                  ? `Last sent on: ${new Date(emp.last_sent_at).toLocaleString()}`
                                  : 'Sent'
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-help"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sent</span>
                            </span>
                          ) : (
                            <span
                              title={
                                emp.last_sent_at
                                  ? `Items updated after last email on ${new Date(emp.last_sent_at).toLocaleString()}`
                                  : 'No notification email sent yet'
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 cursor-help"
                            >
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Unsent</span>
                            </span>
                          )}

                          <button
                            type="button"
                            id={`btn-send-email-${emp.id}`}
                            disabled={!canEdit || isSaving}
                            onClick={() => canEdit && handleOpenEmailModal(emp)}
                            title={
                              canEdit
                                ? emp.email_status === 'sent'
                                  ? 'Resend onboarding items email'
                                  : 'Send onboarding items email'
                                : 'Branch managers have read-only access'
                            }
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                              canEdit
                                ? 'bg-white hover:bg-slate-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                            }`}
                          >
                            <Mail className="w-3 h-3" />
                            <span>{emp.email_status === 'sent' ? 'Resend' : 'Send'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Onboarding Asset Notification Email Modal */}
      {selectedEmployeeForEmail && (
        <Modal
          isOpen={Boolean(selectedEmployeeForEmail)}
          onClose={() => {
            if (!isSendingEmail) {
              setSelectedEmployeeForEmail(null);
              setModalError(null);
            }
          }}
          title={
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <span>
                {selectedEmployeeForEmail.email_status === 'sent'
                  ? 'Resend Onboarding Asset Notification Email'
                  : 'Send Onboarding Asset Notification Email'}
              </span>
            </div>
          }
          description={
            <span>
              Dispatch an official onboarding items checklist summary to{' '}
              <strong className="text-slate-900">{selectedEmployeeForEmail.full_name}</strong> (
              <span className="font-mono text-xs">{selectedEmployeeForEmail.employee_code}</span>).
            </span>
          }
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                id="modal-cancel-email-btn"
                type="button"
                variant="secondary"
                disabled={isSendingEmail}
                onClick={() => {
                  setSelectedEmployeeForEmail(null);
                  setModalError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                id="modal-submit-email-btn"
                type="button"
                variant="primary"
                disabled={isSendingEmail || !isEmailValid}
                isLoading={isSendingEmail}
                onClick={handleSendEmailSubmit}
                leftIcon={!isSendingEmail ? <Mail className="w-4 h-4" /> : undefined}
              >
                Send email
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            {modalError && (
              <div
                id="modal-email-error-alert"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2 animate-in fade-in"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed font-medium">{modalError}</span>
              </div>
            )}

            {/* Email Input Field */}
            <div>
              <Input
                label="Recipient Email"
                id="modal-recipient-email-input"
                type="email"
                required
                value={modalEmail}
                disabled={isSendingEmail}
                onChange={(e) => {
                  setModalEmail(e.target.value);
                  setModalEmailTouched(true);
                }}
                placeholder="e.g. employee@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={
                  modalEmailTouched && !isEmailValid
                    ? modalEmail.trim() === ''
                      ? 'Recipient email is required.'
                      : 'Please enter a valid email address (e.g. employee@example.com).'
                    : undefined
                }
                helperText={
                  !selectedEmployeeForEmail.personal_email && !modalEmailTouched
                    ? 'Employee has no personal email on file. Please enter one.'
                    : undefined
                }
              />
            </div>

            {/* Checklist Preview Table */}
            <div>
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Checklist Status Preview
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ASSET_ITEMS_CONFIG.map((cfg) => {
                      const isProvided = selectedEmployeeForEmail.item_states[cfg.key] === 'provided';
                      return (
                        <tr key={cfg.key} className="bg-white">
                          <td className="py-2 px-3 font-medium text-slate-800">{cfg.header}</td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
                                isProvided
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isProvided ? cfg.positive : cfg.negative}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
