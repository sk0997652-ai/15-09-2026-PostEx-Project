import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  itemName: string;
  itemType?: string;
  contextInfo?: string; // e.g. "Executive Track → Personal Information" or "Zone: North"
  warningMessage?: string; // e.g. "This action will permanently delete this item and affect live candidate forms."
  requireReason?: boolean; // For Form Builder & sensitive live structural changes
  reasonPlaceholder?: string;
  confirmButtonLabel?: string;
  isDeleting?: boolean;
  onConfirm: (reason?: string) => Promise<void> | void;
  onCancel: () => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  title = 'Confirm Permanent Deletion',
  itemName,
  itemType = 'item',
  contextInfo,
  warningMessage,
  requireReason = false,
  reasonPlaceholder = 'Please specify the business reason for this deletion (required for audit logging)...',
  confirmButtonLabel = 'Yes, Delete',
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (requireReason) {
      if (!reason.trim()) {
        setReasonError('A deletion reason is required for compliance and audit logging.');
        return;
      }
      if (reason.trim().length < 5) {
        setReasonError('Please provide a meaningful reason (at least 5 characters).');
        return;
      }
    }
    setReasonError(null);
    await onConfirm(reason.trim());
  };

  return (
    <div
      id="delete-confirmation-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        id="delete-confirmation-modal-card"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-modal-title" className="text-sm font-bold text-slate-900">
                {title}
              </h3>
              <p className="text-xs text-rose-700 font-medium mt-0.5">Destructive action requires confirmation</p>
            </div>
          </div>
          <button
            id="delete-modal-close-btn"
            onClick={onCancel}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
              "{itemName}"
            </strong>{' '}
            {itemType ? `(${itemType})` : ''}?
            {contextInfo && (
              <div className="mt-2 text-[11px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                Location: <span className="text-slate-800 font-semibold">{contextInfo}</span>
              </div>
            )}
          </div>

          {warningMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">{warningMessage}</div>
            </div>
          )}

          {requireReason && (
            <div className="space-y-1.5 pt-1">
              <label htmlFor="delete-reason-input" className="block text-xs font-bold text-slate-800">
                Audit Reason for Deletion <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="delete-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder={reasonPlaceholder}
                disabled={isDeleting}
                className={`w-full text-xs p-2.5 rounded-xl border ${
                  reasonError ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' : 'border-slate-300'
                } focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none transition-all`}
              />
              {reasonError ? (
                <p className="text-[11px] text-rose-600 font-medium">{reasonError}</p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  This note will be permanently logged with your admin ID in the system audit log.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            id="delete-modal-cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="delete-modal-confirm-btn"
            type="button"
            onClick={handleConfirmClick}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : confirmButtonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
