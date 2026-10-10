import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Car,
  Phone,
  Key,
  CreditCard,
  FileBox,
  MoreHorizontal,
  FileCheck2,
  X,
  Loader2,
  Download,
} from 'lucide-react';
import {
  exitsApi,
  ExitListItem,
  ExitDetailRecord,
  ExitItemKey,
  ClearanceSubmitStatus,
  SaveClearanceItemPayload,
} from '../../lib/exitsApi';
import { Badge, Button, Modal } from '../ui';
import { toTitleCase } from '../../lib/formatText';

export type WorkflowTrackerRole = 'super_admin' | 'zonal_hr' | 'central_hr' | 'branch_manager';

export interface ExitTrackerSubViewProps {
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
  onExitCompleted?: () => void;
}

interface ClearanceItemConfig {
  key: ExitItemKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  thirdOptionLabel: string;
  detailPlaceholder?: string;
  detailLabel?: string;
}

const CLEARANCE_CONFIG: ClearanceItemConfig[] = [
  {
    key: 'office_files',
    label: 'Office files & stationery',
    icon: FileBox,
    thirdOptionLabel: 'N/A',
  },
  {
    key: 'keys',
    label: 'Keys',
    icon: Key,
    thirdOptionLabel: 'Not eligible',
  },
  {
    key: 'mobile_sim',
    label: 'Mobile & SIM',
    icon: Phone,
    thirdOptionLabel: 'N/A',
    detailLabel: 'Mobile no.',
    detailPlaceholder: 'e.g. 0300-1234567',
  },
  {
    key: 'id_card',
    label: 'Company ID card',
    icon: CreditCard,
    thirdOptionLabel: 'N/A',
  },
  {
    key: 'company_car',
    label: 'Company car',
    icon: Car,
    thirdOptionLabel: 'N/A',
    detailLabel: 'Registration #',
    detailPlaceholder: 'e.g. LEA-2025-9812',
  },
  {
    key: 'others',
    label: 'Others',
    icon: MoreHorizontal,
    thirdOptionLabel: 'N/A',
    detailLabel: 'Please state',
    detailPlaceholder: 'Specify additional asset detail',
  },
];

export const ExitTrackerSubView: React.FC<ExitTrackerSubViewProps> = ({
  role,
  onExitCompleted,
}) => {
  const [exits, setExits] = useState<ExitListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clearance Modal State
  const [selectedExitForClearance, setSelectedExitForClearance] = useState<ExitDetailRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<
    Record<ExitItemKey, { status: ClearanceSubmitStatus | 'pending'; detail: string }>
  >({
    office_files: { status: 'pending', detail: '' },
    keys: { status: 'pending', detail: '' },
    mobile_sim: { status: 'pending', detail: '' },
    id_card: { status: 'pending', detail: '' },
    company_car: { status: 'pending', detail: '' },
    others: { status: 'pending', detail: '' },
  });

  // Complete Exit Modal State
  const [completeTarget, setCompleteTarget] = useState<ExitListItem | null>(null);
  const [completeTargetDetail, setCompleteTargetDetail] = useState<ExitDetailRecord | null>(null);
  const [completeLoadingDetail, setCompleteLoadingDetail] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeModalError, setCompleteModalError] = useState<string | null>(null);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const canEdit = role === 'super_admin' || role === 'zonal_hr' || role === 'central_hr';

  // Fetch Exits List
  const fetchExits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await exitsApi.getExits({ status: 'in_progress' });
      if (res.success) {
        setExits(res.exits || []);
      } else {
        throw new Error(res.error || 'Failed to fetch exit records');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExits();
  }, [fetchExits]);

  // Open Clearance Form Modal
  const handleOpenClearanceModal = async (exitItem: ExitListItem) => {
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await exitsApi.getExitById(exitItem.id);
      if (res.success && res.exit) {
        setSelectedExitForClearance(res.exit);

        const initialForm: Record<ExitItemKey, { status: ClearanceSubmitStatus | 'pending'; detail: string }> = {
          office_files: { status: 'pending', detail: '' },
          keys: { status: 'pending', detail: '' },
          mobile_sim: { status: 'pending', detail: '' },
          id_card: { status: 'pending', detail: '' },
          company_car: { status: 'pending', detail: '' },
          others: { status: 'pending', detail: '' },
        };

        (res.exit.clearance_items || []).forEach((ci) => {
          if (ci.item_key && initialForm[ci.item_key]) {
            initialForm[ci.item_key] = {
              status: ci.status as any,
              detail: ci.detail || '',
            };
          }
        });

        setFormState(initialForm);
      } else {
        throw new Error(res.error || 'Failed to retrieve exit clearance details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  // Close Clearance Modal
  const handleCloseClearanceModal = () => {
    if (!isSaving) {
      setSelectedExitForClearance(null);
      setModalError(null);
    }
  };

  // Open Complete Exit Modal
  const handleOpenCompleteModal = async (item: ExitListItem) => {
    setCompleteTarget(item);
    setCompleteModalError(null);
    setCompleteLoadingDetail(true);
    try {
      const res = await exitsApi.getExitById(item.id);
      if (res.success && res.exit) {
        setCompleteTargetDetail(res.exit);
      } else {
        setCompleteModalError(res.error || 'Failed to retrieve clearance details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompleteModalError(msg);
    } finally {
      setCompleteLoadingDetail(false);
    }
  };

  // Close Complete Exit Modal
  const handleCloseCompleteModal = () => {
    if (!isCompleting) {
      setCompleteTarget(null);
      setCompleteTargetDetail(null);
      setCompleteModalError(null);
    }
  };

  // Confirm Complete Exit
  const handleConfirmCompleteExit = async () => {
    if (!completeTarget || isCompleting) return;
    setIsCompleting(true);
    setCompleteModalError(null);
    try {
      const outstanding = (completeTargetDetail?.clearance_items || []).filter(
        (ci) => ci.status === 'not_received'
      );
      const hasOutstanding = outstanding.length > 0;

      const res = await exitsApi.completeExit(completeTarget.id, {
        confirm_outstanding: hasOutstanding,
      });

      if (res.success) {
        const empName = completeTarget.full_name || completeTarget.employee_code;
        setSuccessToast(`Exit process completed successfully for ${empName}.`);
        setCompleteTarget(null);
        setCompleteTargetDetail(null);
        await fetchExits();
        if (onExitCompleted) {
          onExitCompleted();
        }
      } else {
        throw new Error(res.error || 'Failed to complete employee exit.');
      }
    } catch (err: any) {
      const msg = err.error || err.message || String(err);
      setCompleteModalError(msg);
    } finally {
      setIsCompleting(false);
    }
  };

  // Save Clearance Items
  const handleSaveClearance = async () => {
    if (!selectedExitForClearance || !canEdit || isSaving) return;

    setIsSaving(true);
    setModalError(null);

    try {
      // Build items payload
      const payloadItems: SaveClearanceItemPayload[] = CLEARANCE_CONFIG.map((cfg) => {
        const itemState = formState[cfg.key];
        const status: ClearanceSubmitStatus =
          itemState.status === 'pending'
            ? 'not_applicable'
            : itemState.status;

        const payloadItem: SaveClearanceItemPayload = {
          item_key: cfg.key,
          status,
        };

        if (cfg.detailLabel) {
          payloadItem.detail = itemState.detail ? itemState.detail.trim() : '';
        }

        return payloadItem;
      });

      const res = await exitsApi.saveClearance(selectedExitForClearance.id, payloadItems);
      if (res.success) {
        setSuccessToast(`Clearance form saved for ${selectedExitForClearance.full_name}.`);
        setTimeout(() => setSuccessToast(null), 4000);
        setSelectedExitForClearance(null);
        await fetchExits(); // Refresh table counts
      } else {
        throw new Error(res.error || res.message || 'Failed to save clearance form.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModalError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Clearance Items & Download ECF PDF
  const handleSaveAndDownloadPdf = async () => {
    if (!selectedExitForClearance || !canEdit || isSaving || isDownloadingPdf) return;

    setIsSaving(true);
    setIsDownloadingPdf(true);
    setModalError(null);

    let saveSuccessful = false;
    try {
      // Build items payload
      const payloadItems: SaveClearanceItemPayload[] = CLEARANCE_CONFIG.map((cfg) => {
        const itemState = formState[cfg.key];
        const status: ClearanceSubmitStatus =
          itemState.status === 'pending'
            ? 'not_applicable'
            : itemState.status;

        const payloadItem: SaveClearanceItemPayload = {
          item_key: cfg.key,
          status,
        };

        if (cfg.detailLabel) {
          payloadItem.detail = itemState.detail ? itemState.detail.trim() : '';
        }

        return payloadItem;
      });

      const res = await exitsApi.saveClearance(selectedExitForClearance.id, payloadItems);
      if (!res.success) {
        throw new Error(res.error || res.message || 'Failed to save clearance form.');
      }
      saveSuccessful = true;

      // Trigger PDF download
      await exitsApi.downloadExitPdf(
        selectedExitForClearance.id,
        selectedExitForClearance.employee_code
      );

      setSuccessToast(
        `Clearance saved and ECF PDF downloaded for ${selectedExitForClearance.full_name}.`
      );
      setTimeout(() => setSuccessToast(null), 4000);
      setSelectedExitForClearance(null);
      await fetchExits(); // Refresh table so the blue "PDF downloaded" badge appears
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (saveSuccessful) {
        // Keep the saved data and show the PDF download error inside modal
        setModalError(`Clearance was saved, but PDF download encountered an issue: ${msg}`);
        fetchExits(); // Refresh background table to update counts
      } else {
        setModalError(msg);
      }
    } finally {
      setIsSaving(false);
      setIsDownloadingPdf(false);
    }
  };

  const getExitTypeBadge = (type: string) => {
    switch (type) {
      case 'termination':
        return <Badge variant="warning">Termination</Badge>;
      case 'absconding':
        return <Badge variant="error">Absconding</Badge>;
      case 'resignation':
      default:
        return <Badge variant="neutral">Resignation</Badge>;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Table Container (full width) */}
      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Loading exit tracker records...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-slate-800">Failed to load exit records</div>
            <div className="text-xs text-rose-600 max-w-md mx-auto">{error}</div>
            <Button variant="secondary" onClick={fetchExits} leftIcon={<RotateCcw className="w-4 h-4" />}>
              Retry
            </Button>
          </div>
        ) : exits.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-700">No exits in progress</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Active employee exit clearance workflows will appear here once initiated.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs whitespace-nowrap min-w-[960px]">
              {/* Header Row: Light grey background with small semi-bold grey labels */}
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold tracking-wider uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Employee Code</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Last Working Day</th>
                  <th className="py-3 px-4">Clearance</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {exits.map((item) => {
                  const isFullyCleared = item.clearance_filled === 6;
                  const hasStarted = item.clearance_filled > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Employee Code */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {item.employee_code || '—'}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.full_name}
                      </td>

                      {/* Designation */}
                      <td className="py-3 px-4 text-slate-600">
                        {item.designation || '—'}
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4 text-slate-600">
                        {item.branch || '—'}
                      </td>

                      {/* Exit Type */}
                      <td className="py-3 px-4">
                        {getExitTypeBadge(item.exit_type)}
                      </td>

                      {/* Last Working Day */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {item.last_working_date || '—'}
                      </td>

                      {/* Clearance Count & PDF Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold text-xs border ${
                              isFullyCleared
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : hasStarted
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {item.clearance_filled}/6
                          </span>

                          {item.pdf_generated_at && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              PDF downloaded
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button
                            id={`clearance-form-btn-${item.employee_code}`}
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenClearanceModal(item)}
                            leftIcon={<FileText className="w-3.5 h-3.5" />}
                          >
                            Clearance form
                          </Button>

                          <Button
                            id={`complete-exit-btn-${item.employee_code}`}
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={!canEdit || item.clearance_filled < 6}
                            onClick={() => handleOpenCompleteModal(item)}
                            title={
                              !canEdit
                                ? 'Insufficient permissions'
                                : item.clearance_filled < 6
                                ? 'All 6 clearance items must be resolved first'
                                : 'Complete employee exit'
                            }
                          >
                            Complete exit
                          </Button>
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

      {/* Clearance Form Modal */}
      {selectedExitForClearance && (
        <Modal
          isOpen={Boolean(selectedExitForClearance)}
          onClose={handleCloseClearanceModal}
          size="lg"
          title={
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">Employee Clearance Form</div>
                <div className="text-xs text-slate-500 font-normal">
                  Check off returned company assets and departmental clearances
                </div>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                id="modal-cancel-clearance-btn"
                type="button"
                variant="secondary"
                disabled={isSaving || isDownloadingPdf}
                onClick={handleCloseClearanceModal}
              >
                Cancel
              </Button>

              {canEdit && (
                <>
                  <Button
                    id="modal-save-clearance-btn"
                    type="button"
                    variant="secondary"
                    disabled={isSaving || isDownloadingPdf || modalLoading}
                    isLoading={isSaving && !isDownloadingPdf}
                    onClick={handleSaveClearance}
                  >
                    Save
                  </Button>
                  <Button
                    id="modal-save-download-pdf-btn"
                    type="button"
                    variant="primary"
                    disabled={isSaving || isDownloadingPdf || modalLoading}
                    isLoading={isSaving && isDownloadingPdf}
                    onClick={handleSaveAndDownloadPdf}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Save & download PDF
                  </Button>
                </>
              )}
            </div>
          }
        >
          <div className="space-y-5 py-1">
            {/* Server Error Alert inside Modal */}
            {modalError && (
              <div
                id="modal-clearance-error-alert"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-in fade-in"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium leading-relaxed">{modalError}</span>
              </div>
            )}

            {/* Employee Metadata Banner at Top of Modal */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Employee</span>
                <span className="font-semibold text-slate-900">{selectedExitForClearance.full_name}</span>
                <span className="block font-mono text-[11px] text-slate-500">
                  {selectedExitForClearance.employee_code}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Designation</span>
                <span className="font-semibold text-slate-900">{selectedExitForClearance.designation || '—'}</span>
                <span className="block text-[11px] text-slate-500">{selectedExitForClearance.branch}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Exit Type</span>
                <span className="mt-0.5 inline-block">
                  {getExitTypeBadge(selectedExitForClearance.exit_type)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Last Working Day</span>
                <span className="font-mono font-semibold text-slate-900">
                  {selectedExitForClearance.last_working_date || '—'}
                </span>
              </div>
            </div>

            {/* Read-Only Notice for Branch Managers */}
            {!canEdit && (
              <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded-lg flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Read-only clearance record. Only HR Officers and Super Admins can record clearances.</span>
              </div>
            )}

            {/* 6 Clearance Items Form */}
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 bg-white shadow-2xs overflow-hidden">
              {CLEARANCE_CONFIG.map((cfg, index) => {
                const IconComponent = cfg.icon;
                const state = formState[cfg.key];

                return (
                  <div
                    key={cfg.key}
                    className="p-3.5 sm:p-4 hover:bg-slate-50/50 transition-colors space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* Item Title & Icon */}
                      <div className="flex items-center gap-2.5 min-w-[220px]">
                        <span className="w-5 text-slate-400 font-mono text-xs">{index + 1}.</span>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-xs text-slate-900">{cfg.label}</span>
                      </div>

                      {/* 3 Radio Options */}
                      <div className="flex items-center gap-4 text-xs">
                        {/* Option 1: Received */}
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`clearance-${cfg.key}`}
                            value="received"
                            checked={state.status === 'received'}
                            disabled={!canEdit || isSaving}
                            onChange={() =>
                              setFormState((prev) => ({
                                ...prev,
                                [cfg.key]: { ...prev[cfg.key], status: 'received' },
                              }))
                            }
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-slate-800 font-medium">Received</span>
                        </label>

                        {/* Option 2: Still not received */}
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`clearance-${cfg.key}`}
                            value="not_received"
                            checked={state.status === 'not_received'}
                            disabled={!canEdit || isSaving}
                            onChange={() =>
                              setFormState((prev) => ({
                                ...prev,
                                [cfg.key]: { ...prev[cfg.key], status: 'not_received' },
                              }))
                            }
                            className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                          <span className="text-slate-800 font-medium">Still not received</span>
                        </label>

                        {/* Option 3: Not eligible / N/A */}
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`clearance-${cfg.key}`}
                            value="not_applicable"
                            checked={state.status === 'not_applicable'}
                            disabled={!canEdit || isSaving}
                            onChange={() =>
                              setFormState((prev) => ({
                                ...prev,
                                [cfg.key]: { ...prev[cfg.key], status: 'not_applicable' },
                              }))
                            }
                            className="text-slate-600 focus:ring-slate-500 cursor-pointer"
                          />
                          <span className="text-slate-600">{cfg.thirdOptionLabel}</span>
                        </label>
                      </div>
                    </div>

                    {/* Optional Detail Input (only for mobile_sim, company_car, others) */}
                    {cfg.detailLabel && (
                      <div className="pl-7 pt-1">
                        <div className="flex items-center gap-2 max-w-md">
                          <span className="text-[11px] font-medium text-slate-500 w-24 shrink-0">
                            {cfg.detailLabel}:
                          </span>
                          <input
                            type="text"
                            maxLength={200}
                            placeholder={cfg.detailPlaceholder}
                            value={state.detail}
                            disabled={!canEdit || isSaving}
                            onChange={(e) =>
                              setFormState((prev) => ({
                                ...prev,
                                [cfg.key]: { ...prev[cfg.key], detail: e.target.value },
                              }))
                            }
                            className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* Complete Exit Confirmation Modal */}
      {completeTarget && (
        <Modal
          isOpen={Boolean(completeTarget)}
          onClose={handleCloseCompleteModal}
          title="Complete Employee Exit"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {/* Employee info */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                Are you sure you want to complete the exit process for{' '}
                <span className="text-indigo-700 font-bold">
                  {completeTarget.full_name || completeTarget.employee_code}
                </span>
                ?
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                <span>Code: {completeTarget.employee_code}</span>
                <span>•</span>
                <span>Branch: {completeTarget.branch || '—'}</span>
                <span>•</span>
                <span>LWD: {completeTarget.last_working_date || '—'}</span>
              </div>
            </div>

            {completeLoadingDetail ? (
              <div className="py-6 text-center text-slate-500 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Checking clearance status...</span>
              </div>
            ) : (
              <>
                {/* Outstanding items in RED */}
                {(() => {
                  const outstanding = (completeTargetDetail?.clearance_items || []).filter(
                    (ci) => ci.status === 'not_received'
                  );
                  if (outstanding.length === 0) return null;

                  return (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wide">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Still not received ({outstanding.length})</span>
                      </div>
                      <p className="text-xs text-rose-700">
                        The following item(s) are marked as not received and remain outstanding:
                      </p>
                      <ul className="list-disc list-inside text-xs font-semibold text-rose-900 space-y-1 pl-1">
                        {outstanding.map((item) => {
                          const cfg = CLEARANCE_CONFIG.find((c) => c.key === item.item_key);
                          const label = cfg ? cfg.label : item.item_key.replace(/_/g, ' ');
                          return (
                            <li key={item.item_key}>
                              <span>{label}</span>
                              {item.detail && (
                                <span className="font-normal text-rose-700"> — {item.detail}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-[11px] text-rose-600 italic">
                        Completing this exit will permanently acknowledge these outstanding assets.
                      </p>
                    </div>
                  );
                })()}

                {/* Yellow warning if PDF was never downloaded */}
                {(() => {
                  const pdfNeverDownloaded =
                    !completeTarget.pdf_generated_at &&
                    !completeTargetDetail?.pdf_generated_at;

                  if (!pdfNeverDownloaded) return null;

                  return (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">The ECF PDF has not been downloaded yet.</span>
                        <span className="text-amber-800 text-[11px]">
                          We recommend downloading the signed Employee Clearance Form for compliance before archiving.
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <p className="text-xs text-slate-500">
                  Once completed, the employee's status will transition to{' '}
                  <span className="font-semibold text-slate-700">Exited</span>, removing them from the active employee directory and archiving their exit record.
                </p>
              </>
            )}

            {completeModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{completeModalError}</span>
              </div>
            )}

            {/* Modal Buttons: Cancel and Complete exit */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                id="cancel-complete-exit-btn"
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCloseCompleteModal}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                id="confirm-complete-exit-btn"
                type="button"
                variant="primary"
                size="md"
                onClick={handleConfirmCompleteExit}
                disabled={isCompleting || completeLoadingDetail}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Completing exit...</span>
                  </>
                ) : (
                  <span>Complete exit</span>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
