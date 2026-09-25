import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';
import { Button, Textarea } from '../ui';

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
  reasonPlaceholder = 'Please explain why this item is being deleted...',
  confirmButtonLabel = 'Delete Permanently',
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (requireReason && !reason.trim()) {
      setReasonError('Please provide a brief justification for audit logging purposes.');
      return;
    }
    await onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-modal-title" className="text-sm font-bold text-slate-900">
                {title}
              </h3>
              <p className="text-xs text-rose-700 font-medium mt-0.5">Destructive action requires confirmation</p>
            </div>
          </div>
          <Button
            id="delete-modal-close-btn"
            variant="ghost"
            size="small"
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 h-auto text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
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
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">{warningMessage}</div>
            </div>
          )}

          {requireReason && (
            <div className="space-y-1.5 pt-1">
              <Textarea
                id="delete-reason-input"
                label="Audit Reason for Deletion"
                required
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder={reasonPlaceholder}
                disabled={isDeleting}
                error={reasonError || undefined}
                helperText={
                  !reasonError
                    ? 'This note will be permanently logged with your admin ID in the system audit log.'
                    : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button
            id="delete-modal-cancel-btn"
            type="button"
            variant="secondary"
            size="medium"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            id="delete-modal-confirm-btn"
            type="button"
            variant="danger"
            size="medium"
            onClick={handleConfirmClick}
            disabled={isDeleting}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            {isDeleting ? 'Deleting...' : confirmButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
