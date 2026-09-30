import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import {
  headcountApi,
  HeadcountZone,
  HeadcountBranch,
  HeadcountDesignation,
  HeadcountEntryItem,
} from '../../lib/headcountApi';
import { useHrPortalStore } from '../../lib/hrPortalStore';
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableToolbar,
  PageHeader,
  Modal,
  Input,
  Select,
} from '../ui';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { toTitleCase } from '../../lib/formatText';

export interface HeadcountManagementViewProps {
  roleContext?: string;
}

export const HeadcountManagementView: React.FC<HeadcountManagementViewProps> = () => {
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [zones, setZones] = useState<HeadcountZone[]>([]);
  const [branches, setBranches] = useState<HeadcountBranch[]>([]);
  const [designations, setDesignations] = useState<HeadcountDesignation[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [userContext, setUserContext] = useState<{
    role: string;
    zone_name: string | null;
    branch_name: string | null;
  } | null>(null);

  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBranchInfo, setSelectedBranchInfo] = useState<HeadcountBranch | null>(null);
  const [entries, setEntries] = useState<HeadcountEntryItem[]>([]);
  const [entrySearch, setEntrySearch] = useState('');
  const [entryCategoryFilter, setEntryCategoryFilter] = useState('all');
  const [entryStatusFilter, setEntryStatusFilter] = useState('all');
  const [summary, setSummary] = useState({
    totalDesignations: 0,
    totalApproved: 0,
    totalActive: 0,
    totalVacancy: 0,
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit Headcount Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formDesignationId, setFormDesignationId] = useState<string>('');
  const [formApprovedCount, setFormApprovedCount] = useState<string>('0');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal State
  const [deleteState, setDeleteState] = useState<{
    open: boolean;
    entryId: string;
    designationName: string;
    isDeleting: boolean;
  }>({
    open: false,
    entryId: '',
    designationName: '',
    isDeleting: false,
  });

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadContext = async () => {
    setLoadingContext(true);
    try {
      const ctx = await headcountApi.getContext();
      setZones(ctx.zones || []);
      setBranches(ctx.branches || []);
      setDesignations(ctx.designations || []);
      setCanEdit(Boolean(ctx.user?.canEdit));
      setUserContext({
        role: ctx.user?.role || '',
        zone_name: ctx.user?.zone_name || null,
        branch_name: ctx.user?.branch_name || null,
      });

      if (ctx.branches && ctx.branches.length > 0) {
        const defaultBranchId =
          selectedBranchId && ctx.branches.some((b) => b.id === selectedBranchId)
            ? selectedBranchId
            : ctx.branches[0].id;
        setSelectedBranchId(defaultBranchId);
      } else {
        setSelectedBranchId('');
        setEntries([]);
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load headcount context.' });
    } finally {
      setLoadingContext(false);
    }
  };

  const loadBranchEntries = async (branchId: string) => {
    if (!branchId) {
      setEntries([]);
      setSelectedBranchInfo(null);
      setSummary({ totalDesignations: 0, totalApproved: 0, totalActive: 0, totalVacancy: 0 });
      return;
    }

    setLoadingEntries(true);
    try {
      const res = await headcountApi.getBranchHeadcount(branchId);
      setSelectedBranchInfo(res.branch);
      setEntries(res.entries || []);
      setSummary(
        res.summary || {
          totalDesignations: 0,
          totalApproved: 0,
          totalActive: 0,
          totalVacancy: 0,
        }
      );
      setCanEdit(Boolean(res.canEdit));
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load branch headcount.' });
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      loadBranchEntries(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Filter branches by selectedZoneId (for Super Admin when filtering by zone)
  const filteredBranches = useMemo(() => {
    if (selectedZoneId === 'all') return branches;
    return branches.filter((b) => b.zone_id === selectedZoneId);
  }, [branches, selectedZoneId]);

  // Keep selectedBranchId synced if zone filter changes
  const handleZoneFilterChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    const nextBranches = zoneId === 'all' ? branches : branches.filter((b) => b.zone_id === zoneId);
    if (nextBranches.length > 0 && !nextBranches.some((b) => b.id === selectedBranchId)) {
      setSelectedBranchId(nextBranches[0].id);
    } else if (nextBranches.length === 0) {
      setSelectedBranchId('');
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('create');
    setEditingEntryId(null);
    setModalError(null);
    const defaultDesigId = designations[0]?.id || '';
    setFormDesignationId(defaultDesigId);
    const existingEntry = entries.find((e) => e.designation_id === defaultDesigId);
    setFormApprovedCount(existingEntry ? String(existingEntry.approved_count) : '0');
    setShowModal(true);
  };

  const handleOpenEditModal = (entry: HeadcountEntryItem) => {
    setModalMode('edit');
    setEditingEntryId(entry.id);
    setModalError(null);
    setFormDesignationId(entry.designation_id);
    setFormApprovedCount(String(entry.approved_count));
    setShowModal(true);
  };

  const handleDesignationSelectChange = (desigId: string) => {
    setFormDesignationId(desigId);
    if (modalMode === 'create') {
      const existingEntry = entries.find((e) => e.designation_id === desigId);
      if (existingEntry) {
        setFormApprovedCount(String(existingEntry.approved_count));
      }
    }
  };

  const handleSaveHeadcount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedBranchId) {
      setModalError('Please select a branch first.');
      return;
    }

    if (!formDesignationId) {
      setModalError('Please select a Designation.');
      return;
    }

    const parsedCount = Number(formApprovedCount);
    if (formApprovedCount.trim() === '' || !Number.isInteger(parsedCount) || parsedCount < 0) {
      setModalError('Approved Count must be a whole number 0 or greater.');
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === 'edit' && editingEntryId) {
        const res = await headcountApi.updateHeadcountEntry(editingEntryId, {
          approved_count: parsedCount,
          designation_id: formDesignationId,
        });
        setNotification({ type: 'success', text: res.message || 'Headcount entry updated.' });
      } else {
        const res = await headcountApi.saveBranchHeadcount(selectedBranchId, {
          designation_id: formDesignationId,
          approved_count: parsedCount,
        });
        setNotification({ type: 'success', text: res.message || 'Headcount entry saved.' });
      }
      setShowModal(false);
      await loadBranchEntries(selectedBranchId);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save headcount entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteModal = (entry: HeadcountEntryItem) => {
    setDeleteState({
      open: true,
      entryId: entry.id,
      designationName: entry.designation_name,
      isDeleting: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteState.entryId) return;
    setDeleteState((prev) => ({ ...prev, isDeleting: true }));
    try {
      await headcountApi.deleteHeadcountEntry(deleteState.entryId);
      setNotification({
        type: 'success',
        text: `Removed headcount allocation for "${deleteState.designationName}".`,
      });
      setDeleteState({ open: false, entryId: '', designationName: '', isDeleting: false });
      await loadBranchEntries(selectedBranchId);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to delete headcount entry.' });
      setDeleteState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const [store] = useHrPortalStore();

  const formatRoleLabel = (role?: string | null) => {
    if (!role) return 'Staff';
    return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Compute live entries & summary incorporating store.employees (Active vs Exit In Progress / Exited)
  const { effectiveEntries, effectiveSummary, fillRatePct } = useMemo(() => {
    const branchName = selectedBranchInfo?.name || '';
    const branchLow = branchName.toLowerCase();

    // Count Active employees in store.employees for this branch (or across all if branchName not matched)
    const storeBranchEmployees = store.employees.filter((e) => {
      if (!branchLow) return false;
      const empB = e.branch.toLowerCase();
      return (
        empB === branchLow ||
        branchLow.includes(empB.split(' ')[0]) ||
        empB.includes(branchLow.split(' ')[0])
      );
    });

    const activeByDesig = new Map<string, number>();
    const exitedDeltaByDesig = new Map<string, number>();

    for (const emp of storeBranchEmployees) {
      const key = emp.designation.toLowerCase();
      if (emp.status === 'Active') {
        activeByDesig.set(key, (activeByDesig.get(key) || 0) + 1);
      } else if (emp.status === 'Exit In Progress' || emp.status === 'Exited') {
        if (!emp.id.startsWith('emp-exit-seed-')) {
          exitedDeltaByDesig.set(key, (exitedDeltaByDesig.get(key) || 0) + 1);
        }
      }
    }

    const baseEntries: HeadcountEntryItem[] = entries.map((entry) => {
      const desigLow = entry.designation_name.toLowerCase();
      const storeActive = activeByDesig.get(desigLow) || 0;
      const exitReduction = exitedDeltaByDesig.get(desigLow) || 0;
      const combinedActive = Math.max(0, entry.active_count + storeActive - exitReduction);
      const vacancy = Math.max(0, entry.approved_count - combinedActive);
      activeByDesig.delete(desigLow);
      return {
        ...entry,
        active_count: combinedActive,
        vacancy,
      };
    });

    // Also include designations that have active employees in browser store for this branch
    activeByDesig.forEach((activeCnt, desigLow) => {
      const storeDesig = store.designations.find((d) => d.name.toLowerCase() === desigLow);
      const desigDisplay = storeDesig?.name || desigLow;
      const approved = Math.max(activeCnt + 2, 5);
      baseEntries.push({
        id: `store-hc-${desigLow}`,
        branch_id: selectedBranchId || 'store-branch',
        designation_id: storeDesig?.id || `desig-${desigLow}`,
        designation_name: desigDisplay,
        employment_category:
          storeDesig?.track === 'Frontline & Field' ? 'Rider' : 'In-House Staff',
        department_id: null,
        department_name: storeDesig?.department || 'Field Operations',
        department_code: null,
        approved_count: approved,
        active_count: activeCnt,
        vacancy: Math.max(0, approved - activeCnt),
        created_by: null,
        updated_by_name: 'Live Roster Sync',
        updated_by_role: 'system',
        updated_at: new Date().toISOString(),
      });
    });

    const totalDesignations = baseEntries.length;
    const totalApproved = baseEntries.reduce((acc, e) => acc + e.approved_count, 0);
    const totalActive = baseEntries.reduce((acc, e) => acc + e.active_count, 0);
    const totalVacancy = baseEntries.reduce((acc, e) => acc + e.vacancy, 0);
    const pct = totalApproved > 0 ? Math.round((totalActive / totalApproved) * 100) : 0;

    return {
      effectiveEntries: baseEntries,
      effectiveSummary: {
        totalDesignations,
        totalApproved,
        totalActive,
        totalVacancy,
      },
      fillRatePct: pct,
    };
  }, [entries, selectedBranchInfo, selectedBranchId, store.employees, store.designations]);

  const filteredEntries = useMemo(() => {
    return effectiveEntries.filter((entry) => {
      if (entryCategoryFilter !== 'all' && entry.employment_category !== entryCategoryFilter) {
        return false;
      }
      if (entryStatusFilter === 'vacancy' && entry.vacancy <= 0) return false;
      if (entryStatusFilter === 'filled' && entry.vacancy > 0) return false;
      if (entrySearch.trim()) {
        const q = entrySearch.trim().toLowerCase();
        const matches =
          entry.designation_name.toLowerCase().includes(q) ||
          (entry.department_name || '').toLowerCase().includes(q) ||
          (entry.employment_category || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [effectiveEntries, entryCategoryFilter, entryStatusFilter, entrySearch]);

  return (
    <div id="headcount-management-view" className="space-y-6">
      <PageHeader
        title="Headcount Management"
        description={
          canEdit
            ? 'Configure and directly edit approved designation headcount allocations and monitor live active staffing and vacancies per branch.'
            : 'Read-only view of approved designation headcount allocations, active enrolled employees, and open vacancies for your assigned branch.'
        }
        roleContext={canEdit ? 'Direct Headcount Governance' : 'Branch Read-Only View'}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              id="headcount-refresh-btn"
              variant="secondary"
              size="sm"
              onClick={() => selectedBranchId ? loadBranchEntries(selectedBranchId) : loadContext()}
              disabled={loadingContext || loadingEntries}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEntries ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {canEdit && (
              <Button
                id="headcount-add-entry-btn"
                variant="primary"
                size="sm"
                onClick={handleOpenAddModal}
                disabled={!selectedBranchId || designations.length === 0}
              >
                <Plus className="w-4 h-4" />
                <span>Add / Edit Headcount Entry</span>
              </Button>
            )}
          </div>
        }
      />

      {notification && (
        <div
          id="headcount-notification-banner"
          className={`p-3.5 rounded-xl border flex items-center justify-between text-caption font-medium ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {!canEdit && (
        <div
          id="headcount-readonly-notice"
          className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-between text-caption text-slate-700"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Read-Only Branch View:</strong> Branch Managers can monitor approved headcount, active enrolled staff, and open vacancies for their assigned branch. Headcount allocations are managed directly by Central HR, Zonal HR Manager, or Super Admin.
            </span>
          </div>
        </div>
      )}

      {/* Branch Selector & Summary Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {userContext?.role === 'super_admin' && zones.length > 1 && (
            <div className="md:col-span-4">
              <Select
                id="headcount-zone-filter"
                label="Filter by Zone"
                value={selectedZoneId}
                onChange={(e) => handleZoneFilterChange(e.target.value)}
              >
                <option value="all">All Operating Zones ({zones.length})</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} {z.zone_code ? `(${z.zone_code})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className={userContext?.role === 'super_admin' && zones.length > 1 ? 'md:col-span-5' : 'md:col-span-7'}>
            <Select
              id="headcount-branch-select"
              label={userContext?.role === 'branch_manager' ? 'Assigned Branch' : 'Select Branch within Your Access Scope'}
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={userContext?.role === 'branch_manager' || filteredBranches.length === 0}
            >
              {filteredBranches.length === 0 ? (
                <option value="">No branches available in scope</option>
              ) : (
                filteredBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.branch_code ? ` (${b.branch_code})` : ''}
                    {b.branch_type ? ` · ${b.branch_type}` : ''}
                    {b.zones?.name ? ` — ${b.zones.name}` : ''}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="md:col-span-3 flex items-center justify-end text-caption text-slate-500">
            {selectedBranchInfo && (
              <div className="text-right space-y-0.5">
                <div className="font-semibold text-slate-800 flex items-center justify-end gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{selectedBranchInfo.name}</span>
                </div>
                <div className="text-tag text-slate-500">
                  <span>{selectedBranchInfo.branch_code || 'No Code'}</span>
                  {selectedBranchInfo.branch_type && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{selectedBranchInfo.branch_type}</span>
                    </>
                  )}
                  {selectedBranchInfo.zones?.name && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{selectedBranchInfo.zones.name}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-caption text-slate-500 block">Configured Designations</span>
            <span id="headcount-metric-designations" className="text-kpi-number text-slate-900 font-mono tabular-nums">
              {effectiveSummary.totalDesignations}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-slate-500 block">Total Approved Headcount</span>
            <span id="headcount-metric-approved" className="text-kpi-number text-indigo-700 font-mono tabular-nums">
              {effectiveSummary.totalApproved}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-slate-500 block">Active Enrolled Count (Fill-Rate)</span>
            <span id="headcount-metric-active" className="text-kpi-number text-emerald-700 font-mono tabular-nums">
              {effectiveSummary.totalActive}{' '}
              <span className="text-caption font-semibold text-slate-500">({fillRatePct}%)</span>
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-slate-500 block">Open Vacancy (Approved − Active)</span>
            <span id="headcount-metric-vacancy" className="text-kpi-number text-amber-700 font-mono tabular-nums">
              {effectiveSummary.totalVacancy}
            </span>
          </div>
        </div>
      </div>

      {/* Headcount Entries Table */}
      <div className="space-y-3">
        <TableToolbar
          searchInputId="headcount-entry-search-input"
          searchValue={entrySearch}
          onSearchChange={setEntrySearch}
          searchPlaceholder="Search designation, department, or category..."
          filters={[
            {
              id: 'headcount-entry-category-filter',
              label: 'Category',
              value: entryCategoryFilter,
              onChange: setEntryCategoryFilter,
              options: [
                { value: 'all', label: 'All Categories' },
                { value: 'Rider', label: 'Rider Only' },
                { value: 'In-House Staff', label: 'In-House Staff Only' },
              ],
            },
          ]}
          activeStatus={entryStatusFilter}
          onStatusChange={setEntryStatusFilter}
          statusPills={[
            { value: 'all', label: 'All Allocations', variant: 'info', count: effectiveEntries.length },
            {
              value: 'vacancy',
              label: 'Open Vacancy',
              variant: 'warning',
              count: effectiveEntries.filter((e) => e.vacancy > 0).length,
            },
            {
              value: 'filled',
              label: 'Fully Staffed',
              variant: 'success',
              count: effectiveEntries.filter((e) => e.vacancy <= 0).length,
            },
          ]}
          hasActiveFilters={
            Boolean(entrySearch.trim()) ||
            entryCategoryFilter !== 'all' ||
            entryStatusFilter !== 'all'
          }
          onReset={() => {
            setEntrySearch('');
            setEntryCategoryFilter('all');
            setEntryStatusFilter('all');
          }}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Designation</TableHead>
              <TableHead className="text-right">Approved Count</TableHead>
              <TableHead className="text-right">Active Count</TableHead>
              <TableHead className="text-right">Vacancy</TableHead>
              <TableHead hideOnTablet>Last Updated By</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingContext || loadingEntries ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-12 text-center text-slate-400 text-caption">
                  Loading branch headcount allocations...
                </TableCell>
              </TableRow>
            ) : !selectedBranchId ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-12 text-center text-slate-400 text-caption">
                  No branch available in your scope. Please configure a branch in Organization Structure first.
                </TableCell>
              </TableRow>
            ) : filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id} data-designation-id={entry.designation_id}>
                  <TableCell mobileRole="primaryFull">
                    <div className="font-semibold text-slate-900 text-body">{entry.designation_name}</div>
                    <div className="text-caption text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span>{entry.department_name || 'Unassigned Department'}</span>
                      {entry.employment_category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700 font-medium">{entry.employment_category}</span>
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell
                    id={`headcount-approved-${entry.designation_id}`}
                    mobileRole="field"
                    mobileLabel="Approved Count"
                    className="md:text-right font-mono tabular-nums font-semibold text-slate-900"
                  >
                    {entry.approved_count}
                  </TableCell>

                  <TableCell
                    id={`headcount-active-${entry.designation_id}`}
                    mobileRole="field"
                    mobileLabel="Active Count"
                    className="md:text-right font-mono tabular-nums font-semibold text-emerald-700"
                  >
                    {entry.active_count}
                  </TableCell>

                  <TableCell
                    id={`headcount-vacancy-${entry.designation_id}`}
                    mobileRole="field"
                    mobileLabel="Vacancy"
                    className={`md:text-right font-mono tabular-nums font-semibold ${
                      entry.vacancy > 0 ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    {entry.vacancy}
                  </TableCell>

                  <TableCell hideOnTablet mobileRole="field" mobileLabel="Last Updated By">
                    <div className="text-body text-slate-800 font-medium">{toTitleCase(entry.updated_by_name)}</div>
                    <div className="text-caption text-slate-500 flex items-center gap-1.5">
                      {entry.updated_by_role && (
                        <>
                          <span>{formatRoleLabel(entry.updated_by_role)}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-mono">
                        {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '—'}
                      </span>
                    </div>
                  </TableCell>

                  {canEdit && (
                    <TableCell mobileRole="actions" className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          id={`headcount-edit-btn-${entry.designation_id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(entry)}
                          title="Edit Approved Headcount"
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          id={`headcount-delete-btn-${entry.designation_id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDeleteModal(entry)}
                          title="Delete Headcount Entry"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-12 text-center text-slate-400 text-caption">
                  {entries.length > 0
                    ? 'No headcount entries match the active search or filter criteria.'
                    : `No headcount entries configured for this branch yet.${
                        canEdit
                          ? ' Click "Add / Edit Headcount Entry" above to set approved headcounts per designation.'
                          : ''
                      }`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Headcount Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'create' ? 'Add / Edit Headcount Entry' : 'Edit Headcount Entry'}
        description={
          selectedBranchInfo
            ? `Directly set the approved headcount allocation for ${selectedBranchInfo.name}.`
            : 'Set approved headcount for the selected branch and designation.'
        }
        size="small"
      >
        <form onSubmit={handleSaveHeadcount} className="space-y-4 text-body">
          {modalError && (
            <div
              id="headcount-modal-error-banner"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-caption font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          <Select
            id="headcount-modal-designation-select"
            label="Designation"
            required
            disabled={modalMode === 'edit'}
            value={formDesignationId}
            onChange={(e) => handleDesignationSelectChange(e.target.value)}
          >
            <option value="">Select Designation...</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.departments?.name ? ` (${d.departments.name})` : ''}
                {d.employment_category ? ` — ${d.employment_category}` : ''}
              </option>
            ))}
          </Select>

          <Input
            id="headcount-modal-approved-count-input"
            label="Approved Headcount"
            type="number"
            min={0}
            step={1}
            required
            value={formApprovedCount}
            onChange={(e) => setFormApprovedCount(e.target.value)}
            placeholder="e.g. 15"
            helperText="Saves directly to branch_designation_headcount without requiring a separate approval workflow."
          />

          <div className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              id="headcount-modal-save-btn"
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Headcount'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteState.open}
        title="Delete Headcount Entry"
        itemName={deleteState.designationName}
        itemType="Branch Headcount Allocation"
        contextInfo={selectedBranchInfo ? `Branch: ${selectedBranchInfo.name}` : 'Selected Branch'}
        warningMessage="Deleting this headcount entry removes the approved count target for this designation at this branch. Enrolled employees are not affected."
        requireReason={false}
        confirmButtonLabel="Yes, Delete Entry"
        isDeleting={deleteState.isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteState({ open: false, entryId: '', designationName: '', isDeleting: false })}
      />
    </div>
  );
};
