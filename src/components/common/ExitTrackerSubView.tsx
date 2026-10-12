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
import {
  Badge,
  Button,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui';

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
      const res = await exitsApi.getExits();
      if (res.success) {
        setExits(res.exits || []);
      } else {
        throw new Error(res.error || 'Failed to load exit tracker records.');
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

  // Open Clearance Modal
  const handleOpenClearanceModal = async (item: ExitListItem) => {
    setModalLoading(true);
    setModalError(null);
    try {
      const res = await exitsApi.getExitById(item.id);
      if (res.success && res.exit) {
        setSelectedExitForClearance(res.exit);
        const newFormState: Record<
          ExitItemKey,
          { status: ClearanceSubmitStatus | 'pending'; detail: string }
        > = {
          office_files: { status: 'pending', detail: '' },
          keys: { status: 'pending', detail: '' },
          mobile_sim: { status: 'pending', detail: '' },
          id_card: { status: 'pending', detail: '' },
          company_car: { status: 'pending', detail: '' },
          others: { status: 'pending', detail: '' },
        };

        if (res.exit.clearance_items && Array.isArray(res.exit.clearance_items)) {
          res.exit.clearance_items.forEach((ci) => {
            if (newFormState[ci.item_key]) {
              newFormState[ci.item_key] = {
                status: ci.status as ClearanceSubmitStatus,
                detail: ci.detail || '',
              };
            }
          });
        }
        setFormState(newFormState);
      } else {
        throw new Error(res.error || 'Failed to load employee clearance details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseClearanceModal = () => {
    if (isSaving || isDownloadingPdf) return;
    setSelectedExitForClearance(null);
    setModalError(null);
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
        throw new Error(res.error || 'Failed to load clearance details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompleteModalError(msg);
    } finally {
      setCompleteLoadingDetail(false);
    }
  };

  const handleCloseCompleteModal = () => {
    if (isCompleting) return;
    setCompleteTarget(null);
    setCompleteTargetDetail(null);
    setCompleteModalError(null);
  };

  const handleConfirmCompleteExit = async () => {
    if (!completeTarget || !canEdit || isCompleting) return;

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
        await fetchExits();
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

      await exitsApi.downloadExitPdf(
        selectedExitForClearance.id,
        selectedExitForClearance.employee_code
      );

      setSuccessToast(
        `Clearance saved and ECF PDF downloaded for ${selectedExitForClearance.full_name}.`
      );
      setTimeout(() => setSuccessToast(null), 4000);
      setSelectedExitForClearance(null);
      await fetchExits();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (saveSuccessful) {
        setModalError(`Clearance was saved, but PDF download encountered an issue: ${msg}`);
        fetchExits();
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
    <div className="w-full space-y-3">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-body rounded-[6px] flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer text-caption"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Table Container using shared Table */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white border border-slate-200 rounded-[6px]">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-caption font-medium">Loading exit tracker records...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center space-y-2 bg-rose-50/50 border border-rose-200 rounded-[6px]">
          <div className="w-8 h-8 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-card-heading font-semibold text-slate-800">Failed to load exit records</div>
          <div className="text-caption text-rose-600 max-w-md mx-auto">{error}</div>
          <Button variant="secondary" size="sm" onClick={fetchExits} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            Retry
          </Button>
        </div>
      ) : exits.length === 0 ? (
        <div className="py-16 text-center space-y-2 bg-white border border-slate-200 rounded-[6px]">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div className="text-card-heading font-semibold text-slate-700">No exits in progress</div>
          <p className="text-caption text-slate-500 max-w-sm mx-auto">
            Active employee exit clearance workflows will appear here once initiated.
          </p>
        </div>
      ) : (
        <Table scroll="x">
          <TableHeader scroll="x">
            <TableRow scroll="x">
              <TableHead>Employee Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Last Working Day</TableHead>
              <TableHead>Clearance</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody scroll="x">
            {exits.map((item) => {
              const isFullyCleared = item.clearance_filled === 6;
              const hasStarted = item.clearance_filled > 0;

              return (
                <TableRow key={item.id} scroll="x">
                  {/* Employee Code */}
                  <TableCell className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {item.employee_code || '—'}
                  </TableCell>

                  {/* Name */}
                  <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                    {item.full_name}
                  </TableCell>

                  {/* Designation */}
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {item.designation || '—'}
                  </TableCell>

                  {/* Branch */}
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {item.branch || '—'}
                  </TableCell>

                  {/* Exit Type */}
                  <TableCell className="whitespace-nowrap">
                    {getExitTypeBadge(item.exit_type)}
                  </TableCell>

                  {/* Last Working Day */}
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {item.last_working_date || '—'}
                  </TableCell>

                  {/* Clearance Count & PDF Badge */}
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-semibold text-tag border ${
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
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-tag font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                          PDF downloaded
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Action Buttons */}
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Clearance Form Modal */}
      {selectedExitForClearance && (
        <Modal
          isOpen={Boolean(selectedExitForClearance)}
          onClose={handleCloseClearanceModal}
          size="lg"
          title={
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[6px] bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <FileCheck2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-card-heading font-bold text-slate-900">Employee Clearance Form</div>
                <div className="text-caption text-slate-500 font-normal">
                  Check off returned company assets and departmental clearances
                </div>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                id="modal-cancel-clearance-btn"
                type="button"
                variant="secondary"
                size="sm"
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
                    size="sm"
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
                    size="sm"
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
          <div className="space-y-3 py-1">
            {/* Server Error Alert inside Modal */}
            {modalError && (
              <div
                id="modal-clearance-error-alert"
                className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-caption rounded-[6px] flex items-start gap-2 animate-in fade-in"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium leading-relaxed">{modalError}</span>
              </div>
            )}

            {/* Employee Metadata Banner at Top of Modal */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-body">
              <div>
                <span className="text-slate-400 font-medium block text-caption">Employee</span>
                <span className="font-semibold text-slate-900">{selectedExitForClearance.full_name}</span>
                <span className="block font-mono text-caption text-slate-500">
                  {selectedExitForClearance.employee_code}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block text-caption">Designation</span>
                <span className="font-semibold text-slate-900">{selectedExitForClearance.designation || '—'}</span>
                <span className="block text-caption text-slate-500">{selectedExitForClearance.branch}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block text-caption">Exit Type</span>
                <span className="mt-0.5 inline-block">
                  {getExitTypeBadge(selectedExitForClearance.exit_type)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block text-caption">Last Working Day</span>
                <span className="font-semibold text-slate-900">
                  {selectedExitForClearance.last_working_date || '—'}
                </span>
              </div>
            </div>

            {/* Read-Only Notice for Branch Managers */}
            {!canEdit && (
              <div className="p-2 bg-slate-100 border border-slate-200 text-slate-600 text-caption rounded-[6px] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Read-only clearance record. Only HR Officers and Super Admins can record clearances.</span>
              </div>
            )}

            {/* 6 Clearance Items Form */}
            <div className="border border-slate-200 rounded-[6px] divide-y divide-slate-200 bg-white shadow-2xs overflow-hidden">
              {CLEARANCE_CONFIG.map((cfg, index) => {
                const IconComponent = cfg.icon;
                const state = formState[cfg.key];

                return (
                  <div
                    key={cfg.key}
                    className="p-2.5 sm:p-3 hover:bg-slate-50/50 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Item Title & Icon */}
                      <div className="flex items-center gap-2 min-w-[200px]">
                        <span className="w-4 text-slate-400 text-caption">{index + 1}.</span>
                        <div className="w-6 h-6 rounded-[4px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <IconComponent className="w-3 h-3" />
                        </div>
                        <span className="font-semibold text-body text-slate-900">{cfg.label}</span>
                      </div>

                      {/* 3 Radio Options */}
                      <div className="flex items-center gap-3.5 text-body">
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
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
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
                            className="text-rose-600 focus:ring-rose-500 cursor-pointer w-3.5 h-3.5"
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
                            className="text-slate-600 focus:ring-slate-500 cursor-pointer w-3.5 h-3.5"
                          />
                          <span className="text-slate-600">{cfg.thirdOptionLabel}</span>
                        </label>
                      </div>
                    </div>

                    {/* Optional Detail Input (only for mobile_sim, company_car, others) */}
                    {cfg.detailLabel && (
                      <div className="pl-6 pt-0.5">
                        <div className="flex items-center gap-2 max-w-md">
                          <span className="text-caption font-medium text-slate-500 w-20 shrink-0">
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
                            className="flex-1 px-2 h-7 text-body border border-slate-300 rounded-[6px] bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
          size="md"
        >
          <div className="space-y-3">
            {/* Employee info */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] space-y-1">
              <p className="text-body font-semibold text-slate-900">
                Are you sure you want to complete the exit process for{' '}
                <span className="text-indigo-700 font-bold">
                  {completeTarget.full_name || completeTarget.employee_code}
                </span>
                ?
              </p>
              <div className="flex flex-wrap items-center gap-2 text-caption text-slate-500">
                <span>Code: <span className="font-mono">{completeTarget.employee_code}</span></span>
                <span>•</span>
                <span>Branch: {completeTarget.branch || '—'}</span>
                <span>•</span>
                <span>LWD: {completeTarget.last_working_date || '—'}</span>
              </div>
            </div>

            {completeLoadingDetail ? (
              <div className="py-6 text-center text-slate-500 flex items-center justify-center gap-2 text-body">
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
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-[6px] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-caption font-bold text-rose-800 uppercase tracking-wide">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Still not received ({outstanding.length})</span>
                      </div>
                      <p className="text-caption text-rose-700">
                        The following item(s) are marked as not received and remain outstanding:
                      </p>
                      <ul className="list-disc list-inside text-caption font-semibold text-rose-900 space-y-0.5 pl-1">
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
                      <p className="text-tag text-rose-600 italic">
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
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-[6px] flex items-start gap-2 text-amber-900 text-caption">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">The ECF PDF has not been downloaded yet.</span>
                        <span className="text-amber-800 text-tag">
                          We recommend downloading the signed Employee Clearance Form for compliance before archiving.
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <p className="text-caption text-slate-500">
                  Once completed, the employee's status will transition to{' '}
                  <span className="font-semibold text-slate-700">Exited</span>, removing them from the active employee directory and archiving their exit record.
                </p>
              </>
            )}

            {completeModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-800 text-caption flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{completeModalError}</span>
              </div>
            )}

            {/* Modal Buttons: Cancel and Complete exit */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                id="cancel-complete-exit-btn"
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCloseCompleteModal}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                id="confirm-complete-exit-btn"
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmCompleteExit}
                disabled={isCompleting || completeLoadingDetail}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
