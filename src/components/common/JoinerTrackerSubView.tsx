import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2,
  AlertTriangle,
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
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
import {
  Badge,
  Button,
  Modal,
  Input,
  KpiCard,
  KpiGrid,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';

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
          message: `Onboarding email preview generated (simulation mode). Resend API key is not configured.`,
        });
      } else {
        setSelectedEmployeeForEmail(null);
        setBannerNotification({
          type: 'success',
          message: `Onboarding checklist notification email sent to ${modalEmail.trim()}.`,
        });
      }

      // Refresh list to update email status
      fetchJoinerData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModalError(msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load available branches for filter dropdown
  useEffect(() => {
    const loadBranches = async () => {
      try {
        let query = supabase.from('branches').select('id, name').order('name');
        if (role === 'branch_manager' && branchName) {
          query = query.eq('name', branchName);
        }
        const { data: bData } = await query;
        if (bData) {
          setAvailableBranches(bData);
        }
      } catch (e) {
        console.error('Failed to load branches', e);
      }
    };
    loadBranches();
  }, [role, branchName]);

  // Fetch joiners list
  const fetchJoinerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeesApi.getJoinerTracker({
        branch_id: branchFilter || undefined,
        hr: hrFilter || undefined,
        only_pending: onlyPending,
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
  }, [role, zoneName, branchName, branchFilter, hrFilter, onlyPending, debouncedSearch]);

  useEffect(() => {
    fetchJoinerData();
  }, [fetchJoinerData]);

  // Extract unique HR officers from the joiners list for filter dropdown
  const uniqueHrOfficers = useMemo(() => {
    const names = new Set<string>();
    joiners.forEach((j) => {
      if (j.hr_officer_name) names.add(j.hr_officer_name);
    });
    return Array.from(names).sort();
  }, [joiners]);

  // Handle Asset Checklist status toggle
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
    <div className="space-y-3" id="joiner-tracker-view">
      {/* 1. KPI Cards using KpiGrid & KpiCard */}
      <KpiGrid columns={3}>
        <KpiCard
          id="kpi-joiners-tracked"
          label="Joiners Tracked"
          value={counts.joiners_tracked}
          hint="active joiners across scope"
          tone="default"
        />
        <KpiCard
          id="kpi-assets-pending"
          label="Assets Pending"
          value={counts.assets_pending}
          hint="joiners with < 6 items provided"
          tone={counts.assets_pending > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          id="kpi-emails-unsent"
          label="Emails Not Sent"
          value={counts.emails_unsent}
          hint="awaiting dispatch or updated"
          tone={counts.emails_unsent > 0 ? 'danger' : 'success'}
        />
      </KpiGrid>

      {/* 2. Toolbar & Filters */}
      <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="joiner-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search joiner name, code, designation, email..."
              className="w-full pl-8 pr-2.5 h-7 text-body rounded-[6px] border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Filters controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Filter */}
            <div className="min-w-[140px]">
              <select
                id="joiner-branch-filter"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-2 h-7 text-body font-medium rounded-[6px] border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:outline-hidden cursor-pointer"
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
            <div className="min-w-[130px]">
              <select
                id="joiner-hr-filter"
                value={hrFilter}
                onChange={(e) => setHrFilter(e.target.value)}
                className="w-full px-2 h-7 text-body font-medium rounded-[6px] border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:outline-hidden cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] border border-slate-300 bg-slate-50 hover:bg-slate-100 text-body font-semibold text-slate-700 cursor-pointer select-none transition-colors"
            >
              <input
                id="joiner-only-pending-toggle"
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                className="rounded-[4px] border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
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
          className={`p-2.5 rounded-[6px] border flex items-start justify-between gap-2.5 animate-in fade-in duration-150 ${
            bannerNotification.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : bannerNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotification.type === 'warning' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            ) : bannerNotification.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            )}
            <span className="text-body font-medium">{bannerNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotification(null)}
            className="text-caption text-slate-500 hover:text-slate-800 font-semibold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Data Table */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500 bg-white border border-slate-200 rounded-[6px]">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-caption font-medium">Loading Joiner Tracker...</span>
        </div>
      ) : error ? (
        <div className="p-6 flex flex-col items-center justify-center gap-2 text-center bg-rose-50/50 border border-rose-200 rounded-[6px]">
          <AlertTriangle className="w-6 h-6 text-rose-600" />
          <div className="text-card-heading font-semibold text-rose-800">{error}</div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchJoinerData}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      ) : joiners.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-[6px]">
          <User className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
          <div className="text-card-heading font-semibold text-slate-700">No active joiners</div>
          <div className="text-caption text-slate-400 mt-0.5">
            {hasActiveFilters
              ? 'No employees match the applied filters.'
              : 'There are no active employee records currently being tracked.'}
          </div>
          {hasActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              className="mt-3"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <Table scroll="x" id="joiner-tracker-table">
          <TableHeader scroll="x">
            <TableRow scroll="x">
              <TableHead>Employee</TableHead>
              <TableHead>Branch / HR Officer</TableHead>
              {ASSET_ITEMS_CONFIG.map((cfg) => (
                <TableHead key={cfg.key} className="text-center whitespace-nowrap">
                  {cfg.header}
                </TableHead>
              ))}
              <TableHead className="text-center whitespace-nowrap">Progress</TableHead>
              <TableHead className="text-center whitespace-nowrap">Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody scroll="x">
            {joiners.map((emp) => {
              const isSaving = savingRows.has(emp.id);
              const rowError = rowErrors[emp.id];
              const branchDisplayName = emp.branch?.name || emp.branch_name || 'HQ / Field';
              const hrDisplayName = emp.hr_officer_name ? toTitleCase(emp.hr_officer_name) : 'Unassigned';

              return (
                <TableRow
                  key={emp.id}
                  id={`joiner-row-${emp.id}`}
                  scroll="x"
                  className={isSaving ? 'bg-indigo-50/20' : ''}
                >
                  {/* Column 1: Employee */}
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{toTitleCase(emp.full_name)}</div>
                    <div className="text-caption text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono">{emp.employee_code}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">{emp.designation}</span>
                    </div>
                    {emp.personal_email && (
                      <div className="text-caption text-slate-400 truncate max-w-[180px] mt-0.5">
                        {emp.personal_email}
                      </div>
                    )}
                    {/* Saving indicator */}
                    {isSaving && (
                      <div className="inline-flex items-center gap-1 text-tag text-indigo-600 font-medium mt-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </div>
                    )}
                    {/* Error message */}
                    {rowError && (
                      <div className="text-caption text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{rowError}</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Column 2: Branch / HR Officer */}
                  <TableCell className="align-top whitespace-nowrap">
                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{branchDisplayName}</span>
                    </div>
                    <div className="text-caption text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{hrDisplayName}</span>
                    </div>
                    <div className="text-caption text-slate-400 mt-0.5">
                      Joined: {emp.joining_date}
                    </div>
                  </TableCell>

                  {/* Columns 3 - 8: 6 Item Dropdowns (keeping green/red value colors with 28px control height) */}
                  {ASSET_ITEMS_CONFIG.map((cfg) => {
                    const currentVal = emp.item_states[cfg.key] || 'not_provided';
                    const isProvided = currentVal === 'provided';
                    const disabled = !canEdit || isSaving;

                    return (
                      <TableCell key={cfg.key} className="align-middle text-center whitespace-nowrap">
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
                          className={`h-7 px-2 text-body font-semibold rounded-[6px] border transition-all text-center select-none ${
                            isProvided
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
                              : 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-1 focus:ring-rose-500 focus:border-rose-500'
                          } ${
                            disabled ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer hover:shadow-2xs'
                          }`}
                        >
                          <option value="provided">{cfg.positive}</option>
                          <option value="not_provided">{cfg.negative}</option>
                        </select>
                      </TableCell>
                    );
                  })}

                  {/* Column 9: Progress */}
                  <TableCell className="align-middle text-center whitespace-nowrap">
                    <Badge
                      variant={
                        emp.progress_count === 6
                          ? 'success'
                          : emp.progress_count > 0
                          ? 'warning'
                          : 'neutral'
                      }
                      className="text-tag"
                    >
                      {emp.progress_count}/6
                    </Badge>
                  </TableCell>

                  {/* Column 10: Email Status & Action */}
                  <TableCell className="align-middle text-center whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      {emp.email_status === 'sent' ? (
                        <span
                          title={
                            emp.last_sent_at
                              ? `Last sent on: ${new Date(emp.last_sent_at).toLocaleString()}`
                              : 'Sent'
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-tag font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-help"
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-tag font-semibold bg-amber-100 text-amber-800 border border-amber-200 cursor-help"
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
                        className={`inline-flex items-center gap-1 h-6 text-tag font-semibold px-2 rounded-[6px] border transition-all ${
                          canEdit
                            ? 'bg-white hover:bg-slate-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-2xs cursor-pointer active:scale-95'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                        }`}
                      >
                        <Mail className="w-3 h-3" />
                        <span>{emp.email_status === 'sent' ? 'Resend' : 'Send'}</span>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

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
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>
                {selectedEmployeeForEmail.email_status === 'sent'
                  ? 'Resend Onboarding Asset Notification Email'
                  : 'Send Onboarding Asset Notification Email'}
              </span>
            </div>
          }
          size="md"
        >
          <div className="space-y-3">
            <div className="bg-slate-50 p-2.5 rounded-[6px] border border-slate-200 space-y-1 text-body">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-semibold text-slate-900">
                  {toTitleCase(selectedEmployeeForEmail.full_name)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee Code:</span>
                <span className="font-mono text-slate-700">
                  {selectedEmployeeForEmail.employee_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch:</span>
                <span className="text-slate-700">
                  {selectedEmployeeForEmail.branch?.name ||
                    selectedEmployeeForEmail.branch_name ||
                    'HQ / Field'}
                </span>
              </div>
            </div>

            <div>
              <Input
                label="Recipient Email Address *"
                type="email"
                value={modalEmail}
                onChange={(e) => {
                  setModalEmail(e.target.value);
                  setModalEmailTouched(true);
                }}
                placeholder="candidate@example.com"
                error={
                  modalEmailTouched && !isEmailValid
                    ? 'Please enter a valid recipient email address'
                    : undefined
                }
                helperText="Summary checklist and credential items will be dispatched to this address."
              />
            </div>

            {modalError && (
              <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-caption flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                disabled={isSendingEmail}
                onClick={() => {
                  setSelectedEmployeeForEmail(null);
                  setModalError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!isEmailValid || isSendingEmail}
                onClick={handleSendEmailSubmit}
                leftIcon={
                  isSendingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )
                }
              >
                {isSendingEmail ? 'Sending...' : 'Confirm & Send Email'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
